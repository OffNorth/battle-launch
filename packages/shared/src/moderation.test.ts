import { describe, expect, it } from "vitest";
import { moderateText, normalizeForModeration } from "./moderation";

describe("normalizeForModeration", () => {
  it("aplatit accents, majuscules et écriture l33t", () => {
    expect(normalizeForModeration("€L0N  M-U-$K")).toBe("elon m u sk");
    expect(normalizeForModeration("Macrön")).toBe("macron");
  });
});

describe("moderateText", () => {
  it("laisse passer un thème ordinaire", () => {
    expect(moderateText("Chat contre Chien", "Moustache", "MEOW").ok).toBe(true);
    expect(moderateText("Pizza vs Burger", "Spicy Pepperoni", "SPICY").ok).toBe(true);
    expect(moderateText("Pedestal", "Retardant").ok).toBe(true);
  });

  it("refuse une marque", () => {
    const r = moderateText("Nike vs Puma");
    expect(r.ok).toBe(false);
    expect(r.reasons).toEqual(["brand"]);
  });

  it("refuse une personnalité, même déguisée", () => {
    expect(moderateText("ELON coin").reasons).toContain("person");
    expect(moderateText("Tr0mp", "TRUMP").reasons).toContain("person");
    expect(moderateText("elonmusk").reasons).toContain("person");
  });

  it("refuse la haine, même collée dans un mot", () => {
    expect(moderateText("NaziCoin").reasons).toContain("hate");
    expect(moderateText("h1tler").reasons).toContain("hate");
  });

  it("ne refuse les mots courts qu'entiers", () => {
    expect(moderateText("spicy").ok).toBe(true);
    expect(moderateText("spic").ok).toBe(false);
  });
});
