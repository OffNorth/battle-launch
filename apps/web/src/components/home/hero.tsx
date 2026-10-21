"use client";

import { MotionConfig, motion } from "framer-motion";
import Link from "next/link";

type HeroText = { kicker: string; title: string; subtitle: string; ctaDocs: string };

/**
 * Bandeau d'accueil, dans l'esprit de deuslaunch : grand titre serré aligné à gauche, une ligne
 * d'accent, deux boutons en pilule, et à droite le duel A contre B. Les propriétés d'animation
 * sont les mêmes au rendu serveur et dans le navigateur (sinon erreur d'hydratation) ;
 * `reducedMotion="user"` coupe les déplacements quand l'utilisateur le demande à son système.
 */
export function Hero({
  text,
  docsHref,
  createHref,
  createLabel,
}: {
  text: HeroText;
  docsHref: string;
  createHref: string;
  createLabel: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <section className="relative mx-auto grid w-full max-w-6xl items-center gap-10 overflow-hidden px-4 pb-12 pt-12 sm:pt-20 md:grid-cols-[1.4fr_1fr]">
        <div aria-hidden className="arena-glow pointer-events-none absolute inset-0" />
        <div className="relative">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-side-a">{text.kicker}</p>
          <h1 className="display mt-4 max-w-2xl text-4xl sm:text-6xl">{text.title}</h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">{text.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={createHref}
              className="inline-flex h-11 items-center rounded-full bg-side-a px-6 text-sm font-medium text-on-side transition hover:opacity-90"
            >
              {createLabel}
            </Link>
            <Link
              href={docsHref}
              className="inline-flex h-11 items-center rounded-full border border-border bg-card px-6 text-sm font-medium transition hover:bg-card-raised"
            >
              {text.ctaDocs}
            </Link>
          </div>
        </div>
        <div
          aria-hidden
          className="relative flex items-center justify-center gap-4 rounded-3xl border border-border bg-card p-8 text-6xl font-semibold tracking-tighter sm:text-7xl"
        >
          <motion.span
            initial={{ x: -60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-side-a drop-shadow-[0_0_24px_var(--side-a)]"
          >
            A
          </motion.span>
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.45, type: "spring" }}
            className="text-xl text-muted-foreground sm:text-2xl"
          >
            VS
          </motion.span>
          <motion.span
            initial={{ x: 60, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-side-b drop-shadow-[0_0_24px_var(--side-b)]"
          >
            B
          </motion.span>
        </div>
      </section>
    </MotionConfig>
  );
}
