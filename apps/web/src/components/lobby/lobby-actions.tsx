"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { createClient } from "@/lib/supabase/client";
import { PushOptIn } from "./push-opt-in";

type Me = { id: string; wallet: string; isAdmin: boolean } | null;

/**
 * Actions du lobby : pré-inscription, relever un duel ouvert, annuler (créateur ou admin).
 * Toutes passent par l'API du site (validée côté serveur) ; rien n'est écrit directement en base.
 */
export function LobbyActions(props: {
  battleId: string;
  status: string;
  createdBy: string;
  labels: Dictionary["lobby"];
  createLabels: Dictionary["create"];
  pushLabels: Dictionary["push"];
  errors: Dictionary["errors"];
  locale: Locale;
}) {
  const { labels, errors } = props;
  const router = useRouter();
  const [me, setMe] = useState<Me | undefined>(undefined);
  const [watching, setWatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sideB, setSideB] = useState({ name: "", ticker: "", description: "" });
  const [accept, setAccept] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/me", { cache: "no-store" }).catch(() => null);
      const body = res?.ok ? ((await res.json()) as { profile: Me }) : { profile: null };
      if (!alive) return;
      setMe(body.profile);
      if (body.profile) {
        // Ma pré-inscription : lisible par moi seul (RLS).
        const { data } = await createClient()
          .from("battle_watchers")
          .select("battle_id")
          .eq("battle_id", props.battleId)
          .maybeSingle();
        if (alive) setWatching(Boolean(data));
      }
    })();
    return () => {
      alive = false;
    };
  }, [props.battleId]);

  async function call(path: string, method: "POST" | "DELETE", body?: unknown): Promise<boolean> {
    setBusy(true);
    setError(null);
    const res = await fetch(path, {
      method,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    setBusy(false);
    if (!res) {
      setError(errors.generic ?? "error");
      return false;
    }
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { error?: string };
      setError(errors[b.error ?? "generic"] ?? errors.generic ?? "error");
      return false;
    }
    return true;
  }

  if (me === undefined) return null;
  if (me === null)
    return <p className="text-center text-sm text-muted-foreground">{labels.signInToAct}</p>;

  const isCreator = me.id === props.createdBy;
  const base = `/api/battles/${props.battleId}`;

  return (
    <div className="flex flex-col items-center gap-4">
      {props.status === "open" && !isCreator && (
        <form
          className="grid w-full gap-3 rounded-xl border border-side-b/40 bg-card/60 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await call(`${base}/accept`, "POST", {
                sideB: { ...sideB, description: sideB.description || undefined },
                acceptRisks: accept,
              })
            ) {
              router.refresh();
            }
          }}
        >
          <h2 className="font-bold text-side-b">{labels.acceptTitle}</h2>
          {(["name", "ticker", "description"] as const).map((k) => (
            <label key={k} className="grid gap-1 text-sm">
              <span>{props.createLabels[k]}</span>
              <input
                value={sideB[k]}
                onChange={(e) => setSideB((s) => ({ ...s, [k]: e.target.value }))}
                maxLength={k === "description" ? 280 : k === "ticker" ? 11 : 32}
                required={k !== "description"}
                className="rounded-md border border-input bg-background px-3 py-2"
              />
            </label>
          ))}
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={accept}
              onChange={(e) => setAccept(e.target.checked)}
              className="mt-0.5 accent-[var(--side-b)]"
            />
            {props.createLabels.acceptRisks}
          </label>
          <button
            type="submit"
            disabled={busy || !accept}
            className="rounded-md bg-side-b px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {labels.acceptSubmit}
          </button>
        </form>
      )}

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            if (await call(`${base}/watch`, watching ? "DELETE" : "POST")) {
              setWatching(!watching);
              router.refresh();
            }
          }}
          className="rounded-md border border-side-b/60 px-4 py-2 text-sm text-side-b hover:bg-side-b/10 disabled:opacity-50"
        >
          {watching ? labels.unwatch : labels.watch}
        </button>
        {(isCreator || me.isAdmin) && (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (window.confirm(labels.cancelConfirm) && (await call(`${base}/cancel`, "POST")))
                router.refresh();
            }}
            className="rounded-md border border-destructive/60 px-4 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {labels.cancel}
          </button>
        )}
      </div>

      {watching && <PushOptIn labels={props.pushLabels} />}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
