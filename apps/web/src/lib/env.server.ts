import "server-only";
import { optionalSecret, parseEnv } from "@battle/shared";
import { z } from "zod";

/** Variables réservées au serveur (routes API). Secrets : jamais renvoyés au navigateur. */
const ServerEnv = z.object({
  /** Clé « secret » Supabase : contourne la RLS. Sert aux écritures validées par le serveur. */
  SUPABASE_SECRET_KEY: z.string().min(20),
  /** Clé de l'API Claude pour le mode Auto-IA (facultative : sans elle, le mode est indisponible). */
  ANTHROPIC_API_KEY: optionalSecret,
});
export type ServerEnv = z.infer<typeof ServerEnv>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseEnv(ServerEnv, process.env);
  return cached;
}
