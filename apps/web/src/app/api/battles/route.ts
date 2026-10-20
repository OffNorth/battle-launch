import { CreateBattleInput } from "@battle/shared";
import { NextResponse } from "next/server";
import {
  apiError,
  ApiFailure,
  clientIp,
  handle,
  parseBody,
  rateLimit,
  requireProfile,
} from "@/lib/api";
import {
  assertCleanContent,
  lobbySchedule,
  readLimits,
  sideRow,
  sideTexts,
} from "@/lib/battle-writes";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Crée une battle. Mode créateur ou Auto-IA : les deux camps, lobby ouvert tout de suite.
 * Duel ouvert : le camp A seulement, en attente d'un challenger (statut « open »).
 */
export async function POST(request: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    await rateLimit(`ip:${clientIp(request)}:create`, 20, 3600);
    const input = await parseBody(request, CreateBattleInput);

    assertCleanContent(
      input.theme,
      ...sideTexts(input.sideA),
      ...("sideB" in input ? sideTexts(input.sideB) : []),
    );

    const { maxBattlesPerWalletPerDay } = await readLimits();
    await rateLimit(`wallet:${profile.wallet}:create`, maxBattlesPerWalletPerDay, 86_400);

    const isOpen = input.mode === "open_duel";
    const schedule = isOpen ? null : lobbySchedule(new Date(), input.lobbyMinutes);
    const sides = [sideRow("A", input.sideA, profile.id)];
    if ("sideB" in input) sides.push(sideRow("B", input.sideB, profile.id));

    const { data: id, error } = await createAdminClient().rpc("create_battle", {
      p_creator: profile.id,
      p_mode: input.mode,
      p_status: isOpen ? "open" : "lobby",
      p_theme: input.theme,
      p_duration_minutes: input.durationMinutes,
      p_lobby_minutes: input.lobbyMinutes,
      p_score_mode: input.scoreMode,
      p_score_weights: input.weights,
      // Lamports : sûr en nombre JS (1 SOL au plus = 1e9, bien sous 2^53).
      p_initial_buy_lamports: Number(input.initialBuySol),
      // Duel ouvert : pas d'horaire tant qu'aucun challenger n'a relevé le défi. Le nul doit être
      // envoyé tel quel (une clé absente empêche PostgREST de trouver la fonction) ; les types
      // générés ne savent pas que ces paramètres acceptent nul.
      p_lobby_opens_at: (schedule?.lobbyOpensAt.toISOString() ?? null) as string,
      p_launch_at: (schedule?.launchAt.toISOString() ?? null) as string,
      p_sides: sides,
    });
    if (error || !id) {
      const conflict = error?.code === "23505";
      throw new ApiFailure(apiError(conflict ? 409 : 500, conflict ? "conflict" : "create_failed"));
    }
    return NextResponse.json({ id }, { status: 201 });
  });
}
