"use client";

import { useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { createClient } from "@/lib/supabase/client";

/** Convertit la clé publique VAPID (base64url) au format attendu par le navigateur. */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded =
    base64url.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Abonnement aux notifications du navigateur (lancement, résultat). La clé publique est publiée
 * par le worker dans les réglages ; sans elle (worker pas encore démarré), le bouton n'apparaît pas.
 */
export function PushOptIn({ labels }: { labels: Dictionary["push"] }) {
  const [state, setState] = useState<"idle" | "busy" | "on" | "denied" | "unsupported">("idle");

  async function enable() {
    if (
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !("Notification" in window)
    ) {
      setState("unsupported");
      return;
    }
    setState("busy");
    const { data } = await createClient()
      .from("settings")
      .select("value")
      .eq("key", "web_push")
      .maybeSingle();
    const publicKey = (data?.value as { publicKey?: string } | null)?.publicKey;
    if (!publicKey) {
      setState("unsupported");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState("denied");
      return;
    }
    const registration = await navigator.serviceWorker.register("/sw.js");
    const subscription =
      (await registration.pushManager.getSubscription()) ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(publicKey),
      }));
    const json = subscription.toJSON();
    const res = await fetch("/api/push", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    }).catch(() => null);
    setState(res?.ok ? "on" : "idle");
  }

  if (state === "on") return <p className="text-xs text-side-a">{labels.enabled}</p>;
  if (state === "denied") return <p className="text-xs text-muted-foreground">{labels.denied}</p>;
  if (state === "unsupported")
    return <p className="text-xs text-muted-foreground">{labels.unsupported}</p>;
  return (
    <button
      type="button"
      onClick={() => void enable()}
      disabled={state === "busy"}
      className="text-xs text-side-a underline underline-offset-4 disabled:opacity-50"
    >
      {labels.enable}
    </button>
  );
}
