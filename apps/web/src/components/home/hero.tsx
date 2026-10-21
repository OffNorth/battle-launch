"use client";

import { MotionConfig, motion } from "framer-motion";
import Link from "next/link";
import { Arena } from "./arena";

type HeroText = { kicker: string; title: string; subtitle: string; ctaDocs: string };

/**
 * Bandeau d'accueil, dans l'esprit de deuslaunch : grand titre serré aligné à gauche (mots qui
 * apparaissent un à un, fin du titre en dégradé qui brille), deux boutons en pilule, et à droite
 * l'arène animée (arena.tsx). Les propriétés d'animation
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
          <h1 className="display mt-4 max-w-2xl text-4xl sm:text-6xl">
            {text.title.split(" ").map((word, i) => (
              <motion.span
                key={`${word}-${i}`}
                className="mr-[0.25em] inline-block"
                initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.5, delay: 0.08 * i, ease: "easeOut" }}
              >
                <span className={i >= text.title.split(" ").length - 2 ? "shine-text" : undefined}>
                  {word}
                </span>
              </motion.span>
            ))}
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground">{text.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={createHref}
              className="btn-shine inline-flex h-11 items-center rounded-full bg-side-a px-6 text-sm font-medium text-on-side transition hover:scale-[1.03]"
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
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
        >
          <Arena />
        </motion.div>
      </section>
    </MotionConfig>
  );
}
