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

test("navigation dans le site sans erreur, thème retenu, fichiers publics servis tels quels", async ({
  page,
  request,
}) => {
  const errors = watchConsole(page);
  await page.goto("/en");
  // Navigation côté navigateur (sans rechargement), là où React refaisait le rendu du layout.
  for (const name of ["Leaderboard", "Hall of Fame", "Rules & FAQ", "Battles"]) {
    await page.getByRole("banner").getByRole("link", { name, exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  }
  // Thème clair choisi : toujours là après rechargement, dès le premier affichage.
  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);

  for (const path of ["/sw.js", "/theme-init.js"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status(), path).toBe(200);
  }
});

test("wallet déjà choisi (comme Phantom) : la page s'hydrate sans écart ni erreur", async ({
  page,
}) => {
  // Faux wallet au standard « Wallet Standard » (comme l'extension Phantom), déjà choisi lors d'une
  // visite précédente : le navigateur affiche son icône alors que le serveur ne le connaît pas.
  await page.addInitScript(() => {
    const icon =
      "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiLz4=";
    const wallet = {
      version: "1.0.0",
      name: "Phantom",
      icon,
      chains: ["solana:devnet"],
      accounts: [],
      features: {
        "standard:connect": { version: "1.0.0", connect: () => new Promise(() => {}) },
        "standard:events": { version: "1.0.0", on: () => () => {} },
        "solana:signTransaction": {
          version: "1.0.0",
          supportedTransactionVersions: ["legacy", 0],
          signTransaction: async () => [],
        },
      },
    };
    const callback = ({ register }: { register: (w: unknown) => void }) => register(wallet);
    window.dispatchEvent(new CustomEvent("wallet-standard:register-wallet", { detail: callback }));
    window.addEventListener("wallet-standard:app-ready", (e) =>
      callback((e as CustomEvent<{ register: (w: unknown) => void }>).detail),
    );
    localStorage.setItem("walletName", JSON.stringify("Phantom"));
  });
  const errors = watchConsole(page);
  await page.goto("/en");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});
