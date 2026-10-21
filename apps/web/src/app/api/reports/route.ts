import { NextResponse } from "next/server";
import { z } from "zod";
import { fromDbError, handle, parseBody, requireProfile } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  targetType: z.enum(["battle", "side", "message", "profile"]),
  targetId: z.string().trim().min(1).max(64),
  reason: z.string().trim().min(3).max(500),
});

/** Signalement d'une battle, d'un camp, d'un message ou d'un profil (traité dans /admin). */
export async function POST(request: Request) {
  return handle(async () => {
    await requireProfile();
    const input = await parseBody(request, Body);
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_report", {
      p_target_type: input.targetType,
      p_target_id: input.targetId,
      p_reason: input.reason,
    });
    if (error) throw fromDbError(error, "report_failed");
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
