"use client";

import { metadataUri } from "@battle/shared";
import { buildLaunchTxs, buildNonceAccountsTx } from "@battle/shared/launch";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, type PublicKey, type Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";

export type PrepSide = {
  id: string;
  side: "A" | "B";
  name: string;
  ticker: string;
  prepared: boolean;
};

/**
 * Préparation du lancement par le créateur, pendant le lobby (non-custodial : tout est signé
 * dans SON wallet ; la clé du mint est générée ici puis oubliée).
 * 1. Une transaction crée deux comptes « durable nonce » par camp (signature n° 1, envoyée).
 * 2. Pour chaque camp : création du token et achat initial, pré-signés (signature n° 2, gardés
 *    par le site jusqu'à l'heure du lancement, puis envoyés par le worker).
 */
export function LaunchPrep(props: {
  battleId: string;
  sides: PrepSide[];
  initialBuyLamports: number;
  appUrl: string;
  labels: Dictionary["launch"];
  errors: Dictionary["errors"];
}) {
  const { labels } = props;
  const { connection } = useConnection();
  const wallet = useWallet();
  const router = useRouter();
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const todo = props.sides.filter((s) => !s.prepared);

  if (props.sides.length === 0) return null;
  if (todo.length === 0) {
    return <p className="text-center text-sm font-medium text-side-a">{labels.ready}</p>;
  }

  async function prepare() {
    const owner = wallet.publicKey;
    if (!owner || !wallet.signTransaction || !wallet.signAllTransactions) {
      setError(labels.walletNeeded);
      return;
    }
    setError(null);
    try {
      // 1. Comptes durable nonce : deux par camp (création, achat initial).
      setStep(labels.stepNonces);
      const nonceKeys = todo.flatMap(() => [Keypair.generate(), Keypair.generate()]);
      const nonceTx = await buildNonceAccountsTx(
        connection,
        owner,
        nonceKeys.map((k) => k.publicKey),
      );
      nonceTx.partialSign(...nonceKeys);
      const signedNonceTx = await wallet.signTransaction(nonceTx);
      const sig = await connection.sendRawTransaction(signedNonceTx.serialize());
      const latest = await connection.getLatestBlockhash("confirmed");
      const conf = await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
      if (conf.value.err) throw new Error("nonce");

      // 2. Transactions de lancement, construites puis signées en une fois.
      setStep(labels.stepSign);
      const nonceValue = async (account: PublicKey) => {
        const info = await connection.getNonce(account, "confirmed");
        if (!info) throw new Error("nonce");
        return info.nonce;
      };
      const built: {
        side: PrepSide;
        mint: Keypair;
        create: Transaction;
        buy: Transaction;
        nonces: PublicKey[];
      }[] = [];
      for (const [i, side] of todo.entries()) {
        const createKey = nonceKeys[2 * i];
        const buyKey = nonceKeys[2 * i + 1];
        if (!createKey || !buyKey) throw new Error("nonce");
        const mint = Keypair.generate();
        const { createTx, buyTx } = await buildLaunchTxs(connection, {
          creator: owner,
          mint: mint.publicKey,
          createNonce: {
            account: createKey.publicKey,
            value: await nonceValue(createKey.publicKey),
          },
          buyNonce: { account: buyKey.publicKey, value: await nonceValue(buyKey.publicKey) },
          name: side.name,
          symbol: side.ticker,
          uri: metadataUri(props.appUrl, side.id),
          initialBuyLamports: BigInt(props.initialBuyLamports),
        });
        createTx.partialSign(mint);
        built.push({
          side,
          mint,
          create: createTx,
          buy: buyTx,
          nonces: [createKey.publicKey, buyKey.publicKey],
        });
      }
      const signed = await wallet.signAllTransactions(built.flatMap((b) => [b.create, b.buy]));

      // 3. Dépôt sur le site (vérifié, puis gardé jusqu'à l'heure du lancement).
      setStep(labels.stepSubmit);
      for (const [i, b] of built.entries()) {
        const create = signed[2 * i];
        const buy = signed[2 * i + 1];
        if (!create || !buy) throw new Error("sign");
        const res = await fetch(`/api/battles/${props.battleId}/launch-tx`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            side: b.side.side,
            mint: b.mint.publicKey.toBase58(),
            createTx: Buffer.from(create.serialize()).toString("base64"),
            createNonce: b.nonces[0]?.toBase58(),
            buyTx: Buffer.from(buy.serialize()).toString("base64"),
            buyNonce: b.nonces[1]?.toBase58(),
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "generic");
        }
      }
      setStep(null);
      router.refresh();
    } catch (e) {
      setStep(null);
      const code = e instanceof Error ? e.message : "generic";
      setError(props.errors[code] ?? labels.failed);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-side-a/40 bg-card p-4 text-center">
      <p className="text-sm">{labels.explain}</p>
      <ul className="text-xs text-muted-foreground">
        {props.sides.map((s) => (
          <li key={s.id}>
            {s.name} (${s.ticker}) — {s.prepared ? labels.sideReady : labels.sidePending}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => void prepare()}
        disabled={step !== null}
        className="rounded-md bg-side-a px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {step ?? labels.prepare}
      </button>
      <p className="text-xs text-muted-foreground">{labels.cost}</p>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
