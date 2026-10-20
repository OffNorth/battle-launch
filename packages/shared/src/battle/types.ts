import { z } from "zod";

/**
 * Types de la logique de jeu. Tout est entier : lamports et unités brutes de token en bigint,
 * temps en secondes Unix, scores en millionièmes (ppm). Aucun flottant : le même calcul donne
 * exactement le même gagnant sur n'importe quelle machine, ce qui rend le snapshot vérifiable.
 */

export const SIDES = ["A", "B"] as const;
export type Side = (typeof SIDES)[number];

export const ScoreMode = z.enum(["volume", "holders", "market_cap", "composite"]);
export type ScoreMode = z.infer<typeof ScoreMode>;

/** 1 = 100 % en points de base : les poids du score composite s'additionnent à 10 000. */
export const WEIGHT_TOTAL = 10_000;
/** Un score vaut entre 0 et 1 000 000 (ppm) ; les deux camps totalisent toujours 1 000 000. */
export const PPM = 1_000_000;

const bps = z.number().int().min(0).max(WEIGHT_TOTAL);
export const ScoreWeights = z
  .object({ volume: bps, holders: bps, market_cap: bps, buys: bps })
  .refine((w) => w.volume + w.holders + w.market_cap + w.buys === WEIGHT_TOTAL, {
    message: `les poids doivent totaliser ${WEIGHT_TOTAL}`,
  });
export type ScoreWeights = z.infer<typeof ScoreWeights>;

export const DEFAULT_WEIGHTS: ScoreWeights = {
  volume: 3500,
  holders: 3500,
  market_cap: 2000,
  buys: 1000,
};

/** Un trade lu sur la chaîne (achat ou vente sur la bonding curve d'un des deux tokens). */
export type Trade = {
  signature: string;
  /** Rang de l'instruction dans la transaction. */
  ixIndex: number;
  slot: number;
  /** Heure du bloc, en secondes Unix. */
  blockTime: number;
  wallet: string;
  side: Side;
  isBuy: boolean;
  solLamports: bigint;
  tokenAmount: bigint;
  /** Réserves virtuelles de la courbe APRÈS le trade : elles donnent le prix. */
  virtualSolReserves: bigint;
  virtualTokenReserves: bigint;
};

/** Règles anti-triche, figées à la création de la battle et publiées. */
export type AntiCheatRules = {
  /** Plafond du volume compté par wallet (ou groupe de wallets), en lamports. */
  maxWalletVolumeLamports: bigint;
  /** Plafond du nombre d'achats comptés par wallet (ou groupe). */
  maxBuysPerWallet: number;
  /** Un achat puis une vente (ou l'inverse) du même wallet en moins de ce délai = aller-retour, non compté. */
  washWindowSeconds: number;
  /** Solde net minimum (unités brutes) pour compter comme holder. */
  minHolderTokens: bigint;
  /** À partir de combien de wallets financés par la même source on les compte comme un seul. */
  minClusterSize: number;
};

/** Paramètres de pump.fun au lancement (lus sur la chaîne ; valeurs par défaut connues). */
export type CurveParams = {
  /** Offre totale, unités brutes (1 milliard de tokens à 6 décimales). */
  totalSupply: bigint;
  initialVirtualSolReserves: bigint;
  initialVirtualTokenReserves: bigint;
};

export const PUMP_CURVE_DEFAULTS: CurveParams = {
  totalSupply: 1_000_000_000_000_000n,
  initialVirtualSolReserves: 30_000_000_000n,
  initialVirtualTokenReserves: 1_073_000_000_000_000n,
};

export type BattleParams = {
  battleId: string;
  formulaVersion: 1;
  scoreMode: ScoreMode;
  weights: ScoreWeights;
  /** Début réel (les deux tokens créés), secondes Unix, inclus. */
  startedAt: number;
  /** Fin, secondes Unix, exclue. En direct : l'heure du calcul. */
  endsAt: number;
  /** Market cap retenue = moyenne pondérée par le temps sur cette fin de battle (contre le pump de dernière seconde). */
  marketCapWindowSeconds: number;
  /** Wallets des créateurs des deux camps : exclus des deux côtés, ainsi que les wallets qu'ils ont financés. */
  creatorWallets: string[];
  /** Sources de financement ignorées pour les groupes (plateformes d'échange : elles financent tout le monde). */
  ignoredFunders: string[];
  rules: AntiCheatRules;
  curve: Record<Side, CurveParams>;
};

/** Pour chaque wallet : l'adresse qui lui a envoyé ses premiers SOL (lue sur la chaîne par le worker). */
export type FundingMap = Record<string, string>;

export type FlagReason = "creator_linked" | "wash_trading" | "common_funder" | "cap_reached";
export type WalletFlag = { wallet: string; reason: FlagReason; detail: string };

export type SideMetrics = {
  /** Volume compté (après exclusions, allers-retours et plafonds), lamports. */
  volumeLamports: bigint;
  /** Volume brut de tous les trades de la fenêtre, pour l'affichage. */
  rawVolumeLamports: bigint;
  /** Holders uniques comptés (un groupe de wallets = un holder). */
  holders: number;
  /** Market cap moyenne de fin de battle, lamports. */
  marketCapLamports: bigint;
  /** Achats comptés. */
  buys: number;
  /** Achats et ventes bruts de la fenêtre, pour l'affichage. */
  rawBuys: number;
  rawSells: number;
};

export type BattleResult = {
  formulaVersion: 1;
  metrics: Record<Side, SideMetrics>;
  /** Score de chaque camp en ppm ; A + B = 1 000 000. */
  scorePpm: Record<Side, number>;
  winner: Side | "draw";
  flags: WalletFlag[];
};
