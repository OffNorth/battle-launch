import type { Redis } from "ioredis";
import webpush from "web-push";
import type { Db } from "./db";
import { log } from "./log";

/**
 * Notifications web push (lancement d'une battle, résultat) aux personnes pré-inscrites.
 * Les clés VAPID sont créées par le worker lui-même au premier démarrage : la clé privée reste
 * dans son Redis privé, la clé publique est publiée dans les réglages (le site s'en sert pour
 * abonner le navigateur). Personne ne manipule de clé.
 */

const REDIS_KEY = "battle:vapid";

export async function setupPush(redis: Redis, db: Db, appUrl: string): Promise<void> {
  let keys = await redis
    .get(REDIS_KEY)
    .then((v) => (v ? (JSON.parse(v) as webpush.VapidKeys) : null));
  if (!keys) {
    const fresh = webpush.generateVAPIDKeys();
    await redis.set(REDIS_KEY, JSON.stringify(fresh), "NX");
    keys = JSON.parse((await redis.get(REDIS_KEY)) ?? JSON.stringify(fresh)) as webpush.VapidKeys;
    log("push", "clés de notification créées");
  }
  await db`insert into public.settings (key, value) values ('web_push', ${db.json({ publicKey: keys.publicKey })})
           on conflict (key) do update set value = excluded.value, updated_at = now()`;
  // Le « sujet » VAPID doit être une adresse https ou mailto.
  const subject = appUrl.startsWith("https://") ? appUrl : "mailto:contact@battle-launch.invalid";
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey);
}

/** Envoie une notification à toutes les personnes pré-inscrites à une battle. */
export async function notifyWatchers(
  db: Db,
  battleId: string,
  message: { title: string; body: string; url: string },
): Promise<void> {
  const subs = await db<{ endpoint: string; keys: { p256dh: string; auth: string } }[]>`
    select ps.endpoint, ps.keys from public.push_subscriptions ps
    join public.battle_watchers bw on bw.profile_id = ps.profile_id
    where bw.battle_id = ${battleId}`;
  let sent = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(message),
        { TTL: 600 },
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      // Abonnement expiré ou retiré par le navigateur : on l'oublie.
      if (status === 404 || status === 410) {
        await db`delete from public.push_subscriptions where endpoint = ${sub.endpoint}`;
      }
    }
  }
  if (subs.length > 0)
    log("push", `battle ${battleId} : ${sent}/${subs.length} notification(s) envoyée(s)`);
}
