import { Connection } from "@solana/web3.js";
import { createDb } from "./db";
import { loadEnv } from "./env";
import { runCleanup, runClosings } from "./jobs/close";
import { runIndexer } from "./jobs/index-trades";
import { runLaunches } from "./jobs/launch";
import { log } from "./log";

/**
 * Une seule passe de chaque tâche, sans Redis ni BullMQ (diagnostic, essais en local) :
 * npm run once --workspace @battle/worker   (REDIS_URL peut être factice)
 */
const env = loadEnv();
if (!env.DATABASE_URL)
  throw new Error("once : DATABASE_URL requis (compte battle_worker, essais en local)");
const db = createDb(env.DATABASE_URL);
const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");
for (const [name, run] of [
  ["launch", () => runLaunches(db, connection, env)],
  ["index", () => runIndexer(db, connection)],
  ["close", () => runClosings(db, connection, env)],
  ["cleanup", () => runCleanup(db)],
] as const) {
  const started = Date.now();
  await run();
  log(name, `passe faite en ${Date.now() - started} ms`);
}
await db.end({ timeout: 5 });
