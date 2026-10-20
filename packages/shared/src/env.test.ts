import { describe, expect, it } from "vitest";
import { z } from "zod";
import { optionalSecret, parseEnv, SolanaCluster } from "./env";

const schema = z.object({ API_URL: z.url(), CLUSTER: SolanaCluster, KEY: optionalSecret });

describe("parseEnv", () => {
  it("renvoie les valeurs validées", () => {
    const env = parseEnv(schema, { API_URL: "https://x.test", CLUSTER: "devnet", KEY: " k " });
    expect(env).toEqual({ API_URL: "https://x.test", CLUSTER: "devnet", KEY: "k" });
  });

  it("traite une variable vide comme absente", () => {
    const env = parseEnv(schema, { API_URL: "https://x.test", CLUSTER: "devnet", KEY: "" });
    expect(env.KEY).toBeUndefined();
  });

  it("nomme les variables en défaut sans afficher leur valeur", () => {
    const secret = "valeur-secrete-123";
    let message = "";
    try {
      parseEnv(schema, { API_URL: secret, CLUSTER: "testnet" });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain("API_URL");
    expect(message).toContain("CLUSTER");
    expect(message).not.toContain(secret);
  });
});
