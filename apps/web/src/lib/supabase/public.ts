import "server-only";
import type { Database } from "@battle/shared";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";

/**
 * Client de lecture publique côté serveur, sans session (aucun cookie lu) : ne voit que ce que
 * la RLS montre à tout le monde. Pour les pages publiques (accueil, battle, classements).
 */
export function createPublicClient() {
  const env = publicEnv();
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
