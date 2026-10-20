import { AcceptDuelInput } from "@battle/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiFailure, handle, parseBody, rateLimit, requireProfile } from "@/lib/api";
import { assertCleanContent, lobbySchedule, sideRow, sideTexts } from "@/lib/battle-writes";
import { createAdminClient } from "@/lib/supabase/admin";

const Id = z.uuid();

/** Un challenger relève un duel ouvert : il propose le camp B, le lobby s'ouvre. */
export async function POST(request: Request, ctx: RouteContext<"/api/battles/[id]/accept">) {
  return handle(async () => {
    const id = Id.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiFailure(apiError(404, "not_found"));
    const profile = await requireProfile();
    await rateLimit(`wallet:${profile.wallet}:accept`, 10, 3600);
    const input = await parseBody(request, AcceptDuelInput);
    assertCleanContent(...sideTexts(input.sideB));

    const admin = createAdminClient();
    const { data: battle } = await admin
      .from("battles")
      .select("lobby_minutes")
      .eq("id", id.data)
      .maybeSingle();
    if (!battle) throw new ApiFailure(apiError(404, "not_found"));
    const schedule = lobbySchedule(new Date(), battle.lobby_minutes);

    const { data: outcome, error } = await admin.rpc("accept_duel", {
      p_battle: id.data,
      p_challenger: profile.id,
      p_side: sideRow("B", input.sideB, profile.id),
      p_lobby_opens_at: schedule.lobbyOpensAt.toISOString(),
      p_launch_at: schedule.launchAt.toISOString(),
    });
    if (error) {
      const conflict = error.code === "23505";
      throw new ApiFailure(apiError(conflict ? 409 : 500, conflict ? "conflict" : "accept_failed"));
    }
    if (outcome === "own_battle") throw new ApiFailure(apiError(403, "own_battle"));
    if (outcome !== "ok") throw new ApiFailure(apiError(409, "not_open"));
    return NextResponse.json({ ok: true });
  });
}
