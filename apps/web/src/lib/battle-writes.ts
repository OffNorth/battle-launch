import "server-only";
import { lobbySchedule, moderateText, type SideInput } from "@battle/shared";
import { ApiFailure, apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

/** Refuse marques, personnalités et haine dans les textes publics d'une battle (422). */
export function assertCleanContent(...texts: (string | undefined)[]) {
  const result = moderateText(...texts);
  if (!result.ok)
    throw new ApiFailure(apiError(422, "content_refused", { reasons: result.reasons }));
}

export function sideTexts(side: SideInput): string[] {
  return [side.name, side.ticker, side.description];
}

/** Réglage public `limits` (nombre de battles par wallet et par jour, battles en direct au plus). */
export async function readLimits(): Promise<{ maxBattlesPerWalletPerDay: number }> {
  const { data } = await createAdminClient()
    .from("settings")
    .select("value")
    .eq("key", "limits")
    .maybeSingle();
  const value = (data?.value ?? {}) as { max_battles_per_wallet_per_day?: unknown };
  const n = Number(value.max_battles_per_wallet_per_day);
  return { maxBattlesPerWalletPerDay: Number.isInteger(n) && n > 0 ? n : 3 };
}

/** Noms trop proches d'un camp déjà existant (même concept relancé) : refus 409. */
export async function assertNotDuplicate(names: string[]) {
  const { data, error } = await createAdminClient().rpc("find_similar_sides", {
    p_names: names,
    p_min_similarity: 0.8,
  });
  if (error) throw new ApiFailure(apiError(503, "duplicate_check_unavailable"));
  if (data && data.length > 0) {
    throw new ApiFailure(
      apiError(409, "duplicate_concept", { similar: data.slice(0, 3).map((d) => d.name) }),
    );
  }
}

export function sideRow(side: "A" | "B", input: SideInput, creatorId: string) {
  return {
    side,
    name: input.name,
    ticker: input.ticker,
    description: input.description ?? "",
    image_url: input.imageUrl ?? "",
    creator_id: creatorId,
  };
}

export { lobbySchedule };
