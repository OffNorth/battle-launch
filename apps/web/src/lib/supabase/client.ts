import type { Database } from "@battle/shared";
import { createBrowserClient } from "@supabase/ssr";
import { publicEnv } from "@/lib/env";

/** Client Supabase du navigateur : lecture publique (RLS), session dans les cookies. */
export function createClient() {
  const env = publicEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
