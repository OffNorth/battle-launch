import "server-only";
import { moderateText, type SideInput } from "@battle/shared";
import { ApiFailure, apiError } from "@/lib/api";

/**
 * Refuse marques, personnalités et haine dans les textes publics d'une battle (422).
 * Le worker refait ce contrôle avant tout lancement (quelqu'un pourrait appeler la base
 * directement, sans passer par le site).
 */
export function assertCleanContent(...texts: (string | undefined)[]) {
  const result = moderateText(...texts);
  if (!result.ok)
    throw new ApiFailure(apiError(422, "content_refused", { reasons: result.reasons }));
}

export function sideTexts(side: SideInput): string[] {
  return [side.name, side.ticker, side.description];
}

/** Camp au format attendu par les fonctions SQL create_battle / accept_duel. */
export function sideRow(side: "A" | "B", input: SideInput) {
  return {
    side,
    name: input.name,
    ticker: input.ticker,
    description: input.description ?? "",
    image_url: input.imageUrl ?? "",
  };
}
