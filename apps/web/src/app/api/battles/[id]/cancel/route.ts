import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiFailure, handle, requireProfile } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const Id = z.uuid();

/** Le créateur (ou un admin) annule une battle tant qu'elle n'est pas lancée. */
export async function POST(_request: Request, ctx: RouteContext<"/api/battles/[id]/cancel">) {
  return handle(async () => {
    const id = Id.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiFailure(apiError(404, "not_found"));
    const profile = await requireProfile();
    const admin = createAdminClient();
    const { data: battle } = await admin
      .from("battles")
      .select("created_by, status")
      .eq("id", id.data)
      .maybeSingle();
    if (!battle) throw new ApiFailure(apiError(404, "not_found"));
    const isOwner = battle.created_by === profile.id;
    if (!isOwner && !profile.isAdmin) throw new ApiFailure(apiError(403, "forbidden"));
    // Une fois le lancement commencé, plus d'annulation à la main : les tokens existent peut-être déjà.
    const { data: updated, error } = await admin
      .from("battles")
      .update({ status: "cancelled", cancel_reason: isOwner ? "creator" : "admin" })
      .eq("id", id.data)
      .in("status", ["draft", "open", "lobby"])
      .select("id");
    if (error) throw new ApiFailure(apiError(500, "cancel_failed"));
    if (!updated || updated.length === 0) throw new ApiFailure(apiError(409, "already_launched"));
    if (!isOwner) {
      await admin
        .from("audit_logs")
        .insert({ actor_id: profile.id, action: "battle.cancel", target: id.data });
    }
    return NextResponse.json({ ok: true });
  });
}
