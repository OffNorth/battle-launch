import { getBuyTokenAmountFromSolAmount, OnlinePumpSdk, PUMP_SDK } from "@pump-fun/pump-sdk";
import { PublicKey, Transaction, type Connection } from "@solana/web3.js";
import BN from "bn.js";
import { NATIVE_MINT } from "./build";

/**
 * Achat d'un token de battle par un spectateur (bouton « Acheter A / B »). Non-custodial : la
 * transaction est construite ici puis signée et envoyée par le wallet de la personne. Le site
 * ne touche jamais aux fonds.
 */

/** Programme Token-2022 : les tokens créés par create_v2 l'utilisent. */
export const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

/** Marge de prix acceptée par défaut sur un achat (en %), la courbe bougeant vite. */
export const DEFAULT_SLIPPAGE_PCT = 3;

export async function buildBuyTx(
  connection: Connection,
  args: { mint: PublicKey; user: PublicKey; solLamports: bigint; slippagePct?: number },
): Promise<{ tx: Transaction; expectedTokens: bigint }> {
  const online = new OnlinePumpSdk(connection);
  const [global, feeConfig, state] = await Promise.all([
    online.fetchGlobal(),
    online.fetchFeeConfig(),
    online.fetchBuyState(args.mint, args.user, TOKEN_2022_PROGRAM_ID),
  ]);
  const solAmount = new BN(args.solLamports.toString());
  const amount = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: state.bondingCurve.tokenTotalSupply,
    bondingCurve: state.bondingCurve,
    amount: solAmount,
    quoteMint: NATIVE_MINT,
  });
  const instructions = await PUMP_SDK.buyInstructions({
    global,
    bondingCurveAccountInfo: state.bondingCurveAccountInfo,
    bondingCurve: state.bondingCurve,
    associatedUserAccountInfo: state.associatedUserAccountInfo,
    mint: args.mint,
    user: args.user,
    amount,
    solAmount,
    slippage: args.slippagePct ?? DEFAULT_SLIPPAGE_PCT,
    tokenProgram: TOKEN_2022_PROGRAM_ID,
  });
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer: args.user, blockhash, lastValidBlockHeight });
  tx.add(...instructions);
  return { tx, expectedTokens: BigInt(amount.toString()) };
}
