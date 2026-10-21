import { getBuyTokenAmountFromSolAmount, OnlinePumpSdk, PUMP_SDK } from "@pump-fun/pump-sdk";
import {
  NONCE_ACCOUNT_LENGTH,
  PublicKey,
  SystemProgram,
  Transaction,
  type Connection,
} from "@solana/web3.js";
import BN from "bn.js";

/** Mint du SOL « emballé » : désigne une courbe cotée en SOL pour les calculs de frais du SDK. */
export const NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");

/**
 * Construction des transactions de lancement avec le SDK officiel de pump.fun. Utilisé par le
 * navigateur du créateur (qui signe dans son wallet) et par les scripts devnet. Aucune clé
 * privée ici : on construit, on ne signe pas (sauf la clé du mint, générée et jetée par l'appelant).
 *
 * Pourquoi DEUX transactions par camp : « création + achat initial + avance du nonce » pèse
 * 1 308 octets, au-delà de la limite de 1 232 octets d'une transaction Solana (mesuré le
 * 21/10/2026). La création et l'achat initial partent donc chacun dans leur transaction, chacune
 * avec son propre durable nonce. Sur mainnet, le worker les enverra ensemble dans un bundle Jito
 * (tout ou rien) ; sur devnet, créations d'abord puis achats.
 * Pas d'instruction de budget de calcul : par défaut chaque instruction a 200 000 unités, assez
 * pour la création (≈ 140 000) et pour l'achat.
 */

/** Une transaction qui crée `nonceAccounts.length` comptes durable nonce, dont le créateur est l'autorité. */
export async function buildNonceAccountsTx(
  connection: Connection,
  creator: PublicKey,
  nonceAccounts: PublicKey[],
): Promise<Transaction> {
  const rent = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: creator, blockhash, lastValidBlockHeight });
  for (const noncePubkey of nonceAccounts) {
    tx.add(
      SystemProgram.createNonceAccount({
        fromPubkey: creator,
        noncePubkey,
        authorizedPubkey: creator,
        lamports: rent,
      }),
    );
  }
  return tx;
}

export type LaunchSpec = {
  creator: PublicKey;
  mint: PublicKey;
  /** Nonce de la transaction de création, et sa valeur actuelle. */
  createNonce: { account: PublicKey; value: string };
  /** Nonce de la transaction d'achat initial, et sa valeur actuelle. */
  buyNonce: { account: PublicKey; value: string };
  name: string;
  symbol: string;
  uri: string;
  initialBuyLamports: bigint;
};

export type LaunchTxs = { createTx: Transaction; buyTx: Transaction; tokenAmount: bigint };

/**
 * Les deux transactions d'un camp, à faire signer par le créateur (et la création, par la clé
 * du mint). Elles restent valables jusqu'à l'envoi grâce aux durable nonces.
 */
export async function buildLaunchTxs(connection: Connection, spec: LaunchSpec): Promise<LaunchTxs> {
  const online = new OnlinePumpSdk(connection);
  const [global, feeConfig] = await Promise.all([online.fetchGlobal(), online.fetchFeeConfig()]);
  const solAmount = new BN(spec.initialBuyLamports.toString());
  const amount = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: null,
    bondingCurve: null,
    amount: solAmount,
    quoteMint: NATIVE_MINT,
  });
  // [create_v2, création idempotente du compte de tokens, achat] : on garde l'ordre du SDK.
  const [createIx, ataIx, buyIx] = await PUMP_SDK.createV2AndBuyInstructions({
    global,
    mint: spec.mint,
    name: spec.name,
    symbol: spec.symbol,
    uri: spec.uri,
    creator: spec.creator,
    user: spec.creator,
    amount,
    solAmount,
    mayhemMode: false,
  });
  if (!createIx || !ataIx || !buyIx) throw new Error("SDK pump : instructions inattendues");

  const createTx = new Transaction({ feePayer: spec.creator });
  createTx.add(
    SystemProgram.nonceAdvance({
      noncePubkey: spec.createNonce.account,
      authorizedPubkey: spec.creator,
    }),
  );
  createTx.add(createIx);
  createTx.recentBlockhash = spec.createNonce.value;

  const buyTx = new Transaction({ feePayer: spec.creator });
  buyTx.add(
    SystemProgram.nonceAdvance({
      noncePubkey: spec.buyNonce.account,
      authorizedPubkey: spec.creator,
    }),
  );
  buyTx.add(ataIx, buyIx);
  buyTx.recentBlockhash = spec.buyNonce.value;

  return { createTx, buyTx, tokenAmount: BigInt(amount.toString()) };
}

/** Paramètres de la courbe au lancement, lus sur la chaîne (devnet : 0,3 SOL virtuel ; mainnet : 30 SOL). */
export async function fetchCurveParams(connection: Connection) {
  const global = await new OnlinePumpSdk(connection).fetchGlobal();
  return {
    totalSupply: BigInt(global.tokenTotalSupply.toString()),
    initialVirtualSolReserves: BigInt(global.initialVirtualSolReserves.toString()),
    initialVirtualTokenReserves: BigInt(global.initialVirtualTokenReserves.toString()),
  };
}
