import { CreateBattleInput } from "@battle/shared";
import { NextResponse } from "next/server";
import { fromDbError, handle, parseBody, requireProfile } from "@/lib/api";
import { assertCleanContent, sideRow, sideTexts } from "@/lib/battle-writes";
import { createClient } from "@/lib/supabase/server";

/**
 * Crée une battle. Mode créateur ou Auto-IA : les deux camps, lobby ouvert tout de suite.
 * Duel ouvert : le camp A seulement, en attente d'un challenger (statut « open »).
 * La fonction SQL décide du statut et des horaires, vérifie l'appelant et sa limite du jour.
 */
export async function POST(request: Request) {
  return handle(async () => {
    await requireProfile();
    const input = await parseBody(request, CreateBattleInput);
    assertCleanContent(
      input.theme,
      ...sideTexts(input.sideA),
      ...("sideB" in input ? sideTexts(input.sideB) : []),
    );

    const sides = [sideRow("A", input.sideA)];
    if ("sideB" in input) sides.push(sideRow("B", input.sideB));

    const supabase = await createClient();
    const { data: id, error } = await supabase.rpc("create_battle", {
      p_mode: input.mode,
      p_theme: input.theme,
      p_duration_minutes: input.durationMinutes,
      p_lobby_minutes: input.lobbyMinutes,
      p_score_mode: input.scoreMode,
      p_score_weights: input.weights,
      // Lamports : sûr en nombre JS (1 SOL au plus = 1e9, bien sous 2^53).
      p_initial_buy_lamports: Number(input.initialBuySol),
      p_sides: sides,
    });
    if (error) throw fromDbError(error, "create_failed");
    return NextResponse.json({ id }, { status: 201 });
  });
}
