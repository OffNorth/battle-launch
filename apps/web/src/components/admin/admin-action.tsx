"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Bouton d'une action d'administration (appel de /api/admin puis rafraîchissement de la page). */
export function AdminAction(props: {
  label: string;
  body: Record<string, unknown>;
  tone?: "danger" | "normal";
  confirm?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  async function run() {
    if (props.confirm && !window.confirm(props.confirm)) return;
    setBusy(true);
    setError(false);
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(props.body),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(true);
      return;
    }
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={() => void run()}
      disabled={busy}
      className={`rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${
        props.tone === "danger"
          ? "border-destructive/60 text-destructive"
          : "border-border hover:border-side-a"
      } ${error ? "ring-2 ring-destructive" : ""}`}
    >
      {props.label}
    </button>
  );
}

/** Édition d'un réglage JSON (limites, anti-triche). */
export function SettingEditor(props: {
  settingKey: string;
  initial: unknown;
  saveLabel: string;
  savedLabel: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(JSON.stringify(props.initial, null, 2));
  const [state, setState] = useState<"idle" | "saved" | "error">("idle");
  async function save() {
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      setState("error");
      return;
    }
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "setting", key: props.settingKey, value }),
    }).catch(() => null);
    setState(res?.ok ? "saved" : "error");
    if (res?.ok) router.refresh();
  }
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-semibold" htmlFor={`setting-${props.settingKey}`}>
        {props.settingKey}
      </label>
      <textarea
        id={`setting-${props.settingKey}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        className="rounded-md border border-input bg-background p-2 font-mono text-xs"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          className="rounded-md bg-side-a px-3 py-1 text-xs font-semibold text-on-side"
        >
          {props.saveLabel}
        </button>
        {state === "saved" && <span className="text-xs text-side-a">{props.savedLabel}</span>}
        {state === "error" && <span className="text-xs text-destructive">✗</span>}
      </div>
    </div>
  );
}
