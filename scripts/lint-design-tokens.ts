// scripts/lint-design-tokens.ts
//
// Design-token lint (design authority v5). Rules are unchanged from the previous version, with two fixes:
//   1. The scan now actually loads client/src. The previous version scanned 0 files and passed silently.
//   2. Baseline mode: existing violations are recorded in scripts/design-token-baseline.json and do not fail the
//      build. A file fails only when its violation count rises above the recorded count (or it has new violations).
//
// Usage:
//   pnpm lint:tokens                     check against the baseline (fails on new violations)
//   pnpm lint:tokens:baseline            re-record the baseline (use only after reviewing the change)

import { Project } from "ts-morph";
import fs from "fs";
import path from "path";

const BASELINE_PATH = path.join("scripts", "design-token-baseline.json");
const UPDATE_BASELINE = process.argv.includes("--update-baseline");

const project = new Project({ tsConfigFilePath: "tsconfig.json", skipAddingFilesFromTsConfig: true });
const files = project.addSourceFilesAtPaths("client/src/**/*.{ts,tsx}");
if (files.length === 0) {
  console.error("design-token lint: no files matched client/src/**/*.{ts,tsx}. Refusing to pass silently.");
  process.exit(2);
}

// Token source files may contain raw hex. Only the canonical token module is listed.
const ALLOWED_HEX_FILES: string[] = [];  // tokens.ts removed

const ALLOWED_CSS_VARS = [
  // existing names
  "--bg-base", "--bg-surface", "--bg-elevate",
  "--text-primary", "--text-body", "--text-dim", "--text-muted", "--text-ghost",
  "--border-sub", "--border-mid",
  "--accent-cyan", "--accent-lime", "--accent-violet",
  "--status-error", "--status-error-soft", "--status-success", "--status-warning",
  "--plan-explorer-accent", "--plan-creator-accent", "--plan-pro-artist-accent",
  "--plan-explorer-glow", "--plan-creator-glow", "--plan-pro-artist-glow",
  "--nav-h",
  // design authority v5 (defined in client/src/styles/r3-tokens.css)
  "--r3-accent-lime",
  "--r3-accent-lime-alt",
  "--r3-accent-lime-hi",
  "--r3-accent-lime-deep",
  "--r3-accent-lime-ref",
  "--r3-accent-cyan",
  "--r3-accent-cyan-alt",
  "--r3-accent-cyan-hi",
  "--r3-accent-sky",
  "--r3-accent-blue",
  "--r3-accent-red",
  "--r3-accent-red-alt",
  "--r3-accent-red-rec",
  "--r3-accent-coral",
  "--r3-accent-amber",
  "--r3-accent-magenta",
  "--r3-accent-violet",
  "--r3-accent-green",
  "--r3-radius-control",
  "--r3-radius-field",
  "--r3-radius-panel",
  "--r3-font-mono",
  "--r3-font-display",
  "--r3-instrument-surface-0",
  "--r3-instrument-surface-1",
  "--r3-instrument-surface-2",
  "--r3-instrument-rim",
];

const BASELINE_FILE = path.join(process.cwd(), BASELINE_PATH);
const rel = (p: string) => path.relative(process.cwd(), p).split(path.sep).join("/");

// violations per file
const byFile = new Map<string, string[]>();
const add = (file: string, msg: string) => {
  if (!byFile.has(file)) byFile.set(file, []);
  byFile.get(file)!.push(msg);
};

for (const sf of files) {
  const file = rel(sf.getFilePath());
  const text = sf.getFullText();
  const isTokenFile = ALLOWED_HEX_FILES.includes(file);

  // 1. Raw hex in component files (not token source)
  if (!isTokenFile) {
    const hexMatches = text.match(/#[0-9a-fA-F]{3,8}\b/g);
    for (const m of hexMatches ?? []) add(file, `Raw hex color: ${m}`);
  }

  // 2. String-concatenated alpha hacks, e.g. ${COLOR.cyan}44
  const concatAlpha = text.match(/\$\{[^}]+}[0-9a-fA-F]{2}\b/g);
  for (const m of concatAlpha ?? []) add(file, `String-concatenated alpha: ${m}`);

  // 3. CSS variables not in the allowlist
  const cssVarMatches = text.match(/var\((--[\w-]+)\)/g);
  if (cssVarMatches) {
    const badVars = cssVarMatches.filter(v => !ALLOWED_CSS_VARS.includes(v.replace("var(", "").replace(")", "")));
    for (const v of badVars) add(file, `Unregistered CSS variable: ${v}`);
  }

  // 4. Direct primitive import (bypasses the semantic layer)
  if (!isTokenFile && (text.includes("from './primitive'") || text.includes('from "./primitive"') || text.includes("from './tokens/primitive'"))) {
    add(file, "Importing from primitive layer directly — use semantic tokens instead");
  }

  // 6. Inline style objects with raw colour strings
  const suspiciousStyle = text.match(/style=\{\{[^}]*color:\s*['"][^'"]+['"]/g);
  if (suspiciousStyle && !isTokenFile) {
    const bad = suspiciousStyle.filter(s => /color:\s*['"][^'"]*(red|blue|green|white|black|#[0-9a-fA-F])/.test(s));
    for (const b of bad) add(file, `Raw colour in style object: ${b}`);
  }
}

const current: Record<string, number> = {};
for (const [file, msgs] of byFile) current[file] = msgs.length;

if (UPDATE_BASELINE) {
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(sorted, null, 2) + "\n");
  const total = Object.values(sorted).reduce((a, b) => a + b, 0);
  console.log(`Baseline written: ${Object.keys(sorted).length} files, ${total} recorded violations (${files.length} files scanned).`);
  process.exit(0);
}

const baseline: Record<string, number> = fs.existsSync(BASELINE_FILE)
  ? JSON.parse(fs.readFileSync(BASELINE_FILE, "utf8"))
  : {};

const regressions: string[] = [];
for (const [file, msgs] of byFile) {
  const allowed = baseline[file] ?? 0;
  if (msgs.length > allowed) {
    regressions.push(`${file}: ${msgs.length} violations, baseline ${allowed}`);
    for (const m of msgs) regressions.push(`    - ${m}`);
  }
}

const improved = Object.keys(baseline).filter(f => (current[f] ?? 0) < baseline[f]).length;
console.log(`Design token lint: ${files.length} files scanned, ${Object.values(current).reduce((a, b) => a + b, 0)} violations, ${Object.keys(baseline).length} files in baseline${improved ? `, ${improved} improved` : ""}.`);

if (regressions.length > 0) {
  console.error("\n❌ NEW DESIGN TOKEN VIOLATIONS (above baseline):\n");
  regressions.forEach(r => console.error(r));
  process.exit(1);
}
console.log("✅ Design token lint passed (no new violations)");
