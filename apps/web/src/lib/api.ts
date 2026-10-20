import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { getCurrentProfile, type CurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Outils communs des routes API : réponses d'erreur, utilisateur obligatoire, validation Zod,
 * limite de débit. Les messages d'erreur sont des codes courts (traduits côté site), jamais
 * des détails internes ni des valeurs secrètes.
 */

export function apiError(status: number, code: string, details?: unknown) {
  return NextResponse.json({ error: code, ...(details ? { details } : {}) }, { status });
}

export class ApiFailure extends Error {
  constructor(readonly response: NextResponse) {
    super("api failure");
  }
}

/** Personne connectée et non bannie, sinon 401 / 403. */
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

/** Adresse du client (derrière le proxy de Vercel), pour limiter le débit des visiteurs. */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Compte un passage ; 429 si `limit` passages ont déjà eu lieu dans la fenêtre. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) throw new ApiFailure(apiError(503, "rate_limit_unavailable"));
  if (data === false) throw new ApiFailure(apiError(429, "too_many_requests"));
}

/** Enveloppe d'une route : transforme les ApiFailure en réponses, cache le reste (500 générique). */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiFailure) return e.response;
    // Variable d'environnement manquante côté serveur (clé secrète…) : réponse générique au
    // visiteur ; le journal nomme la variable en défaut, jamais sa valeur (voir parseEnv).
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
