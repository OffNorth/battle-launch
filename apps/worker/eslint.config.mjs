import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // tsup écrit un fichier temporaire *.bundled_*.mjs pendant le build (lancé en parallèle du lint).
  { ignores: ["node_modules", "coverage", "dist", "*.bundled_*.mjs"] },
  js.configs.recommended,
  ...tseslint.configs.strict,
);
