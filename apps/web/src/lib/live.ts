import "server-only";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Données de départ de la page d'une battle lancée (le reste arrive en temps réel) : stats des
 * deux camps, bougies, derniers trades, derniers messages du chat, wallets écartés.
 */

export type SideStat = {
  side: "A" | "B";
  volumeLamports: number;
  buys: number;
  sells: number;
  holders: number;
  marketCapLamports: number;
  score: number;
};
export type CandlePoint = {
  side: "A" | "B";
  bucket: string;
  open: number;
  high: number;
  low: number;
  close: number;
};
export type TradeItem = {
  id: number;
  side: "A" | "B";
  wallet: string;
  isBuy: boolean;
  solLamports: number;
  blockTime: string;
  signature: string;
};
export type ChatItem = { id: number; body: string; createdAt: string; author: string };
export type FlagItem = { wallet: string; reason: string };

export type LiveData = {
  stats: SideStat[];
  candles: CandlePoint[];
  trades: TradeItem[];
  chat: ChatItem[];
  flags: FlagItem[];
};

export async function getLiveData(battleId: string): Promise<LiveData> {
  const supabase = createPublicClient();
  const [stats, candles, trades, chat, flags] = await Promise.all([
    supabase.from("side_stats").select("*").eq("battle_id", battleId),
    supabase.from("candles").select("*").eq("battle_id", battleId).order("bucket"),
    supabase
      .from("trades")
      .select("id, side, wallet, is_buy, sol_lamports, block_time, signature")
      .eq("battle_id", battleId)
      .order("block_time", { ascending: false })
      .limit(40),
    supabase
      .from("chat_messages")
      .select(
        "id, body, created_at, author:profiles!chat_messages_author_id_fkey ( wallet, display_name )",
      )
      .eq("battle_id", battleId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("wallet_flags").select("wallet, reason").eq("battle_id", battleId).limit(200),
  ]);
  return {
    stats: (stats.data ?? []).map((s) => ({
      side: s.side,
      volumeLamports: s.volume_lamports,
      buys: s.buys,
      sells: s.sells,
      holders: s.unique_holders,
      marketCapLamports: s.market_cap_lamports,
      score: s.score,
    })),
    candles: (candles.data ?? []).map((c) => ({
      side: c.side,
      bucket: c.bucket,
      open: c.open_price,
      high: c.high_price,
      low: c.low_price,
      close: c.close_price,
    })),
    trades: (trades.data ?? []).map((t) => ({
      id: t.id,
      side: t.side,
      wallet: t.wallet,
      isBuy: t.is_buy,
      solLamports: t.sol_lamports,
      blockTime: t.block_time,
      signature: t.signature,
    })),
    chat: (chat.data ?? [])
      .map((m) => ({
        id: m.id,
        body: m.body,
        createdAt: m.created_at,
        author: m.author?.display_name ?? m.author?.wallet ?? "?",
      }))
      .reverse(),
    flags: flags.data ?? [],
  };
}
