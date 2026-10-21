import { defineConfig } from "vitest/config";

// Les tests du dossier e2e/ sont pour Playwright (navigateur réel), pas pour Vitest.
export default defineConfig({
  test: { exclude: ["node_modules/**", "e2e/**", ".next/**"] },
});
