import { defineConfig } from "tsup";

// Un seul fichier dist/index.js : le code de @battle/shared (sources TypeScript) est inclus
// dans le paquet, les dépendances npm restent externes (installées sur Railway).
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  noExternal: ["@battle/shared"],
  sourcemap: true,
  clean: true,
});
