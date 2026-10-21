import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, hasLocale, LOCALES, RETIRED_LOCALES } from "./config";

describe("langues", () => {
  it("le site est en anglais seulement", () => {
    expect(LOCALES).toEqual(["en"]);
    expect(DEFAULT_LOCALE).toBe("en");
    expect(hasLocale("en")).toBe(true);
    expect(hasLocale("fr")).toBe(false);
  });
  it("l'ancien français est repéré pour être redirigé", () => {
    expect(RETIRED_LOCALES).toContain("fr");
  });
});
