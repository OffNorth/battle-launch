const LAMPORTS_PER_SOL = 1_000_000_000;

/** Lamports -> texte en SOL pour l'affichage seulement (jamais pour un calcul). */
export function formatSol(lamports: number | bigint, locale: string, digits = 2): string {
  const sol = Number(lamports) / LAMPORTS_PER_SOL;
  return `${sol.toLocaleString(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 })} SOL`;
}

export function shortWallet(wallet: string): string {
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

/** Score stocké (0 à 1) -> pourcentage entier pour la barre de domination. */
export function scorePercent(score: number | null | undefined): number {
  if (score === null || score === undefined || !Number.isFinite(score)) return 50;
  return Math.min(100, Math.max(0, Math.round(score * 1000) / 10));
}
