/**
 * Simulation sur le DEVNET de « création du token + achat initial » (rien n'est envoyé, rien
 * n'est dépensé) : vérifie que les instructions construites avec le SDK officiel passent bien
 * dans le vrai programme pump.fun du devnet, et que le TradeEvent se relit dans les journaux.
 *
 * PAYER : une adresse devnet qui a du solde (la simulation ne vérifie pas les signatures).
 * Lancement : PAYER=<adresse> npx tsx scripts/devnet-simulate-launch.ts
 */
import {
  getBuyTokenAmountFromSolAmount,
  OnlinePumpSdk,
  PUMP_SDK,
  pumpIdl,
} from "@pump-fun/pump-sdk";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";

const NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");

const RPC = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

async function main() {
  const payerArg = process.env.PAYER;
  if (!payerArg) throw new Error("PAYER manquant");
  const payer = new PublicKey(payerArg);
  const connection = new Connection(RPC, "confirmed");
  const online = new OnlinePumpSdk(connection);
  const [global, feeConfig] = await Promise.all([online.fetchGlobal(), online.fetchFeeConfig()]);
  const mint = Keypair.generate();
  const solAmount = new BN(process.env.BUY_LAMPORTS ?? "10000000");
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
    creator: payer,
    user: payer,
    amount,
    solAmount,
    mayhemMode: false,
  });
  const { blockhash } = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions: [ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ...ixs],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  const sim = await connection.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });
  console.log(
    `erreur : ${JSON.stringify(sim.value.err)} ; unités de calcul : ${sim.value.unitsConsumed}`,
  );
  console.log(`tokens attendus pour ${solAmount.toString()} lamports : ${amount.toString()}`);
  const disc = Buffer.from(pumpIdl.events.find((e) => e.name === "TradeEvent")!.discriminator);
  let found = false;
  for (const line of sim.value.logs ?? []) {
    if (!line.startsWith("Program data: ")) continue;
    const data = Buffer.from(line.slice("Program data: ".length), "base64");
    if (!data.subarray(0, 8).equals(disc)) continue;
    const ev = PUMP_SDK.decodeTradeEventBc(data.subarray(8));
    found = true;
    console.log(
      `TradeEvent : achat=${ev.isBuy} sol=${ev.solAmount.toString()} tokens=${ev.tokenAmount.toString()} ` +
        `vSol=${ev.virtualSolReserves.toString()} vTok=${ev.virtualTokenReserves.toString()} ix=${ev.ixName}`,
    );
  }
  if (!found) console.log((sim.value.logs ?? []).slice(-15).join("\n"));
}

main().catch((e) => {
  console.error(`ERREUR : ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
