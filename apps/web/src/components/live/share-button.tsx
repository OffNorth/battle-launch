"use client";

import { useState } from "react";

/** Partage de la battle : feuille de partage du téléphone, sinon copie du lien. */
export function ShareButton({
  label,
  copied,
  title,
}: {
  label: string;
  copied: string;
  title: string;
}) {
  const [done, setDone] = useState(false);
  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      await navigator.share({ title, url }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url).catch(() => undefined);
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }
  return (
    <button
      type="button"
      onClick={() => void share()}
      className="rounded-md border border-side-a/60 px-4 py-2 text-sm font-semibold text-side-a hover:bg-side-a/10"
    >
      {done ? copied : label}
    </button>
  );
}
