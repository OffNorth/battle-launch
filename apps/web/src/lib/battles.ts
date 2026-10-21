import "server-only";
import type { Enums } from "@battle/shared";
import { createPublicClient } from "@/lib/supabase/public";

export type BattleSideSummary = {
  side: Enums<"side_letter">;
  name: string;
  ticker: string;
  imageUrl: string | null;
  score: number | null;
  volumeLamports: number | null;
  holders: number | null;
};

export type BattleSummary = {
  id: string;
  theme: string;
  status: Enums<"battle_status">;
  durationMinutes: number;
  launchAt: string | null;
  startedAt: string | null;
  endsAt: string | null;
  winnerSide: Enums<"side_letter"> | null;
  isFeatured: boolean;
  sides: { A: BattleSideSummary | null; B: BattleSideSummary | null };
};

const SELECT = `id, theme, status, duration_minutes, launch_at, started_at, ends_at, winner_side, is_featured,
  battle_sides ( side, name, ticker, image_url ),
  side_stats ( side, score, volume_lamports, unique_holders )`;

/** Battles publiques pour l'accueil : en direct, à venir, terminées. */
export async function listHomeBattles(): Promise<{
  featured: BattleSummary[];
  live: BattleSummary[];
  upcoming: BattleSummary[];
  results: BattleSummary[];
}> {
  const supabase = createPublicClient();
  const [featured, live, upcoming, results] = await Promise.all([
    supabase
      .from("battles")
      .select(SELECT)
      .eq("is_featured", true)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("battles")
      .select(SELECT)
      .in("status", ["launching", "live", "closing"])
      .order("ends_at")
      .limit(24),
    supabase
      .from("battles")
      .select(SELECT)
      .in("status", ["open", "lobby"])
      .order("launch_at")
      .limit(24),
    supabase
      .from("battles")
      .select(SELECT)
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(12),
  ]);
  const error = featured.error ?? live.error ?? upcoming.error ?? results.error;
  if (error) throw new Error(`lecture des battles impossible (${error.code})`);
  return {
    featured: (featured.data ?? []).map(toSummary),
    live: (live.data ?? []).map(toSummary),
    upcoming: (upcoming.data ?? []).map(toSummary),
    results: (results.data ?? []).map(toSummary),
  };
}

type Row = {
  id: string;
  theme: string;
  status: Enums<"battle_status">;
  duration_minutes: number;
  launch_at: string | null;
  started_at: string | null;
  ends_at: string | null;
  winner_side: Enums<"side_letter"> | null;
  is_featured: boolean;
  battle_sides: {
    side: Enums<"side_letter">;
    name: string;
    ticker: string;
    image_url: string | null;
  }[];
  side_stats: {
    side: Enums<"side_letter">;
    score: number;
    volume_lamports: number;
    unique_holders: number;
  }[];
};

function toSummary(row: Row): BattleSummary {
  const pick = (side: Enums<"side_letter">): BattleSideSummary | null => {
    const s = row.battle_sides.find((x) => x.side === side);
    if (!s) return null;
    const stats = row.side_stats.find((x) => x.side === side);
    return {
      side,
      name: s.name,
      ticker: s.ticker,
      imageUrl: s.image_url,
      score: stats?.score ?? null,
      volumeLamports: stats?.volume_lamports ?? null,
      holders: stats?.unique_holders ?? null,
    };
  };
  return {
    id: row.id,
    theme: row.theme,
    status: row.status,
    durationMinutes: row.duration_minutes,
    launchAt: row.launch_at,
    startedAt: row.started_at,
    endsAt: row.ends_at,
    winnerSide: row.winner_side,
    isFeatured: row.is_featured,
    sides: { A: pick("A"), B: pick("B") },
  };
}

export type BattleDetail = BattleSummary & {
  mode: Enums<"battle_mode">;
  createdBy: string;
  lobbyMinutes: number;
  scoreMode: Enums<"score_mode">;
  initialBuyLamports: number;
  watchersCount: number;
  cancelReason: string | null;
  sideDetails: {
    id: string;
    side: Enums<"side_letter">;
    name: string;
    ticker: string;
    description: string | null;
    imageUrl: string | null;
    mint: string | null;
    creatorId: string | null;
    creatorWallet: string | null;
  }[];
};

/** Une battle publique avec ses camps, ou null (inexistante ou brouillon d'un autre). */
export async function getBattle(id: string): Promise<BattleDetail | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("battles")
    .select(
      `${SELECT}, mode, created_by, lobby_minutes, score_mode, initial_buy_lamports, watchers_count, cancel_reason,
       details:battle_sides ( id, side, name, ticker, description, image_url, mint, creator_id, creator:profiles!battle_sides_creator_id_fkey ( wallet ) )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`lecture de la battle impossible (${error.code})`);
  if (!data) return null;
  return {
    ...toSummary(data as unknown as Row),
    mode: data.mode,
    createdBy: data.created_by,
    lobbyMinutes: data.lobby_minutes,
    scoreMode: data.score_mode,
    initialBuyLamports: data.initial_buy_lamports,
    watchersCount: data.watchers_count,
    cancelReason: data.cancel_reason,
    sideDetails: data.details
      .map((d) => ({
        id: d.id,
        side: d.side,
        name: d.name,
        ticker: d.ticker,
        description: d.description,
        imageUrl: d.image_url,
        mint: d.mint,
        creatorId: d.creator_id,
        creatorWallet: d.creator?.wallet ?? null,
      }))
      .sort((a, b) => (a.side < b.side ? -1 : 1)),
  };
}
