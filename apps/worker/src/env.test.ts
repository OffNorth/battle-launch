import { describe, expect, it } from "vitest";
import { loadEnv } from "./env";

const base = {
  REDIS_URL: "redis://default:pw@localhost:6379",
  SUPABASE_URL: "https://abc.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_0123456789abcdef",
  SOLANA_RPC_URL: "https://api.devnet.solana.com",
};

describe("loadEnv", () => {
  it("part en devnet par défaut", () => {
    expect(loadEnv(base).SOLANA_CLUSTER).toBe("devnet");
  });

  it("refuse mainnet sans ALLOW_MAINNET=yes", () => {
    expect(() => loadEnv({ ...base, SOLANA_CLUSTER: "mainnet-beta" })).toThrow(/ALLOW_MAINNET/);
    expect(
      loadEnv({ ...base, SOLANA_CLUSTER: "mainnet-beta", ALLOW_MAINNET: "yes" }).SOLANA_CLUSTER,
    ).toBe("mainnet-beta");
  });
});
