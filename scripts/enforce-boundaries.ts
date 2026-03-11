// =============================================================================
// R3 v4 — Workspace Boundary Enforcement
// Place at: scripts/enforce-boundaries.ts
// Run:      pnpm tsx scripts/enforce-boundaries.ts
// CI:       add as turbo "lint:boundaries" task
//
// FIX (v2): All file discovery uses Node fs.readdirSync — no execSync+find —
// so paths with spaces ("R3 v4") never break shell word-splitting.
// =============================================================================

import * as fs from "fs";
import * as path from "path";
import { execSync } from "child_process";

// ---------------------------------------------------------------------------
// LAYER DEFINITIONS — strict acyclic dependency graph
// Lower number = closer to the metal. Dependencies only flow downward.
// ---------------------------------------------------------------------------
const LAYERS: Record<string, number> = {
  "llpte-core": 0,             // Zero llpte-* deps. Pure types + audio primitives.
  "llpte-signal": 1,           // May depend on: llpte-core
  "llpte-transition-graph": 1, // May depend on: llpte-core
  "llpte-adapters": 2,         // May depend on: llpte-core, llpte-signal
  "llpte-execution": 3,        // May depend on: all layers below
  "llpte-ai": 4,               // May depend on: all layers below.
                               // INVARIANT: never touches Web Audio API directly.
};

// ---------------------------------------------------------------------------
// CROSS-LAYER IMPORT RULES
// ---------------------------------------------------------------------------
interface BoundaryRule {
  from: RegExp;
  to:   RegExp;
  reason: string;
}

