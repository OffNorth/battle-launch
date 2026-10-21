"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";
import type { ChatItem } from "@/lib/live";

/** Chat de la battle : messages en direct, envoi par l'API (filtre de contenu et limite de débit). */
export function ChatBox(props: {
  battleId: string;
  messages: ChatItem[];
  labels: Dictionary["live"];
  errors: Dictionary["errors"];
}) {
  const { labels } = props;
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/battles/${props.battleId}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const b = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(props.errors[b?.error ?? "generic"] ?? props.errors.generic ?? "error");
      return;
    }
    setBody("");
  }

  return (
    <section
      aria-label={labels.chat}
      className="flex flex-col rounded-xl border border-border bg-card p-3"
    >
      <h2 className="mb-2 text-sm font-bold">{labels.chat}</h2>
      <ul className="mb-2 max-h-72 flex-1 space-y-1 overflow-y-auto text-sm" aria-live="polite">
        {props.messages.length === 0 && (
          <li className="text-muted-foreground">{labels.noMessages}</li>
        )}
        {props.messages.map((m) => (
          <li key={m.id} className="break-words">
            <span className="font-mono text-xs text-muted-foreground">{m.author}</span> {m.body}
          </li>
        ))}
      </ul>
      <form onSubmit={(e) => void send(e)} className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={280}
          aria-label={labels.chatPlaceholder}
          placeholder={labels.chatPlaceholder}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-side-a px-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {labels.send}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
