import { createHash, createHmac, pbkdf2Sync, randomBytes } from "node:crypto";
import postgres from "postgres";
import type { Redis } from "ioredis";
import { log } from "./log";

/**
 * Mot de passe base de données du worker de production, que PERSONNE ne voit :
 * - au premier démarrage, le worker en tire un au hasard, le range dans son Redis privé et en
 *   donne l'empreinte SCRAM à la base grâce à l'identifiant d'amorçage (à usage unique) ;
 * - ensuite, il le relit dans Redis.
 * En local, DATABASE_URL suffit (compte battle_worker).
 */

const REDIS_KEY = "battle:db-password";

/** Empreinte SCRAM-SHA-256 au format Postgres (ne permet pas de retrouver le mot de passe). */
export function scramVerifier(password: string, salt = randomBytes(16), iterations = 4096): string {
  const salted = pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const clientKey = createHmac("sha256", salted).update("Client Key").digest();
  const storedKey = createHash("sha256").update(clientKey).digest();
  const serverKey = createHmac("sha256", salted).update("Server Key").digest();
  return `SCRAM-SHA-256$${iterations}:${salt.toString("base64")}$${storedKey.toString("base64")}:${serverKey.toString("base64")}`;
}

export type DbTarget = { host: string; port: number; user: string; database: string };

export function buildUrl(target: DbTarget, password: string): string {
  return `postgresql://${encodeURIComponent(target.user)}:${encodeURIComponent(password)}@${target.host}:${target.port}/${target.database}`;
}

/** Adresse de connexion de production : mot de passe relu dans Redis, ou créé par amorçage. */
export async function productionDatabaseUrl(
  redis: Redis,
  target: DbTarget,
  bootstrapUrl: string | undefined,
): Promise<string> {
  const existing = await redis.get(REDIS_KEY);
  if (existing) return buildUrl(target, existing);
  if (!bootstrapUrl) {
    throw new Error(
      "aucun mot de passe en Redis et pas d'identifiant d'amorçage (BOOTSTRAP_DATABASE_URL)",
    );
  }
  const password = randomBytes(32).toString("base64url");
  // Rangé d'abord (NX : un seul worker gagne), retiré si la base refuse.
  const stored = await redis.set(REDIS_KEY, password, "NX");
  if (stored !== "OK") {
    const winner = await redis.get(REDIS_KEY);
    if (!winner) throw new Error("mot de passe introuvable après amorçage concurrent");
    return buildUrl(target, winner);
  }
  const boot = postgres(bootstrapUrl, { ssl: "require", max: 1, connect_timeout: 15 });
  try {
    await boot`select app_private.rotate_worker_password(${scramVerifier(password)})`;
    log("credentials", "mot de passe du worker créé et enregistré (amorçage désactivé)");
  } catch (e) {
    await redis.del(REDIS_KEY);
    throw new Error(
      `amorçage refusé par la base (${e instanceof Error ? e.message.slice(0, 80) : "?"})`,
    );
  } finally {
    await boot.end({ timeout: 2 }).catch(() => undefined);
  }
  return buildUrl(target, password);
}
