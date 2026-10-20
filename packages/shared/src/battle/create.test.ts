import { describe, expect, it } from "vitest";
import {
  CreateBattleInput,
  lamportsToSolString,
  lobbySchedule,
  parseSolToLamports,
} from "./create";

describe("parseSolToLamports", () => {
  it("convertit sans flottant", () => {
    expect(parseSolToLamports("0.05")).toBe(50_000_000n);
    expect(parseSolToLamports("0,1")).toBe(100_000_000n);
    expect(parseSolToLamports("1")).toBe(1_000_000_000n);
    expect(parseSolToLamports("0.000000001")).toBe(1n);
  });
  it("refuse les écritures douteuses", () => {
    for (const bad of ["", "-1", "1e3", "0.0000000001", "abc", "1.2.3"]) {
      expect(parseSolToLamports(bad)).toBeNull();
    }
  });
  it("relit l'inverse", () => {
    expect(lamportsToSolString(50_000_000n)).toBe("0.05");
    expect(lamportsToSolString(2_000_000_000n)).toBe("2");
  });
});

const base = {
  theme: "Cat vs Dog",
  durationMinutes: 60,
  lobbyMinutes: 10,
  initialBuySol: "0.05",
  acceptRisks: true,
  sideA: { name: "Whiskers", ticker: "$meow" },
};

describe("CreateBattleInput", () => {
  it("accepte une battle du créateur et normalise", () => {
    const r = CreateBattleInput.parse({
      ...base,
      mode: "creator",
      sideB: { name: "Rex", ticker: "woof" },
    });
    expect(r.mode).toBe("creator");
    expect(r.initialBuySol).toBe(50_000_000n);
    if (r.mode === "creator") {
      expect(r.sideA.ticker).toBe("MEOW");
      expect(r.sideB.ticker).toBe("WOOF");
    }
    expect(r.scoreMode).toBe("composite");
  });

  it("accepte un duel ouvert sans camp B", () => {
    expect(CreateBattleInput.safeParse({ ...base, mode: "open_duel" }).success).toBe(true);
  });

  it("refuse les deux camps identiques", () => {
    const r = CreateBattleInput.safeParse({
      ...base,
      mode: "creator",
      sideB: { name: "whiskers", ticker: "MEOW" },
    });
    expect(r.success).toBe(false);
  });

  it("refuse une durée, un lobby ou un achat hors limites", () => {
    const creator = { ...base, mode: "creator", sideB: { name: "Rex", ticker: "WOOF" } };
    expect(CreateBattleInput.safeParse({ ...creator, durationMinutes: 120 }).success).toBe(false);
    expect(CreateBattleInput.safeParse({ ...creator, lobbyMinutes: 2 }).success).toBe(false);
    expect(CreateBattleInput.safeParse({ ...creator, initialBuySol: "5" }).success).toBe(false);
  });

  it("exige l'acceptation des risques", () => {
    const creator = { ...base, mode: "creator", sideB: { name: "Rex", ticker: "WOOF" } };
    expect(CreateBattleInput.safeParse({ ...creator, acceptRisks: false }).success).toBe(false);
  });
});

describe("lobbySchedule", () => {
  it("place le lancement à la fin du lobby", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    expect(lobbySchedule(now, 10).launchAt.toISOString()).toBe("2026-10-20T12:10:00.000Z");
  });
});
