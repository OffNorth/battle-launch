import { metadataUri } from "@battle/shared";
import { validateLaunchPair } from "@battle/shared/launch";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiFailure, fromDbError, handle, parseBody, requireProfile } from "@/lib/api";
import { getBattle } from "@/lib/battles";
import { solanaPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const Id = z.uuid();
const base58 = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
const base64 = z.string().regex(/^[A-Za-z0-9+/=]{100,2400}$/);

const Body = z.object({
  side: z.enum(["A", "B"]),
  mint: base58,
  createTx: base64,
  createNonce: base58,
  buyTx: base64,
  buyNonce: base58,
});

/**
 * Le créateur d'un camp dépose ses deux transactions pré-signées (création du token, achat
 * initial). Elles sont vérifiées ici pour répondre tout de suite en cas d'erreur, rangées hors
 * de portée du public, puis revérifiées par le worker juste avant l'envoi.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/battles/[id]/launch-tx">) {
  return handle(async () => {
    const id = Id.safeParse((await ctx.params).id);
    if (!id.success) throw new ApiFailure(apiError(404, "not_found"));
    const profile = await requireProfile();
    const input = await parseBody(request, Body);

    const battle = await getBattle(id.data);
    const side = battle?.sideDetails.find((s) => s.side === input.side);
    if (!battle || !side) throw new ApiFailure(apiError(404, "not_found"));
    if (side.creatorId !== profile.id) throw new ApiFailure(apiError(403, "forbidden"));
    if (battle.status !== "lobby") throw new ApiFailure(apiError(409, "lobby_closed"));

    const check = validateLaunchPair(input.createTx, input.buyTx, {
      creator: profile.wallet,
      mint: input.mint,
      createNonceAccount: input.createNonce,
      buyNonceAccount: input.buyNonce,
      name: side.name,
      symbol: side.ticker,
      uri: metadataUri(solanaPublicEnv().NEXT_PUBLIC_APP_URL, side.id),
      initialBuyLamports: BigInt(battle.initialBuyLamports),
    });
    if (!check.ok)
      throw new ApiFailure(apiError(400, "invalid_launch_tx", { reason: check.reason }));

    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_launch_tx", {
      p_battle: id.data,
      p_side: input.side,
      p_mint: input.mint,
      p_create_tx: input.createTx,
      p_create_nonce: input.createNonce,
      p_buy_tx: input.buyTx,
      p_buy_nonce: input.buyNonce,
    });
    if (error) throw fromDbError(error, "launch_tx_failed");
    return NextResponse.json({ ok: true });
  });
}
