import { AcceptDuelInput } from "@battle/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiFailure, fromDbError, handle, parseBody, requireProfile } from "@/lib/api";
import { assertCleanContent, sideRow, sideTexts } from "@/lib/battle-writes";
import { createClient } from "@/lib/supabase/server";

const Id = z.uuid();

/** Un challenger relève un duel ouvert : il propose le camp B, le lobby s'ouvre. */
export async function POST(request: Request, ctx: RouteContext<"/api/battles/[id]/accept">) {
  return handle(async () => {
    const id = Id.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiFailure(apiError(404, "not_found"));
    await requireProfile();
    const input = await parseBody(request, AcceptDuelInput);
    assertCleanContent(...sideTexts(input.sideB));

    const supabase = await createClient();
    const { error } = await supabase.rpc("accept_duel", {
      p_battle: id.data,
      p_side: sideRow("B", input.sideB),
    });
    if (error) throw fromDbError(error, "accept_failed");
    return NextResponse.json({ ok: true });
  });
}
