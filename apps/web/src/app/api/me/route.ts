import { NextResponse } from "next/server";
import { getCurrentProfile } from "@/lib/auth";

/**
 * Profil de la personne connectée (wallet, rôle), ou `profile: null`.
 * Réponse 200 dans les deux cas : « pas connecté » n'est pas une erreur pour un visiteur.
 */
export async function GET() {
  const profile = await getCurrentProfile();
  return NextResponse.json({ profile }, { headers: { "cache-control": "no-store" } });
}
