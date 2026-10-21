"use client";

import { parseSolToLamports } from "@battle/shared";
import { buildBuyTx } from "@battle/shared/launch";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";

/**
 * Bouton « Acheter » d'un camp. Non-custodial : la transaction est construite dans le navigateur
 * et signée par le wallet de la personne ; le site ne détient jamais de fonds.
 */
export function BuyPanel(props: {
  side: "A" | "B";
  name: string;
  ticker: string;
  mint: string;
  cluster: string;
  labels: Dictionary["live"];
}) {
  const { labels } = props;
  const { connection } = useConnection();
  const wallet = useWallet();
  const [amount, setAmount] = useState("0.01");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; sig?: string } | null>(null);

  async function buy() {
    const lamports = parseSolToLamports(amount);
    if (!lamports || lamports <= 0n) {
      setMessage({ ok: false, text: labels.invalidAmount });
      return;
    }
    if (!wallet.publicKey) {
      setMessage({ ok: false, text: labels.connectFirst });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const { tx } = await buildBuyTx(connection, {
        mint: new PublicKey(props.mint),
        user: wallet.publicKey,
        solLamports: lamports,
      });
      const sig = await wallet.sendTransaction(tx, connection);
      const latest = await connection.getLatestBlockhash("confirmed");
      const conf = await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
      setMessage(
        conf.value.err
          ? { ok: false, text: labels.buyFailed }
          : { ok: true, text: labels.buyDone, sig },
      );
    } catch {
      setMessage({ ok: false, text: labels.buyFailed });
    } finally {
      setBusy(false);
    }
  }

  const accent = props.side === "A" ? "bg-side-a" : "bg-side-b";
  const explorer = (sig: string) =>
    `https://solscan.io/tx/${sig}${props.cluster === "devnet" ? "?cluster=devnet" : ""}`;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="shrink-0 text-muted-foreground">SOL</span>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          aria-label={`${labels.amount} (${props.ticker})`}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5"
        />
      </label>
      <button
        type="button"
        onClick={() => void buy()}
        disabled={busy}
        className={`${accent} rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-60`}
      >
        {busy ? labels.buying : labels.buy.replace("{name}", props.name)}
      </button>
      {message && (
        <p role="status" className={`text-xs ${message.ok ? "text-side-a" : "text-destructive"}`}>
          {message.text}{" "}
          {message.sig && (
            <a href={explorer(message.sig)} target="_blank" rel="noreferrer" className="underline">
              {labels.viewTx}
            </a>
          )}
        </p>
      )}
    </div>
  );
}
