"use client";

import { useEffect, useState } from "react";

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** Compte à rebours jusqu'à `target` (ISO). Affiche 00:00:00 une fois l'heure passée. */
export function Countdown({ target, label }: { target: string; label: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    // Première valeur au prochain tour (pas pendant l'effet), puis chaque seconde.
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, []);
  const left = now === null ? null : Math.max(0, Math.floor((Date.parse(target) - now) / 1000));
  const text =
    left === null
      ? "--:--:--"
      : `${pad(Math.floor(left / 3600))}:${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;
  return (
    <span className="font-mono text-sm tabular-nums">
      <span className="text-muted-foreground">{label} </span>
      <time dateTime={target} suppressHydrationWarning>
        {text}
      </time>
    </span>
  );
}
