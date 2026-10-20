import { describe, expect, it } from "vitest";
import { baseParams, fakeWallet, freshReserves, makeTrade, SOL } from "./fixtures";
import { computeBattle, marketCapFromReserves, sharePpm, twapMarketCap } from "./score";
import { PPM, PUMP_CURVE_DEFAULTS, type Trade } from "./types";

const alice = fakeWallet("Alice");
const bob = fakeWallet("Bob");
const carol = fakeWallet("Carol");

describe("sharePpm", () => {
  it("donne la part de A en millionièmes, 50 % si rien", () => {
    expect(sharePpm(3n, 1n)).toBe(750_000);
    expect(sharePpm(0n, 0n)).toBe(500_000);
    expect(sharePpm(0n, 5n)).toBe(0);
    expect(sharePpm(1n, 2n)).toBe(333_333);
  });
});

describe("market cap", () => {
  it("vaut ~28 SOL au départ d'une courbe pump.fun", () => {
    const c = PUMP_CURVE_DEFAULTS;
    expect(
      marketCapFromReserves(
        c.initialVirtualSolReserves,
        c.initialVirtualTokenReserves,
        c.totalSupply,
      ),
    ).toBe(27_958_993_476n);
  });

  it("est une moyenne pondérée par le temps sur la fin de battle", () => {
    const r = freshReserves();
    const before = marketCapFromReserves(r.vSol, r.vTok, PUMP_CURVE_DEFAULTS.totalSupply);
    // Fenêtre [4300, 4600[ ; un achat à 4450 : moitié du temps avant, moitié après.
    const t = makeTrade("A", alice, true, 10n * SOL, 4_450, r);
    const after = marketCapFromReserves(r.vSol, r.vTok, PUMP_CURVE_DEFAULTS.totalSupply);
    const twap = twapMarketCap([t], PUMP_CURVE_DEFAULTS, 1_000, 4_600, 300);
    expect(twap).toBe((before * 150n + after * 150n) / 300n);
  });

  it("ne laisse pas un achat de dernière seconde emporter la market cap", () => {
    const r = freshReserves();
    const t = makeTrade("A", alice, true, 50n * SOL, 4_599, r);
    const last = marketCapFromReserves(r.vSol, r.vTok, PUMP_CURVE_DEFAULTS.totalSupply);
    const twap = twapMarketCap([t], PUMP_CURVE_DEFAULTS, 1_000, 4_600, 300);
    expect(twap * 5n).toBeLessThan(last * 2n); // moins de 40 % du pic
  });
});

/** Petit marché : A a 3 acheteurs, B en a 1. */
function market(): Trade[] {
  const ra = freshReserves();
  const rb = freshReserves();
  return [
    makeTrade("A", alice, true, 1n * SOL, 1_100, ra),
    makeTrade("A", bob, true, 1n * SOL, 1_200, ra),
    makeTrade("A", carol, true, 1n * SOL, 1_300, ra),
    makeTrade("B", fakeWallet("Dave"), true, 2n * SOL, 1_150, rb),
  ];
}

