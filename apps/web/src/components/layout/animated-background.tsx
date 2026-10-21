/**
 * Fond animé du site (styles dans globals.css, section « Animations de fond ») : taches de vert
 * qui dérivent, grille de points qui glisse, bulles qui montent. Pur CSS, aucun script :
 * rendu au serveur, rien à hydrater. Les bulles sont fixes (pas de hasard) pour que le rendu
 * serveur et le navigateur soient identiques.
 */
const BUBBLES = [
  { left: "6%", size: 14, duration: 19, delay: 0, drift: 30 },
  { left: "14%", size: 26, duration: 27, delay: 6, drift: -20 },
  { left: "27%", size: 10, duration: 17, delay: 11, drift: 16 },
  { left: "39%", size: 20, duration: 24, delay: 3, drift: -28 },
  { left: "52%", size: 12, duration: 21, delay: 14, drift: 22 },
  { left: "63%", size: 30, duration: 31, delay: 8, drift: -14 },
  { left: "74%", size: 16, duration: 22, delay: 1, drift: 26 },
  { left: "85%", size: 22, duration: 28, delay: 17, drift: -24 },
  { left: "93%", size: 11, duration: 18, delay: 9, drift: 12 },
];

export function AnimatedBackground() {
  return (
    <div aria-hidden className="bg-stage">
      <div className="bg-blob bg-blob-1" />
      <div className="bg-blob bg-blob-2" />
      <div className="bg-blob bg-blob-3" />
      <div className="bg-grid" />
      {BUBBLES.map((b) => (
        <span
          key={b.left}
          className="bg-bubble"
          style={
            {
              left: b.left,
              width: b.size,
              height: b.size,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
              "--drift": `${b.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
