import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import eslintPluginImport from "eslint-plugin-import";
import eslintConfigPrettier from "eslint-config-prettier";

export default defineConfig([
  // Base JavaScript configuration
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    plugins: {
      js,
      import: eslintPluginImport,
    },
    extends: [
      "js/recommended",
      "plugin:import/recommended",
      "plugin:import/typescript",
    ],
    rules: {
      "import/order": [
        "error",
        {
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
        },
      ],
    },
  },

  // TypeScript-specific configuration
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: "./tsconfig.json",
        sourceType: "module",
        ecmaVersion: "latest",
      },
    },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },

  // Node.js environment configuration
  {
    files: ["**/*.{js,mjs,cjs,ts}"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
  },

  // Prettier integration (must come last)
  eslintConfigPrettier,

  // Ignore patterns
  {
    ignores: [
      "**/dist",
      "**/build",
      "**/coverage",
      "**/node_modules",
      "**/.git",
      "**/.github",
      "**/.idea",
      "**/.vscode",
      "**/.DS_Store",
      "**/.eslintcache",
      "**/scripts",
      "**/*.d.ts",
    ],
  },
]);
