import { optionalSecret, parseEnv, SolanaCluster } from "@battle/shared";
import { z } from "zod";

/** Réglages du worker, lus et validés une seule fois au démarrage. */
const WorkerEnv = z.object({
  /** Adresse du Redis Railway (BullMQ). Contient un mot de passe : secret. */
  REDIS_URL: z.url(),
  /**
   * En LOCAL seulement : connexion Postgres du compte `battle_worker` (contient son mot de passe).
   * En production, laisser vide : le worker se connecte en `battle_worker_prod` avec un mot de
   * passe qu'il crée lui-même au premier démarrage (voir credentials.ts).
   */
  DATABASE_URL: optionalSecret.pipe(
    z
      .string()
      .refine((u) => u.startsWith("postgres"), "doit commencer par postgres")
      .optional(),
  ),
  /** Production : identifiant d'amorçage à usage unique (premier démarrage seulement). */
  BOOTSTRAP_DATABASE_URL: optionalSecret,
  /** Production : où se connecter (pooler Supabase, mode session). Rien de secret ici. */
  DB_HOST: z.string().default("aws-1-eu-west-3.pooler.supabase.com"),
  DB_PORT: z.coerce.number().int().default(5432),
  DB_USER: z.string().default("battle_worker_prod.gqeiqlejxqotldubsxic"),
  DB_NAME: z.string().default("postgres"),
  /** Réseau Solana : devnet par défaut, mainnet seulement après validation. */
  SOLANA_CLUSTER: SolanaCluster.default("devnet"),
  /** RPC Solana (Helius conseillé). Une adresse avec clé est un secret. */
  SOLANA_RPC_URL: z.url(),
  /** Adresse publique du site : les métadonnées des tokens doivent pointer exactement dessus. */
  APP_URL: z.url(),
  /** Port du petit serveur de santé lu par Railway. */
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  /** Annonce des gagnants sur Telegram (facultatif : les deux, ou rien). */
  TELEGRAM_BOT_TOKEN: optionalSecret,
  TELEGRAM_CHAT_ID: optionalSecret,
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
