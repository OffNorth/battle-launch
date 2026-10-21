import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import fixture from "./launch-tx.fixture.json";
import {
  validateBuyTx,
  validateCreateTx,
  validateLaunchPair,
  type LaunchExpectation,
} from "./validate";

/** Transactions construites avec le vrai SDK sur le Global du devnet, signées par des clés jetables. */
const exp: LaunchExpectation = {
  ...fixture.expectation,
  initialBuyLamports: BigInt(fixture.expectation.initialBuyLamports),
};

describe("validateLaunchPair", () => {
  it("accepte les transactions construites par le site", () => {
    const r = validateLaunchPair(fixture.createTx, fixture.buyTx, exp);
    expect(r).toEqual({
      ok: true,
      tokenAmount: BigInt(fixture.tokenAmount),
      maxSolCost: expect.any(BigInt),
    });
  });

  it("refuse un autre achat initial que celui de la battle", () => {
    expect(validateBuyTx(fixture.buyTx, { ...exp, initialBuyLamports: 10_000_000n })).toEqual({
      ok: false,
      reason: "wrong_initial_buy",
    });
  });

  it("refuse un autre mint, un autre nom ou un autre ticker", () => {
    const other = Keypair.generate().publicKey.toBase58();
    expect(validateCreateTx(fixture.createTx, { ...exp, mint: other }).ok).toBe(false);
    expect(validateCreateTx(fixture.createTx, { ...exp, symbol: "WOOF" })).toEqual({
      ok: false,
      reason: "wrong_metadata",
    });
  });

  it("refuse un autre payeur ou un autre nonce", () => {
    const other = Keypair.generate().publicKey.toBase58();
    expect(validateCreateTx(fixture.createTx, { ...exp, creator: other })).toEqual({
      ok: false,
      reason: "wrong_fee_payer",
    });
    expect(validateBuyTx(fixture.buyTx, { ...exp, buyNonceAccount: other })).toEqual({
      ok: false,
      reason: "wrong_nonce",
    });
  });

  it("refuse une transaction modifiée après signature", () => {
    const bytes = Buffer.from(fixture.buyTx, "base64");
    bytes[bytes.length - 3] = (bytes[bytes.length - 3] ?? 0) ^ 0xff;
    expect(validateBuyTx(bytes.toString("base64"), exp).ok).toBe(false);
  });

  it("refuse un virement de SOL glissé dans la transaction", () => {
    const creator = Keypair.generate();
    const tx = Transaction.from(Buffer.from(fixture.buyTx, "base64"));
    const forged = new Transaction({ feePayer: creator.publicKey });
    forged.add(...tx.instructions);
    forged.add(
      SystemProgram.transfer({
        fromPubkey: creator.publicKey,
        toPubkey: Keypair.generate().publicKey,
        lamports: 1,
      }),
    );
    forged.recentBlockhash = tx.recentBlockhash ?? "";
    forged.sign(creator);
    expect(
      validateBuyTx(forged.serialize({ verifySignatures: false }).toString("base64"), {
        ...exp,
        creator: creator.publicKey.toBase58(),
      }).ok,
    ).toBe(false);
  });

  it("refuse n'importe quoi", () => {
    expect(validateCreateTx("pas-une-transaction", exp)).toEqual({
      ok: false,
      reason: "invalid_format",
    });
  });
});
