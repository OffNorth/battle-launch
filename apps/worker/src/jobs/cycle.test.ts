import {
  buildSnapshot,
  canonicalJson,
  computeBattle,
  verifySnapshot,
  type FundingMap,
  type Trade,
} from "@battle/shared";
import { fakeWallet, freshReserves, makeTrade, SOL } from "@battle/shared/fixtures";
import { describe, expect, it } from "vitest";
import { toParams, type BattleRow, type SideRow } from "../battles";
import { buildCandles, candlePrice } from "./index-trades";

/**
 * Cycle complet d'une battle, avec le code du worker et du site (sans réseau) :
 * ligne de la base -> paramètres, trades qui arrivent pendant 1 h, stats en direct à
 * plusieurs moments, bougies, clôture (snapshot haché), passage par le jsonb de la base,
 * vérification comme sur la page /verify, et détection d'une falsification.
 */

const START = 1_800_000_000;
const END = START + 3600;

// Une battle telle que `loadBattle` la lit (jsonb : nombres et grands entiers en chaînes).
const battle: BattleRow = {
  id: "00000000-0000-4000-8000-0000000000c1",
  theme: "Sun vs Moon",
  status: "live",
  mode: "creator",
  duration_minutes: 60,
  score_mode: "composite",
  score_weights: { buys: 1000, volume: 3500, holders: 3500, market_cap: 2000 },
  formula_version: 1,
  initial_buy_lamports: "50000000",
  anti_cheat_rules: {
    minClusterSize: 3,
    minHolderTokens: "1000000",
    maxBuysPerWallet: 20,
    washWindowSeconds: 120,
    maxWalletVolumeLamports: "5000000000",
  },
  market_cap_window_seconds: 300,
  curve_params: {
    totalSupply: "1000000000000000",
    initialVirtualSolReserves: "30000000000",
    initialVirtualTokenReserves: "1073000000000000",
  },
  started_at: new Date(START * 1000),
  ends_at: new Date(END * 1000),
};
const side = (s: "A" | "B", creator: string): SideRow => ({
  id: `side-${s}`,
  side: s,
  name: s === "A" ? "Sunny" : "Moony",
  ticker: s === "A" ? "SUN" : "MOON",
  description: null,
  mint: `Mint${s}`,
  creator_id: `creator-${s}`,
  creator_wallet: fakeWallet(creator),
});
const sides = [side("A", "CreatorA"), side("B", "CreatorB")];
const EXCHANGE = fakeWallet("Exchange");

/** Les trades de l'heure, dans l'ordre où la chaîne les produit. */
function scenario(): { trades: Trade[]; funding: FundingMap } {
  const ra = freshReserves();
  const rb = freshReserves();
  const trades: Trade[] = [];
  const add = (s: "A" | "B", who: string, buy: boolean, sol: bigint, t: number) =>
    trades.push(makeTrade(s, fakeWallet(who), buy, sol, START + t, s === "A" ? ra : rb));
  const funding: FundingMap = {};

  add("A", "CreatorA", true, 50_000_000n, 1); // achats initiaux : exclus du score
  add("B", "CreatorB", true, 50_000_000n, 1);
  // A démarre fort : 6 acheteurs dans les 20 premières minutes.
  ["Ana", "Ben", "Cleo", "Dan", "Eva", "Finn"].forEach((w, i) =>
    add("A", w, true, (3n * SOL) / 10n, 60 + i * 180),
  );
  // Triche côté A : une baleine (plafonnée), un aller-retour (écarté), un wallet payé par le
  // créateur de A (exclu) et trois wallets financés par la même source (un seul participant).
  add("A", "Whale", true, 9n * SOL, 1500);
  add("A", "Flip", true, SOL, 1600);
  add("A", "Flip", false, SOL, 1650);
  add("A", "Puppet", true, 2n * SOL, 1700);
  funding[fakeWallet("Puppet")] = fakeWallet("CreatorA");
  for (const w of ["Bot1", "Bot2", "Bot3"]) {
    add("A", w, true, SOL / 2n, 2000);
    funding[fakeWallet(w)] = fakeWallet("Farm");
  }
  // Un wallet financé par une plateforme d'échange reste un participant normal.
  add("A", "Gus", true, SOL / 5n, 2100);
  funding[fakeWallet("Gus")] = EXCHANGE;
  // B remonte dans la seconde moitié : 12 acheteurs plus gros.
  [
    "Jade",
    "Kim",
    "Leo",
    "Mia",
    "Noah",
    "Olga",
    "Paul",
    "Quinn",
    "Rosa",
    "Sam",
    "Tara",
    "Uma",
  ].forEach((w, i) => add("B", w, true, (8n * SOL) / 10n, 1900 + i * 140));
  add("B", "Late", true, 3n * SOL, 3700); // après la fin : ne compte pas
  return { trades, funding };
}

/** Ce que l'indexeur calcule à l'instant `now` avec les trades déjà vus. */
function liveAt(now: number, all: Trade[], funding: FundingMap) {
  const seen = all.filter((t) => t.blockTime <= now);
  const params = toParams(battle, sides, [EXCHANGE], Math.min(now, END));
  return computeBattle(params, seen, funding);
}

/** Simule le jsonb de Postgres : mêmes valeurs, clés dans un autre ordre. */
function shuffleKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shuffleKeys);
  if (value && typeof value === "object") {
    const entries = Object.entries(value).reverse();
    return Object.fromEntries(entries.map(([k, v]) => [k, shuffleKeys(v)]));
  }
  return value;
}

