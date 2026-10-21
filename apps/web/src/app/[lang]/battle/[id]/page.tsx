import { lamportsToSolString } from "@battle/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { Countdown } from "@/components/battle/countdown";
import { BattleLiveRefresh } from "@/components/lobby/battle-live-refresh";
import { CreatorLaunchPanel } from "@/components/lobby/creator-launch-panel";
import { LiveBattle } from "@/components/live/live-battle";
import { ReportButton } from "@/components/results/report-button";
import { LobbyActions } from "@/components/lobby/lobby-actions";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { getBattle } from "@/lib/battles";
import { solanaPublicEnv } from "@/lib/env";
import { getLiveData } from "@/lib/live";

const Id = z.uuid();

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/battle/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!Id.safeParse(id).success) return {};
  const battle = await getBattle(id).catch(() => null);
  if (!battle) return {};
  const [a, b] = [battle.sides.A?.name ?? "A", battle.sides.B?.name ?? "?"];
  return { title: `${a} vs ${b}`, description: battle.theme };
}

export default async function BattlePage({ params }: PageProps<"/[lang]/battle/[id]">) {
  const dict = await getDictionary();
  const locale = await getLocale();
  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-muted-foreground">{dict.home.loading}</p>
      }
    >
      <BattleView params={params} dict={dict} locale={locale} />
    </Suspense>
  );
}

/** Lu à la demande (données vivantes) : derrière le Suspense. */
async function BattleView({
  params,
  dict,
  locale,
}: {
  params: PageProps<"/[lang]/battle/[id]">["params"];
  dict: Dictionary;
  locale: Locale;
}) {
  const { id } = await params;
  if (!Id.safeParse(id).success) notFound();
  const battle = await getBattle(id);
  if (!battle) notFound();

  const t = dict.battle;
  const a = battle.sideDetails.find((s) => s.side === "A");
  const b = battle.sideDetails.find((s) => s.side === "B");
  const isPreLaunch = battle.status === "open" || battle.status === "lobby";

  return (
    <article className="mx-auto w-full max-w-5xl px-4 py-8">
      <BattleLiveRefresh battleId={battle.id} />
      <p className="text-center text-sm text-muted-foreground">{battle.theme}</p>
      <header className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <SideHeader side={a} accent="text-side-a" align="text-left" />
        <span className="text-2xl font-black text-muted-foreground sm:text-4xl">{t.vs}</span>
        <SideHeader
          side={b}
          accent="text-side-b"
          align="text-right"
          placeholder={battle.status === "open" ? dict.lobby.waitingChallenger : undefined}
        />
      </header>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3 text-sm">
        <span className="rounded-full border border-border px-3 py-1 uppercase tracking-wider">
          {t.status[battle.status]}
        </span>
        {battle.status === "lobby" && battle.launchAt && (
          <Countdown target={battle.launchAt} label={t.startsIn} />
        )}
        {battle.status === "live" && battle.endsAt && (
          <Countdown target={battle.endsAt} label={t.endsIn} />
        )}
        {isPreLaunch && (
          <span className="text-muted-foreground">
            {dict.lobby.watchers.replace("{n}", String(battle.watchersCount))}
          </span>
        )}
      </div>

      {battle.status === "launching" && (
        <p className="mt-6 text-center text-sm font-medium text-side-a">{dict.live.launching}</p>
      )}
      {battle.status === "closing" && (
        <p className="mt-6 text-center text-sm font-medium text-side-a">{dict.live.closing}</p>
      )}
      {battle.status === "finished" && (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-xl border border-side-a/50 bg-card p-4 text-center">
          <p className="text-xl font-black text-side-a">
            {battle.winnerSide
              ? dict.live.winnerBanner.replace(
                  "{name}",
                  battle.sides[battle.winnerSide]?.name ?? battle.winnerSide,
                )
              : dict.live.drawBanner}
          </p>
          <Link
            href={`/${locale}/battle/${battle.id}/verify`}
            className="text-sm underline underline-offset-4"
          >
            {dict.live.verify}
          </Link>
        </div>
      )}
      {["live", "closing", "finished"].includes(battle.status) && (
        <LiveSection
          battleId={battle.id}
          status={battle.status}
          sides={battle.sideDetails}
          dict={dict}
          locale={locale}
        />
      )}

      {battle.status === "cancelled" && (
        <p className="mt-6 rounded-xl border border-border p-4 text-center text-sm">
          {dict.lobby.cancelled}
        </p>
      )}

      <dl className="mx-auto mt-8 grid max-w-2xl grid-cols-2 gap-3 rounded-xl border border-border bg-card/60 p-4 text-sm sm:grid-cols-3">
        <Info
          k={dict.create.duration}
          v={dict.create.hours.replace("{h}", String(battle.durationMinutes / 60))}
        />
        <Info
          k={dict.lobby.initialBuy}
          v={`${lamportsToSolString(BigInt(battle.initialBuyLamports))} SOL`}
        />
        <Info k={dict.lobby.scoring} v={dict.create.scoreModes[battle.scoreMode]} />
      </dl>

      {isPreLaunch && (
        <section className="mx-auto mt-8 max-w-2xl">
          <p className="mb-4 text-center text-xs text-muted-foreground">{dict.lobby.nextStep}</p>
          {battle.status === "lobby" && (
            <div className="mb-6">
              <CreatorLaunchPanel
                battleId={battle.id}
                sides={battle.sideDetails.map((s) => ({
                  id: s.id,
                  side: s.side,
                  name: s.name,
                  ticker: s.ticker,
                  prepared: s.mint !== null,
                  creatorId: s.creatorId,
                }))}
                initialBuyLamports={battle.initialBuyLamports}
                appUrl={solanaPublicEnv().NEXT_PUBLIC_APP_URL}
                labels={dict.launch}
                errors={dict.errors}
              />
            </div>
          )}
          <LobbyActions
            battleId={battle.id}
            status={battle.status}
            createdBy={battle.createdBy}
            labels={dict.lobby}
            createLabels={dict.create}
            pushLabels={dict.push}
            errors={dict.errors}
            locale={locale}
          />
        </section>
      )}
      <div className="mt-10 flex justify-center">
        <ReportButton
          targetType="battle"
          targetId={battle.id}
          labels={dict.report}
          errors={dict.errors}
        />
      </div>
    </article>
  );
}

