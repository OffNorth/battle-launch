import "server-only";
import { parseEnv } from "@battle/shared";
import { z } from "zod";

/** Variables réservées au serveur (routes API). Secrets : jamais renvoyés au navigateur. */
const ServerEnv = z.object({
  /** Clé « secret » Supabase : contourne la RLS. Sert aux écritures validées par le serveur. */
  SUPABASE_SECRET_KEY: z.string().min(20),
});
export type ServerEnv = z.infer<typeof ServerEnv>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseEnv(ServerEnv, process.env);
  return cached;
}
