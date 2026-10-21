import { NextResponse } from "next/server";
import { solanaPublicEnv } from "@/lib/env";
import { getPublicSide } from "@/lib/sides";

/**
 * Métadonnées d'un token de battle (format attendu par pump.fun et les wallets : name, symbol,
 * description, image). Leur adresse est inscrite sur la chaîne à la création du token.
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/metadata/[sideId]">) {
  const { sideId } = await ctx.params;
  const side = await getPublicSide(sideId);
  if (!side) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const appUrl = solanaPublicEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  return NextResponse.json(
    {
      name: side.name,
      symbol: side.ticker,
      description: side.description ?? `${side.theme} — BATTLE LAUNCH`,
      image: side.imageUrl ?? `${appUrl}/api/metadata/${side.id}/image`,
      showName: true,
      createdOn: appUrl,
      website: `${appUrl}/en/battle/${side.battleId}`,
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}
