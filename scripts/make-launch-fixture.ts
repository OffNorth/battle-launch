/**
 * Fabrique un exemple des deux transactions de lancement d'un camp pour les tests de
 * validateLaunchPair : construites avec le vrai SDK et le vrai « Global » du devnet, signées par
 * des clés JETABLES (rien n'est envoyé ; les clés sont oubliées). Vérifie aussi leur taille.
 * Résultat : packages/shared/src/launch/launch-tx.fixture.json.
 *
 * Lancement : npx tsx scripts/make-launch-fixture.ts
 */
import { writeFileSync } from "node:fs";
import { Connection, Keypair } from "@solana/web3.js";
import { buildLaunchTxs } from "../packages/shared/src/launch/build";

async function main() {
  const connection = new Connection(
    process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com",
    "confirmed",
  );
  const creator = Keypair.generate();
  const mint = Keypair.generate();
  const createNonce = {
    account: Keypair.generate().publicKey,
    value: Keypair.generate().publicKey.toBase58(),
  };
  const buyNonce = {
    account: Keypair.generate().publicKey,
    value: Keypair.generate().publicKey.toBase58(),
  };
  const spec = {
    creator: creator.publicKey,
    mint: mint.publicKey,
    createNonce,
    buyNonce,
    name: "Whiskers",
    symbol: "MEOW",
    uri: "https://battle-launch.test/api/metadata/00000000-0000-4000-8000-000000000001",
    initialBuyLamports: 50_000_000n,
  };
  const { createTx, buyTx, tokenAmount } = await buildLaunchTxs(connection, spec);
  createTx.sign(creator, mint);
  buyTx.sign(creator);
  const createBytes = createTx.serialize();
  const buyBytes = buyTx.serialize();
  console.log(
    `tailles : création ${createBytes.length} octets, achat ${buyBytes.length} octets (limite 1232)`,
  );
  const fixture = {
    createTx: createBytes.toString("base64"),
    buyTx: buyBytes.toString("base64"),
    expectation: {
      creator: creator.publicKey.toBase58(),
      mint: mint.publicKey.toBase58(),
      createNonceAccount: createNonce.account.toBase58(),
      buyNonceAccount: buyNonce.account.toBase58(),
      name: spec.name,
      symbol: spec.symbol,
      uri: spec.uri,
      initialBuyLamports: spec.initialBuyLamports.toString(),
    },
    tokenAmount: tokenAmount.toString(),
  };
  writeFileSync(
    "packages/shared/src/launch/launch-tx.fixture.json",
    JSON.stringify(fixture, null, 2) + "\n",
  );
  console.log("fixture écrite");
}

main().catch((e) => {
  console.error(`ERREUR : ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
