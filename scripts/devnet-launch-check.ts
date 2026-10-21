/**
 * Essai réel sur le DEVNET (SOL de test sans valeur) du mécanisme de lancement :
 * 1. un wallet jetable reçoit des SOL de test (faucet devnet) ;
 * 2. il crée un compte « durable nonce » ;
 * 3. il pré-signe « création du token + achat initial » avec ce nonce ;
 * 4. la transaction est envoyée bien après l'expiration d'un blockhash normal (preuve qu'elle reste valable) ;
 * 5. le trade est relu dans les journaux de la transaction (événement TradeEvent de pump.fun).
 *
 * Lancement : npx tsx scripts/devnet-launch-check.ts
 * Aucune clé n'est enregistrée : tout est jetable et oublié à la fin.
 */
import {
  getBuyTokenAmountFromSolAmount,
  OnlinePumpSdk,
  PUMP_SDK,
  pumpIdl,
  bondingCurvePda,
} from "@pump-fun/pump-sdk";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  NONCE_ACCOUNT_LENGTH,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import BN from "bn.js";

const NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
const WAIT_SECONDS = Number(process.env.WAIT_SECONDS ?? 90);

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const creator = Keypair.generate();
  console.log(`wallet jetable : ${creator.publicKey.toBase58()}`);

  const airdrop = await connection.requestAirdrop(creator.publicKey, 1 * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(airdrop, "confirmed");
  console.log(
    `SOL de test reçus : ${(await connection.getBalance(creator.publicKey)) / LAMPORTS_PER_SOL}`,
  );

  // 2. Compte durable nonce, dont le créateur est l'autorité.
  const nonce = Keypair.generate();
  const rent = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_LENGTH);
  const nonceTx = new Transaction().add(
    SystemProgram.createNonceAccount({
      fromPubkey: creator.publicKey,
      noncePubkey: nonce.publicKey,
      authorizedPubkey: creator.publicKey,
      lamports: rent,
    }),
  );
  await sendAndConfirmTransaction(connection, nonceTx, [creator, nonce]);
  const nonceValue = (await connection.getNonce(nonce.publicKey))?.nonce;
  if (!nonceValue) throw new Error("nonce illisible");
  console.log(`nonce prêt (loyer ${rent / LAMPORTS_PER_SOL} SOL)`);

  // 3. Création + achat initial, pré-signés avec le nonce.
  const online = new OnlinePumpSdk(connection);
  const [global, feeConfig] = await Promise.all([online.fetchGlobal(), online.fetchFeeConfig()]);
  const mint = Keypair.generate();
  const solAmount = new BN(50_000_000); // 0,05 SOL de test
  const amount = getBuyTokenAmountFromSolAmount({
    global,
    feeConfig,
    mintSupply: null,
    bondingCurve: null,
    amount: solAmount,
    quoteMint: NATIVE_MINT,
  });
  const ixs = await PUMP_SDK.createV2AndBuyInstructions({
    global,
    mint: mint.publicKey,
    name: "Battle Check",
    symbol: "BCHK",
    uri: "https://example.com/battle-check.json",
    creator: creator.publicKey,
    user: creator.publicKey,
    amount,
    solAmount,
    mayhemMode: false,
  });
  const launch = new Transaction();
  launch.add(
    SystemProgram.nonceAdvance({
      noncePubkey: nonce.publicKey,
      authorizedPubkey: creator.publicKey,
    }),
  );
  launch.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }));
  launch.add(...ixs);
  launch.recentBlockhash = nonceValue;
  launch.feePayer = creator.publicKey;
  launch.sign(creator, mint);
  const signed = launch.serialize();
  console.log(
    `transaction pré-signée : ${signed.length} octets, mint ${mint.publicKey.toBase58()}`,
  );

  // 4. Attente au-delà de la durée de vie d'un blockhash normal (~60-90 s).
  console.log(`attente ${WAIT_SECONDS} s…`);
  await new Promise((r) => setTimeout(r, WAIT_SECONDS * 1000));
  const sig = await connection.sendRawTransaction(signed, { skipPreflight: false });
  const conf = await connection.confirmTransaction(
    { signature: sig, nonceAccountPubkey: nonce.publicKey, nonceValue, minContextSlot: 0 },
    "confirmed",
  );
  if (conf.value.err) throw new Error(`échec du lancement : ${JSON.stringify(conf.value.err)}`);
  console.log(`lancement confirmé : ${sig}`);

  // 5. Relecture du trade dans les journaux.
  const tx = await connection.getTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 255,
  });
  const disc = Buffer.from(pumpIdl.events.find((e) => e.name === "TradeEvent")!.discriminator);
  for (const line of tx?.meta?.logMessages ?? []) {
    if (!line.startsWith("Program data: ")) continue;
    const data = Buffer.from(line.slice("Program data: ".length), "base64");
    if (!data.subarray(0, 8).equals(disc)) continue;
    const ev = PUMP_SDK.decodeTradeEventBc(data.subarray(8));
    console.log(
      `TradeEvent : achat=${ev.isBuy} sol=${ev.solAmount.toString()} tokens=${ev.tokenAmount.toString()} ` +
        `vSol=${ev.virtualSolReserves.toString()} vTok=${ev.virtualTokenReserves.toString()} user=${ev.user.toBase58()}`,
    );
  }
  console.log(
    `slot ${tx?.slot}, blockTime ${tx?.blockTime}, courbe ${bondingCurvePda(mint.publicKey).toBase58()}`,
  );
}

main().catch((e) => {
  console.error(`ERREUR : ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
