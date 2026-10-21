import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiFailure, fromDbError, handle, requireProfile } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const Id = z.uuid();

async function setWatch(ctx: RouteContext<"/api/battles/[id]/watch">, watch: boolean) {
  const id = Id.safeParse((await ctx.params).id);
  if (!id.success) throw new ApiFailure(apiError(404, "not_found"));
  await requireProfile();
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_battle_watch", { p_battle: id.data, p_watch: watch });
  if (error) throw fromDbError(error, "watch_failed");
  return NextResponse.json({ watching: watch });
}

/** Pré-inscription au lobby (être prévenu du lancement). Seulement avant le départ. */
export async function POST(_request: Request, ctx: RouteContext<"/api/battles/[id]/watch">) {
  return handle(() => setWatch(ctx, true));
}

/** Annule sa pré-inscription. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/battles/[id]/watch">) {
  return handle(() => setWatch(ctx, false));
}
