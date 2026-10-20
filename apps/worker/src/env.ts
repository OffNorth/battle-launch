import { optionalSecret, parseEnv, SolanaCluster } from "@battle/shared";
import { z } from "zod";

/** Réglages du worker, lus et validés une seule fois au démarrage. */
const WorkerEnv = z.object({
  /** Adresse du Redis Railway (BullMQ). Contient un mot de passe : secret. */
  REDIS_URL: z.url(),
  /** Adresse du projet Supabase (publique). */
  SUPABASE_URL: z.url(),
  /** Clé « secret » (service_role) de Supabase : contourne la RLS, uniquement côté serveur. */
  SUPABASE_SECRET_KEY: z.string().min(20),
  /** Réseau Solana : devnet par défaut, mainnet seulement après validation. */
  SOLANA_CLUSTER: SolanaCluster.default("devnet"),
  /** RPC Solana (Helius conseillé). Une adresse avec clé est un secret. */
  SOLANA_RPC_URL: z.url(),
  /** Port du petit serveur de santé lu par Railway. */
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  /** Token du bot Telegram pour les annonces (facultatif). */
  TELEGRAM_BOT_TOKEN: optionalSecret,
});
export type WorkerEnv = z.infer<typeof WorkerEnv>;

export function loadEnv(source: Record<string, string | undefined> = process.env): WorkerEnv {
  const env = parseEnv(WorkerEnv, source);
  if (env.SOLANA_CLUSTER === "mainnet-beta" && source.ALLOW_MAINNET !== "yes") {
    throw new Error(
      "SOLANA_CLUSTER=mainnet-beta refusé : mettre ALLOW_MAINNET=yes après validation.",
    );
  }
  return env;
}
