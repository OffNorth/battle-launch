import "server-only";
import type { PostgrestError } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getCurrentProfile, type CurrentProfile } from "@/lib/auth";

/**
 * Outils communs des routes API : réponses d'erreur, utilisateur obligatoire, validation Zod,
 * traduction des erreurs de la base. Les messages d'erreur sont des codes courts (traduits côté
 * site), jamais des détails internes ni des valeurs secrètes.
 *
 * Le site n'a AUCUNE clé secrète : les écritures appellent des fonctions SQL avec la session de
 * la personne connectée, et ces fonctions vérifient elles-mêmes l'appelant, son ban et sa limite
 * de débit (migration ecritures_sans_cle).
 */

export function apiError(status: number, code: string, details?: unknown) {
  return NextResponse.json({ error: code, ...(details ? { details } : {}) }, { status });
}

export class ApiFailure extends Error {
  constructor(readonly response: NextResponse) {
    super("api failure");
  }
}

/** Personne connectée et non bannie, sinon 401 / 403 (la base revérifie de son côté). */
export async function requireProfile(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) throw new ApiFailure(apiError(401, "not_signed_in"));
  if (profile.isBanned) throw new ApiFailure(apiError(403, "banned"));
  return profile;
}

/** Lit et valide le corps JSON avec Zod ; 400 avec les champs fautifs sinon. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiFailure(apiError(400, "invalid_json"));
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const fields = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    throw new ApiFailure(apiError(400, "invalid_input", fields));
  }
  return result.data;
}

/** Codes levés exprès par les fonctions SQL (`raise exception '<code>'`) et leur statut HTTP. */
const SQL_ERRORS: Record<string, number> = {
  not_signed_in: 401,
  banned: 403,
  forbidden: 403,
  own_battle: 403,
  not_found: 404,
  not_open: 409,
  lobby_closed: 409,
  already_launched: 409,
  invalid_input: 400,
  too_many_requests: 429,
};

/** Erreur renvoyée par un appel à la base -> réponse HTTP propre. */
export function fromDbError(error: PostgrestError, fallback: string): ApiFailure {
  if (error.code === "P0001" && error.message in SQL_ERRORS) {
    return new ApiFailure(apiError(SQL_ERRORS[error.message] ?? 400, error.message));
  }
  if (error.code === "23505") return new ApiFailure(apiError(409, "conflict"));
  // Contrainte de la base (longueur, format du ticker, bornes…) : entrée refusée.
  if (error.code === "23514" || error.code === "22P02" || error.code === "23502") {
    return new ApiFailure(apiError(400, "invalid_input"));
  }
  if (error.code === "42501") return new ApiFailure(apiError(401, "not_signed_in"));
  console.error(`[api] base : ${error.code} ${error.message.slice(0, 120)}`);
  return new ApiFailure(apiError(500, fallback));
}

/** Enveloppe d'une route : transforme les ApiFailure en réponses, cache le reste (500 générique). */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiFailure) return e.response;
    // Variable d'environnement manquante côté serveur : réponse générique au visiteur ; le
    // journal nomme la variable en défaut, jamais sa valeur (voir parseEnv).
    if (e instanceof Error && e.message.startsWith("Variables d'environnement invalides")) {
      console.error(`[api] configuration : ${e.message.split("\n").slice(1).join(" ")}`);
      return apiError(503, "server_not_configured");
    }
    console.error(
      `[api] ${e instanceof Error ? e.name : "Error"}: ${e instanceof Error ? e.message.slice(0, 200) : ""}`,
    );
    return apiError(500, "internal_error");
  }
}
