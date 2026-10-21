import { expect, test, type Page } from "@playwright/test";

/**
 * Parcours d'une battle tel qu'un visiteur le voit, de bout en bout, sur les données de
 * démonstration (scripts/seed-devnet.ts) : accueil -> lobby -> battle terminée -> vérification
 * du gagnant recalculée dans le navigateur. Aucune erreur dans la console.
 */
const FINISHED = "d0000000-0000-4000-8000-000000000101";
const LOBBY = "d0000000-0000-4000-8000-000000000102";

/** Erreurs de la console pendant le test (hors extensions du navigateur). */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !m.location().url.startsWith("chrome-extension://"))
      errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

test("accueil : battles à la une, à venir et terminées", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/");
  await expect(page).toHaveURL(/\/(fr|en)$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText("Cat vs Dog (demo)").first()).toBeVisible();
  await expect(page.getByText("Pizza vs Burger (demo)").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("lobby : compte à rebours, règles, inscription réservée aux connectés", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto(`/en/battle/${LOBBY}`);
  await expect(page.getByRole("heading", { name: "Margherita" })).toBeVisible();
  await expect(page.getByText("Starts in")).toBeVisible();
  await expect(page.getByText("Sign in to take part.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("battle terminée : gagnant, stats, graphiques, trades", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto(`/en/battle/${FINISHED}`);
  await expect(page.getByText("Rex wins this battle")).toBeVisible();
  await expect(page.getByRole("table", { name: "Live stats of both sides" })).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Live trades" }).getByRole("listitem").first(),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("vérification : le navigateur retrouve le même hash et le même gagnant", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto(`/en/battle/${FINISHED}/verify`);
  await expect(page.getByText("The hash matches: the snapshot was not modified.")).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByText("The recomputed result is identical to the published result."),
  ).toBeVisible();
  await expect(page.getByText(/Recomputed winner : Rex/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("pages publiques : règles, classement, Hall of Fame, mobile sans défilement horizontal", async ({
  page,
}) => {
  const errors = watchConsole(page);
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ["/en/docs", "/en/leaderboard", "/en/hall-of-fame", "/en/create"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  expect(errors).toEqual([]);
});
