import { z } from "zod";
import { DEFAULT_WEIGHTS, ScoreMode, ScoreWeights } from "./types";

/**
 * Règles de création d'une battle, communes au formulaire (navigateur) et à l'API (serveur).
 * Le serveur revalide toujours : le navigateur ne fait foi de rien.
 */

export const BattleMode = z.enum(["creator", "open_duel", "auto_ai"]);
export type BattleMode = z.infer<typeof BattleMode>;

export const DURATIONS_MINUTES = [60, 180, 360] as const;
export const LOBBY_MIN_MINUTES = 5;
export const LOBBY_MAX_MINUTES = 15;

/** Achat initial permis, en lamports (devnet : SOL de test). Identique pour les deux camps. */
export const INITIAL_BUY_MIN_LAMPORTS = 10_000_000n; // 0,01 SOL
export const INITIAL_BUY_MAX_LAMPORTS = 1_000_000_000n; // 1 SOL

/**
 * « 0,05 » ou « 0.05 » SOL -> 50 000 000 lamports, sans passer par un flottant.
 * Refuse plus de 9 décimales, les signes et les écritures exotiques.
 */
export function parseSolToLamports(input: string): bigint | null {
  const s = input.trim().replace(",", ".");
  const m = /^(\d{1,9})(?:\.(\d{1,9}))?$/.exec(s);
  if (!m) return null;
  const whole = BigInt(m[1] ?? "0");
  const frac = BigInt((m[2] ?? "").padEnd(9, "0"));
  return whole * 1_000_000_000n + frac;
}

/** Lamports -> texte décimal exact en SOL (« 0.05 »). */
export function lamportsToSolString(lamports: bigint): string {
  const whole = lamports / 1_000_000_000n;
  const frac = (lamports % 1_000_000_000n).toString().padStart(9, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

const text = (min: number, max: number) =>
  z
    .string()
    .transform((s) => s.normalize("NFC").replace(/\s+/g, " ").trim())
    .pipe(z.string().min(min).max(max));

export const SideInput = z.object({
  name: text(2, 32),
  ticker: z
    .string()
    .transform((s) => s.trim().replace(/^\$/, "").toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{2,10}$/, "2 to 10 letters or digits")),
  description: text(0, 280).optional().default(""),
  imageUrl: z
    .url({ protocol: /^https$/ })
    .max(500)
    .optional(),
});
export type SideInput = z.infer<typeof SideInput>;

const initialBuy = z
  .string()
  .transform((s, ctx) => {
    const lamports = parseSolToLamports(s);
    if (lamports === null) {
      ctx.addIssue({ code: "custom", message: "invalid SOL amount" });
      return z.NEVER;
    }
    return lamports;
  })
  .refine((l) => l >= INITIAL_BUY_MIN_LAMPORTS && l <= INITIAL_BUY_MAX_LAMPORTS, {
    message: `between ${lamportsToSolString(INITIAL_BUY_MIN_LAMPORTS)} and ${lamportsToSolString(INITIAL_BUY_MAX_LAMPORTS)} SOL`,
  });

const rules = {
  theme: text(3, 80),
  durationMinutes: z.union(DURATIONS_MINUTES.map((d) => z.literal(d))),
  lobbyMinutes: z.number().int().min(LOBBY_MIN_MINUTES).max(LOBBY_MAX_MINUTES),
  scoreMode: ScoreMode.default("composite"),
  weights: ScoreWeights.default(DEFAULT_WEIGHTS),
  initialBuySol: initialBuy,
  /** Case « j'ai lu les risques » : obligatoire. */
  acceptRisks: z.literal(true),
};

/** Création : en mode créateur ou Auto-IA, les deux camps ; en duel ouvert, le camp A seulement. */
export const CreateBattleInput = z
  .discriminatedUnion("mode", [
    z.object({ mode: z.literal("creator"), ...rules, sideA: SideInput, sideB: SideInput }),
    z.object({ mode: z.literal("auto_ai"), ...rules, sideA: SideInput, sideB: SideInput }),
    z.object({ mode: z.literal("open_duel"), ...rules, sideA: SideInput }),
  ])
  .superRefine((v, ctx) => {
    if ("sideB" in v) {
      if (v.sideA.ticker === v.sideB.ticker) {
        ctx.addIssue({
          code: "custom",
          path: ["sideB", "ticker"],
          message: "both sides need different tickers",
        });
      }
      if (v.sideA.name.toLowerCase() === v.sideB.name.toLowerCase()) {
        ctx.addIssue({
          code: "custom",
          path: ["sideB", "name"],
          message: "both sides need different names",
        });
      }
    }
  });
export type CreateBattleInput = z.infer<typeof CreateBattleInput>;

/** Un challenger relève un duel ouvert en proposant le camp B. */
export const AcceptDuelInput = z.object({ sideB: SideInput, acceptRisks: z.literal(true) });
export type AcceptDuelInput = z.infer<typeof AcceptDuelInput>;

/** Heures du lobby : il s'ouvre maintenant et le lancement a lieu `lobbyMinutes` plus tard. */
export function lobbySchedule(
  now: Date,
  lobbyMinutes: number,
): { lobbyOpensAt: Date; launchAt: Date } {
  return { lobbyOpensAt: now, launchAt: new Date(now.getTime() + lobbyMinutes * 60_000) };
}

/**
 * Adresse des métadonnées d'un camp, inscrite dans la création du token. Le navigateur du
 * créateur et le worker la calculent de la même façon (le worker refuse une autre adresse).
 */
export function metadataUri(appUrl: string, sideId: string): string {
  return `${appUrl.replace(/\/+$/, "")}/api/metadata/${sideId}`;
}
