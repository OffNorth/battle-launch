import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiFailure, handle, rateLimit, requireProfile } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const Id = z.uuid();

async function target(ctx: RouteContext<"/api/battles/[id]/watch">) {
  const id = Id.safeParse((await ctx.params).id);
  if (!id.success) throw new ApiFailure(apiError(404, "not_found"));
  return id.data;
}

/** Pré-inscription au lobby (être prévenu du lancement). Seulement avant le départ. */
export async function POST(_request: Request, ctx: RouteContext<"/api/battles/[id]/watch">) {
  return handle(async () => {
    const battleId = await target(ctx);
    const profile = await requireProfile();
    await rateLimit(`wallet:${profile.wallet}:watch`, 60, 3600);
    const admin = createAdminClient();
    const { data: battle } = await admin
      .from("battles")
      .select("status")
      .eq("id", battleId)
      .maybeSingle();
    if (!battle) throw new ApiFailure(apiError(404, "not_found"));
    if (battle.status !== "open" && battle.status !== "lobby") {
      throw new ApiFailure(apiError(409, "lobby_closed"));
    }
    const { error } = await admin
      .from("battle_watchers")
      .upsert(
        { battle_id: battleId, profile_id: profile.id },
        { onConflict: "battle_id,profile_id", ignoreDuplicates: true },
      );
    if (error) throw new ApiFailure(apiError(500, "watch_failed"));
    return NextResponse.json({ watching: true });
  });
}

/** Annule sa pré-inscription. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/battles/[id]/watch">) {
  return handle(async () => {
    const battleId = await target(ctx);
    const profile = await requireProfile();
    const { error } = await createAdminClient()
      .from("battle_watchers")
      .delete()
      .eq("battle_id", battleId)
      .eq("profile_id", profile.id);
    if (error) throw new ApiFailure(apiError(500, "watch_failed"));
    return NextResponse.json({ watching: false });
  });
}
