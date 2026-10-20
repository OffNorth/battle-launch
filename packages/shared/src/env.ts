import { z } from "zod";

/**
 * Valide les variables d'environnement au démarrage, avec un message clair.
 * Le message donne le NOM des variables en défaut, jamais leur valeur (une clé ne doit
 * jamais apparaître dans un journal).
 */
export function parseEnv<S extends z.ZodType>(
  schema: S,
  source: Record<string, string | undefined>,
): z.infer<S> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => {
    const name = issue.path.join(".") || "(racine)";
    return `- ${name} : ${issue.message}`;
  });
  throw new Error(`Variables d'environnement invalides :\n${problems.join("\n")}`);
}

/** Réseau Solana utilisé. Tout commence en devnet : mainnet demande une validation explicite. */
export const SolanaCluster = z.enum(["devnet", "mainnet-beta"]);
export type SolanaCluster = z.infer<typeof SolanaCluster>;

/** Variable vide (chaîne "") traitée comme absente : les tableaux de bord créent souvent des variables vides. */
export const optionalSecret = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v.trim() === "" ? undefined : v.trim()));
