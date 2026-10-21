import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiFailure, fromDbError, handle, parseBody, requireProfile } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

/**
 * Actions d'administration. La base revérifie que l'appelant est admin et journalise chaque
 * action (audit_logs) ; ce contrôle-ci ne sert qu'à répondre vite.
 */
const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("feature"), battleId: z.uuid(), value: z.boolean() }),
  z.object({ action: z.literal("cancel"), battleId: z.uuid() }),
  z.object({
    action: z.literal("hide"),
    messageId: z.number().int().positive(),
    value: z.boolean(),
  }),
  z.object({ action: z.literal("ban"), profileId: z.uuid(), value: z.boolean() }),
  z.object({
    action: z.literal("report"),
    reportId: z.number().int().positive(),
    status: z.enum(["dismissed", "actioned"]),
  }),
  z.object({
    action: z.literal("setting"),
    key: z.enum(["limits", "anti_cheat"]),
    value: z.record(z.string(), z.unknown()),
  }),
]);

export async function POST(request: Request) {
  return handle(async () => {
    const profile = await requireProfile();
    if (!profile.isAdmin) throw new ApiFailure(apiError(403, "forbidden"));
    const input = await parseBody(request, Action);
    const supabase = await createClient();
    const call = () => {
      switch (input.action) {
        case "feature":
          return supabase.rpc("admin_set_featured", {
            p_battle: input.battleId,
            p_featured: input.value,
          });
        case "cancel":
          return supabase.rpc("cancel_battle", { p_battle: input.battleId });
        case "hide":
          return supabase.rpc("admin_hide_message", {
            p_message: input.messageId,
            p_hidden: input.value,
          });
        case "ban":
          return supabase.rpc("admin_set_banned", {
            p_profile: input.profileId,
            p_banned: input.value,
          });
        case "report":
          return supabase.rpc("admin_resolve_report", {
            p_report: input.reportId,
            p_status: input.status,
          });
        case "setting":
          return supabase.rpc("admin_update_setting", {
            p_key: input.key,
            p_value: input.value as never,
          });
      }
    };
    const { error } = await call();
    if (error) throw fromDbError(error, "admin_failed");
    return NextResponse.json({ ok: true });
  });
}