describe("computeBattle", () => {
  it("désigne le camp qui a le plus de holders en mode holders", () => {
    const r = computeBattle(baseParams({ scoreMode: "holders" }), market(), {});
    expect(r.metrics.A.holders).toBe(3);
    expect(r.metrics.B.holders).toBe(1);
    expect(r.scorePpm).toEqual({ A: 750_000, B: 250_000 });
    expect(r.winner).toBe("A");
  });

  it("A + B font toujours 1 000 000 en mode composite", () => {
    const r = computeBattle(baseParams(), market(), {});
    expect(r.scorePpm.A + r.scorePpm.B).toBe(PPM);
  });

  it("ne dépend pas de l'ordre des trades reçus", () => {
    const trades = market();
    const a = computeBattle(baseParams(), trades, {});
    const b = computeBattle(baseParams(), [...trades].reverse(), {});
    expect(b).toEqual(a);
  });

  it("ignore les trades hors de la battle", () => {
    const rb = freshReserves();
    const late = makeTrade("B", fakeWallet("Late"), true, 9n * SOL, 4_600, rb);
    const r = computeBattle(baseParams({ scoreMode: "volume" }), [...market(), late], {});
    expect(r.metrics.B.rawVolumeLamports).toBe(2n * SOL);
  });

  it("exclut les créateurs et les wallets qu'ils financent, des deux camps", () => {
    const ra = freshReserves();
    const rb = freshReserves();
    const puppet = fakeWallet("Puppet");
    const trades = [
      makeTrade("A", fakeWallet("CreatorA"), true, 4n * SOL, 1_010, ra),
      makeTrade("A", puppet, true, 4n * SOL, 1_020, ra),
      makeTrade("B", fakeWallet("Dave"), true, 1n * SOL, 1_030, rb),
    ];
    const r = computeBattle(baseParams({ scoreMode: "volume" }), trades, {
      [puppet]: fakeWallet("CreatorA"),
    });
    expect(r.metrics.A.volumeLamports).toBe(0n);
    expect(r.metrics.A.rawVolumeLamports).toBe(8n * SOL);
    expect(r.winner).toBe("B");
    expect(r.flags.filter((f) => f.reason === "creator_linked").map((f) => f.wallet)).toEqual(
      [fakeWallet("CreatorA"), puppet].sort(),
    );
  });

  it("écarte les allers-retours rapides du volume et des achats", () => {
    const ra = freshReserves();
    const trades = [
      makeTrade("A", alice, true, 2n * SOL, 1_100, ra),
      makeTrade("A", alice, false, 1n * SOL, 1_160, ra), // 60 s après : aller-retour
      makeTrade("A", bob, true, 1n * SOL, 1_200, ra),
      makeTrade("A", bob, false, 1n * SOL, 1_500, ra), // 300 s après : vraie vente, comptée
    ];
    const r = computeBattle(baseParams(), trades, {});
    expect(r.metrics.A.volumeLamports).toBe(2n * SOL);
    expect(r.metrics.A.buys).toBe(1);
    expect(r.flags).toContainEqual(
      expect.objectContaining({ wallet: alice, reason: "wash_trading" }),
    );
    expect(r.flags.some((f) => f.wallet === bob)).toBe(false);
  });

  it("compte comme un seul holder les wallets financés par la même source", () => {
    const ra = freshReserves();
    const funder = fakeWallet("Farm");
    const sybils = ["S1", "S2", "S3"].map(fakeWallet);
    const trades = sybils.map((w, i) => makeTrade("A", w, true, 1n * SOL, 1_100 + i * 300, ra));
    const funding = Object.fromEntries(sybils.map((w) => [w, funder]));
    const r = computeBattle(baseParams(), trades, funding);
    expect(r.metrics.A.holders).toBe(1);
    expect(r.flags.filter((f) => f.reason === "common_funder")).toHaveLength(3);
  });

  it("ne regroupe pas les wallets financés par une plateforme d'échange", () => {
    const ra = freshReserves();
    const users = ["U1", "U2", "U3"].map(fakeWallet);
    const trades = users.map((w, i) => makeTrade("A", w, true, 1n * SOL, 1_100 + i * 300, ra));
    const funding = Object.fromEntries(users.map((w) => [w, fakeWallet("Exchange")]));
    expect(computeBattle(baseParams(), trades, funding).metrics.A.holders).toBe(3);
  });

  it("plafonne le volume compté par participant", () => {
    const ra = freshReserves();
    const trades = [
      makeTrade("A", alice, true, 4n * SOL, 1_100, ra),
      makeTrade("A", alice, true, 4n * SOL, 1_400, ra),
    ];
    const r = computeBattle(baseParams(), trades, {});
    expect(r.metrics.A.volumeLamports).toBe(5n * SOL);
    expect(r.flags).toContainEqual(
      expect.objectContaining({ wallet: alice, reason: "cap_reached" }),
    );
  });

  it("plafonne le nombre d'achats comptés par participant", () => {
    const ra = freshReserves();
    const trades = Array.from({ length: 5 }, (_, i) =>
      makeTrade("A", alice, true, SOL / 100n, 1_100 + i * 200, ra),
    );
    const params = baseParams();
    params.rules = { ...params.rules, maxBuysPerWallet: 3 };
    expect(computeBattle(params, trades, {}).metrics.A.buys).toBe(3);
  });

  it("déclare un match nul quand tout est égal", () => {
    const r = computeBattle(baseParams(), [], {});
    expect(r.scorePpm).toEqual({ A: 500_000, B: 500_000 });
    expect(r.winner).toBe("draw");
  });

  it("départage une égalité de score par le volume", () => {
    const ra = freshReserves();
    const rb = freshReserves();
    const trades = [
      makeTrade("A", alice, true, 2n * SOL, 1_100, ra),
      makeTrade("B", bob, true, 1n * SOL, 1_100, rb),
    ];
    // Mode holders : 1 contre 1, égalité ; A a plus de volume.
    const r = computeBattle(baseParams({ scoreMode: "holders" }), trades, {});
    expect(r.scorePpm.A).toBe(r.scorePpm.B);
    expect(r.winner).toBe("A");
  });
});
