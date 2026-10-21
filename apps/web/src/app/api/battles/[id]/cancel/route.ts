import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiFailure, fromDbError, handle, requireProfile } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const Id = z.uuid();

/** Le créateur (ou un admin) annule une battle tant qu'elle n'est pas lancée. */
export async function POST(_request: Request, ctx: RouteContext<"/api/battles/[id]/cancel">) {
  return handle(async () => {
    const id = Id.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiFailure(apiError(404, "not_found"));
    await requireProfile();
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_battle", { p_battle: id.data });
    if (error) throw fromDbError(error, "cancel_failed");
    return NextResponse.json({ ok: true });
  });
}
