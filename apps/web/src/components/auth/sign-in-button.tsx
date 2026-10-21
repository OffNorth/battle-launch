"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { BaseWalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { SolanaWallet } from "@supabase/supabase-js";
import { signInMessage } from "@/lib/siws";
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

/** Vrai seulement dans le navigateur, après le premier rendu (faux au rendu serveur et pendant l'hydratation). */
const noSubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );
}

/** Connexion par signature de message : wallet connecté -> signature -> session Supabase. */
export function SignInButton({ labels }: { labels: SignInLabels }) {
  const wallet = useWallet();
  const mounted = useMounted();
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

  // Le navigateur se souvient du dernier wallet choisi (icône Phantom…), le serveur non : avant
  // l'hydratation, on affiche le même bouton neutre des deux côtés (sinon React refait toute la page).
  if (!mounted)
    return (
      <span className="inline-flex h-9 items-center rounded-full bg-side-a px-4 text-sm font-medium text-on-side">
        {labels.wallet["no-wallet"]}
      </span>
    );
  if (!wallet.connected) return <BaseWalletMultiButton labels={labels.wallet} />;

  if (sessionWallet) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-mono text-side-a">{shortWallet(sessionWallet)}</span>
        <button
          type="button"
          onClick={() => void supabase().auth.signOut()}
          className="rounded-md border border-border px-3 py-1.5 hover:border-side-a"
        >
          {labels.signOut}
        </button>
      </div>
    );
  }

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await signInWithWallet();
      if (err) setError(labels.failed);
    } catch {
      // Signature refusée dans le wallet, wallet fermé… : message clair, pas de plantage.
      setError(labels.failed);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Deux chemins, tous deux au format standard « Sign In With Solana » :
   * 1. le wallet sait faire « signIn » (Phantom, Solflare, Backpack…) : c'est LUI qui écrit le
   *    message, dans le format qu'il attend ;
   * 2. sinon, on écrit nous-mêmes le message (signInMessage) et le wallet le signe.
   * On n'utilise plus le message écrit par Supabase : il met « Version » avant « URI », ordre que
   * Phantom refuse (« invalid formatting », vu le 23/10/2026).
   */
  const signInWithWallet = async () => {
    const auth = supabase().auth;
    const signInFn = wallet.signIn;
    if (signInFn) {
      return auth.signInWithWeb3({
        chain: "solana",
        statement: labels.statement,
        wallet: {
          // Types de wallet-adapter et de Supabase presque identiques mais déclarés à part.
          signIn: async (...inputs) =>
            (await signInFn(inputs[0] as Parameters<typeof signInFn>[0])) as Awaited<
              ReturnType<NonNullable<SolanaWallet["signIn"]>>
            >,
        },
      });
    }
    if (!wallet.publicKey || !wallet.signMessage) throw new Error("wallet sans signature");
    const message = signInMessage({
      domain: window.location.host,
      address: wallet.publicKey.toBase58(),
      statement: labels.statement,
      uri: window.location.href,
      issuedAt: new Date().toISOString(),
    });
    const signature = await wallet.signMessage(new TextEncoder().encode(message));
    return auth.signInWithWeb3({ chain: "solana", message, signature });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void signIn()}
        disabled={busy}
        className="rounded-full bg-side-a px-4 py-2 text-sm font-medium text-on-side hover:bg-side-a/90 disabled:opacity-60"
      >
        {busy ? labels.checkWallet : labels.signIn}
      </button>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
