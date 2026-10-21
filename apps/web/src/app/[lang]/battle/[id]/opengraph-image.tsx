import { ImageResponse } from "next/og";
import { z } from "zod";
import { getBattle } from "@/lib/battles";

/** Image de partage d'une battle (réseaux sociaux) : A contre B, aux couleurs du site, score si lancée. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "BATTLE LAUNCH";

export default async function OpengraphImage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const battle = z.uuid().safeParse(id).success ? await getBattle(id).catch(() => null) : null;
  const a = battle?.sides.A;
  const b = battle?.sides.B;
  const pctA = a?.score !== null && a?.score !== undefined ? Math.round(a.score * 100) : null;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: 72,
        background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 55%, #dcfce7 100%)",
        fontFamily: "sans-serif",
        color: "#14342b",
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 2, color: "#16a34a" }}>
        BATTLE LAUNCH
      </div>
      <div style={{ marginTop: 18, fontSize: 30, color: "#4b6358" }}>{battle?.theme ?? ""}</div>
      <div style={{ display: "flex", alignItems: "center", marginTop: 40, gap: 36 }}>
        <div style={{ fontSize: 88, fontWeight: 900, color: "#16a34a" }}>{a?.name ?? "A"}</div>
        <div style={{ fontSize: 44, fontWeight: 800, color: "#7a8f86" }}>VS</div>
        <div style={{ fontSize: 88, fontWeight: 900, color: "#14342b" }}>{b?.name ?? "B"}</div>
      </div>
      {pctA !== null && (
        <div
          style={{
            display: "flex",
            marginTop: 48,
            width: "100%",
            height: 28,
            borderRadius: 14,
            overflow: "hidden",
          }}
        >
          <div style={{ width: `${pctA}%`, background: "#16a34a" }} />
          <div style={{ width: `${100 - pctA}%`, background: "#14342b" }} />
        </div>
      )}
    </div>,
    size,
  );
}
