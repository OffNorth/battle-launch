import Link from "next/link";
import type { Dictionary } from "@/i18n/dictionaries/en";
import type { Locale } from "@/i18n/config";
import type { BattleSummary } from "@/lib/battles";
import { formatSol, scorePercent } from "@/lib/format";
import { Countdown } from "./countdown";
import { DominationBar } from "./domination-bar";

/** Carte d'une battle sur l'accueil : thème, A contre B, statut, compte à rebours, domination. */
export function BattleCard({
  battle,
  dict,
  locale,
}: {
  battle: BattleSummary;
  dict: Dictionary;
  locale: Locale;
}) {
  const a = battle.sides.A;
  const b = battle.sides.B;
  const percentA = scorePercent(a?.score);
  const t = dict.battle;
  return (
    <Link
      href={`/${locale}/battle/${battle.id}`}
      className="group flex flex-col gap-4 rounded-xl border border-border bg-card/60 p-4 transition hover:border-side-a/60 focus-visible:outline-2 focus-visible:outline-side-b"
    >
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium text-muted-foreground">{battle.theme}</span>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 uppercase tracking-wider">
          {t.status[battle.status]}
        </span>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-side-a">{a?.name ?? "?"}</p>
          <p className="font-mono text-xs text-muted-foreground">${a?.ticker ?? "—"}</p>
        </div>
        <span className="text-sm font-black text-muted-foreground">{t.vs}</span>
        <div className="min-w-0 text-right">
          <p className="truncate font-bold text-side-b">{b?.name ?? "?"}</p>
          <p className="font-mono text-xs text-muted-foreground">${b?.ticker ?? "—"}</p>
        </div>
      </div>
      {battle.status !== "lobby" && (
        <DominationBar percentA={percentA} labelA={a?.name ?? "A"} labelB={b?.name ?? "B"} />
      )}
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t.duration.replace("{h}", String(battle.durationMinutes / 60))}</span>
        {battle.status === "lobby" && battle.launchAt && (
          <Countdown target={battle.launchAt} label={t.startsIn} />
        )}
        {battle.status === "live" && battle.endsAt && (
          <Countdown target={battle.endsAt} label={t.endsIn} />
        )}
        {battle.status === "finished" && (
          <span className="font-semibold text-foreground">
            {battle.winnerSide
              ? `${t.winner}: ${battle.sides[battle.winnerSide]?.name ?? battle.winnerSide}`
              : t.draw}
          </span>
        )}
        {battle.status === "live" && a && b && (
          <span className="hidden sm:inline">
            {formatSol((a.volumeLamports ?? 0) + (b.volumeLamports ?? 0), locale)} {t.volume}
          </span>
        )}
      </div>
    </Link>
  );
}
