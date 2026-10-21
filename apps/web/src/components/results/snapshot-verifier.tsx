"use client";

import { verifySnapshot, type SnapshotCheck } from "@battle/shared";
import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/dictionaries/en";

/**
 * Vérification dans le navigateur du visiteur : on refait le calcul du score avec le code public
 * (packages/shared) et le hash SHA-256 du snapshot canonique, sans faire confiance au serveur.
 */
export function SnapshotVerifier(props: {
  payload: unknown;
  sha256: string;
  sideNames: { A: string; B: string };
  labels: Dictionary["verify"];
  drawLabel: string;
}) {
  const t = props.labels;
  const [check, setCheck] = useState<SnapshotCheck | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    verifySnapshot(props.payload, props.sha256)
      .then((c) => alive && setCheck(c))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [props.payload, props.sha256]);

  const tradeCount = Array.isArray((props.payload as { trades?: unknown[] })?.trades)
    ? (props.payload as { trades: unknown[] }).trades.length
    : 0;
  const download = () => {
    const blob = new Blob([JSON.stringify(props.payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `battle-snapshot-${props.sha256.slice(0, 12)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t.trades.replace("{n}", String(tradeCount))}</p>
      <dl className="grid gap-2 rounded-xl border border-border bg-card p-4 font-mono text-xs break-all">
        <dt className="font-sans text-muted-foreground">{t.published}</dt>
        <dd>{props.sha256}</dd>
        <dt className="mt-2 font-sans text-muted-foreground">{t.recomputed}</dt>
        <dd>{check ? check.sha256 : failed ? "—" : t.computing}</dd>
      </dl>
      {check && (
        <ul className="space-y-2 text-sm" role="status">
          <li className={check.hashOk ? "text-side-a" : "font-semibold text-destructive"}>
            {check.hashOk ? `✓ ${t.hashOk}` : `✗ ${t.hashKo}`}
          </li>
          <li className={check.resultOk ? "text-side-a" : "font-semibold text-destructive"}>
            {check.resultOk ? `✓ ${t.resultOk}` : `✗ ${t.resultKo}`}
          </li>
          <li>
            {t.winner} :{" "}
            <strong>
              {check.recomputed.winner === "draw"
                ? props.drawLabel
                : props.sideNames[check.recomputed.winner]}
            </strong>{" "}
            ({(check.recomputed.scorePpm.A / 10_000).toFixed(2)} % /{" "}
            {(check.recomputed.scorePpm.B / 10_000).toFixed(2)} %)
          </li>
        </ul>
      )}
      {failed && <p className="text-sm text-destructive">{t.resultKo}</p>}
      <button
        type="button"
        onClick={download}
        className="w-fit rounded-md border border-side-a/60 px-4 py-2 text-sm text-side-a"
      >
        {t.download}
      </button>
    </div>
  );
}
