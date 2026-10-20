import {
  DEFAULT_WEIGHTS,
  PUMP_CURVE_DEFAULTS,
  type BattleParams,
  type Side,
  type Trade,
} from "./types";

/**
 * Données d'exemple pour les tests et le seed devnet (aucune donnée réelle).
 * Adresses factices au format base58 (32 caractères).
 */
export function fakeWallet(name: string): string {
  return `W${name}`.padEnd(32, "1").slice(0, 32);
}

export const SOL = 1_000_000_000n;

export function baseParams(overrides: Partial<BattleParams> = {}): BattleParams {
  return {
    battleId: "00000000-0000-4000-8000-000000000001",
    formulaVersion: 1,
    scoreMode: "composite",
    weights: DEFAULT_WEIGHTS,
    startedAt: 1_000,
    endsAt: 4_600,
    marketCapWindowSeconds: 300,
    creatorWallets: [fakeWallet("CreatorA"), fakeWallet("CreatorB")],
    ignoredFunders: [fakeWallet("Exchange")],
    rules: {
      maxWalletVolumeLamports: 5n * SOL,
      maxBuysPerWallet: 20,
      washWindowSeconds: 120,
      minHolderTokens: 1_000_000n,
      minClusterSize: 3,
    },
    curve: { A: PUMP_CURVE_DEFAULTS, B: PUMP_CURVE_DEFAULTS },
    ...overrides,
  };
}

let counter = 0;

/**
 * Trade simulé sur une courbe pump.fun : les réserves après le trade suivent la règle
 * x·y = k de la bonding curve (approximation suffisante pour les tests).
 */
export function makeTrade(
  side: Side,
  wallet: string,
  isBuy: boolean,
  solLamports: bigint,
  blockTime: number,
  reserves: { vSol: bigint; vTok: bigint },
): Trade {
  const k = reserves.vSol * reserves.vTok;
  const vSol = isBuy ? reserves.vSol + solLamports : reserves.vSol - solLamports;
  const vTok = k / vSol;
  const tokenAmount = isBuy ? reserves.vTok - vTok : vTok - reserves.vTok;
  reserves.vSol = vSol;
  reserves.vTok = vTok;
  counter++;
  return {
    signature: `sig${String(counter).padStart(6, "0")}`,
    ixIndex: 0,
    slot: blockTime * 2,
    blockTime,
    wallet,
    side,
    isBuy,
    solLamports,
    tokenAmount,
    virtualSolReserves: vSol,
    virtualTokenReserves: vTok,
  };
}

export function freshReserves() {
  return {
    vSol: PUMP_CURVE_DEFAULTS.initialVirtualSolReserves,
    vTok: PUMP_CURVE_DEFAULTS.initialVirtualTokenReserves,
  };
}
