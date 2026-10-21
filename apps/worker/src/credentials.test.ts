import { createHash, createHmac, pbkdf2Sync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildUrl, scramVerifier } from "./credentials";

describe("scramVerifier", () => {
  it("produit le format Postgres et se recalcule à l'identique", () => {
    const salt = Buffer.alloc(16, 7);
    const v = scramVerifier("motdepasse", salt);
    expect(v).toMatch(/^SCRAM-SHA-256\$4096:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/);
    const salted = pbkdf2Sync("motdepasse", salt, 4096, 32, "sha256");
    const stored = createHash("sha256")
      .update(createHmac("sha256", salted).update("Client Key").digest())
      .digest();
    expect(v).toContain(stored.toString("base64"));
    expect(v).not.toContain("motdepasse");
  });
});

describe("buildUrl", () => {
  it("échappe le mot de passe dans l'adresse", () => {
    expect(buildUrl({ host: "h", port: 5432, user: "u.ref", database: "postgres" }, "a/b+c")).toBe(
      "postgresql://u.ref:a%2Fb%2Bc@h:5432/postgres",
    );
  });
});
