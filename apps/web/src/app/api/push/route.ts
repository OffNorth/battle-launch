import { NextResponse } from "next/server";
import { z } from "zod";
import { fromDbError, handle, parseBody, requireProfile } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

/** Enregistre l'abonnement web push du navigateur de la personne connectée. */
export async function POST(request: Request) {
  return handle(async () => {
    await requireProfile();
    const input = await parseBody(request, Body);
    const supabase = await createClient();
    const { error } = await supabase.rpc("save_push_subscription", {
      p_endpoint: input.endpoint,
      p_keys: input.keys,
    });
    if (error) throw fromDbError(error, "push_failed");
    return NextResponse.json({ ok: true }, { status: 201 });
  });
}
