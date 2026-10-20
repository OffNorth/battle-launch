import { createServer } from "node:http";
import { Redis } from "ioredis";
import { loadEnv } from "./env";

const env = loadEnv();

// Connexion partagée par les files BullMQ (maxRetriesPerRequest: null est exigé par BullMQ
// pour les workers bloquants).
const redis = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null, lazyConnect: true });
redis.on("error", (err) => console.error(`[redis] ${err.name}: ${err.message.split("\n")[0]}`));

let redisOk = false;
await redis
  .connect()
  .then(() => (redisOk = true))
  .catch((err: Error) => console.error(`[redis] connexion impossible : ${err.name}`));

// Santé lue par Railway : 200 si Redis répond, 503 sinon.
const server = createServer(async (req, res) => {
  if (req.url !== "/health") {
    res.writeHead(404).end();
    return;
  }
  redisOk = await redis.ping().then(
    () => true,
    () => false,
  );
  res.writeHead(redisOk ? 200 : 503, { "content-type": "application/json" });
  res.end(JSON.stringify({ ok: redisOk, cluster: env.SOLANA_CLUSTER }));
});
server.listen(env.PORT, () =>
  console.log(`[worker] prêt sur :${env.PORT} (${env.SOLANA_CLUSTER})`),
);

async function shutdown(signal: string) {
  console.log(`[worker] arrêt (${signal})`);
  server.close();
  await redis.quit().catch(() => undefined);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