const BOUNDARY_RULES: BoundaryRule[] = [
  {
    from: /packages[\\/]llpte-ai[\\/]/,
    to:   /AudioContext|AudioWorkletNode|AudioBuffer|GainNode|BiquadFilterNode/,
    reason: "AI layer must never touch Web Audio API — communicate via message queue only",
  },
  {
    from: /\.worklet\.ts$/,
    to:   /from ['"]react['"]|from ['"]react-dom['"]/,
    reason: "AudioWorkletProcessor runs on a dedicated thread — no React, no DOM",
  },
  {
    from: /\.worklet\.ts$/,
    to:   /from ['"].*[\\/]server[\\/]/,
    reason: "Worklets cannot import server-side code",
  },
  {
    from: /[\\/]server[\\/]/,
    to:   /from ['"]react['"]|from ['"]react-dom['"]/,
    reason: "Server must never depend on React",
  },
  {
    from: /[\\/]packages[\\/]/,
    to:   /from ['"].*[\\/]client[\\/]src/,
    reason: "Packages must be client-agnostic — client imports packages, never the reverse",
  },
  {
    from: /.*/,
    to:   /from ['"].*[\\/]shared[\\/]types['"]/,
    reason: "shared/types.ts is deprecated — import from the correct domain type file instead",
  },
];

// ---------------------------------------------------------------------------
// DRIZZLE SCHEMA CONTRACT
// ---------------------------------------------------------------------------
const SCHEMA_CONTRACT = {
  canonical:        "shared/schema.ts",
  drizzleZodPattern: /createInsertSchema|createSelectSchema/,
  manualZodPattern:  /z\.object\(\{/,
};

// ---------------------------------------------------------------------------
// UTILITIES — pure Node fs, zero shell
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(["node_modules", "dist", ".turbo", ".git", "coverage"]);

function walkFiles(
  dir: string,
  predicate: (filePath: string) => boolean,
  results: string[] = []
): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walkFiles(path.join(dir, entry.name), predicate, results);
    } else if (entry.isFile() && predicate(path.join(dir, entry.name))) {
      results.push(path.join(dir, entry.name));
    }
  }
  return results;
}

function isSourceFile(f: string): boolean {
  return (f.endsWith(".ts") || f.endsWith(".tsx"))
    && !f.endsWith(".d.ts")
    && !f.endsWith(".tsbuildinfo");
}

function readJsonSafe(filePath: string): Record<string, unknown> {
  try { return JSON.parse(fs.readFileSync(filePath, "utf8")); }
  catch { return {}; }
}

// ---------------------------------------------------------------------------
// ROOT DETECTION
// ---------------------------------------------------------------------------
let ROOT: string;
try {
  ROOT = execSync("git rev-parse --show-toplevel", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
} catch {
  ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
}

let errors   = 0;
let warnings = 0;

function err(msg: string):  void { console.error(`  ✗  ${msg}`); errors++;   }
function warn(msg: string): void { console.warn( `  ⚠  ${msg}`); warnings++; }
function ok(msg: string):   void { console.log(  `  ✓  ${msg}`); }

// ---------------------------------------------------------------------------
// CHECK 1 — llpte-* package dependency directions
// ---------------------------------------------------------------------------
function checkLayerDeps(): void {
  console.log("\n▶  Checking llpte-* package dependency directions...");

  for (const [pkgName, myLayer] of Object.entries(LAYERS)) {
    const pkgJsonPath = path.join(ROOT, "packages", pkgName, "package.json");
    if (!fs.existsSync(pkgJsonPath)) { warn(`Package not found: ${pkgName}`); continue; }

    const pkg = readJsonSafe(pkgJsonPath);
    const allDeps: Record<string, string> = {
      ...((pkg.dependencies  as Record<string, string>) ?? {}),
      ...((pkg.devDependencies as Record<string, string>) ?? {}),
    };

    for (const dep of Object.keys(allDeps)) {
      const depBare  = dep.replace(/^@[^/]+\//, "");
      const depLayer = LAYERS[depBare];
      if (depLayer === undefined) continue;

      if (depLayer >= myLayer) {
        err(`ILLEGAL DEPENDENCY: ${pkgName} (layer ${myLayer}) → ${dep} (layer ${depLayer})`);
        console.error(`     Lower-layer packages cannot depend on equal or higher layers.`);
      } else {
        ok(`${pkgName} → ${dep}`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 2 — Cross-layer import rules
// ---------------------------------------------------------------------------
function checkForbiddenImports(): void {
  console.log("\n▶  Checking cross-layer import boundary rules...");

  const allFiles = walkFiles(ROOT, isSourceFile);
  let violations = 0;

  for (const rule of BOUNDARY_RULES) {
    for (const file of allFiles.filter(f => rule.from.test(f))) {
      let content: string;
      try { content = fs.readFileSync(file, "utf8"); } catch { continue; }
      if (rule.to.test(content)) {
        err(`BOUNDARY VIOLATION: ${path.relative(ROOT, file)}`);
        console.error(`     ${rule.reason}`);
        violations++;
      }
    }
  }

  if (violations === 0) ok("No boundary violations detected");
}

// ---------------------------------------------------------------------------
// CHECK 3 — Drizzle schema is the single source of truth
// ---------------------------------------------------------------------------
function checkDrizzleContract(): void {
  console.log("\n▶  Checking Drizzle schema contract...");

  const schemaPath = path.join(ROOT, SCHEMA_CONTRACT.canonical);
  if (!fs.existsSync(schemaPath)) {
    err(`MISSING: ${SCHEMA_CONTRACT.canonical} — this is the canonical data contract`);
    return;
  }
  ok(`${SCHEMA_CONTRACT.canonical} exists`);

  const sep = path.sep;
  const routerFiles = walkFiles(
    path.join(ROOT, "server"),
    f => isSourceFile(f) && (
      f.includes(`${sep}routers${sep}`) || f.includes(`${sep}routes${sep}`)
    )
  );

  for (const rf of routerFiles) {
    let content: string;
    try { content = fs.readFileSync(rf, "utf8"); } catch { continue; }

    const hasInput       = /\.input\(/.test(content);
    const usesDrizzleZod = SCHEMA_CONTRACT.drizzleZodPattern.test(content);
    const hasManualZod   = SCHEMA_CONTRACT.manualZodPattern.test(content);

    if (hasInput && hasManualZod && !usesDrizzleZod) {
      warn(
        `SCHEMA DRIFT RISK: ${path.relative(ROOT, rf)}\n` +
        `     Uses manual z.object() — replace with drizzle-zod createInsertSchema/createSelectSchema`
      );
    }
  }
}

// ---------------------------------------------------------------------------
// CHECK 4 — tRPC router type safety
// ---------------------------------------------------------------------------
function checkTrpcTypes(): void {
  console.log("\n▶  Checking tRPC router type safety...");

  const sep = path.sep;
  const routerFiles = walkFiles(
    path.join(ROOT, "server"),
    f => isSourceFile(f) && (
      f.includes(`${sep}routers${sep}`) || f.includes(`${sep}routes${sep}`)
    )
  );

  if (routerFiles.length === 0) {
    warn("No router files found under server/routers/ or server/routes/");
    return;
  }

  for (const rf of routerFiles) {
    let content: string;
    try { content = fs.readFileSync(rf, "utf8"); } catch { continue; }

    const rel = path.relative(ROOT, rf);

    const anyCount = [...content.matchAll(/:\s*any\b|<\s*any\s*>/g)].length;
    if (anyCount > 0) err(`IMPLICIT ANY (${anyCount}×) in ${rel}`);

    const mutations = (content.match(/\.mutation\(/g)  ?? []).length;
    const queries   = (content.match(/\.query\(/g)     ?? []).length;
    const inputs    = (content.match(/\.input\(/g)     ?? []).length;
    const total     = mutations + queries;

    if (total > 0 && inputs < total)
      warn(`${rel}: ${total} procedure(s), only ${inputs} have .input() validators`);

    if (total > 0 && !/TRPCError|try\s*\{|\.catch\(|onError/.test(content))
      warn(`${rel}: no error handling found (TRPCError / try-catch)`);

    if (anyCount === 0 && inputs >= total && total > 0)
      ok(rel);
  }
}

// ---------------------------------------------------------------------------
// CHECK 5 — Compiled .js artefacts tracked alongside .ts source
// ---------------------------------------------------------------------------
function checkCompiledArtefacts(): void {
  console.log("\n▶  Checking for compiled .js artefacts tracked next to .ts source...");

  const pairs: Array<[string, string]> = [
    ["server/storage.ts",        "server/storage.js"],
    ["server/trpc.ts",           "server/trpc.js"],
    ["server/db/index.ts",       "server/db/index.js"],
    ["server/db/schema.ts",      "server/db/schema.js"],
    ["server/lib/logger.ts",     "server/lib/logger.js"],
    ["server/routers/index.ts",  "server/routers/index.js"],
    ["shared/types/trpc.ts",     "shared/types/trpc.js"],
  ];

  let found = 0;
  for (const [src, compiled] of pairs) {
    if (fs.existsSync(path.join(ROOT, src)) && fs.existsSync(path.join(ROOT, compiled))) {
      err(`COMPILED ARTEFACT TRACKED: ${compiled} — delete it, keep ${src}`);
      found++;
    }
  }
  if (found === 0) ok("No stale compiled artefacts found");
}

// ---------------------------------------------------------------------------
// CHECK 6 — Bak files still in tree
// ---------------------------------------------------------------------------
function checkBakFiles(): void {
  console.log("\n▶  Checking for .bak files...");

  const bakFiles = walkFiles(ROOT, f => /\.bak(\.\d{8}.*)?$/.test(f));

  if (bakFiles.length > 0) {
    for (const f of bakFiles) err(`BAK FILE: ${path.relative(ROOT, f)}`);
  } else {
    ok("No .bak files found");
  }
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
console.log("═".repeat(62));
console.log(" R3 v4 — Boundary Enforcement");
console.log(` Root: ${ROOT}`);
console.log("═".repeat(62));

checkLayerDeps();
checkForbiddenImports();
checkDrizzleContract();
checkTrpcTypes();
checkCompiledArtefacts();
checkBakFiles();

console.log("\n" + "═".repeat(62));
console.log(`  Errors:   ${errors}`);
console.log(`  Warnings: ${warnings}`);
console.log("═".repeat(62));

if (errors === 0 && warnings === 0) {
  console.log("✓  All boundary checks passed.\n");
  process.exit(0);
} else if (errors === 0) {
  console.warn("⚠  Warnings present — review before merging.\n");
  process.exit(0);
} else {
  console.error(`✗  ${errors} error(s) found — fix before shipping.\n`);
  process.exit(1);
}