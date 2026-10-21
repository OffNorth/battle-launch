import { computeBattle, PPM, type BattleResult, type Trade } from "@battle/shared";
import type { Connection } from "@solana/web3.js";
import { ignoredFunders, loadBattle, loadFunding, loadTrades, toParams } from "../battles";
import { firstFunder, newCurveSignatures, tradesFromTransaction, type ChainTrade } from "../chain";
import type { Db } from "../db";
import { log } from "../log";

/**
 * Suivi en direct : pour chaque battle en cours, lecture des nouveaux trades sur la chaîne,
 * financement des nouveaux wallets (anti-triche), puis recalcul des stats, du score, des bougies
 * et des wallets écartés. Le site reçoit les changements en temps réel (Supabase Realtime).
 */

/** Nouveaux wallets dont on cherche la source de financement à chaque passage (limite le RPC). */
const FUNDERS_PER_TICK = 10;

/** Prix d'une bougie : lamports pour un million de tokens entiers (lisible même sur la petite courbe du devnet). */
export function candlePrice(vSol: bigint, vTok: bigint): bigint {
  return vTok > 0n ? (vSol * 1_000_000_000_000n) / vTok : 0n;
}

export async function runIndexer(db: Db, connection: Connection): Promise<void> {
  const live = await db<{ id: string }[]>`select id from public.battles where status = 'live'`;
  for (const { id } of live) {
    try {
      await indexBattle(db, connection, id, Math.floor(Date.now() / 1000));
    } catch (e) {
      log("index", `battle ${id} : ${e instanceof Error ? e.message.slice(0, 200) : "?"}`);
    }
  }
}

/** Lit les trades manquants d'une battle et met ses stats à jour (`now` : heure du calcul). */
export async function indexBattle(
  db: Db,
  connection: Connection,
  battleId: string,
  now: number,
): Promise<BattleResult | null> {
  const loaded = await loadBattle(db, battleId);
  if (!loaded?.battle.started_at || !loaded.battle.ends_at) return null;
  const { battle, sides } = loaded;
  const battleEnd = Math.floor(loaded.battle.ends_at.getTime() / 1000);

  const known = new Set(
    (
      await db<
        { signature: string }[]
      >`select distinct signature from public.trades where battle_id = ${battleId}`
    ).map((r) => r.signature),
  );
  for (const side of sides) {
    if (!side.mint) continue;
    const signatures = await newCurveSignatures(connection, side.mint, (s) => known.has(s));
    const found: ChainTrade[] = [];
    for (let i = 0; i < signatures.length; i += 50) {
      const txs = await connection.getTransactions(signatures.slice(i, i + 50), {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 255,
      });
      for (const tx of txs) if (tx) found.push(...tradesFromTransaction(tx, side.mint));
    }
    if (found.length > 0) {
      await db`insert into public.trades ${db(
        found.map((t) => ({
          battle_id: battleId,
          side: side.side,
          signature: t.signature,
          ix_index: t.ixIndex,
          slot: t.slot,
          block_time: new Date(t.blockTime * 1000),
          wallet: t.wallet,
          is_buy: t.isBuy,
          sol_lamports: t.solLamports.toString(),
          token_amount: t.tokenAmount.toString(),
          virtual_sol_reserves: t.virtualSolReserves.toString(),
          virtual_token_reserves: t.virtualTokenReserves.toString(),
        })),
      )} on conflict (signature, ix_index) do nothing`;
    }
  }

  const trades = await loadTrades(db, battleId);
  const wallets = [...new Set(trades.map((t) => t.wallet))];
  const unchecked = await db<{ wallet: string }[]>`
    select w as wallet from unnest(${wallets}::text[]) as w
    where not exists (select 1 from public.wallet_funders f where f.wallet = w) limit ${FUNDERS_PER_TICK}`;
  for (const { wallet } of unchecked) {
    const funder = await firstFunder(connection, wallet).catch(() => null);
    await db`insert into public.wallet_funders (wallet, funder) values (${wallet}, ${funder})
             on conflict (wallet) do update set funder = excluded.funder, checked_at = now()`;
  }

  const endsAt = Math.min(now, battleEnd);
  const params = toParams(battle, sides, await ignoredFunders(db), endsAt);
  const result = computeBattle(params, trades, await loadFunding(db, wallets));
  await saveResult(db, battleId, result, trades);
  return result;
}

