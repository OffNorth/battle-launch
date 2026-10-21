import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const base = {
  REDIS_URL: "redis://default:pw@localhost:6379",
  DATABASE_URL:
    "postgresql://battle_worker.ref:pw@aws-1-eu-west-3.pooler.supabase.com:5432/postgres",
  SOLANA_RPC_URL: "https://api.devnet.solana.com",
  APP_URL: "https://battle-launch.test",
};

describe("loadEnv", () => {
  it("part en devnet par défaut", () => {
    expect(loadEnv(base).SOLANA_CLUSTER).toBe("devnet");
  });

  it("refuse mainnet sans ALLOW_MAINNET=yes", () => {
    expect(() => loadEnv({ ...base, SOLANA_CLUSTER: "mainnet-beta" })).toThrow(/ALLOW_MAINNET/);
  });

  it("accepte l'absence de DATABASE_URL (production : mot de passe créé par le worker)", () => {
    expect(loadEnv({ ...base, DATABASE_URL: undefined }).DATABASE_URL).toBeUndefined();
  });

  it("refuse une base qui n'est pas Postgres, sans afficher l'adresse", () => {
    const secret = "mysql://user:secret-password@host/db";
    let message = "";
    try {
      loadEnv({ ...base, DATABASE_URL: secret });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("DATABASE_URL");
    expect(message).not.toContain("secret-password");
  });
});
