import { metadataUri, moderateText } from "@battle/shared";
import { fetchCurveParams, validateLaunchPair } from "@battle/shared/launch";
import type { Connection } from "@solana/web3.js";
import { loadBattle, type SideRow } from "../battles";
import { sendNonceTx } from "../chain";
import type { Db } from "../db";
import type { WorkerEnv } from "../env";
import { log } from "../log";
import { notifyWatchers } from "../push";

/**
 * Lancement simultané à l'heure H. Pour chaque battle dont le lobby est fini :
 * 1. la battle est réservée (statut « launching ») pour qu'un seul worker la traite ;
 * 2. contenu revérifié (filtre), transactions revérifiées (programmes, montant, mint, nonce,
 *    payeur), achats initiaux identiques ;
 * 3. devnet : les deux créations partent ensemble, puis les deux achats initiaux.
 *    Mainnet : il faudra un bundle Jito (les quatre ou aucune) ; refusé tant qu'il n'existe pas.
 * Toute anomalie annule la battle avec une raison publique.
 */

type LaunchRow = {
  signed_tx: string;
  nonce_account: string;
  buy_tx: string | null;
  buy_nonce_account: string | null;
};

async function cancel(db: Db, battleId: string, reason: string) {
  await db`update public.battles set status = 'cancelled', cancel_reason = ${reason} where id = ${battleId}`;
  log("launch", `battle ${battleId} annulée : ${reason}`);
}

export async function runLaunches(db: Db, connection: Connection, env: WorkerEnv): Promise<void> {
  // Réservation atomique : une battle due passe en « launching » une seule fois.
  const due = await db<{ id: string }[]>`
    update public.battles set status = 'launching'
    where id in (
      select id from public.battles
      where status = 'lobby' and launch_at <= now()
      order by launch_at limit 3
      for update skip locked
    )
    returning id`;
  for (const { id } of due) {
    try {
      await launchOne(db, connection, env, id);
    } catch (e) {
      await cancel(db, id, "launch_error");
      log("launch", `erreur ${id} : ${e instanceof Error ? e.message.slice(0, 200) : "?"}`);
    }
  }
}

async function launchOne(db: Db, connection: Connection, env: WorkerEnv, battleId: string) {
  if (env.SOLANA_CLUSTER !== "devnet") {
    // Garde-fou : sur mainnet, les quatre transactions doivent partir en un bundle Jito atomique.
    return cancel(db, battleId, "mainnet_launch_not_available");
  }
  const loaded = await loadBattle(db, battleId);
  if (!loaded) return;
  const { battle, sides } = loaded;
  if (sides.length !== 2) return cancel(db, battleId, "missing_side");

  // Contenu revérifié : quelqu'un a pu appeler la base sans passer par le site.
  const content = moderateText(
    battle.theme,
    ...sides.flatMap((s) => [s.name, s.ticker, s.description]),
  );
  if (!content.ok) return cancel(db, battleId, "content_refused");

  const prepared: { side: SideRow; tx: LaunchRow; tokenAmount: bigint }[] = [];
  for (const side of sides) {
    const [tx] = await db<LaunchRow[]>`
      select signed_tx, nonce_account, buy_tx, buy_nonce_account from public.launch_txs where side_id = ${side.id}`;
    if (!tx || !tx.buy_tx || !tx.buy_nonce_account || !side.mint || !side.creator_wallet) {
      return cancel(db, battleId, "not_signed");
    }
    const check = validateLaunchPair(tx.signed_tx, tx.buy_tx, {
      creator: side.creator_wallet,
      mint: side.mint,
      createNonceAccount: tx.nonce_account,
      buyNonceAccount: tx.buy_nonce_account,
      name: side.name,
      symbol: side.ticker,
      uri: metadataUri(env.APP_URL, side.id),
      initialBuyLamports: BigInt(battle.initial_buy_lamports),
    });
    if (!check.ok) return cancel(db, battleId, `invalid_launch_tx:${side.side}:${check.reason}`);
    prepared.push({ side, tx, tokenAmount: check.tokenAmount });
  }
  // Même achat initial des deux côtés (les courbes partent du même point).
  if (prepared[0]?.tokenAmount !== prepared[1]?.tokenAmount)
    return cancel(db, battleId, "unequal_initial_buy");

  const curve = await fetchCurveParams(connection);
  await db`update public.battles set curve_params = ${db.json({
    totalSupply: curve.totalSupply.toString(),
    initialVirtualSolReserves: curve.initialVirtualSolReserves.toString(),
    initialVirtualTokenReserves: curve.initialVirtualTokenReserves.toString(),
  })} where id = ${battleId}`;

  // 1. Les deux créations, en même temps.
  const creates = await Promise.all(
    prepared.map((p) => sendNonceTx(connection, p.tx.signed_tx, p.tx.nonce_account)),
  );
  for (const [i, r] of creates.entries()) {
    const p = prepared[i];
    if (!p) continue;
    await db`update public.launch_txs set submitted_at = now(), status = ${r.ok ? "confirmed" : "failed"},
             error = ${r.ok ? null : r.error} where side_id = ${p.side.id}`;
  }
  if (creates.some((r) => !r.ok)) return cancel(db, battleId, "launch_failed");

  // 2. Les deux achats initiaux, en même temps. Un échec ne bloque pas la battle (noté).
  const buys = await Promise.all(
    prepared.map((p) => sendNonceTx(connection, p.tx.buy_tx ?? "", p.tx.buy_nonce_account ?? "")),
  );
  for (const [i, r] of buys.entries()) {
    const p = prepared[i];
    if (p && !r.ok) {
      await db`update public.launch_txs set error = ${`initial_buy:${r.error}`} where side_id = ${p.side.id}`;
      log("launch", `achat initial ${p.side.side} échoué : ${r.error}`);
    }
  }

  // 3. Départ réel : quand les deux créations sont confirmées (heure du bloc le plus tardif).
  const times: number[] = [];
  for (const [i, r] of creates.entries()) {
    const p = prepared[i];
    if (!p || !r.ok) continue;
    const tx = await connection.getTransaction(r.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 255,
    });
    times.push(tx?.blockTime ?? Math.floor(Date.now() / 1000));
    await db`update public.battle_sides set launch_signature = ${r.signature}, launch_slot = ${tx?.slot ?? null}
             where id = ${p.side.id}`;
  }
  const startedAt = new Date(Math.max(...times) * 1000);
  const endsAt = new Date(startedAt.getTime() + battle.duration_minutes * 60_000);
  await db.begin(async (tx) => {
    await tx`update public.battles set status = 'live', started_at = ${startedAt}, ends_at = ${endsAt}
             where id = ${battleId}`;
    await tx`insert into public.side_stats (battle_id, side) values (${battleId}, 'A'), (${battleId}, 'B')
             on conflict do nothing`;
  });
  log("launch", `battle ${battleId} en direct jusqu'à ${endsAt.toISOString()}`);
  const [a, b] = [sides.find((s) => s.side === "A")?.name, sides.find((s) => s.side === "B")?.name];
  await notifyWatchers(db, battleId, {
    title: `${a} vs ${b} is live`,
    body: battle.theme,
    url: `${env.APP_URL.replace(/\/+$/, "")}/en/battle/${battleId}`,
  });
}
