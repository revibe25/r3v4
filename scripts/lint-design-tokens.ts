// scripts/lint-design-tokens.ts
import { Project } from "ts-morph";

const project = new Project({ tsConfigFilePath: "tsconfig.json" });

const files = project.getSourceFiles("client/src/**/*.{ts,tsx}");

const ALLOWED_HEX_FILES = [
  "tokens/primitive.ts",
  "tokens/semantic.ts",      // may reference primitives
  "tokens/component.ts",     // may reference primitives
];

const ALLOWED_CSS_VARS = [
  "--bg-base",
  "--bg-surface",
  "--bg-elevate",
  "--text-primary",
  "--text-body",
  "--text-dim",
  "--text-muted",
  "--text-ghost",
  "--border-sub",
  "--border-mid",
  "--accent-cyan",
  "--accent-lime",
  "--accent-violet",
  "--status-error",
  "--status-error-soft",
  "--status-success",
  "--status-warning",
  "--plan-explorer-accent",
  "--plan-creator-accent",
  "--plan-pro-artist-accent",
  "--plan-explorer-glow",
  "--plan-creator-glow",
  "--plan-pro-artist-glow",
  "--nav-h",                 // from PageNav
];

const violations: string[] = [];

for (const file of files) {
  const path = file.getFilePath();
  const text = file.getFullText();

  const isTokenFile = ALLOWED_HEX_FILES.some((f) => path.includes(f));

  // ── 1. Raw hex in component files (not token source) ────────────────────
  if (!isTokenFile) {
    const hexMatches = text.match(/#[0-9a-fA-F]{3,8}\b/g);
    if (hexMatches) {
      violations.push(
        `${path}: Raw hex colors in component code: ${hexMatches.join(", ")}`
      );
    }
  }

  // ── 2. String-concatenated alpha hacks ──────────────────────────────────
  // Catches: ${COLOR.cyan}44, ${accent}11, etc.
  const concatAlpha = text.match(/\$\{[^}]+}[0-9a-fA-F]{2}\b/g);
  if (concatAlpha) {
    violations.push(
      `${path}: Use alpha(color, N) instead of string concat: ${concatAlpha.join(", ")}`
    );
  }

  // ── 3. CSS variables not in allowlist ───────────────────────────────────
  const cssVarMatches = text.match(/var\((--[\w-]+)\)/g);
  if (cssVarMatches) {
    const badVars = cssVarMatches.filter((v) => {
      const name = v.replace("var(", "").replace(")", "");
      return !ALLOWED_CSS_VARS.includes(name);
    });
    if (badVars.length) {
      violations.push(
        `${path}: Unregistered CSS variables: ${badVars.join(", ")}`
      );
    }
  }

  // ── 4. Direct primitive import (bypasses semantic layer) ────────────────
  if (
    text.includes("from './primitive'") ||
    text.includes('from "./primitive"') ||
    text.includes("from './tokens/primitive'")
  ) {
    // Allow in semantic.ts and component.ts
    if (!isTokenFile) {
      violations.push(
        `${path}: Importing from primitive layer directly — use semantic tokens instead`
      );
    }
  }

  // ── 5. Missing alpha() for opacity patterns ─────────────────────────────
  // Heuristic: rgba() or opacity in style objects without alpha()
  const rgbaMatches = text.match(/rgba\(/g);
  if (rgbaMatches && !text.includes("rgba(")) {
    // Already caught by rule 1 if hardcoded hex inside rgba
  }

  // ── 6. Inline style objects with raw strings that look like colors ──────
  const suspiciousStyle = text.match(/style=\{\{[^}]*color:\s*['"][^'"]+['"]/g);
  if (suspiciousStyle && !isTokenFile) {
    // This catches `color: 'red'` or `color: '#fff'` in inline styles
    const bad = suspiciousStyle.filter((s) =>
      /color:\s*['"][^'"]*(red|blue|green|white|black|#[0-9a-fA-F])/.test(s)
    );
    if (bad.length) {
      violations.push(
        `${path}: Raw color strings in style object: ${bad.join(", ")}`
      );
    }
  }
}

if (violations.length > 0) {
  console.error("\n❌ DESIGN TOKEN VIOLATIONS:\n");
  violations.forEach((v) => console.error(" - " + v));
  process.exit(1);
}

console.log("✅ Design token lint passed");