"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { BaseWalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type SignInLabels = {
  /** Textes du bouton de choix du wallet (états de wallet-adapter). */
  wallet: {
    "no-wallet": string;
    connecting: string;
    "has-wallet": string;
    "copy-address": string;
    copied: string;
    "change-wallet": string;
    disconnect: string;
  };
  signIn: string;
  signOut: string;
  checkWallet: string;
  failed: string;
  /** Texte affiché par le wallet au moment de signer (une seule ligne, aucune transaction). */
  statement: string;
};

function shortWallet(wallet: string) {
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

/** Connexion par signature de message : wallet connecté -> signature -> session Supabase. */
export function SignInButton({ labels }: { labels: SignInLabels }) {
  const wallet = useWallet();
  // Client créé à la première utilisation dans le navigateur (jamais pendant le rendu serveur).
  const clientRef = useRef<ReturnType<typeof createClient> | null>(null);
  const supabase = () => (clientRef.current ??= createClient());
  const [sessionWallet, setSessionWallet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const read = async () => {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) return setSessionWallet(null);
      const body = (await res.json()) as { profile: { wallet: string } | null };
      setSessionWallet(body.profile?.wallet ?? null);
    };
    // onAuthStateChange émet aussi l'état initial (INITIAL_SESSION) : une seule lecture au chargement.
    const { data } = supabase().auth.onAuthStateChange(() => void read());
    return () => data.subscription.unsubscribe();
  }, []);

  // Le wallet a changé dans l'extension : la session ne correspond plus, on la ferme.
  const connected = wallet.publicKey?.toBase58() ?? null;
  useEffect(() => {
    if (sessionWallet && connected && connected !== sessionWallet) void supabase().auth.signOut();
  }, [connected, sessionWallet]);

  if (!wallet.connected) return <BaseWalletMultiButton labels={labels.wallet} />;

  if (sessionWallet) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-mono text-cyan-300">{shortWallet(sessionWallet)}</span>
        <button
          type="button"
          onClick={() => void supabase().auth.signOut()}
          className="rounded-md border border-zinc-700 px-3 py-1.5 hover:border-zinc-500"
        >
          {labels.signOut}
        </button>
      </div>
    );
  }

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase().auth.signInWithWeb3({
      chain: "solana",
      statement: labels.statement,
      // Seulement la clé publique et la signature de message : marche avec tous les wallets,
      // et évite l'écart de types entre wallet-adapter et Supabase sur signIn.
      wallet: { publicKey: wallet.publicKey, signMessage: wallet.signMessage },
    });
    if (err) setError(labels.failed);
    setBusy(false);
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={busy}
        className="rounded-md bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white hover:bg-fuchsia-400 disabled:opacity-60"
      >
        {busy ? labels.checkWallet : labels.signIn}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
