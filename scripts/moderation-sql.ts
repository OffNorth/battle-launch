/**
 * Génère l'insertion SQL des termes refusés à partir des listes de packages/shared/src/moderation.ts
 * (une seule source : le site et la base refusent exactement les mêmes mots).
 * Usage : npx tsx scripts/moderation-sql.ts > fichier.sql, puis l'ajouter à une migration.
 * À relancer après chaque changement des listes.
 */
import {
  BRANDS,
  HATE_EMBEDDED,
  normalizeForModeration,
  PEOPLE,
  WHOLE_WORD_ONLY,
} from "../packages/shared/src/moderation";

const rows: string[] = [];
const add = (list: readonly string[], category: string, embeddedAllowed: boolean) => {
  for (const raw of list) {
    const term = normalizeForModeration(raw);
    const embedded =
      embeddedAllowed && !term.includes(" ") && !WHOLE_WORD_ONLY.has(term) && term.length >= 4;
    rows.push(`  ('${term.replace(/'/g, "''")}', '${category}', ${embedded})`);
  }
};
add(HATE_EMBEDDED, "hate", true);
add(PEOPLE, "person", false);
add(BRANDS, "brand", false);
console.log(
  `insert into app_private.blocked_terms (term, category, embedded) values\n${[...new Set(rows)].join(",\n")}\non conflict (term) do nothing;`,
);
