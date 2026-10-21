import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiFailure, fromDbError, handle, parseBody, requireProfile } from "@/lib/api";
import { assertCleanContent } from "@/lib/battle-writes";
import { createClient } from "@/lib/supabase/server";

const Id = z.uuid();
const Body = z.object({ body: z.string().trim().min(1).max(280) });

/** Message dans le chat d'une battle (filtre de contenu ici et dans la base, 12 messages par minute). */
export async function POST(request: Request, ctx: RouteContext<"/api/battles/[id]/chat">) {
  return handle(async () => {
    const id = Id.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiFailure(apiError(404, "not_found"));
    await requireProfile();
    const { body } = await parseBody(request, Body);
    assertCleanContent(body);
    const supabase = await createClient();
    const { error } = await supabase.rpc("post_chat_message", { p_battle: id.data, p_body: body });
    if (error) throw fromDbError(error, "chat_failed");
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
