import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SignInButton } from "@/components/auth/sign-in-button";
import { SolanaProvider } from "@/components/providers/solana-provider";
import { solanaPublicEnv } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BATTLE LAUNCH",
  description: "Two Pump.fun memecoins launched together, battling live.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background font-sans text-foreground">
        <SolanaProvider rpcUrl={solanaPublicEnv().NEXT_PUBLIC_SOLANA_RPC_URL}>
          <header className="flex items-center justify-between border-b border-zinc-800/80 px-4 py-3">
            <Link href="/" className="font-black tracking-tight">
              <span className="text-fuchsia-400">BATTLE</span>{" "}
              <span className="text-cyan-300">LAUNCH</span>
            </Link>
            <SignInButton />
          </header>
          {children}
        </SolanaProvider>
      </body>
    </html>
  );
}
