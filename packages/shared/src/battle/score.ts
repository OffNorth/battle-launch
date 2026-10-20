import {
  compareTrades,
  detectWashTrades,
  isCreatorLinked,
  resolveEntities,
  sortFlags,
  tradeKey,
} from "./anti-cheat";
import {
  PPM,
  SIDES,
  WEIGHT_TOTAL,
  type BattleParams,
  type BattleResult,
  type CurveParams,
  type FundingMap,
  type Side,
  type SideMetrics,
  type Trade,
  type WalletFlag,
} from "./types";

/** Market cap (lamports) à partir des réserves virtuelles : prix × offre totale. */
export function marketCapFromReserves(vSol: bigint, vToken: bigint, totalSupply: bigint): bigint {
  if (vToken <= 0n) return 0n;
  return (vSol * totalSupply) / vToken;
}

/**
 * Market cap moyenne, pondérée par le temps, sur la fin de la battle
 * [max(début, fin - fenêtre), fin[. Tous les trades du camp comptent ici : le prix est un fait
 * de marché, même quand un trade est écarté du volume. Avant le premier trade : réserves initiales.
 * `sideTrades` doit être dans l'ordre canonique.
 */
export function twapMarketCap(
  sideTrades: Trade[],
  curve: CurveParams,
  startedAt: number,
  endsAt: number,
  windowSeconds: number,
): bigint {
  const from = Math.max(startedAt, endsAt - windowSeconds);
  // État au début de la fenêtre (dernier trade à cette heure ou avant), puis aire sous la courbe.
  let current = marketCapFromReserves(
    curve.initialVirtualSolReserves,
    curve.initialVirtualTokenReserves,
    curve.totalSupply,
  );
  let acc = 0n;
  let t = from;
  for (const trade of sideTrades) {
    if (trade.blockTime >= endsAt) break;
    if (trade.blockTime > from) {
      acc += current * BigInt(trade.blockTime - t);
      t = trade.blockTime;
    }
    current = marketCapFromReserves(
      trade.virtualSolReserves,
      trade.virtualTokenReserves,
      curve.totalSupply,
    );
  }
  if (endsAt <= from) return current;
  acc += current * BigInt(endsAt - t);
  return acc / BigInt(endsAt - from);
}

/** Part de A en ppm : a / (a + b), arrondie vers le bas. 50 % si les deux sont nuls. */
export function sharePpm(a: bigint, b: bigint): number {
  const total = a + b;
  if (total === 0n) return PPM / 2;
  return Number((a * BigInt(PPM)) / total);
}

function emptyMetrics(): SideMetrics {
  return {
    volumeLamports: 0n,
    rawVolumeLamports: 0n,
    holders: 0,
    marketCapLamports: 0n,
    buys: 0,
    rawBuys: 0,
    rawSells: 0,
  };
}

