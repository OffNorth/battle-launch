import { describe, expect, it } from "vitest";
import { baseParams, fakeWallet, freshReserves, makeTrade, SOL } from "./fixtures";
import { buildSnapshot, canonicalJson, sha256Hex, verifySnapshot } from "./snapshot";

function sample() {
  const ra = freshReserves();
  const rb = freshReserves();
  const trades = [
    makeTrade("A", fakeWallet("Alice"), true, 1n * SOL, 1_100, ra),
    makeTrade("B", fakeWallet("Bob"), true, 2n * SOL, 1_200, rb),
    makeTrade("A", fakeWallet("Carol"), true, 1n * SOL, 1_300, ra),
  ];
  return {
    params: baseParams(),
    trades,
    funding: { [fakeWallet("Alice")]: fakeWallet("Exchange") },
  };
}

/** Remélange l'ordre des clés à tous les niveaux (comme le fait le stockage jsonb). */
function shuffleKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shuffleKeys);
  if (v && typeof v === "object") {
    const keys = Object.keys(v).reverse();
    return Object.fromEntries(keys.map((k) => [k, shuffleKeys((v as Record<string, unknown>)[k])]));
  }
  return v;
}

describe("canonicalJson", () => {
  it("trie les clés et écrit les bigint en chaînes", () => {
    expect(canonicalJson({ b: 1n, a: [true, null], c: undefined })).toBe(
      '{"a":[true,null],"b":"1"}',
    );
  });

  it("refuse les flottants", () => {
    expect(() => canonicalJson({ x: 0.1 })).toThrow(/non entier/);
  });
});

describe("sha256Hex", () => {
  it("donne le hash attendu", async () => {
    expect(await sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("snapshot", () => {
  it("se vérifie : même hash, même gagnant, quel que soit l'ordre des clés", async () => {
    const { params, trades, funding } = sample();
    const snap = await buildSnapshot(params, trades, funding);
    expect(snap.sha256).toMatch(/^[0-9a-f]{64}$/);

    const stored = JSON.parse(JSON.stringify(shuffleKeys(snap.payload)));
    const check = await verifySnapshot(stored, snap.sha256);
    expect(check.ok).toBe(true);
    expect(check.recomputed.winner).toBe(snap.result.winner);
  });

  it("ne publie que les financements des wallets présents", async () => {
    const { params, trades } = sample();
    const snap = await buildSnapshot(params, trades, {
      [fakeWallet("Alice")]: fakeWallet("Exchange"),
      [fakeWallet("Nobody")]: fakeWallet("Exchange"),
    });
    expect(Object.keys((snap.payload as { funding: object }).funding)).toEqual([
      fakeWallet("Alice"),
    ]);
  });

  it("détecte un trade modifié", async () => {
    const { params, trades, funding } = sample();
    const snap = await buildSnapshot(params, trades, funding);
    const tampered = JSON.parse(snap.json) as { trades: { solLamports: string }[] };
    const first = tampered.trades[0];
    if (!first) throw new Error("snapshot sans trade");
    first.solLamports = (50n * SOL).toString();
    const check = await verifySnapshot(tampered, snap.sha256);
    expect(check.hashOk).toBe(false);
    expect(check.resultOk).toBe(false);
    expect(check.ok).toBe(false);
  });

  it("détecte un gagnant réécrit même si le hash est recalculé", async () => {
    const { params, trades, funding } = sample();
    const snap = await buildSnapshot(params, trades, funding);
    const tampered = JSON.parse(snap.json) as { result: { winner: string } };
    tampered.result.winner = tampered.result.winner === "A" ? "B" : "A";
    const check = await verifySnapshot(tampered, await sha256Hex(canonicalJson(tampered)));
    expect(check.hashOk).toBe(true);
    expect(check.resultOk).toBe(false);
  });
});
