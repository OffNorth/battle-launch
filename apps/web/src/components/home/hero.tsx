"use client";

import { MotionConfig, motion } from "framer-motion";
import Link from "next/link";

type HeroText = { kicker: string; title: string; subtitle: string; ctaDocs: string };

/**
 * Bandeau d'accueil : les deux camps qui se rencontrent. Les propriétés d'animation sont les mêmes
 * au rendu serveur et dans le navigateur (sinon erreur d'hydratation) ; `reducedMotion="user"`
 * coupe les déplacements quand l'utilisateur le demande à son système.
 */
export function Hero({ text, docsHref }: { text: HeroText; docsHref: string }) {
  return (
    <MotionConfig reducedMotion="user">
      <section className="relative overflow-hidden px-4 pb-10 pt-14 text-center sm:pt-20">
        <div aria-hidden className="arena-glow pointer-events-none absolute inset-0" />
        <p className="relative font-mono text-xs uppercase tracking-[0.3em] text-side-b">
          {text.kicker}
        </p>
        <div
          aria-hidden
          className="relative mt-4 flex items-center justify-center gap-3 text-5xl font-black tracking-tight sm:gap-6 sm:text-7xl"
        >
          <motion.span
            initial={{ x: -80, opacity: 0 }}
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
            className="text-2xl text-foreground sm:text-4xl"
          >
            VS
          </motion.span>
          <motion.span
            initial={{ x: 80, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="text-side-b drop-shadow-[0_0_24px_var(--side-b)]"
          >
            B
          </motion.span>
        </div>
        <h1 className="relative mx-auto mt-6 max-w-2xl text-2xl font-bold sm:text-4xl">
          {text.title}
        </h1>
        <p className="relative mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          {text.subtitle}
        </p>
        <Link
          href={docsHref}
          className="relative mt-6 inline-flex rounded-md border border-side-b/60 px-4 py-2 text-sm font-semibold text-side-b hover:bg-side-b/10"
        >
          {text.ctaDocs}
        </Link>
      </section>
    </MotionConfig>
  );
}
