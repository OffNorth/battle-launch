import { BorshInstructionCoder, type Idl } from "@coral-xyz/anchor";
import { pumpIdl, PUMP_PROGRAM_ID } from "@pump-fun/pump-sdk";
import { PublicKey, SystemInstruction, SystemProgram, Transaction } from "@solana/web3.js";
import type BN from "bn.js";

/**
 * Vérification complète des deux transactions de lancement pré-signées d'un camp (création,
 * puis achat initial), AVANT de les envoyer. Le worker n'envoie que ce qui passe : la base ne
 * peut pas lire le contenu d'une transaction, et un créateur pourrait déposer n'importe quoi en
 * appelant la base directement.
 */

const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

/** Le SDK met 1 % de marge sur le coût maximal de l'achat ; on tolère jusqu'à 2 %. */
const MAX_COST_MARGIN_BPS = 200n;

export type LaunchExpectation = {
  creator: string;
  mint: string;
  createNonceAccount: string;
  buyNonceAccount: string;
  name: string;
  symbol: string;
  uri: string;
  initialBuyLamports: bigint;
};

export type LaunchCheck =
  { ok: true; tokenAmount: bigint; maxSolCost: bigint } | { ok: false; reason: string };

const idl = pumpIdl as unknown as Idl;
const coder = new BorshInstructionCoder(idl);

function accountIndex(ixName: string, account: string): number {
  const ix = idl.instructions.find((i) => i.name === ixName);
  const index = ix?.accounts.findIndex((a) => a.name === account) ?? -1;
  if (index < 0) throw new Error(`IDL pump : compte ${account} introuvable dans ${ixName}`);
  return index;
}
const CREATE_MINT = accountIndex("create_v2", "mint");
const BUY_MINT = accountIndex("buy", "mint");
const BUY_USER = accountIndex("buy", "user");

type Failure = { ok: false; reason: string };
const fail = (reason: string): Failure => ({ ok: false, reason });

/** Contrôles communs : format, payeur, signatures, avance du bon nonce en première instruction. */
function openTx(base64: string, creator: PublicKey, nonceAccount: string): Transaction | Failure {
  let tx: Transaction;
  try {
    tx = Transaction.from(Buffer.from(base64, "base64"));
  } catch {
    return fail("invalid_format");
  }
  if (!tx.feePayer?.equals(creator)) return fail("wrong_fee_payer");
  if (!tx.verifySignatures(true)) return fail("bad_signatures");
  const [first] = tx.instructions;
  if (!first || !first.programId.equals(SystemProgram.programId)) return fail("no_nonce_advance");
  try {
    if (SystemInstruction.decodeInstructionType(first) !== "AdvanceNonceAccount")
      return fail("no_nonce_advance");
    const adv = SystemInstruction.decodeNonceAdvance(first);
    if (adv.noncePubkey.toBase58() !== nonceAccount || !adv.authorizedPubkey.equals(creator)) {
      return fail("wrong_nonce");
    }
  } catch {
    return fail("no_nonce_advance");
  }
  // Après l'avance du nonce : aucune autre instruction du System Program (pas de virement caché).
  if (tx.instructions.slice(1).some((ix) => ix.programId.equals(SystemProgram.programId))) {
    return fail("extra_system_ix");
  }
  return tx;
}

/** Transaction de création : avance du nonce puis create_v2 seul, signée par la clé du mint. */
export function validateCreateTx(base64: string, exp: LaunchExpectation): { ok: true } | Failure {
  const creator = new PublicKey(exp.creator);
  const mint = new PublicKey(exp.mint);
  const tx = openTx(base64, creator, exp.createNonceAccount);
  if ("ok" in tx) return tx;
  if (tx.instructions.length !== 2) return fail("unexpected_instructions");
  if (!tx.signatures.some((s) => s.publicKey.equals(mint))) return fail("mint_not_signer");
  const ix = tx.instructions[1];
  if (!ix?.programId.equals(PUMP_PROGRAM_ID)) return fail("no_create");
  const decoded = coder.decode(ix.data);
  if (decoded?.name !== "create_v2") return fail("no_create");
  const data = decoded.data as Record<string, unknown>;
  if (!ix.keys[CREATE_MINT]?.pubkey.equals(mint)) return fail("wrong_mint");
  if (data.name !== exp.name || data.symbol !== exp.symbol || data.uri !== exp.uri)
    return fail("wrong_metadata");
  if (data.is_mayhem_mode !== false) return fail("mayhem_mode");
  return { ok: true };
}

/** Transaction d'achat initial : avance du nonce, compte de tokens du créateur, achat du bon montant. */
export function validateBuyTx(base64: string, exp: LaunchExpectation): LaunchCheck {
  const creator = new PublicKey(exp.creator);
  const mint = new PublicKey(exp.mint);
  const tx = openTx(base64, creator, exp.buyNonceAccount);
  if ("ok" in tx) return tx;
  if (tx.instructions.length !== 3) return fail("unexpected_instructions");
  const [, ata, buyIx] = tx.instructions;
  if (!ata?.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)) return fail("no_token_account");
  if (!buyIx?.programId.equals(PUMP_PROGRAM_ID)) return fail("no_buy");
  const decoded = coder.decode(buyIx.data);
  if (decoded?.name !== "buy") return fail("no_buy");
  if (!buyIx.keys[BUY_MINT]?.pubkey.equals(mint) || !buyIx.keys[BUY_USER]?.pubkey.equals(creator)) {
    return fail("wrong_buy_accounts");
  }
  const data = decoded.data as Record<string, unknown>;
  const amount = BigInt((data.amount as BN).toString());
  const maxSolCost = BigInt((data.max_sol_cost as BN).toString());
  const maxAllowed =
    exp.initialBuyLamports + (exp.initialBuyLamports * MAX_COST_MARGIN_BPS) / 10_000n;
  if (maxSolCost < exp.initialBuyLamports || maxSolCost > maxAllowed)
    return fail("wrong_initial_buy");
  return { ok: true, tokenAmount: amount, maxSolCost };
}

/** Les deux transactions d'un camp. */
export function validateLaunchPair(
  createB64: string,
  buyB64: string,
  exp: LaunchExpectation,
): LaunchCheck {
  const created = validateCreateTx(createB64, exp);
  if (!created.ok) return created;
  return validateBuyTx(buyB64, exp);
}
