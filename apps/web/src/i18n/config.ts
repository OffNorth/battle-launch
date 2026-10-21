/**
 * Langue du site : anglais seulement (décision du 23/10/2026). Le segment /[lang] de l'adresse est
 * gardé tel quel (liens, partages et pages existants ne changent pas) ; ajouter une langue plus
 * tard = l'ajouter ici, créer son dictionnaire dans i18n/dictionaries et le déclarer dans get-dictionary.ts.
 */
export const LOCALES = ["en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export function hasLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Anciennes adresses en français (/fr/...) : redirigées vers l'anglais. */
export const RETIRED_LOCALES = ["fr"] as const;
