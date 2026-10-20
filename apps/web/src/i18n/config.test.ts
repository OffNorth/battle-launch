import { describe, expect, it } from "vitest";
import { negotiateLocale, switchLocalePath } from "./config";

describe("negotiateLocale", () => {
  it("prend le français quand il est préféré", () => {
    expect(negotiateLocale("fr-FR,fr;q=0.9,en;q=0.8")).toBe("fr");
  });
  it("respecte les poids", () => {
    expect(negotiateLocale("fr;q=0.5,en;q=0.9")).toBe("en");
  });
  it("retombe sur l'anglais", () => {
    expect(negotiateLocale("de-DE,es;q=0.8")).toBe("en");
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("fr;q=0")).toBe("en");
  });
});

describe("switchLocalePath", () => {
  it("change la langue du chemin", () => {
    expect(switchLocalePath("/fr/docs", "en")).toBe("/en/docs");
    expect(switchLocalePath("/en", "fr")).toBe("/fr");
    expect(switchLocalePath("/docs", "fr")).toBe("/fr/docs");
  });
});
