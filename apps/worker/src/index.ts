import { createServer } from "node:http";
import { Connection } from "@solana/web3.js";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { productionDatabaseUrl } from "./credentials";
import { createDb } from "./db";
import { loadEnv } from "./env";
import { runCleanup, runClosings } from "./jobs/close";
import { runIndexer } from "./jobs/index-trades";
import { runLaunches } from "./jobs/launch";
import { log } from "./log";
import { setupPush } from "./push";

/**
 * Worker BATTLE LAUNCH : quatre tâches répétées par BullMQ (une file chacune, une exécution à
 * la fois par file, donc jamais deux lancements de la même battle en même temps) :
 * - launch  : toutes les 5 s, lance les battles dont le lobby est fini ;
 * - index   : toutes les 6 s, lit les trades et met à jour stats, score et bougies ;
 * - close   : toutes les 10 s, clôture les battles terminées (snapshot, gagnant) ;
 * - cleanup : toutes les 10 min, ménage (duels expirés, lancements interrompus).
 * Santé : GET /health (200 si Redis et la base répondent).
 */

const env = loadEnv();
const connection = new Connection(env.SOLANA_RPC_URL, "confirmed");

// BullMQ exige maxRetriesPerRequest: null pour ses connexions bloquantes.
const redisOptions = { maxRetriesPerRequest: null } as const;
const redis = new Redis(env.REDIS_URL, redisOptions);
redis.on("error", (err) => log("redis", `${err.name}: ${err.message.split("\n")[0]}`));

// Local : DATABASE_URL (compte battle_worker). Production : mot de passe créé par le worker
// lui-même et gardé dans Redis (voir credentials.ts).
const db = createDb(
  env.DATABASE_URL ??
    (await productionDatabaseUrl(
      redis,
      { host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, database: env.DB_NAME },
      env.BOOTSTRAP_DATABASE_URL,
    )),
);

await setupPush(redis, db, env.APP_URL);

const TASKS: { name: string; everyMs: number; run: () => Promise<void> }[] = [
  { name: "launch", everyMs: 5_000, run: () => runLaunches(db, connection, env) },
  { name: "index", everyMs: 6_000, run: () => runIndexer(db, connection) },
  { name: "close", everyMs: 10_000, run: () => runClosings(db, connection, env) },
  { name: "cleanup", everyMs: 600_000, run: () => runCleanup(db) },
];

const workers: Worker[] = [];
const queues: Queue[] = [];
for (const task of TASKS) {
  const queue = new Queue(task.name, { connection: new Redis(env.REDIS_URL, redisOptions) });
  // Planification idempotente : redémarrer le worker ne crée pas de doublon.
  await queue.upsertJobScheduler(
    `${task.name}-every`,
    { every: task.everyMs },
    {
      name: task.name,
      opts: { removeOnComplete: 50, removeOnFail: 200 },
    },
  );
  queues.push(queue);
  const worker = new Worker(
    task.name,
    async () => {
      await task.run();
    },
    { connection: new Redis(env.REDIS_URL, redisOptions), concurrency: 1 },
  );
  worker.on("failed", (_job, err) => log(task.name, `échec : ${err.message.slice(0, 200)}`));
  workers.push(worker);
}

const server = createServer(async (req, res) => {
  if (req.url !== "/health") {
    res.writeHead(404).end();
    return;
  }
  const redisOk = await redis.ping().then(
    () => true,
    () => false,
  );
  const dbOk = await db`select 1 as ok`.then(
    () => true,
    () => false,
  );
  const ok = redisOk && dbOk;
  res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok, redis: redisOk, db: dbOk, cluster: env.SOLANA_CLUSTER }));
});
server.listen(env.PORT, () => log("worker", `prêt sur :${env.PORT} (${env.SOLANA_CLUSTER})`));

async function shutdown(signal: string) {
  log("worker", `arrêt (${signal})`);
  server.close();
  await Promise.allSettled(workers.map((w) => w.close()));
  await Promise.allSettled(queues.map((q) => q.close()));
  await redis.quit().catch(() => undefined);
  await db.end({ timeout: 5 }).catch(() => undefined);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
