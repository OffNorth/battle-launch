import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { moderateText, SideInput } from "@battle/shared";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, ApiFailure, fromDbError, handle, parseBody, requireProfile } from "@/lib/api";
import { serverEnv } from "@/lib/env.server";
import { createClient } from "@/lib/supabase/server";

/**
 * Mode Auto-IA : Claude propose trois paires de concepts opposés pour une battle.
 * Chaque proposition est revalidée (format, filtre de contenu) et comparée aux camps déjà
 * lancés (doublons) avant d'être montrée. Le créateur choisit et peut tout modifier.
 */

const Request = z.object({
  /** Piste de thème facultative (« animaux », « nourriture »…). */
  hint: z.string().trim().max(60).optional().default(""),
  locale: z.enum(["en", "fr"]).default("en"),
});

// Schéma de sortie imposé au modèle (sortie structurée). Les limites fines sont revérifiées
// ensuite avec SideInput : le schéma de sortie reste simple.
const ConceptSide = z.object({ name: z.string(), ticker: z.string(), description: z.string() });
const Output = z.object({
  concepts: z.array(z.object({ theme: z.string(), sideA: ConceptSide, sideB: ConceptSide })),
});

/** Similarité au-delà de laquelle un nom est jugé déjà pris (trigrammes, 0 à 1). */
const DUPLICATE_SIMILARITY = 0.6;

const SYSTEM = `You invent playful head-to-head themes for a memecoin "battle" website.
Each concept is two opposing sides of one theme (for example Cat vs Dog, Pizza vs Burger).
Rules for every side:
- name: 2 to 24 characters, original and catchy;
- ticker: 3 to 8 uppercase letters or digits, no "$";
- description: one short sentence (at most 120 characters), fun, about the side's personality.
Never use real people, celebrities, politicians, brands, trademarks, sports teams, or anything
hateful, sexual, violent or about real tragedies. Never promise gains, prices or returns.
The two sides of a concept must be clearly different from each other, and the three concepts
must be different from each other.`;

export async function POST(request: globalThis.Request) {
  return handle(async () => {
    await requireProfile();
    const apiKey = serverEnv().ANTHROPIC_API_KEY;
    if (!apiKey) throw new ApiFailure(apiError(503, "auto_ai_unavailable"));
    // Limite de débit comptée par la base pour la personne connectée (10 par heure).
    const supabase = await createClient();
    const limited = await supabase.rpc("consume_rate_limit", { p_action: "ai" });
    if (limited.error) throw fromDbError(limited.error, "auto_ai_failed");
    const input = await parseBody(request, Request);

    const hint = moderateText(input.hint);
    if (!hint.ok) throw new ApiFailure(apiError(422, "content_refused", { reasons: hint.reasons }));

    const language = input.locale === "fr" ? "French" : "English";
    const client = new Anthropic({ apiKey, timeout: 60_000, maxRetries: 1 });

    let response;
    try {
      response = await client.beta.messages.parse({
        model: "claude-opus-5-5",
        max_tokens: 4000,
        // Réglage du refus : si le modèle décline, l'API essaie d'elle-même un modèle de repli.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // Tâche courte et simple : peu de réflexion suffit.
        output_config: { effort: "low", format: betaZodOutputFormat(Output) },
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Propose exactly 3 concepts. Write theme names and descriptions in ${language}.${
              input.hint ? ` Theme idea to start from: ${JSON.stringify(input.hint)}.` : ""
            }`,
          },
        ],
      });
    } catch (e) {
      if (e instanceof Anthropic.RateLimitError)
        throw new ApiFailure(apiError(429, "too_many_requests"));
      if (e instanceof Anthropic.APIError) throw new ApiFailure(apiError(502, "auto_ai_failed"));
      throw e;
    }
    if (response.stop_reason === "refusal") throw new ApiFailure(apiError(422, "auto_ai_refused"));
    const parsed = response.parsed_output;
    if (!parsed) throw new ApiFailure(apiError(502, "auto_ai_failed"));

    // Revalidation et filtre de contenu : une proposition fautive est simplement écartée.
    const candidates = parsed.concepts.flatMap((c) => {
      const a = SideInput.safeParse(c.sideA);
      const b = SideInput.safeParse(c.sideB);
      if (!a.success || !b.success || a.data.ticker === b.data.ticker) return [];
      const theme = c.theme.trim().slice(0, 80);
      if (theme.length < 3) return [];
      const check = moderateText(
        theme,
        a.data.name,
        a.data.ticker,
        a.data.description,
        b.data.name,
        b.data.ticker,
        b.data.description,
      );
      return check.ok ? [{ theme, sideA: a.data, sideB: b.data }] : [];
    });

    // Doublons : un concept est écarté si l'un de ses camps ressemble trop à un camp déjà créé.
    // Une requête par concept (3 au plus) pour savoir exactement lequel ressemble à quoi.
    const checks = await Promise.all(
      candidates.map((c) =>
        supabase.rpc("find_similar_sides", {
          p_names: [c.sideA.name, c.sideB.name],
          p_min_similarity: DUPLICATE_SIMILARITY,
        }),
      ),
    );
    if (checks.some((r) => r.error))
      throw new ApiFailure(apiError(503, "duplicate_check_unavailable"));
    const concepts = candidates.filter((_, i) => (checks[i]?.data ?? []).length === 0);

    return NextResponse.json({ concepts, discarded: parsed.concepts.length - concepts.length });
  });
}
