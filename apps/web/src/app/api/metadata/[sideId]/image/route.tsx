import { ImageResponse } from "next/og";
import { getPublicSide } from "@/lib/sides";

/** Image par défaut d'un token de battle (512 × 512, aux couleurs du site) quand le créateur n'en a pas fourni. */
export async function GET(_request: Request, ctx: RouteContext<"/api/metadata/[sideId]/image">) {
  const { sideId } = await ctx.params;
  const side = await getPublicSide(sideId);
  if (!side) return new Response("not found", { status: 404 });
  const accent = side.side === "A" ? "#16a34a" : "#14342b";
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(160deg, #f6fdf7 0%, #dcfce7 100%)",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          width: 300,
          height: 300,
          borderRadius: 9999,
          background: accent,
          color: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: side.ticker.length > 5 ? 64 : 96,
          fontWeight: 800,
        }}
      >
        {side.ticker}
      </div>
      <div style={{ marginTop: 28, fontSize: 40, fontWeight: 700, color: "#14342b" }}>
        {side.name}
      </div>
    </div>,
    { width: 512, height: 512, headers: { "cache-control": "public, max-age=3600" } },
  );
}
