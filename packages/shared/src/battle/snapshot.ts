import { z } from "zod";
import { compareTrades } from "./anti-cheat";
import { computeBattle } from "./score";
import {
  ScoreMode,
  ScoreWeights,
  type BattleParams,
  type BattleResult,
  type FundingMap,
  type Trade,
} from "./types";

/**
 * Snapshot vérifiable : JSON CANONIQUE (clés triées, bigint en chaînes décimales, entiers seulement)
 * de tout ce qui a servi au calcul, puis son SHA-256. N'importe qui peut relire le snapshot,
 * refaire le calcul avec le même code et retrouver le même gagnant et le même hash.
 */

export const SNAPSHOT_KIND = "battle-launch/snapshot";

type CanonicalValue =
  string | number | boolean | null | CanonicalValue[] | { [k: string]: CanonicalValue };

/** Forme canonique : refuse les flottants (un flottant pourrait s'écrire différemment ailleurs). */
export function toCanonical(value: unknown): CanonicalValue {
  if (value === null) return null;
  switch (typeof value) {
    case "bigint":
      return value.toString();
    case "number":
      if (!Number.isSafeInteger(value))
        throw new Error(`nombre non entier dans le snapshot : ${value}`);
      return value;
    case "string":
    case "boolean":
      return value;
    case "object": {
      if (Array.isArray(value)) return value.map(toCanonical);
      const out: { [k: string]: CanonicalValue } = {};
      for (const key of Object.keys(value).sort()) {
        const v = (value as Record<string, unknown>)[key];
        if (v !== undefined) out[key] = toCanonical(v);
      }
      return out;
    }
    default:
      throw new Error(`type non accepté dans le snapshot : ${typeof value}`);
  }
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(toCanonical(value));
}

/** SHA-256 en hexadécimal (Web Crypto : marche dans le navigateur et dans Node). */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── Relecture d'un snapshot (chaînes -> bigint), validée par Zod ────────────────────────────
const big = z
  .string()
  .regex(/^-?\d+$/)
  .transform((s) => BigInt(s));
const wallet = z.string().min(32).max(44);
const side = z.enum(["A", "B"]);
const int = z.number().int();

const CurveSchema = z.object({
  initialVirtualSolReserves: big,
  initialVirtualTokenReserves: big,
  totalSupply: big,
});

const ParamsSchema = z.object({
  battleId: z.string(),
  formulaVersion: z.literal(1),
  scoreMode: ScoreMode,
  weights: ScoreWeights,
  startedAt: int,
  endsAt: int,
  marketCapWindowSeconds: int.positive(),
  creatorWallets: z.array(wallet),
  ignoredFunders: z.array(wallet),
  rules: z.object({
    maxWalletVolumeLamports: big,
    maxBuysPerWallet: int.positive(),
    washWindowSeconds: int.nonnegative(),
    minHolderTokens: big,
    minClusterSize: int.min(2),
  }),
  curve: z.object({ A: CurveSchema, B: CurveSchema }),
});

const TradeSchema = z.object({
  signature: z.string(),
  ixIndex: int.nonnegative(),
  slot: int.nonnegative(),
  blockTime: int,
  wallet,
  side,
  isBuy: z.boolean(),
  solLamports: big,
  tokenAmount: big,
  virtualSolReserves: big,
  virtualTokenReserves: big,
});

export const SnapshotPayloadSchema = z.object({
  kind: z.literal(SNAPSHOT_KIND),
  params: ParamsSchema,
  funding: z.record(z.string(), wallet),
  trades: z.array(TradeSchema),
  result: z.unknown(),
});

export type Snapshot = {
  /** Objet à stocker tel quel (jsonb) : déjà sous forme canonique. */
  payload: CanonicalValue;
  /** Texte exact qui est haché. */
  json: string;
  sha256: string;
  result: BattleResult;
};

/** Fige une battle : calcul final, JSON canonique, hash. */
export async function buildSnapshot(
  params: BattleParams,
  trades: Trade[],
  funding: FundingMap,
): Promise<Snapshot> {
  const sorted = [...trades].sort(compareTrades);
  // Seuls les financements des wallets présents servent : on n'en publie pas plus.
  const used: FundingMap = {};
  for (const t of sorted) {
    const f = funding[t.wallet];
    if (f !== undefined) used[t.wallet] = f;
  }
  const result = computeBattle(params, sorted, used);
  const payload = toCanonical({
    kind: SNAPSHOT_KIND,
    params,
    funding: used,
    trades: sorted,
    result,
  });
  const json = JSON.stringify(payload);
  return { payload, json, sha256: await sha256Hex(json), result };
}

export type SnapshotCheck = {
  /** Le hash du JSON canonique correspond au hash publié. */
  hashOk: boolean;
  /** Refaire le calcul à partir des données du snapshot redonne exactement le résultat publié. */
  resultOk: boolean;
  ok: boolean;
  sha256: string;
  recomputed: BattleResult;
};

/**
 * Vérifie un snapshot publié (objet lu en base ou JSON téléchargé) contre son hash.
 * L'ordre des clés n'importe pas : le JSON est remis sous forme canonique avant d'être haché.
 */
export async function verifySnapshot(
  payload: unknown,
  expectedSha256: string,
): Promise<SnapshotCheck> {
  const json = canonicalJson(payload);
  const sha256 = await sha256Hex(json);
  const parsed = SnapshotPayloadSchema.parse(payload);
  const recomputed = computeBattle(parsed.params as BattleParams, parsed.trades, parsed.funding);
  const resultOk = canonicalJson(recomputed) === canonicalJson(parsed.result);
  const hashOk = sha256 === expectedSha256.toLowerCase();
  return { hashOk, resultOk, ok: hashOk && resultOk, sha256, recomputed };
}