describe("battle complète (lobby lancé -> en direct -> terminée -> vérifiée)", () => {
  const { trades, funding } = scenario();

  it("stats en direct : A mène au début, B gagne à la fin, le volume ne recule jamais", () => {
    const at20 = liveAt(START + 20 * 60, trades, funding);
    expect(at20.scorePpm.A).toBeGreaterThan(at20.scorePpm.B);
    expect(at20.metrics.B.holders).toBe(0);

    let lastVolume = -1n;
    for (let minute = 5; minute <= 60; minute += 5) {
      const r = liveAt(START + minute * 60, trades, funding);
      const total = r.metrics.A.rawVolumeLamports + r.metrics.B.rawVolumeLamports;
      expect(total >= lastVolume).toBe(true);
      expect(r.scorePpm.A + r.scorePpm.B).toBe(1_000_000);
      lastVolume = total;
    }

    const end = liveAt(END + 600, trades, funding);
    expect(end.winner).toBe("B");
  });

  it("anti-triche appliqué : créateur, baleine, aller-retour, groupe, plateforme d'échange", () => {
    const r = liveAt(END, trades, funding);
    const reasons = (name: string) =>
      r.flags.filter((f) => f.wallet === fakeWallet(name)).map((f) => f.reason);
    expect(reasons("Puppet")).toContain("creator_linked");
    expect(reasons("Whale")).toContain("cap_reached");
    expect(reasons("Flip")).toContain("wash_trading");
    expect(reasons("Bot1")).toContain("common_funder");
    expect(reasons("Gus")).toEqual([]);
    // Holders de A : 6 premiers + baleine + groupe compté une fois + Gus = 9 (ni Flip, ni Puppet, ni créateur).
    expect(r.metrics.A.holders).toBe(9);
    expect(r.metrics.B.holders).toBe(12);
    // Volume de A : 6 x 0,3 + 5 (plafond baleine) + 1,5 (groupe, sous le plafond) + 0,2 SOL.
    expect(r.metrics.A.volumeLamports).toBe(
      (18n * SOL) / 10n + 5n * SOL + (15n * SOL) / 10n + SOL / 5n,
    );
    // Le trade arrivé après la fin ne compte pas.
    expect(r.metrics.B.volumeLamports).toBe((96n * SOL) / 10n);
  });

  it("bougies : une par minute et par camp, prix et volumes fidèles aux trades", () => {
    const candles = buildCandles(trades);
    for (const s of ["A", "B"] as const) {
      const mine = trades.filter((t) => t.side === s);
      const own = candles.filter((c) => c.side === s);
      const volume = own.reduce((sum, c) => sum + BigInt(c.volume_lamports), 0n);
      expect(volume).toBe(mine.reduce((sum, t) => sum + t.solLamports, 0n));
      const last = mine[mine.length - 1];
      const lastCandle = own.sort((a, b) => a.bucket.getTime() - b.bucket.getTime()).at(-1);
      if (!last || !lastCandle) throw new Error("bougies manquantes");
      expect(lastCandle.close_price).toBe(
        candlePrice(last.virtualSolReserves, last.virtualTokenReserves).toString(),
      );
      for (const c of own) {
        expect(BigInt(c.low_price) <= BigInt(c.open_price)).toBe(true);
        expect(BigInt(c.high_price) >= BigInt(c.close_price)).toBe(true);
      }
    }
  });

  it("clôture : le snapshot redonne le résultat affiché en direct, même lu dans le désordre", async () => {
    const params = toParams(battle, sides, [EXCHANGE], END);
    // L'indexeur peut avoir enregistré les trades dans n'importe quel ordre.
    const snap = await buildSnapshot(params, [...trades].reverse(), funding);
    expect(snap.result.winner).toBe("B");
    expect(canonicalJson(snap.result)).toBe(canonicalJson(liveAt(END, trades, funding)));
    // Le financement publié se limite aux wallets de la battle.
    const again = await buildSnapshot(params, trades, {
      ...funding,
      [fakeWallet("Nobody")]: EXCHANGE,
    });
    expect(again.sha256).toBe(snap.sha256);

    // Lecture depuis la base (jsonb) puis vérification comme sur /battle/[id]/verify.
    const fromDb = shuffleKeys(JSON.parse(snap.json));
    const check = await verifySnapshot(fromDb, snap.sha256.toUpperCase());
    expect(check).toMatchObject({ hashOk: true, resultOk: true, ok: true, sha256: snap.sha256 });
    expect(check.recomputed.winner).toBe("B");
  });

  it("falsification : un trade modifié ou un résultat changé est détecté", async () => {
    const snap = await buildSnapshot(toParams(battle, sides, [EXCHANGE], END), trades, funding);
    const tampered = JSON.parse(snap.json) as {
      trades: { solLamports: string }[];
      result: { winner: string };
    };
    const first = tampered.trades[0];
    if (!first) throw new Error("snapshot vide");
    first.solLamports = "1";
    const c1 = await verifySnapshot(tampered, snap.sha256);
    expect(c1.hashOk).toBe(false);

    const forged = JSON.parse(snap.json) as { result: { winner: string } };
    forged.result.winner = "A";
    const c2 = await verifySnapshot(forged, snap.sha256);
    expect(c2.hashOk).toBe(false);
    expect(c2.resultOk).toBe(false);
    expect(c2.recomputed.winner).toBe("B");
  });
});
