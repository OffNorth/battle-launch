import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CurrentProfile = {
  id: string;
  wallet: string;
  displayName: string | null;
  isAdmin: boolean;
  isBanned: boolean;
};

/**
 * Profil de l'utilisateur connecté, ou null. Le jeton est VÉRIFIÉ (getClaims), pas seulement lu :
 * à appeler dans chaque route API qui écrit, au plus près de la donnée.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims.sub;
  if (error || !userId) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, wallet, display_name, is_admin, is_banned")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return null;
  return {
    id: profile.id,
    wallet: profile.wallet,
    displayName: profile.display_name,
    isAdmin: profile.is_admin,
    isBanned: profile.is_banned,
  };
}
