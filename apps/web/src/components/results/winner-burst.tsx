"use client";

import { MotionConfig, motion } from "framer-motion";

/**
 * Bannière du gagnant : trophée qui tombe et rebondit, bordure lumineuse qui tourne, et une
 * explosion de confettis aux couleurs du gagnant à l'ouverture de la page (une seule fois).
 * Confettis décrits à l'avance (aucun hasard) : rendu serveur et navigateur identiques.
 */
const CONFETTI = Array.from({ length: 36 }, (_, i) => {
  const angle = (i / 36) * Math.PI * 2;
  const power = 110 + ((i * 53) % 140);
  return {
    // Arrondi : mêmes nombres au rendu serveur et dans le navigateur.
    x: Math.round(Math.cos(angle) * power),
    y: Math.round(Math.sin(angle) * power * 0.6 - 60),
    rotate: ((i * 97) % 720) - 360,
    delay: (i % 6) * 0.03,
    round: i % 3 === 0,
    alt: i % 4 === 0,
  };
});

export function WinnerBurst({
  winner,
  title,
  children,
}: {
  winner: "A" | "B" | null;
  title: string;
  children: React.ReactNode;
}) {
  const color = winner === "B" ? "var(--side-b)" : "var(--side-a)";
  return (
    <MotionConfig reducedMotion="user">
      <div
        className="glow-border relative mt-6 rounded-2xl"
        style={{ "--glow": color } as React.CSSProperties}
      >
        <div className="relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl bg-card p-6 text-center">
          <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
            {winner &&
              CONFETTI.map((c, i) => (
                <motion.span
                  key={i}
                  className={`absolute block ${c.round ? "size-2 rounded-full" : "h-3 w-1.5 rounded-sm"}`}
                  style={{ backgroundColor: c.alt ? "var(--foreground)" : color }}
                  initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
                  animate={{
                    x: [0, c.x, c.x * 1.1],
                    y: [0, c.y, c.y + 160],
                    opacity: [0, 1, 0],
                    rotate: [0, c.rotate / 2, c.rotate],
                  }}
                  transition={{
                    duration: 2.2,
                    delay: 0.25 + c.delay,
                    ease: "easeOut",
                    times: [0, 0.35, 1],
                  }}
                />
              ))}
          </div>
          {winner && (
            <motion.span
              aria-hidden
              className="text-4xl"
              initial={{ y: -40, scale: 0.4, opacity: 0, rotate: -20 }}
              animate={{ y: 0, scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.1 }}
            >
              🏆
            </motion.span>
          )}
          <motion.p
            className="display text-2xl sm:text-3xl"
            style={{ color }}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            {title}
          </motion.p>
          {children}
        </div>
      </div>
    </MotionConfig>
  );
}
