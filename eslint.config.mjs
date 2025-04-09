import { defineConfig } from "eslint/config";
import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-plugin-prettier";
import _import from "eslint-plugin-import";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default defineConfig([
  {
    extends: fixupConfigRules(
      compat.extends(
        "eslint:recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:prettier/recommended",
        "plugin:import/errors",
        "plugin:import/warnings",
        "plugin:import/typescript",
      ),
    ),

    plugins: {
      "@typescript-eslint": fixupPluginRules(typescriptEslint),
      prettier: fixupPluginRules(prettier),
      import: fixupPluginRules(_import),
    },

    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },

      parser: tsParser,
      ecmaVersion: 2020,
      sourceType: "module",

      parserOptions: {
        project: "./tsconfig.json",
      },
    },

    settings: {
      "import/resolver": {
        typescript: {},
      },
    },

    rules: {
      "prettier/prettier": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
        },
      ],

      "import/order": [
        "error",
        {
          "newlines-between": "always",
          groups: [
            ["builtin", "external"],
            ["internal", "parent", "sibling", "index"],
          ],
        },
      ],

      "no-console": [
        "warn",
        {
          allow: ["warn", "error"],
        },
      ],

      "import/no-unresolved": "off",
    },
  },
]);
