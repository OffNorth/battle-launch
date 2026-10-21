"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";

/** Signalement d'une battle (marque, personne réelle, haine, arnaque…), traité dans /admin. */
export function ReportButton(props: {
  targetType: "battle" | "side" | "message" | "profile";
  targetId: string;
  labels: Dictionary["report"];
  errors: Dictionary["errors"];
}) {
  const t = props.labels;
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | string>("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ targetType: props.targetType, targetId: props.targetId, reason }),
    }).catch(() => null);
    if (res?.ok) {
      setState("sent");
      return;
    }
    const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    setState(props.errors[body?.error ?? "generic"] ?? props.errors.generic ?? "error");
  }

  if (state === "sent") return <p className="text-xs text-side-a">{t.sent}</p>;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline underline-offset-4"
      >
        {t.button}
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => void send(e)}
      className="flex w-full max-w-md flex-col gap-2 rounded-xl border border-border bg-card p-3"
    >
      <label className="text-sm font-semibold" htmlFor="report-reason">
        {t.title}
      </label>
      <textarea
        id="report-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t.reason}
        minLength={3}
        maxLength={500}
        required
        rows={3}
        className="rounded-md border border-input bg-background p-2 text-sm"
      />
      <button
        type="submit"
        disabled={state === "busy"}
        className="w-fit rounded-md bg-side-b px-3 py-1.5 text-xs font-semibold text-white"
      >
        {t.send}
      </button>
      {state !== "idle" && state !== "busy" && <p className="text-xs text-destructive">{state}</p>}
    </form>
  );
}
