/** Langues du site. L'anglais est la langue par défaut (public international). */
export const LOCALES = ["en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function hasLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * Choisit la langue d'après l'en-tête Accept-Language (« fr-FR,fr;q=0.9,en;q=0.8 »).
 * Prend la langue acceptée qui a le plus fort poids ; à défaut, l'anglais.
 */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag = "", ...rest] = part.trim().split(";");
      const q = rest.find((p) => p.trim().startsWith("q="));
      const weight = q ? Number(q.trim().slice(2)) : 1;
      return {
        lang: tag.toLowerCase().split("-")[0] ?? "",
        weight: Number.isFinite(weight) ? weight : 0,
        index,
      };
    })
    .filter((x) => x.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { lang } of ranked) if (hasLocale(lang)) return lang;
  return DEFAULT_LOCALE;
}

/** Remplace la langue en tête d'un chemin (/fr/docs -> /en/docs). */
export function switchLocalePath(pathname: string, target: Locale): string {
  const parts = pathname.split("/");
  if (parts[1] && hasLocale(parts[1])) parts[1] = target;
  else parts.splice(1, 0, target);
  return parts.join("/") || `/${target}`;
}
