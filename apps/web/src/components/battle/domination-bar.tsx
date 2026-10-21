/** Barre de domination : part du camp A (vert) contre le camp B (vert foncé), en pourcentage. */
export function DominationBar({
  percentA,
  labelA,
  labelB,
}: {
  percentA: number;
  labelA: string;
  labelB: string;
}) {
  const a = Math.min(100, Math.max(0, percentA));
  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-side-b/70"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={a}
      aria-label={`${labelA} ${a}% – ${labelB} ${Math.round((100 - a) * 10) / 10}%`}
    >
      <div
        className="h-full bg-side-a shadow-[0_0_12px] shadow-side-a transition-[width] duration-700 ease-out"
        style={{ width: `${a}%` }}
      />
    </div>
  );
}
