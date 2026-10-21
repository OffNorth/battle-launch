/**
 * Filtre de contenu des noms, tickers, thèmes et messages : marques, personnalités réelles,
 * haine. C'est un premier barrage automatique ; le signalement et la modération /admin complètent.
 *
 * Le texte est « aplati » avant comparaison : minuscules, sans accents, chiffres de l'écriture
 * « l33t » remplacés (3 -> e, 0 -> o…), tout ce qui n'est pas une lettre retiré. « €L0N M-U-$K »
 * devient donc « elonmusk ».
 */

export type ModerationReason = "brand" | "person" | "hate";
export type ModerationResult = { ok: boolean; reasons: ModerationReason[]; matches: string[] };

const LEET: Record<string, string> = {
  "0": "o",
  "1": "i",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "€": "e",
  "!": "i",
  "|": "i",
};

/** Texte aplati, mots séparés par une espace (« Elon-Musk 2.0 » -> « elon musk zo »). */
export function normalizeForModeration(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[0134578@$€!|]/g, (c) => LEET[c] ?? c)
    .replace(/[^a-z]+/g, " ")
    .trim();
}

// Marques connues (noms déposés) : un token ne doit pas se faire passer pour elles.
export const BRANDS = [
  "nike",
  "adidas",
  "apple",
  "iphone",
  "google",
  "amazon",
  "microsoft",
  "tesla",
  "spacex",
  "netflix",
  "disney",
  "pixar",
  "marvel",
  "pepsi",
  "cocacola",
  "coca cola",
  "mcdonalds",
  "starbucks",
  "gucci",
  "louis vuitton",
  "chanel",
  "ferrari",
  "lamborghini",
  "rolex",
  "samsung",
  "sony",
  "playstation",
  "nintendo",
  "pokemon",
  "facebook",
  "instagram",
  "tiktok",
  "youtube",
  "twitter",
  "openai",
  "chatgpt",
  "binance",
  "coinbase",
  "visa",
  "mastercard",
  "paypal",
  "red bull",
  "redbull",
  "uber",
  "airbnb",
];

// Personnalités réelles : pas de token à leur nom.
export const PEOPLE = [
  "trump",
  "donald trump",
  "biden",
  "obama",
  "kamala",
  "harris",
  "elon",
  "musk",
  "elon musk",
  "putin",
  "poutine",
  "macron",
  "zelensky",
  "zelenskyy",
  "xi jinping",
  "kim jong",
  "netanyahu",
  "erdogan",
  "modi",
  "le pen",
  "melenchon",
  "bardella",
  "zemmour",
  "pope",
  "pape",
  "king charles",
  "taylor swift",
  "kanye",
  "ye west",
  "beyonce",
  "rihanna",
  "cristiano",
  "ronaldo",
  "messi",
  "mbappe",
  "neymar",
  "lebron",
  "bezos",
  "zuckerberg",
  "gates",
  "bill gates",
  "vitalik",
  "cz binance",
  "saylor",
  "mrbeast",
  "kardashian",
  "andrew tate",
];

// Haine et terrorisme. Liste courte des termes les plus courants (FR et EN), à compléter par la
// modération. Ces mots sont cherchés aussi à l'intérieur des mots collés (« nazicoin »).
export const HATE_EMBEDDED = [
  "nazi",
  "hitler",
  "heil",
  "swastika",
  "kkk",
  "isis",
  "daesh",
  "jihad",
  "genocide",
  "holocaust",
  "nigger",
  "nigga",
  "negro",
  "faggot",
  "fagot",
  "tranny",
  "retard",
  "chink",
  "spic",
  "kike",
  "wetback",
  "beaner",
  "raghead",
  "towelhead",
  "pedo",
  "pedophile",
  "pedophil",
  "bougnoule",
  "negre",
  "youpin",
  "pede",
  "tarlouze",
  "bicot",
  "sale arabe",
  "sale juif",
  "sale noir",
];

// Mots courts qui ne doivent compter qu'entiers (sinon « spicy » ou « pedestal » seraient refusés).
export const WHOLE_WORD_ONLY = new Set([
  "spic",
  "pede",
  "pedo",
  "isis",
  "heil",
  "kkk",
  "negro",
  "retard",
]);

function contains(normalized: string, squashed: string, term: string, embedded: boolean): boolean {
  const t = normalizeForModeration(term);
  if (t.includes(" "))
    return ` ${normalized} `.includes(` ${t} `) || squashed.includes(t.replace(/ /g, ""));
  if (` ${normalized} `.includes(` ${t} `)) return true;
  // Mots collés (« elonmusk », « nazicoin ») : seulement pour les termes assez longs.
  return embedded && !WHOLE_WORD_ONLY.has(t) && t.length >= 4 && squashed.includes(t);
}

export function moderateText(...inputs: (string | undefined | null)[]): ModerationResult {
  const normalized = normalizeForModeration(inputs.filter(Boolean).join(" "));
  const squashed = normalized.replace(/ /g, "");
  const reasons = new Set<ModerationReason>();
  const matches: string[] = [];
  const check = (list: string[], reason: ModerationReason, embedded: boolean) => {
    for (const term of list) {
      if (contains(normalized, squashed, term, embedded)) {
        reasons.add(reason);
        matches.push(term);
      }
    }
  };
  check(HATE_EMBEDDED, "hate", true);
  // Personnes et marques : mots entiers, ou noms en plusieurs mots collés (« elonmusk », « cocacola »).
  check(PEOPLE, "person", false);
  check(BRANDS, "brand", false);
  return {
    ok: reasons.size === 0,
    reasons: [...reasons].sort(),
    matches: [...new Set(matches)].sort(),
  };
}
