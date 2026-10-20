import "server-only";
import type { Database } from "@battle/shared";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";

/**
 * Client avec la clé secrète : contourne la RLS. Uniquement dans les routes API, APRÈS
 * avoir vérifié l'utilisateur et validé l'entrée avec Zod. Jamais dans un composant client.
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv().NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
