import "server-only";
import type { Json } from "@battle/shared";
import { createPublicClient } from "@/lib/supabase/public";

/** Lectures publiques des résultats : snapshot, classement, Hall of Fame, profils. */

export async function getSnapshot(
  battleId: string,
): Promise<{ payload: Json; sha256: string } | null> {
  const { data } = await createPublicClient()
    .from("snapshots")
    .select("payload, sha256")
    .eq("battle_id", battleId)
    .maybeSingle();
  return data ?? null;
}

export type LeaderRow = {
  wallet: string;
  displayName: string | null;
  wins: number;
  played: number;
};

export async function getLeaderboard(limit = 50): Promise<LeaderRow[]> {
  const { data } = await createPublicClient()
    .from("leaderboard")
    .select("wallet, display_name, wins, battles_played")
    .gt("battles_played", 0)
    .order("wins", { ascending: false })
    .order("battles_played", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    wallet: r.wallet ?? "",
    displayName: r.display_name,
    wins: r.wins ?? 0,
    played: r.battles_played ?? 0,
  }));
}

export type FameRow = {
  id: string;
  theme: string;
  finishedAt: string | null;
  isFeatured: boolean;
  winner: { name: string; ticker: string; score: number | null } | null;
  loser: { name: string; ticker: string; score: number | null } | null;
};

export async function getHallOfFame(limit = 30): Promise<FameRow[]> {
  const { data } = await createPublicClient()
    .from("battles")
    .select(
      "id, theme, finished_at, is_featured, winner_side, battle_sides ( side, name, ticker ), side_stats ( side, score )",
    )
    .eq("status", "finished")
    .not("winner_side", "is", null)
    .order("is_featured", { ascending: false })
    .order("finished_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((b) => {
    const pick = (side: string | null) => {
      const s = b.battle_sides.find((x) => x.side === side);
      if (!s) return null;
      return {
        name: s.name,
        ticker: s.ticker,
        score: b.side_stats.find((x) => x.side === side)?.score ?? null,
      };
    };
    const other = b.winner_side === "A" ? "B" : "A";
    return {
      id: b.id,
      theme: b.theme,
      finishedAt: b.finished_at,
      isFeatured: b.is_featured,
      winner: pick(b.winner_side),
      loser: pick(other),
    };
  });
}

export type ProfileView = {
  wallet: string;
  displayName: string | null;
  createdAt: string;
  wins: number;
  battles: { id: string; theme: string; status: string; side: string; won: boolean | null }[];
};

export async function getProfile(wallet: string): Promise<ProfileView | null> {
  const supabase = createPublicClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, wallet, display_name, created_at, is_banned")
    .eq("wallet", wallet)
    .maybeSingle();
  if (!profile || profile.is_banned) return null;
  const [{ data: sides }, { count }] = await Promise.all([
    supabase
      .from("battle_sides")
      .select("side, battle:battles ( id, theme, status, winner_side, created_at )")
      .eq("creator_id", profile.id)
      .limit(100),
    supabase
      .from("badges")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile.id)
      .eq("kind", "winner"),
  ]);
  const battles = (sides ?? [])
    .flatMap((s) =>
      s.battle
        ? [
            {
              id: s.battle.id,
              theme: s.battle.theme,
              status: s.battle.status,
              side: s.side,
              won: s.battle.status === "finished" ? s.battle.winner_side === s.side : null,
              createdAt: s.battle.created_at,
            },
          ]
        : [],
    )
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return {
    wallet: profile.wallet,
    displayName: profile.display_name,
    createdAt: profile.created_at,
    wins: count ?? 0,
    battles,
  };
}
