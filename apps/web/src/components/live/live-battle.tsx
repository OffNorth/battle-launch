"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DominationBar } from "@/components/battle/domination-bar";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { formatSol, scorePercent, shortWallet } from "@/lib/format";
import type { CandlePoint, ChatItem, LiveData, SideStat, TradeItem } from "@/lib/live";
import { createClient } from "@/lib/supabase/client";
import { BuyPanel } from "./buy-panel";
import { ChatBox } from "./chat-box";
import { DuelCharts } from "./duel-charts";
import { ShareButton } from "./share-button";

type SideInfo = { side: "A" | "B"; name: string; ticker: string; mint: string | null };

/**
 * Duel en direct : barre de domination, stats, bougies synchronisées, flux des trades, achat,
 * chat. Tout se met à jour sans recharger (Supabase Realtime sur les tables de la battle).
 */
export function LiveBattle(props: {
  battleId: string;
  status: string;
  initial: LiveData;
  sides: SideInfo[];
  cluster: string;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = props.dict.live;
  const [stats, setStats] = useState<SideStat[]>(props.initial.stats);
  const [candles, setCandles] = useState<CandlePoint[]>(props.initial.candles);
  const [trades, setTrades] = useState<TradeItem[]>(props.initial.trades);
  const [chat, setChat] = useState<ChatItem[]>(props.initial.chat);
  const authors = useRef(new Map<string, string>());

  useEffect(() => {
    const supabase = createClient();
    const filter = `battle_id=eq.${props.battleId}`;
    const channel = supabase
      .channel(`live:${props.battleId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "side_stats", filter },
        (p) => {
          const row = p.new as Record<string, number | string>;
          if (!row.side) return;
          const next: SideStat = {
            side: row.side as "A" | "B",
            volumeLamports: Number(row.volume_lamports),
            buys: Number(row.buys),
            sells: Number(row.sells),
            holders: Number(row.unique_holders),
            marketCapLamports: Number(row.market_cap_lamports),
            score: Number(row.score),
          };
          setStats((s) => [...s.filter((x) => x.side !== next.side), next]);
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "candles", filter }, (p) => {
        const row = p.new as Record<string, number | string>;
        if (!row.bucket) return;
        const next: CandlePoint = {
          side: row.side as "A" | "B",
          bucket: String(row.bucket),
          open: Number(row.open_price),
          high: Number(row.high_price),
          low: Number(row.low_price),
          close: Number(row.close_price),
        };
        setCandles((c) => [
          ...c.filter((x) => !(x.side === next.side && x.bucket === next.bucket)),
          next,
        ]);
      })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trades", filter },
        (p) => {
          const row = p.new as Record<string, number | string | boolean>;
          const next: TradeItem = {
            id: Number(row.id),
            side: row.side as "A" | "B",
            wallet: String(row.wallet),
            isBuy: Boolean(row.is_buy),
            solLamports: Number(row.sol_lamports),
            blockTime: String(row.block_time),
            signature: String(row.signature),
          };
          setTrades((tr) => [next, ...tr.filter((x) => x.id !== next.id)].slice(0, 40));
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter },
        async (p) => {
          const row = p.new as {
            id: number;
            body: string;
            created_at: string;
            author_id: string;
            is_hidden: boolean;
          };
          if (row.is_hidden) return;
          let author = authors.current.get(row.author_id);
          if (!author) {
            const { data } = await supabase
              .from("profiles")
              .select("wallet, display_name")
              .eq("id", row.author_id)
              .maybeSingle();
            author = data?.display_name ?? (data?.wallet ? shortWallet(data.wallet) : "?");
            authors.current.set(row.author_id, author);
          }
          const item: ChatItem = { id: row.id, body: row.body, createdAt: row.created_at, author };
          setChat((c) => [...c.filter((x) => x.id !== item.id), item].slice(-80));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [props.battleId]);

  const byside = useMemo(() => {
    const get = (s: "A" | "B") => stats.find((x) => x.side === s);
    return { A: get("A"), B: get("B") };
  }, [stats]);
  const a = props.sides.find((s) => s.side === "A");
  const b = props.sides.find((s) => s.side === "B");
  const live = props.status === "live";

  const statRows: { label: string; value: (s: SideStat | undefined) => string }[] = [
    { label: t.volume, value: (s) => formatSol(s?.volumeLamports ?? 0, props.locale) },
    { label: t.holders, value: (s) => String(s?.holders ?? 0) },
    { label: t.marketCap, value: (s) => formatSol(s?.marketCapLamports ?? 0, props.locale) },
    { label: t.buys, value: (s) => String(s?.buys ?? 0) },
  ];

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div>
        <div className="mb-1 flex justify-between text-sm font-bold">
          <span className="text-side-a">{scorePercent(byside.A?.score)} %</span>
          <span className="text-side-b">
            {scorePercent(byside.B?.score ?? (byside.A ? 1 - byside.A.score : undefined))} %
          </span>
        </div>
        <DominationBar
          percentA={scorePercent(byside.A?.score)}
          labelA={a?.name ?? "A"}
          labelB={b?.name ?? "B"}
        />
      </div>

      <table className="w-full overflow-hidden rounded-xl border border-border bg-card text-sm">
        <caption className="sr-only">{t.statsCaption}</caption>
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="p-2 text-left font-medium" scope="col" />
            <th className="p-2 text-right font-semibold text-side-a" scope="col">
              {a?.name}
            </th>
            <th className="p-2 text-right font-semibold text-side-b" scope="col">
              {b?.name}
            </th>
          </tr>
        </thead>
        <tbody>
          {statRows.map((r) => (
            <tr key={r.label} className="border-t border-border">
              <th scope="row" className="p-2 text-left font-normal text-muted-foreground">
                {r.label}
              </th>
              <td className="p-2 text-right font-mono tabular-nums">{r.value(byside.A)}</td>
              <td className="p-2 text-right font-mono tabular-nums">{r.value(byside.B)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <DuelCharts candles={candles} labelA={a?.name ?? "A"} labelB={b?.name ?? "B"} />

      {live && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[a, b].map((s) =>
            s?.mint ? (
              <BuyPanel
                key={s.side}
                side={s.side}
                name={s.name}
                ticker={s.ticker}
                mint={s.mint}
                cluster={props.cluster}
                labels={t}
              />
            ) : null,
          )}
          <p className="text-xs text-muted-foreground sm:col-span-2">{props.dict.footer.risk}</p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label={t.feed} className="rounded-xl border border-border bg-card p-3">
          <h2 className="mb-2 text-sm font-bold">{t.feed}</h2>
          {trades.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noTrades}</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto text-xs" aria-live="polite">
              {trades.map((tr) => {
                const s = tr.side === "A" ? a : b;
                return (
                  <li key={tr.id} className="flex items-center justify-between gap-2">
                    <span
                      className={
                        tr.isBuy ? "font-semibold text-side-a" : "font-semibold text-destructive"
                      }
                    >
                      {tr.isBuy ? t.bought : t.sold}
                    </span>
                    <span className={tr.side === "A" ? "text-side-a" : "text-side-b"}>
                      ${s?.ticker}
                    </span>
                    <span className="font-mono tabular-nums">
                      {formatSol(tr.solLamports, props.locale, 3)}
                    </span>
                    <a
                      href={`https://solscan.io/tx/${tr.signature}${props.cluster === "devnet" ? "?cluster=devnet" : ""}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-muted-foreground underline-offset-2 hover:underline"
                    >
                      {shortWallet(tr.wallet)}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <ChatBox battleId={props.battleId} messages={chat} labels={t} errors={props.dict.errors} />
      </div>

      <div className="flex justify-center">
        <ShareButton
          label={t.share}
          copied={t.copied}
          title={`${a?.name ?? "A"} vs ${b?.name ?? "B"}`}
        />
      </div>
    </div>
  );
}