function SideHeader(props: {
  side: { name: string; ticker: string; description: string | null } | undefined;
  accent: string;
  align: string;
  placeholder?: string | undefined;
}) {
  if (!props.side) {
    return (
      <p className={`${props.align} text-sm text-muted-foreground`}>{props.placeholder ?? "?"}</p>
    );
  }
  return (
    <div className={`min-w-0 ${props.align}`}>
      <h1 className={`truncate text-2xl font-black sm:text-4xl ${props.accent}`}>
        {props.side.name}
      </h1>
      <p className="font-mono text-sm text-muted-foreground">${props.side.ticker}</p>
      {props.side.description && (
        <p className="mt-1 hidden text-sm text-muted-foreground sm:block">
          {props.side.description}
        </p>
      )}
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-semibold">{v}</dd>
    </div>
  );
}

/** Duel en direct (ou terminé) : données de départ lues au serveur, la suite en temps réel. */
async function LiveSection(props: {
  battleId: string;
  status: string;
  sides: { side: "A" | "B"; name: string; ticker: string; mint: string | null }[];
  dict: Dictionary;
  locale: Locale;
}) {
  const initial = await getLiveData(props.battleId);
  return (
    <>
      <LiveBattle
        battleId={props.battleId}
        status={props.status}
        initial={initial}
        sides={props.sides.map((s) => ({
          side: s.side,
          name: s.name,
          ticker: s.ticker,
          mint: s.mint,
        }))}
        cluster={solanaPublicEnv().NEXT_PUBLIC_SOLANA_CLUSTER}
        locale={props.locale}
        dict={props.dict}
      />
      {initial.flags.length > 0 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {props.dict.live.excluded.replace(
            "{n}",
            String(new Set(initial.flags.map((f) => f.wallet)).size),
          )}
        </p>
      )}
    </>
  );
}
