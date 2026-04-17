import eslintJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginAstro from "eslint-plugin-astro";
import eslintPluginReact from "eslint-plugin-react";
import eslintConfigPrettier from "eslint-config-prettier";

export default tseslint.config(
  // Base JS recommended rules
  eslintJs.configs.recommended,

  // TypeScript recommended (type-aware)
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Astro
  ...eslintPluginAstro.configs.recommended,

  // React
  {
    files: ["**/*.{tsx,jsx}"],
    plugins: { react: eslintPluginReact },
    settings: { react: { version: "detect" } },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },

  // Rule overrides
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Warn-only: allow gradual migration to stricter types
      "@typescript-eslint/no-unsafe-assignment": "warn",
      "@typescript-eslint/no-unsafe-member-access": "warn",
      "@typescript-eslint/no-unsafe-argument": "warn",
      "@typescript-eslint/no-unsafe-call": "warn",
      "@typescript-eslint/no-unsafe-return": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-misused-promises": "warn",
    },
  },

  // Prettier must be last to disable conflicting rules
  eslintConfigPrettier,

  // Global ignores
  {
    ignores: [
      "dist/",
      "node_modules/",
      ".astro/",
      "playwright-report/",
      "test-results/",
      "scripts/",
      "src/pages-dev/",
    ],
  },
);
