import "server-only";
import type { Database } from "@battle/shared";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Client Supabase côté serveur, au nom de l'utilisateur (cookies de session, RLS appliquée).
 * Lit les cookies : à n'appeler que derrière un <Suspense> ou dans une route API.
 */
export async function createClient() {
  const cookieStore = await cookies();
  const env = publicEnv();
  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Appelé depuis un Server Component (qui ne peut pas écrire de cookie) :
            // sans gravité, le proxy rafraîchit la session à chaque requête.
          }
        },
      },
    },
  );
}
