import {
  PUMP_CURVE_DEFAULTS,
  ScoreWeights,
  type BattleParams,
  type CurveParams,
  type FundingMap,
  type Trade,
} from "@battle/shared";
import { z } from "zod";
import type { Db } from "./db";

/** Lecture des battles et de leurs données, et passage au format du calcul (packages/shared). */

export type SideRow = {
  id: string;
  side: "A" | "B";
  name: string;
  ticker: string;
  description: string | null;
  mint: string | null;
  creator_id: string | null;
  creator_wallet: string | null;
};

export type BattleRow = {
  id: string;
  theme: string;
  status: string;
  mode: string;
  duration_minutes: number;
  score_mode: "volume" | "holders" | "market_cap" | "composite";
  score_weights: unknown;
  formula_version: number;
  initial_buy_lamports: string;
  anti_cheat_rules: unknown;
  market_cap_window_seconds: number;
  curve_params: unknown;
  started_at: Date | null;
  ends_at: Date | null;
};

export async function loadBattle(
  db: Db,
  id: string,
): Promise<{ battle: BattleRow; sides: SideRow[] } | null> {
  const [battle] = await db<BattleRow[]>`
    select id, theme, status, mode, duration_minutes, score_mode, score_weights, formula_version,
           initial_buy_lamports::text, anti_cheat_rules, market_cap_window_seconds, curve_params,
           started_at, ends_at
    from public.battles where id = ${id}`;
  if (!battle) return null;
  const sides = await db<SideRow[]>`
    select s.id, s.side, s.name, s.ticker, s.description, s.mint, s.creator_id, p.wallet as creator_wallet
    from public.battle_sides s left join public.profiles p on p.id = s.creator_id
    where s.battle_id = ${id} order by s.side`;
  return { battle, sides };
}

const big = z.union([z.string(), z.number()]).transform((v) => BigInt(v));
const Rules = z.object({
  maxWalletVolumeLamports: big,
  maxBuysPerWallet: z.number().int().positive(),
  washWindowSeconds: z.number().int().nonnegative(),
  minHolderTokens: big,
  minClusterSize: z.number().int().min(2),
});
const Curve = z.object({
  totalSupply: big,
  initialVirtualSolReserves: big,
  initialVirtualTokenReserves: big,
});

/** Sources de financement ignorées (plateformes d'échange), réglage public `anti_cheat`. */
export async function ignoredFunders(db: Db): Promise<string[]> {
  const [row] = await db<{ value: { ignoredFunders?: unknown } }[]>`
    select value from public.settings where key = 'anti_cheat'`;
  const list = row?.value.ignoredFunders;
  return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
}

/** Paramètres du calcul d'une battle lancée (`endsAt` : fin, ou « maintenant » en direct). */
export function toParams(
  battle: BattleRow,
  sides: SideRow[],
  ignored: string[],
  endsAt: number,
): BattleParams {
  if (!battle.started_at) throw new Error("battle non démarrée");
  const curve: CurveParams = battle.curve_params
    ? Curve.parse(battle.curve_params)
    : PUMP_CURVE_DEFAULTS;
  return {
    battleId: battle.id,
    formulaVersion: 1,
    scoreMode: battle.score_mode,
    weights: ScoreWeights.parse(battle.score_weights),
    startedAt: Math.floor(battle.started_at.getTime() / 1000),
    endsAt,
    marketCapWindowSeconds: battle.market_cap_window_seconds,
    creatorWallets: sides.map((s) => s.creator_wallet).filter((w): w is string => w !== null),
    ignoredFunders: ignored,
    rules: Rules.parse(battle.anti_cheat_rules),
    curve: { A: curve, B: curve },
  };
}

type TradeRow = {
  signature: string;
  ix_index: number;
  slot: string;
  block_time: Date;
  wallet: string;
  side: "A" | "B";
  is_buy: boolean;
  sol_lamports: string;
  token_amount: string;
  virtual_sol_reserves: string;
  virtual_token_reserves: string;
};

export async function loadTrades(db: Db, battleId: string): Promise<Trade[]> {
  const rows = await db<TradeRow[]>`
    select signature, ix_index, slot::text, block_time, wallet, side, is_buy, sol_lamports::text,
           token_amount::text, virtual_sol_reserves::text, virtual_token_reserves::text
    from public.trades where battle_id = ${battleId}`;
  return rows.map((r) => ({
    signature: r.signature,
    ixIndex: r.ix_index,
    slot: Number(r.slot),
    blockTime: Math.floor(r.block_time.getTime() / 1000),
    wallet: r.wallet,
    side: r.side,
    isBuy: r.is_buy,
    solLamports: BigInt(r.sol_lamports),
    tokenAmount: BigInt(r.token_amount),
    virtualSolReserves: BigInt(r.virtual_sol_reserves),
    virtualTokenReserves: BigInt(r.virtual_token_reserves),
  }));
}

export async function loadFunding(db: Db, wallets: string[]): Promise<FundingMap> {
  if (wallets.length === 0) return {};
  const rows = await db<{ wallet: string; funder: string | null }[]>`
    select wallet, funder from public.wallet_funders where wallet = any(${wallets})`;
  const map: FundingMap = {};
  for (const r of rows) if (r.funder) map[r.wallet] = r.funder;
  return map;
}
