import { buildSnapshot } from "@battle/shared";
import type { Connection } from "@solana/web3.js";
import { ignoredFunders, loadBattle, loadFunding, loadTrades, toParams } from "../battles";
import type { Db } from "../db";
import type { WorkerEnv } from "../env";
import { log } from "../log";
import { announceWinner } from "../notify";
import { notifyWatchers } from "../push";
import { indexBattle } from "./index-trades";

/**
 * Clôture automatique : à la fin d'une battle (avec un délai de grâce pour lire les derniers
 * trades), stats figées, gagnant désigné, snapshot canonique haché en SHA-256, badge du gagnant.
 */

/** Délai après la fin avant de clôturer, pour que les derniers trades soient lisibles. */
const GRACE_SECONDS = 20;

export async function runClosings(db: Db, connection: Connection, env: WorkerEnv): Promise<void> {
  const due = await db<{ id: string }[]>`
    update public.battles set status = 'closing'
    where id in (
      select id from public.battles
      where status = 'live' and ends_at <= now() - make_interval(secs => ${GRACE_SECONDS})
      order by ends_at limit 3
      for update skip locked
    )
    returning id`;
  for (const { id } of due) {
    try {
      await closeOne(db, connection, env, id);
    } catch (e) {
      // On repassera : la battle redevient « live » et sera reprise au prochain passage.
      await db`update public.battles set status = 'live' where id = ${id} and status = 'closing'`;
      log("close", `erreur ${id} : ${e instanceof Error ? e.message.slice(0, 200) : "?"}`);
    }
  }
}

async function closeOne(db: Db, connection: Connection, env: WorkerEnv, battleId: string) {
  const loaded = await loadBattle(db, battleId);
  if (!loaded?.battle.ends_at) return;
  const endsAt = Math.floor(loaded.battle.ends_at.getTime() / 1000);
  // Dernière lecture des trades jusqu'à la fin exacte.
  await indexBattle(db, connection, battleId, endsAt);

  const { battle, sides } = loaded;
  const trades = await loadTrades(db, battleId);
  const funding = await loadFunding(db, [...new Set(trades.map((t) => t.wallet))]);
  const params = toParams(battle, sides, await ignoredFunders(db), endsAt);
  const snapshot = await buildSnapshot(params, trades, funding);
  const winner = snapshot.result.winner === "draw" ? null : snapshot.result.winner;

  await db.begin(async (tx) => {
    await tx`insert into public.snapshots (battle_id, formula_version, payload, sha256)
             values (${battleId}, ${params.formulaVersion}, ${tx.json(snapshot.payload as never)}, ${snapshot.sha256})
             on conflict (battle_id) do nothing`;
    await tx`update public.battles set status = 'finished', finished_at = now(), winner_side = ${winner}
             where id = ${battleId}`;
    const winnerSide = sides.find((s) => s.side === winner);
    if (winnerSide?.creator_id) {
      await tx`insert into public.badges (profile_id, battle_id, kind) values (${winnerSide.creator_id}, ${battleId}, 'winner')
               on conflict do nothing`;
    }
  });
  log(
    "close",
    `battle ${battleId} terminée : gagnant ${winner ?? "match nul"}, sha256 ${snapshot.sha256.slice(0, 12)}…`,
  );

  const name = (side: "A" | "B") => sides.find((s) => s.side === side)?.name ?? side;
  const url = `${env.APP_URL.replace(/\/+$/, "")}/en/battle/${battleId}`;
  await notifyWatchers(db, battleId, {
    title: winner ? `${name(winner)} wins` : "Draw",
    body: battle.theme,
    url,
  });
  await announceWinner(env, {
    theme: battle.theme,
    winner: winner ? name(winner) : null,
    loser: winner ? name(winner === "A" ? "B" : "A") : null,
    url,
  });
}

/** Ménage : duels jamais relevés, lancements interrompus, vieux compteurs de limite de débit. */
export async function runCleanup(db: Db): Promise<void> {
  const expired = await db`update public.battles set status = 'cancelled', cancel_reason = 'expired'
    where status = 'open' and created_at < now() - interval '24 hours' returning id`;
  const stuck =
    await db`update public.battles set status = 'cancelled', cancel_reason = 'launch_interrupted'
    where status = 'launching' and started_at is null and launch_at < now() - interval '10 minutes' returning id`;
  await db`delete from public.rate_limits where window_start < now() - interval '2 days'`;
  if (expired.length + stuck.length > 0) {
    log(
      "cleanup",
      `${expired.length} duel(s) expiré(s), ${stuck.length} lancement(s) interrompu(s)`,
    );
  }
}
