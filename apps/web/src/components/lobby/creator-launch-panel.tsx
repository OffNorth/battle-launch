"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";
import { LaunchPrep, type PrepSide } from "./launch-prep";

type Side = PrepSide & { creatorId: string | null };

/** Montre la préparation du lancement aux seuls créateurs, pour leurs propres camps. */
export function CreatorLaunchPanel(props: {
  battleId: string;
  sides: Side[];
  initialBuyLamports: number;
  appUrl: string;
  labels: Dictionary["launch"];
  errors: Dictionary["errors"];
}) {
  const [meId, setMeId] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => r.json() as Promise<{ profile: { id: string } | null }>)
      .then((b) => alive && setMeId(b.profile?.id ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (!meId) return null;
  const mine = props.sides.filter((s) => s.creatorId === meId);
  if (mine.length === 0) return null;
  return <LaunchPrep {...props} sides={mine} />;
}
