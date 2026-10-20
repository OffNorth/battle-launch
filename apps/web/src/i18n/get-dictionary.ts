import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { hasLocale, type Locale } from "./config";
import { en } from "./dictionaries/en";
import { fr } from "./dictionaries/fr";

const dictionaries = { en, fr };

/** Langue de la page en cours (segment /[lang]), lue sans la passer de composant en composant. */
export async function getLocale(): Promise<Locale> {
  const value = await lang();
  if (!hasLocale(value)) notFound();
  return value;
}

/** Textes de la page en cours. */
export async function getDictionary() {
  return dictionaries[await getLocale()];
}
