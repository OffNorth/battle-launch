"use client";

import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import type { ReactNode } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";

/**
 * Connexion aux wallets. Liste vide exprès : Phantom, Solflare et Backpack suivent le
 * « Wallet Standard » et sont détectés tout seuls, sans paquet propre à chacun.
 */
export function SolanaProvider({ rpcUrl, children }: { rpcUrl: string; children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={rpcUrl}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
