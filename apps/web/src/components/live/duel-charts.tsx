"use client";

import {
  CandlestickSeries,
  ColorType,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import type { CandlePoint } from "@/lib/live";

/**
 * Deux graphiques en bougies (camp A, camp B), synchronisés : déplacer ou zoomer l'un déplace
 * l'autre. Prix : lamports pour un million de tokens (même unité des deux côtés).
 */
export function DuelCharts(props: { candles: CandlePoint[]; labelA: string; labelB: string }) {
  const refA = useRef<HTMLDivElement>(null);
  const refB = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<{ A?: ISeriesApi<"Candlestick">; B?: ISeriesApi<"Candlestick"> }>({});
  const chartsRef = useRef<IChartApi[]>([]);

  useEffect(() => {
    if (!refA.current || !refB.current) return;
    // Couleurs en hexadécimal (variables --chart-* du thème) : la bibliothèque ne lit pas oklch().
    const css = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const palette = () => ({
      text: css("--chart-text"),
      grid: css("--chart-grid"),
      a: css("--chart-side-a"),
      b: css("--chart-side-b"),
      down: css("--chart-down"),
    });
    const make = (el: HTMLDivElement, up: string): [IChartApi, ISeriesApi<"Candlestick">] => {
      const c = palette();
      const chart = createChart(el, {
        autoSize: true,
        height: 240,
        layout: {
          background: { type: ColorType.Solid, color: "transparent" },
          textColor: c.text,
          attributionLogo: false,
        },
        grid: { vertLines: { visible: false }, horzLines: { color: c.grid } },
        timeScale: { timeVisible: true, secondsVisible: false },
        rightPriceScale: { borderVisible: false },
      });
      const series = chart.addSeries(CandlestickSeries, {
        upColor: up,
        borderUpColor: up,
        wickUpColor: up,
        downColor: c.down,
        borderDownColor: c.down,
        wickDownColor: c.down,
        priceFormat: { type: "price", precision: 0, minMove: 1 },
      });
      return [chart, series];
    };
    const [chartA, seriesA] = make(refA.current, palette().a);
    const [chartB, seriesB] = make(refB.current, palette().b);
    seriesRef.current = { A: seriesA, B: seriesB };
    chartsRef.current = [chartA, chartB];

    // Synchronisation des deux échelles de temps (sans boucle infinie).
    let syncing = false;
    const link = (from: IChartApi, to: IChartApi) =>
      from.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (syncing || !range) return;
        syncing = true;
        to.timeScale().setVisibleLogicalRange(range);
        syncing = false;
      });
    link(chartA, chartB);
    link(chartB, chartA);

    // Changement de thème (bouton clair/sombre) : on recolore les deux graphiques.
    const recolor = () => {
      const c = palette();
      for (const [chart, series, up] of [
        [chartA, seriesA, c.a],
        [chartB, seriesB, c.b],
      ] as const) {
        chart.applyOptions({
          layout: { textColor: c.text },
          grid: { horzLines: { color: c.grid } },
        });
        series.applyOptions({
          upColor: up,
          borderUpColor: up,
          wickUpColor: up,
          downColor: c.down,
          borderDownColor: c.down,
          wickDownColor: c.down,
        });
      }
    };
    const observer = new MutationObserver(recolor);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => {
      observer.disconnect();
      chartA.remove();
      chartB.remove();
      seriesRef.current = {};
      chartsRef.current = [];
    };
  }, []);

  useEffect(() => {
    for (const side of ["A", "B"] as const) {
      const data = props.candles
        .filter((c) => c.side === side)
        .map((c) => ({
          time: Math.floor(Date.parse(c.bucket) / 1000) as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
        .sort((a, b) => a.time - b.time);
      seriesRef.current[side]?.setData(data);
    }
    // Toute la battle visible d'un coup (les deux graphiques restent synchronisés).
    chartsRef.current[0]?.timeScale().fitContent();
  }, [props.candles]);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <figure className="rounded-xl border border-border bg-card p-3">
        <figcaption className="mb-2 text-sm font-bold text-side-a">{props.labelA}</figcaption>
        <div ref={refA} className="h-60 w-full" />
      </figure>
      <figure className="rounded-xl border border-border bg-card p-3">
        <figcaption className="mb-2 text-sm font-bold text-side-b">{props.labelB}</figcaption>
        <div ref={refB} className="h-60 w-full" />
      </figure>
    </div>
  );
}