function byString(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Stats, score et gagnant d'une battle. Fonction PURE : mêmes entrées, même résultat, au bit près.
 * Sert au direct (worker, `endsAt` = maintenant), à la clôture et à la page de vérification.
 */
export function computeBattle(
  params: BattleParams,
  allTrades: Trade[],
  funding: FundingMap,
): BattleResult {
  const trades = [...allTrades].sort(compareTrades);
  const inWindow = trades.filter(
    (t) => t.blockTime >= params.startedAt && t.blockTime < params.endsAt,
  );
  const flags: WalletFlag[] = [];

  // 1. Wallets liés aux créateurs : exclus des deux camps.
  const counted: Trade[] = [];
  for (const t of inWindow) {
    if (isCreatorLinked(t.wallet, funding, params)) {
      flags.push({
        wallet: t.wallet,
        reason: "creator_linked",
        detail: "creator or funded by a creator",
      });
    } else {
      counted.push(t);
    }
  }

  // 2. Wallets financés par une même source : un seul participant.
  const entityOf = resolveEntities(
    counted.map((t) => t.wallet),
    funding,
    params,
  );
  for (const [wallet, entity] of entityOf) {
    if (entity !== wallet) {
      flags.push({
        wallet,
        reason: "common_funder",
        detail: `counted as one with others funded by ${entity.slice("cluster:".length)}`,
      });
    }
  }

  // 3. Allers-retours rapides : écartés du volume et des achats.
  const wash = detectWashTrades(counted, entityOf, params.rules.washWindowSeconds);
  for (const t of counted) {
    if (wash.has(tradeKey(t))) {
      flags.push({
        wallet: t.wallet,
        reason: "wash_trading",
        detail: `buy and sell within ${params.rules.washWindowSeconds}s`,
      });
    }
  }

  const metrics: Record<Side, SideMetrics> = { A: emptyMetrics(), B: emptyMetrics() };
  for (const side of SIDES) {
    const m = metrics[side];
    for (const t of inWindow) {
      if (t.side !== side) continue;
      m.rawVolumeLamports += t.solLamports;
      if (t.isBuy) m.rawBuys++;
      else m.rawSells++;
    }

    const volumeByEntity = new Map<string, bigint>();
    const buysByEntity = new Map<string, number>();
    const netByEntity = new Map<string, bigint>();
    const walletsOfEntity = new Map<string, Set<string>>();
    for (const t of counted) {
      if (t.side !== side) continue;
      const entity = entityOf.get(t.wallet) ?? t.wallet;
      const members = walletsOfEntity.get(entity) ?? new Set<string>();
      members.add(t.wallet);
      walletsOfEntity.set(entity, members);
      // Le solde net compte TOUS les trades : un aller-retour ne fait pas un holder de plus.
      const delta = t.isBuy ? t.tokenAmount : -t.tokenAmount;
      netByEntity.set(entity, (netByEntity.get(entity) ?? 0n) + delta);
      if (wash.has(tradeKey(t))) continue;
      volumeByEntity.set(entity, (volumeByEntity.get(entity) ?? 0n) + t.solLamports);
      if (t.isBuy) buysByEntity.set(entity, (buysByEntity.get(entity) ?? 0) + 1);
    }

    // 4. Plafonds par participant.
    const cap = params.rules.maxWalletVolumeLamports;
    for (const [entity, volume] of [...volumeByEntity].sort(([a], [b]) => byString(a, b))) {
      if (volume > cap) {
        m.volumeLamports += cap;
        for (const wallet of walletsOfEntity.get(entity) ?? []) {
          flags.push({ wallet, reason: "cap_reached", detail: `side ${side} volume capped` });
        }
      } else {
        m.volumeLamports += volume;
      }
    }
    for (const n of buysByEntity.values()) m.buys += Math.min(n, params.rules.maxBuysPerWallet);
    for (const net of netByEntity.values()) {
      if (net > 0n && net >= params.rules.minHolderTokens) m.holders++;
    }

    m.marketCapLamports = twapMarketCap(
      trades.filter((t) => t.side === side),
      params.curve[side],
      params.startedAt,
      params.endsAt,
      params.marketCapWindowSeconds,
    );
  }

  // 5. Score : part de A sur chaque critère, puis pondération (entiers seulement).
  const shares = {
    volume: sharePpm(metrics.A.volumeLamports, metrics.B.volumeLamports),
    holders: sharePpm(BigInt(metrics.A.holders), BigInt(metrics.B.holders)),
    market_cap: sharePpm(metrics.A.marketCapLamports, metrics.B.marketCapLamports),
    buys: sharePpm(BigInt(metrics.A.buys), BigInt(metrics.B.buys)),
  };
  let scoreA: number;
  if (params.scoreMode === "composite") {
    const w = params.weights;
    const weighted =
      BigInt(shares.volume) * BigInt(w.volume) +
      BigInt(shares.holders) * BigInt(w.holders) +
      BigInt(shares.market_cap) * BigInt(w.market_cap) +
      BigInt(shares.buys) * BigInt(w.buys);
    scoreA = Number(weighted / BigInt(WEIGHT_TOTAL));
  } else {
    scoreA = shares[params.scoreMode];
  }
  const scorePpm = { A: scoreA, B: PPM - scoreA };

  return {
    formulaVersion: 1,
    metrics,
    scorePpm,
    winner: pickWinner(scorePpm, metrics),
    flags: sortFlags(flags),
  };
}

/** Plus haut score ; à égalité : volume, puis holders, puis market cap ; sinon match nul. */
function pickWinner(score: Record<Side, number>, m: Record<Side, SideMetrics>): Side | "draw" {
  if (score.A !== score.B) return score.A > score.B ? "A" : "B";
  const ties: [bigint, bigint][] = [
    [m.A.volumeLamports, m.B.volumeLamports],
    [BigInt(m.A.holders), BigInt(m.B.holders)],
    [m.A.marketCapLamports, m.B.marketCapLamports],
  ];
  for (const [a, b] of ties) if (a !== b) return a > b ? "A" : "B";
  return "draw";
}
