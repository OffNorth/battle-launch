/**
 * Barre de domination : part du camp A contre le camp B, en pourcentage. Reflets qui courent dans
 * chaque camp et étincelle au point de contact (styles .bar-* de globals.css).
 */
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
      className="bar-flow-b relative h-2.5 w-full overflow-visible rounded-full bg-side-b/70"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={a}
      aria-label={`${labelA} ${a}% – ${labelB} ${Math.round((100 - a) * 10) / 10}%`}
    >
      <div
        className="bar-flow h-full bg-side-a shadow-[0_0_12px] shadow-side-a transition-[width] duration-700 ease-out"
        style={{ width: `${a}%` }}
      />
      {/* Point de contact des deux camps : une étincelle qui crépite (glisse avec la barre). */}
      <span
        aria-hidden
        className="bar-spark absolute top-1/2 transition-[left] duration-700 ease-out"
        style={{ left: `${a}%` }}
      />
    </div>
  );
}
