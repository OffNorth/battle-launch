import { defineConfig } from "@playwright/test";

/**
 * Tests de bout en bout (navigateur réel). Par défaut : le site local (`npm run dev`) et le
 * navigateur Edge installé sur la machine (aucun navigateur à télécharger).
 * Autre cible : E2E_BASE_URL=https://… npm run e2e --workspace @battle/web
 * Les tests lisent les données de démonstration (scripts/seed-devnet.ts).
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    channel: process.env.E2E_CHANNEL ?? "msedge",
    locale: "en-US",
    trace: "retain-on-failure",
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000/en",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
