"use client";

import {
  CreateBattleInput,
  DURATIONS_MINUTES,
  LOBBY_MAX_MINUTES,
  LOBBY_MIN_MINUTES,
  SideInput,
  type BattleMode,
  type ScoreMode,
} from "@battle/shared";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";

type Side = { name: string; ticker: string; description: string; imageUrl: string };
type Concept = { theme: string; sideA: Side; sideB: Side };
type WeightKey = "volume" | "holders" | "market_cap" | "buys";

const emptySide: Side = { name: "", ticker: "", description: "", imageUrl: "" };
const MODES: BattleMode[] = ["creator", "open_duel", "auto_ai"];
const SCORE_MODES: ScoreMode[] = ["composite", "volume", "holders", "market_cap"];
const WEIGHT_KEYS: WeightKey[] = ["volume", "holders", "market_cap", "buys"];

/** Corps envoyé à l'API (le serveur revalide tout avec le même schéma). */
function toPayload(s: {
  mode: BattleMode;
  theme: string;
  sideA: Side;
  sideB: Side;
  durationMinutes: number;
  lobbyMinutes: number;
  scoreMode: ScoreMode;
  weightsPercent: Record<WeightKey, number>;
  initialBuySol: string;
  acceptRisks: boolean;
}) {
  const side = (x: Side) => ({
    name: x.name,
    ticker: x.ticker,
    description: x.description || undefined,
    imageUrl: x.imageUrl || undefined,
  });
  return {
    mode: s.mode,
    theme: s.theme,
    durationMinutes: s.durationMinutes,
    lobbyMinutes: s.lobbyMinutes,
    scoreMode: s.scoreMode,
    // Pourcentages entiers -> points de base (total 10 000).
    weights: Object.fromEntries(WEIGHT_KEYS.map((k) => [k, s.weightsPercent[k] * 100])),
    initialBuySol: s.initialBuySol,
    acceptRisks: s.acceptRisks,
    sideA: side(s.sideA),
    ...(s.mode === "open_duel" ? {} : { sideB: side(s.sideB) }),
  };
}

