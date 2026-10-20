import type { BattleParams, FundingMap, Trade, WalletFlag } from "./types";

/** Identifiant stable d'un trade. */
export function tradeKey(t: Pick<Trade, "signature" | "ixIndex">): string {
  return `${t.signature}:${t.ixIndex}`;
}

/** Ordre canonique des trades : temps, slot, signature, rang. Le même partout. */
export function compareTrades(a: Trade, b: Trade): number {
  if (a.blockTime !== b.blockTime) return a.blockTime - b.blockTime;
  if (a.slot !== b.slot) return a.slot - b.slot;
  if (a.signature !== b.signature) return a.signature < b.signature ? -1 : 1;
  return a.ixIndex - b.ixIndex;
}

/**
 * Wallet lié à un créateur : un créateur lui-même, ou un wallet dont les premiers SOL viennent
 * d'un créateur. Ces wallets ne comptent dans AUCUN camp (le créateur ne peut pas gonfler le sien
 * ni saboter l'autre).
 */
export function isCreatorLinked(
  wallet: string,
  funding: FundingMap,
  params: BattleParams,
): boolean {
  const creators = new Set(params.creatorWallets);
  if (creators.has(wallet)) return true;
  const funder = funding[wallet];
  return funder !== undefined && creators.has(funder);
}

/**
 * Regroupe les wallets financés par une même source (hors plateformes d'échange) : à partir de
 * `minClusterSize` wallets, ils comptent comme UN SEUL participant (un holder, un plafond).
 * Renvoie l'« entité » de chaque wallet : le wallet lui-même, ou `cluster:<source>`.
 */
export function resolveEntities(
  wallets: Iterable<string>,
  funding: FundingMap,
  params: BattleParams,
): Map<string, string> {
  const ignored = new Set(params.ignoredFunders);
  const unique = [...new Set(wallets)].sort();
  const byFunder = new Map<string, string[]>();
  for (const w of unique) {
    const funder = funding[w];
    if (funder === undefined || ignored.has(funder)) continue;
    const list = byFunder.get(funder) ?? [];
    list.push(w);
    byFunder.set(funder, list);
  }
  const entityOf = new Map<string, string>();
  for (const w of unique) entityOf.set(w, w);
  for (const [funder, list] of byFunder) {
    if (list.length >= params.rules.minClusterSize) {
      for (const w of list) entityOf.set(w, `cluster:${funder}`);
    }
  }
  return entityOf;
}

/**
 * Allers-retours (wash trading) : un trade est écarté si la même entité a fait le trade inverse
 * sur le même camp moins de `washWindowSeconds` avant lui ; le trade précédent est écarté aussi.
 * Ces trades ne comptent ni dans le volume ni dans les achats (le solde net, lui, reste juste).
 * `trades` doit être dans l'ordre canonique.
 */
export function detectWashTrades(
  trades: Trade[],
  entityOf: Map<string, string>,
  washWindowSeconds: number,
): Set<string> {
  const wash = new Set<string>();
  // Dernier trade de chaque sens, par entité et par camp.
  const last = new Map<string, { buy?: Trade; sell?: Trade }>();
  for (const t of trades) {
    const entity = entityOf.get(t.wallet) ?? t.wallet;
    const k = `${entity}|${t.side}`;
    const state = last.get(k) ?? {};
    const opposite = t.isBuy ? state.sell : state.buy;
    if (opposite && t.blockTime - opposite.blockTime <= washWindowSeconds) {
      wash.add(tradeKey(t));
      wash.add(tradeKey(opposite));
    }
    if (t.isBuy) state.buy = t;
    else state.sell = t;
    last.set(k, state);
  }
  return wash;
}

/** Signalements publiés (un par wallet et par raison), triés pour être reproductibles. */
export function sortFlags(flags: WalletFlag[]): WalletFlag[] {
  const seen = new Set<string>();
  const out: WalletFlag[] = [];
  for (const f of flags) {
    const k = `${f.wallet}|${f.reason}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out.sort((a, b) =>
    a.wallet === b.wallet ? (a.reason < b.reason ? -1 : 1) : a.wallet < b.wallet ? -1 : 1,
  );
}
