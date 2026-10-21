import "server-only";
import { z } from "zod";
import { createPublicClient } from "@/lib/supabase/public";

const Id = z.uuid();

export type PublicSide = {
  id: string;
  side: "A" | "B";
  name: string;
  ticker: string;
  description: string | null;
  imageUrl: string | null;
  battleId: string;
  theme: string;
};

/** Un camp public (battle non brouillon), pour les métadonnées du token. */
export async function getPublicSide(sideId: string): Promise<PublicSide | null> {
  if (!Id.safeParse(sideId).success) return null;
  const { data } = await createPublicClient()
    .from("battle_sides")
    .select("id, side, name, ticker, description, image_url, battle:battles ( id, theme )")
    .eq("id", sideId)
    .maybeSingle();
  if (!data || !data.battle) return null;
  return {
    id: data.id,
    side: data.side,
    name: data.name,
    ticker: data.ticker,
    description: data.description,
    imageUrl: data.image_url,
    battleId: data.battle.id,
    theme: data.battle.theme,
  };
}