export function CreateWizard({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const t = dict.create;
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<BattleMode>("creator");
  const [theme, setTheme] = useState("");
  const [sideA, setSideA] = useState<Side>(emptySide);
  const [sideB, setSideB] = useState<Side>(emptySide);
  const [durationMinutes, setDuration] = useState<number>(60);
  const [lobbyMinutes, setLobby] = useState(10);
  const [scoreMode, setScoreMode] = useState<ScoreMode>("composite");
  const [weightsPercent, setWeights] = useState<Record<WeightKey, number>>({
    volume: 35,
    holders: 35,
    market_cap: 20,
    buys: 10,
  });
  const [initialBuySol, setInitialBuy] = useState("0.05");
  const [acceptRisks, setAcceptRisks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [hint, setHint] = useState("");
  const [concepts, setConcepts] = useState<Concept[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ profile: unknown }>)
      .then((b) => alive && setSignedIn(b.profile !== null))
      .catch(() => alive && setSignedIn(false));
    return () => {
      alive = false;
    };
  }, []);

  const state = {
    mode,
    theme,
    sideA,
    sideB,
    durationMinutes,
    lobbyMinutes,
    scoreMode,
    weightsPercent,
    initialBuySol,
    acceptRisks,
  };
  const weightTotal = WEIGHT_KEYS.reduce((n, k) => n + weightsPercent[k], 0);

  const errorText = (code: string) => dict.errors[code] ?? dict.errors.generic ?? code;

  /** Vérifie l'étape en cours avec les mêmes règles que le serveur. */
  function validateStep(s: number): string[] {
    if (s === 1) {
      const sides = mode === "open_duel" ? [sideA] : [sideA, sideB];
      return sides.flatMap((x, i) => {
        const r = SideInput.safeParse(toPayload({ ...state, sideA: x }).sideA);
        return r.success
          ? []
          : r.error.issues.map(
              (e) => `${t.side} ${i === 0 ? "A" : "B"} · ${e.path.join(".")}: ${e.message}`,
            );
      });
    }
    if (s === 2) {
      const r = CreateBattleInput.safeParse({ ...toPayload(state), acceptRisks: true });
      if (scoreMode === "composite" && weightTotal !== 100) return [t.weights];
      return r.success ? [] : r.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`);
    }
    return [];
  }

  function next() {
    const problems = validateStep(step);
    setFieldErrors(problems);
    if (problems.length === 0) setStep((s) => Math.min(3, s + 1));
  }

  async function suggest() {
    setBusy(true);
    setError(null);
    setConcepts(null);
    const res = await fetch("/api/ai/concepts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hint, locale }),
    }).catch(() => null);
    setBusy(false);
    if (!res) return setError(errorText("generic"));
    const body = (await res.json()) as { error?: string; concepts?: Concept[] };
    if (!res.ok) return setError(errorText(body.error ?? "generic"));
    setConcepts(body.concepts ?? []);
  }

  function pick(c: Concept) {
    setTheme(c.theme);
    setSideA({ ...emptySide, ...c.sideA, description: c.sideA.description ?? "" });
    setSideB({ ...emptySide, ...c.sideB, description: c.sideB.description ?? "" });
    setConcepts(null);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors([]);
    const res = await fetch("/api/battles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(toPayload(state)),
    }).catch(() => null);
    if (!res) {
      setBusy(false);
      return setError(errorText("generic"));
    }
    const body = (await res.json()) as {
      id?: string;
      error?: string;
      details?: { path: string; message: string }[] | { reasons?: string[] };
    };
    if (!res.ok || !body.id) {
      setBusy(false);
      setError(errorText(body.error ?? "generic"));
      if (Array.isArray(body.details))
        setFieldErrors(body.details.map((d) => `${d.path}: ${d.message}`));
      return;
    }
    router.push(`/${locale}/battle/${body.id}`);
  }

  if (signedIn === false) {
    return (
      <p className="rounded-xl border border-border bg-card/60 p-6 text-center text-sm">
        {t.signInFirst}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="grid grid-cols-4 gap-2 text-center text-xs" aria-label={t.title}>
        {t.steps.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={`rounded-md border px-2 py-1.5 ${i === step ? "border-side-a text-foreground" : i < step ? "border-side-b/50 text-side-b" : "border-border text-muted-foreground"}`}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="sr-only">{t.steps[0]}</legend>
          {MODES.map((m) => (
            <label
              key={m}
              className={`cursor-pointer rounded-xl border p-4 transition ${mode === m ? "border-side-a bg-side-a/10" : "border-border bg-card/60 hover:border-side-a/50"}`}
            >
              <input
                type="radio"
                name="mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="sr-only"
              />
              <span className="block font-bold">{t.modes[m].title}</span>
              <span className="mt-1 block text-sm text-muted-foreground">{t.modes[m].body}</span>
            </label>
          ))}
        </fieldset>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-6">
          {mode === "auto_ai" && (
            <section className="rounded-xl border border-side-b/40 bg-card/60 p-4">
              <div className="flex flex-col gap-2 sm:flex-row">
                <TextField label={t.aiHint} value={hint} onChange={setHint} maxLength={60} />
                <button
                  type="button"
                  onClick={() => void suggest()}
                  disabled={busy}
                  className="self-end rounded-md bg-side-b px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
                >
                  {busy ? t.aiGenerating : t.aiGenerate}
                </button>
              </div>
              {concepts && concepts.length === 0 && (
                <p className="mt-3 text-sm text-muted-foreground">{t.aiNone}</p>
              )}
              {concepts && concepts.length > 0 && (
                <ul className="mt-4 grid gap-3 sm:grid-cols-3">
                  {concepts.map((c) => (
                    <li
                      key={`${c.sideA.ticker}-${c.sideB.ticker}`}
                      className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm"
                    >
                      <span className="font-semibold">{c.theme}</span>
                      <span>
                        <span className="text-side-a">{c.sideA.name}</span> vs{" "}
                        <span className="text-side-b">{c.sideB.name}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => pick(c)}
                        className="mt-auto rounded-md border border-side-b/60 px-3 py-1.5 text-side-b"
                      >
                        {t.aiPick}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <SideForm
              title={`${t.side} A`}
              accent="text-side-a"
              side={sideA}
              onChange={setSideA}
              t={t}
            />
            {mode === "open_duel" ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                {t.challengerSide}
              </p>
            ) : (
              <SideForm
                title={`${t.side} B`}
                accent="text-side-b"
                side={sideB}
                onChange={setSideB}
                t={t}
              />
            )}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-5">
          <TextField label={t.theme} value={theme} onChange={setTheme} maxLength={80} />
          <fieldset>
            <legend className="mb-2 text-sm font-medium">{t.duration}</legend>
            <div className="flex gap-2">
              {DURATIONS_MINUTES.map((d) => (
                <label
                  key={d}
                  className={`cursor-pointer rounded-md border px-4 py-2 text-sm ${durationMinutes === d ? "border-side-a bg-side-a/10" : "border-border"}`}
                >
                  <input
                    type="radio"
                    name="duration"
                    className="sr-only"
                    checked={durationMinutes === d}
                    onChange={() => setDuration(d)}
                  />
                  {t.hours.replace("{h}", String(d / 60))}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">
              {t.lobby} : {t.minutes.replace("{m}", String(lobbyMinutes))}
            </span>
            <input
              type="range"
              min={LOBBY_MIN_MINUTES}
              max={LOBBY_MAX_MINUTES}
              value={lobbyMinutes}
              onChange={(e) => setLobby(Number(e.target.value))}
              className="accent-[var(--side-a)]"
            />
          </label>
          <label className="grid gap-2 text-sm">
            <span className="font-medium">{t.scoreMode}</span>
            <select
              value={scoreMode}
              onChange={(e) => setScoreMode(e.target.value as ScoreMode)}
              className="rounded-md border border-input bg-background px-3 py-2"
            >
              {SCORE_MODES.map((m) => (
                <option key={m} value={m}>
                  {t.scoreModes[m]}
                </option>
              ))}
            </select>
          </label>
          {scoreMode === "composite" && (
            <fieldset className="grid gap-2">
              <legend className="mb-2 text-sm font-medium">
                {t.weights} —{" "}
                <span className={weightTotal === 100 ? "text-side-b" : "text-destructive"}>
                  {weightTotal} %
                </span>
              </legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {WEIGHT_KEYS.map((k) => (
                  <label key={k} className="grid gap-1 text-xs">
                    {t.weightNames[k]}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={5}
                      value={weightsPercent[k]}
                      onChange={(e) =>
                        setWeights((w) => ({
                          ...w,
                          [k]: Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0))),
                        }))
                      }
                      className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="grid gap-1">
            <TextField
              label={t.initialBuy}
              value={initialBuySol}
              onChange={setInitialBuy}
              inputMode="decimal"
              maxLength={12}
            />
            <p className="text-xs text-muted-foreground">{t.initialBuyHelp}</p>
          </div>
        </div>
      )}

      {step === 3 && (
        <section className="grid gap-4">
          <h2 className="text-lg font-bold">{t.review}</h2>
          <dl className="grid gap-2 rounded-xl border border-border bg-card/60 p-4 text-sm sm:grid-cols-2">
            <Row k={t.steps[0]} v={t.modes[mode].title} />
            <Row k={t.theme} v={theme} />
            <Row
              k={`${t.side} A`}
              v={`${sideA.name} ($${sideA.ticker.replace(/^\$/, "").toUpperCase()})`}
            />
            <Row
              k={`${t.side} B`}
              v={
                mode === "open_duel"
                  ? t.challengerSide
                  : `${sideB.name} ($${sideB.ticker.replace(/^\$/, "").toUpperCase()})`
              }
            />
            <Row k={t.duration} v={t.hours.replace("{h}", String(durationMinutes / 60))} />
            <Row k={t.lobby} v={t.minutes.replace("{m}", String(lobbyMinutes))} />
            <Row k={t.scoreMode} v={t.scoreModes[scoreMode]} />
            <Row k={t.initialBuy} v={`${initialBuySol} SOL`} />
          </dl>
          <p className="text-xs text-side-b">{t.devnetNote}</p>
          <label className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm">
            <input
              type="checkbox"
              checked={acceptRisks}
              onChange={(e) => setAcceptRisks(e.target.checked)}
              className="mt-0.5 size-4 accent-[var(--side-a)]"
            />
            {t.acceptRisks}
          </label>
        </section>
      )}

      {(error || fieldErrors.length > 0) && (
        <div
          role="alert"
          className="rounded-md border border-destructive/60 bg-destructive/10 p-3 text-sm"
        >
          {error && <p className="font-medium">{error}</p>}
          {fieldErrors.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {fieldErrors.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setFieldErrors([]);
            setStep((s) => Math.max(0, s - 1));
          }}
          disabled={step === 0 || busy}
          className="rounded-md border border-border px-4 py-2 text-sm disabled:opacity-40"
        >
          {t.back}
        </button>
        {step < 3 ? (
          <button
            type="button"
            onClick={next}
            className="rounded-md bg-side-a px-5 py-2 text-sm font-semibold text-on-side"
          >
            {t.next}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!acceptRisks || busy || signedIn !== true}
            className="rounded-md bg-side-a px-5 py-2 text-sm font-semibold text-on-side disabled:opacity-50"
          >
            {busy ? t.submitting : t.submit}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{k}</dt>
      <dd className="font-medium break-words">{v || "—"}</dd>
    </div>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  inputMode?: "decimal" | "text";
}) {
  return (
    <label className="grid flex-1 gap-1 text-sm">
      <span className="font-medium">{props.label}</span>
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        maxLength={props.maxLength}
        inputMode={props.inputMode}
        className="rounded-md border border-input bg-background px-3 py-2"
      />
    </label>
  );
}

function SideForm(props: {
  title: string;
  accent: string;
  side: Side;
  onChange: (s: Side) => void;
  t: Dictionary["create"];
}) {
  const { side, onChange, t } = props;
  return (
    <fieldset className="grid gap-3 rounded-xl border border-border bg-card/60 p-4">
      <legend className={`px-1 text-sm font-bold ${props.accent}`}>{props.title}</legend>
      <TextField
        label={t.name}
        value={side.name}
        onChange={(name) => onChange({ ...side, name })}
        maxLength={32}
      />
      <TextField
        label={t.ticker}
        value={side.ticker}
        onChange={(ticker) => onChange({ ...side, ticker })}
        maxLength={11}
      />
      <TextField
        label={t.description}
        value={side.description}
        onChange={(description) => onChange({ ...side, description })}
        maxLength={280}
      />
      <TextField
        label={t.imageUrl}
        value={side.imageUrl}
        onChange={(imageUrl) => onChange({ ...side, imageUrl })}
        maxLength={500}
      />
    </fieldset>
  );
}
