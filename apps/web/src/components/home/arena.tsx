/**
 * Arène animée de l'accueil : deux orbes d'énergie (A et B) qui chargent, foncent l'une vers
 * l'autre, se percutent au centre (flash, ondes de choc, étincelles, VS qui tremble), puis
 * reculent, en boucle. Tout est en CSS (styles .arena-* de globals.css) : une seule horloge
 * pour toutes les pièces (le choc tombe pile au contact), distance de charge proportionnelle à la
 * largeur de l'arène (unités cqw), aucun script ni risque d'écart entre serveur et navigateur.
 * Coupé si l'appareil demande moins d'animations.
 */

// Étincelles : 14 directions fixes, longueurs variées (valeurs entières, calculées une fois).
const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + (i % 2 ? 0.2 : 0);
  const dist = 70 + ((i * 37) % 60);
  return {
    x: Math.round(Math.cos(angle) * dist),
    y: Math.round(Math.sin(angle) * dist),
    deg: Math.round((angle * 180) / Math.PI),
    a: i % 2 === 0,
  };
});

function Orb({ side }: { side: "A" | "B" }) {
  return (
    <div className={`arena-orb arena-orb-${side.toLowerCase()}`}>
      <span className="arena-halo" />
      <span className="arena-ring" />
      <span className="arena-core">{side}</span>
    </div>
  );
}

export function Arena() {
  return (
    <div
      aria-hidden
      className="arena-panel relative h-64 overflow-hidden rounded-3xl border border-border sm:h-72"
    >
      <div className="speed-lines absolute inset-0" />
      <Orb side="A" />
      <Orb side="B" />
      <div className="absolute left-1/2 top-1/2">
        <span className="arena-flash" />
        <span className="arena-wave" />
        <span className="arena-wave arena-wave-2" />
        {SPARKS.map((s, i) => (
          <span
            key={i}
            className={`arena-spark ${s.a ? "text-side-a" : "text-side-b"}`}
            style={
              {
                "--sx": `${s.x}px`,
                "--sy": `${s.y}px`,
                "--sd": `${s.deg}deg`,
              } as React.CSSProperties
            }
          >
            <span className={s.a ? "bg-side-a" : "bg-side-b"} />
          </span>
        ))}
      </div>
      <span className="arena-vs vs-glitch" data-text="VS">
        VS
      </span>
    </div>
  );
}