/** Enregistre stats, bougies et wallets écartés (une transaction). */
export async function saveResult(db: Db, battleId: string, result: BattleResult, trades: Trade[]) {
  await db.begin(async (tx) => {
    for (const side of ["A", "B"] as const) {
      const m = result.metrics[side];
      const score = (result.scorePpm[side] / PPM).toFixed(6);
      await tx`
        insert into public.side_stats (battle_id, side, volume_lamports, buys, sells, unique_holders, market_cap_lamports, score, updated_at)
        values (${battleId}, ${side}, ${m.volumeLamports.toString()}, ${m.buys}, ${m.rawSells}, ${m.holders},
                ${m.marketCapLamports.toString()}, ${score}, now())
        on conflict (battle_id, side) do update set
          volume_lamports = excluded.volume_lamports, buys = excluded.buys, sells = excluded.sells,
          unique_holders = excluded.unique_holders, market_cap_lamports = excluded.market_cap_lamports,
          score = excluded.score, updated_at = now()`;
    }
    const candles = buildCandles(trades);
    if (candles.length > 0) {
      await tx`insert into public.candles ${tx(
        candles.map((c) => ({ ...c, battle_id: battleId })),
      )} on conflict (battle_id, side, bucket) do update set
        open_price = excluded.open_price, high_price = excluded.high_price, low_price = excluded.low_price,
        close_price = excluded.close_price, volume_lamports = excluded.volume_lamports`;
    }
    await tx`delete from public.wallet_flags where battle_id = ${battleId}`;
    if (result.flags.length > 0) {
      await tx`insert into public.wallet_flags ${tx(
        result.flags.map((f) => ({
          battle_id: battleId,
          wallet: f.wallet,
          reason: f.reason,
          details: tx.json({ detail: f.detail }),
        })),
      )} on conflict do nothing`;
    }
  });
}

type Candle = {
  side: "A" | "B";
  bucket: Date;
  open_price: string;
  high_price: string;
  low_price: string;
  close_price: string;
  volume_lamports: string;
};

/** Bougies d'une minute par camp, à partir de tous les trades (prix : voir candlePrice). */
export function buildCandles(trades: Trade[]): Candle[] {
  const sorted = [...trades].sort(
    (a, b) => a.blockTime - b.blockTime || a.slot - b.slot || a.ixIndex - b.ixIndex,
  );
  const map = new Map<
    string,
    { side: "A" | "B"; bucket: number; o: bigint; h: bigint; l: bigint; c: bigint; v: bigint }
  >();
  for (const t of sorted) {
    const bucket = Math.floor(t.blockTime / 60) * 60;
    const price = candlePrice(t.virtualSolReserves, t.virtualTokenReserves);
    const key = `${t.side}:${bucket}`;
    const c = map.get(key);
    if (!c) {
      map.set(key, {
        side: t.side,
        bucket,
        o: price,
        h: price,
        l: price,
        c: price,
        v: t.solLamports,
      });
    } else {
      if (price > c.h) c.h = price;
      if (price < c.l) c.l = price;
      c.c = price;
      c.v += t.solLamports;
    }
  }
  return [...map.values()].map((c) => ({
    side: c.side,
    bucket: new Date(c.bucket * 1000),
    open_price: c.o.toString(),
    high_price: c.h.toString(),
    low_price: c.l.toString(),
    close_price: c.c.toString(),
    volume_lamports: c.v.toString(),
  }));
}
