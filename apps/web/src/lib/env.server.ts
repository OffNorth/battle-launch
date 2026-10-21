import "server-only";
import { optionalSecret, parseEnv } from "@battle/shared";
import { z } from "zod";

/**
 * Variables réservées au serveur (routes API). Secrets : jamais renvoyés au navigateur.
 * Le site n'a volontairement PAS de clé secrète Supabase : il écrit avec la session de
 * l'utilisateur, par des fonctions SQL qui le vérifient elles-mêmes.
 */
const ServerEnv = z.object({
  /** Clé de l'API Claude pour le mode Auto-IA (facultative : sans elle, le mode est indisponible). */
  ANTHROPIC_API_KEY: optionalSecret,
});
export type ServerEnv = z.infer<typeof ServerEnv>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  cached ??= parseEnv(ServerEnv, process.env);
  return cached;
}
