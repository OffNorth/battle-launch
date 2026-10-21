import { describe, expect, it } from "vitest";
import { signInMessage } from "./siws";

describe("signInMessage", () => {
  const base = {
    domain: "localhost:3000",
    address: "Dem0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    statement: "Sign in to BATTLE LAUNCH. This is a signature only: no transaction, no fee.",
    uri: "http://localhost:3000/en",
    issuedAt: "2026-10-23T10:00:00.000Z",
  };

  it("respecte l'ordre du standard (URI avant Version)", () => {
    expect(signInMessage(base)).toBe(
      [
        "localhost:3000 wants you to sign in with your Solana account:",
        base.address,
        "",
        base.statement,
        "",
        "URI: http://localhost:3000/en",
        "Version: 1",
        "Issued At: 2026-10-23T10:00:00.000Z",
      ].join("\n"),
    );
  });

  it("ajoute le Chain ID à sa place", () => {
    const lines = signInMessage({ ...base, chainId: "devnet" }).split("\n");
    expect(lines.indexOf("Chain ID: devnet")).toBe(lines.indexOf("Version: 1") + 1);
  });

  it("refuse une phrase sur plusieurs lignes", () => {
    expect(() => signInMessage({ ...base, statement: "a\nb" })).toThrow();
  });
});
