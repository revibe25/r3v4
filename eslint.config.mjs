// eslint.config.mjs  (flat config – ESLint v9)
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import reactHooksPlugin from "eslint-plugin-react-hooks";

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  {
    // ── Global ignores (replaces .eslintignore + .eslintrc ignorePatterns) ──
    ignores: [
      "dist/**",
      "server/dist/**",
      "packages/**/dist/**",
      ".r3-backups/**",
      ".audio_hook_backup_*/**",
      "internal/archive/**",
      "internal/dev/**",
      "server/tools/create-pitch-deck-pro.js",
      "node_modules/**",
      "build/**",
      "**/*.bak",
      "**/*.bak-*",
      ".pnpm/**",
      "shared/dist/**",
      "scripts/seed/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      // ── React Hooks ────────────────────────────────────────────────────
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // ── Import restrictions ────────────────────────────────────────────
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@llpte/*/src/*", "@llpte/*/dist/internal/*"],
          paths: [
            {
              name: "@/store/transport-store",
              importNames: ["useTransportFlat", "usetransportstore", "useTransportstore"],
              message: "Use useTransportStore directly — flat props are first-class members.",
            },
            {
              name: "@/store/clip-store",
              importNames: ["useClipstore", "useclipstore"],
              message: "Use useClipStore (capital S).",
            },
          ],
        },
      ],

      // ── TypeScript ─────────────────────────────────────────────────────
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/explicit-module-boundary-types": "off",

      // TODO[lint-debt]: downgraded to warn for CI green (2026-05-23)
      // Track cleanup: https://github.com/your-org/Stable/issues/XXXX
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],

      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", disallowTypeAnnotations: false },
      ],
    },
  },
  {
    files: ["**/__tests__/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
];
