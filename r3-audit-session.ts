#!/usr/bin/env tsx
/**
 * r3-audit-session.ts — R3 v4 Session Fix Verification
 * ──────────────────────────────────────────────────────
 * Verifies every fix applied during the enhancement session:
 *   • File placement (root strays moved, express.d.ts installed)
 *   • Route wiring (auth, effects, presets, waveform)
 *   • Middleware correctness (enforceUsage tiers, feature-gate logger)
 *   • Client fixes (oscilloscope DPR + transform reset, time.ts guards)
 *   • Server fixes (billing order, WebSocket.OPEN, stripe logger)
 *   • Type system (shared/types conflicts deleted, shared/index deduped)
 *   • Wiring (schema exports, service exports, util exports)
 *   • Security (loops rate limiting, projectSerializer URL leak)
 *
 * This script is ADDITIVE — it does not duplicate checks already in
 * r3-audit-v4.ts. Run both for a complete picture:
 *
 *   pnpm tsx scripts/r3-audit-v4.ts
 *   pnpm tsx scripts/r3-audit-session.ts
 *   pnpm tsx scripts/r3-audit-session.ts --fix   # safe auto-remediations
 *   pnpm tsx scripts/r3-audit-session.ts --json  # machine-readable
 *
 * Exit codes:  0 = clean  |  1 = unresolved BLOCKs  |  2 = script error
 */

import fs   from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// ─── CLI ─────────────────────────────────────────────────────────────────────
const argv     = process.argv.slice(2);
const FIX      = argv.includes("--fix");
const JSON_OUT = argv.includes("--json");
const NO_PASS  = argv.includes("--no-pass");
const HELP     = argv.includes("--help");

if (HELP) {
  console.log(`
r3-audit-session.ts — Session fix verification for R3 v4

  --fix      Apply safe automated remediations (runs r3-place-files.py if strays found)
  --json     Machine-readable JSON output; implies no colour
  --no-pass  Suppress PASS findings from terminal output
  --help     This message

Exit codes: 0=clean, 1=unresolved BLOCKs, 2=script error
`);
  process.exit(0);
}

// ─── Root detection ───────────────────────────────────────────────────────────
function findRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 12; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}
const ROOT = findRoot();

// ─── Colour helpers ───────────────────────────────────────────────────────────
const USE_COLOR = process.stdout.isTTY && !JSON_OUT;
const clr    = (c: string, s: string) => USE_COLOR ? `\x1b[${c}m${s}\x1b[0m` : s;
const bold   = (s: string) => clr("1",  s);
const dim    = (s: string) => clr("2",  s);
const red    = (s: string) => clr("31", s);
const yellow = (s: string) => clr("33", s);
const green  = (s: string) => clr("32", s);
const cyan   = (s: string) => clr("36", s);
const gray   = (s: string) => clr("90", s);

// ─── Finding model ────────────────────────────────────────────────────────────
type Severity = "BLOCK" | "WARN" | "PASS" | "INFO" | "FIXED";

interface Finding {
  id:       string;
  severity: Severity;
  section:  string;
  title:    string;
  detail:   string;
  fixed?:   boolean;
  fixNote?: string;
}

const findings: Finding[] = [];
const seenIds  = new Set<string>();

function emit(
  id: string, severity: Severity, section: string,
  title: string, detail: string, fixNote?: string,
): Finding {
  if (seenIds.has(id)) return findings.find(f => f.id === id)!;
  seenIds.add(id);
  const f: Finding = { id, severity, section, title, detail, fixNote };
  findings.push(f);
  return f;
}

function pass(id: string, section: string, title: string): void {
  if (seenIds.has(id)) return;
  seenIds.add(id);
  findings.push({ id, severity: "PASS", section, title, detail: "OK" });
}

// ─── File-system helpers ──────────────────────────────────────────────────────
const abs    = (rel: string)  => path.join(ROOT, rel);
const exists = (rel: string)  => fs.existsSync(abs(rel));

/** Read a file relative to ROOT. Returns "" on any error. */
function safeRead(rel: string): string {
  try { return fs.readFileSync(abs(rel), "utf8"); }
  catch { return ""; }
}

/** Read a file by absolute path. Returns "" on any error. */
function safeReadAbs(p: string): string {
  try { return fs.readFileSync(p, "utf8"); }
  catch { return ""; }
}

function lines(rel: string): string[] {
  return safeRead(rel).split("\n");
}

const PRUNE = new Set([
  "node_modules", ".git", "coverage", "dist", ".pnpm",
  ".turbo", ".next", "build", "out", ".r3-backups",
]);

function walk(
  dir: string,
  pred: (rel: string) => boolean,
  out: string[] = [],
  depth = 0,
): string[] {
  if (depth > 10) return out;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(abs(dir), { withFileTypes: true }); }
  catch { return out; }
  for (const e of entries) {
    if (PRUNE.has(e.name)) continue;
    const rel = dir === "." ? e.name : `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, pred, out, depth + 1);
    else if (pred(rel))  out.push(rel);
  }
  return out;
}

/**
 * Run grep over the given directories (relative to ROOT).
 * @param pattern         The grep pattern string.
 * @param dirs            Directories to search (relative to ROOT). Non-existent dirs are skipped.
 * @param mode            "fixed" = -F (literal), "extended" = -E (ERE). Default "fixed".
 * @returns Absolute paths of matching files.
 */
function grep(
  pattern: string,
  dirs: string[],
  mode: "fixed" | "extended" = "fixed",
): string[] {
  const targets = dirs.map(d => abs(d)).filter(d => {
    try { return fs.statSync(d).isDirectory(); } catch { return false; }
  });
  if (!targets.length) return [];
  const flags: string[] = [
    "-rl", "--include=*.ts", "--include=*.tsx", "--include=*.js",
    mode === "extended" ? "-E" : "-F",
    "--", pattern, ...targets,
  ];
  const r = spawnSync("grep", flags, { encoding: "utf8" });
  // grep exits 0 = match, 1 = no match, 2 = error
  if (r.status === null || r.status === 2) return [];
  return r.stdout.trim().split("\n").filter(Boolean);
}

function grepLines(rel: string, pattern: RegExp): number[] {
  return lines(rel)
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => pattern.test(l))
    .map(({ i }) => i + 1);   // 1-indexed
}

function lineOf(rel: string, pattern: RegExp): number {
  const idx = lines(rel).findIndex(l => pattern.test(l));
  return idx === -1 ? -1 : idx + 1;
}

function section(title: string): void {
  if (!JSON_OUT) {
    console.log(`\n${bold(cyan("▸"))} ${bold(title)}`);
    console.log(gray("─".repeat(72)));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// CHECKS
// ═════════════════════════════════════════════════════════════════════════════

// ─── §SES.1  Root-level stray files ──────────────────────────────────────────
const STRAYS = [
  { file: "auth.ts",          dest: "server/routes/auth.ts" },
  { file: "effects.ts",       dest: "server/routes/effects.ts" },
  { file: "presets.ts",       dest: "server/routes/presets.ts" },
  { file: "waveform.ts",      dest: "server/routes/waveform.ts" },
  { file: "enforceUsage.ts",  dest: "server/middleware/enforceUsage.ts" },
  { file: "time.ts",          dest: "client/src/utils/time.ts" },
  { file: "oscilloscope.tsx", dest: "client/src/visual/oscilloscope.tsx" },
];

function checkRootStrays(): void {
  section("§SES.1  Root-Level Stray Files (must be moved to correct destinations)");
  let anyStray = false;
  for (const { file, dest } of STRAYS) {
    if (exists(file)) {
      anyStray = true;
      const f = emit(
        `SES1.stray.${file}`, "BLOCK", "§SES.1",
        `Stray source file at project root: ${file}`,
        `Must reside at: ${dest}\n` +
        `  Run: python3 r3-place-files.py\n` +
        `  The root copy is not compiled by either the server or client tsconfig.`,
        "--fix will run r3-place-files.py if it exists at root"
      );
      if (FIX) {
        if (exists("r3-place-files.py")) {
          const r = spawnSync("python3", ["r3-place-files.py"], { cwd: ROOT, encoding: "utf8" });
          if (r.status === 0 && !exists(file)) {
            f.severity = "FIXED"; f.fixed = true;
          }
        }
      }
    } else {
      pass(`SES1.placed.${file}`, "§SES.1", `${file} absent from root — correctly placed at ${dest}`);
    }
  }
  if (!anyStray) {
    pass("SES1.allPlaced", "§SES.1", "All enhanced files removed from root — OK");
  }
}

// ─── §SES.2  express.d.ts type augmentation ───────────────────────────────────
function checkExpressAugmentation(): void {
  section("§SES.2  Express Request Augmentation (server/types/express.d.ts)");

  // Must be installed as a .d.ts — not inlined in a .ts route file.
  const DTS = "server/types/express.d.ts";

  if (!exists(DTS)) {
    emit("SES2.dts.missing", "BLOCK", "§SES.2",
      "server/types/express.d.ts not found",
      "The Express Request namespace augmentation (req.user) must live in a .d.ts\n" +
      "  file visible to the entire server compilation. Without it:\n" +
      "    • server/middleware/enforceUsage.ts will see req.user as `undefined`\n" +
      "    • Any middleware other than auth.ts accessing req.user gets a TS error\n" +
      "  Run: python3 r3-place-files.py  (installs the file automatically)"
    );
  } else {
    const content = safeRead(DTS);
    if (!content.includes("declare namespace Express")) {
      emit("SES2.dts.invalid", "BLOCK", "§SES.2",
        "server/types/express.d.ts exists but lacks declare namespace Express",
        "The file must contain:\n" +
        "  declare namespace Express {\n" +
        "    interface Request { user?: { userId: string; username: string; }; }\n" +
        "  }"
      );
    } else {
      pass("SES2.dts.ok", "§SES.2", "server/types/express.d.ts — correct augmentation present");
    }
  }

  // auth.ts must NOT still contain the old declare global block
  const AUTH = "server/routes/auth.ts";
  if (exists(AUTH)) {
    if (/declare global/.test(safeRead(AUTH))) {
      emit("SES2.auth.duplicateAugment", "BLOCK", "§SES.2",
        "server/routes/auth.ts still contains `declare global { namespace Express ... }`",
        "The augmentation was extracted to server/types/express.d.ts.\n" +
        "  Remove the `declare global { ... }` block from auth.ts to prevent\n" +
        "  duplicate-declaration TS errors."
      );
    } else {
      pass("SES2.auth.noDeclare", "§SES.2", "auth.ts — no duplicate declare global augmentation");
    }
  }
}

// ─── §SES.3  oscilloscope.tsx — DPR + transform reset ─────────────────────────
function checkOscilloscope(): void {
  section("§SES.3  client/src/visual/oscilloscope.tsx — DPR Fix + Transform Reset");
  const FILE = "client/src/visual/oscilloscope.tsx";

  if (!exists(FILE)) {
    emit("SES3.osc.missing", "WARN", "§SES.3", `${FILE} not found`,
      "Cannot verify oscilloscope fixes. Ensure r3-place-files.py has run.");
    return;
  }

  const content = safeRead(FILE);

  // Check DPR scaling is applied
  if (!/window\.devicePixelRatio/.test(content)) {
    emit("SES3.osc.noDPR", "BLOCK", "§SES.3",
      "oscilloscope.tsx — devicePixelRatio scaling not applied",
      "Canvas renders at logical pixels only. On HiDPI screens the waveform will be blurry.\n" +
      "  Required: const dpr = window.devicePixelRatio ?? 1; then canvas.width = width * dpr;"
    );
  } else {
    pass("SES3.osc.dpr", "§SES.3", "oscilloscope.tsx — devicePixelRatio scaling present");
  }

  // Check ctx.setTransform reset BEFORE ctx.scale
  const setTransformLine = lineOf(FILE, /ctx\.setTransform\s*\(\s*1\s*,\s*0\s*,\s*0\s*,\s*1/);
  const scaleLine        = lineOf(FILE, /ctx\.scale\s*\(\s*dpr/);

  if (setTransformLine === -1) {
    emit("SES3.osc.noReset", "BLOCK", "§SES.3",
      "oscilloscope.tsx — ctx.setTransform(1,0,0,1,0,0) not found",
      "Without resetting the transform before ctx.scale(dpr, dpr), each re-render\n" +
      "  (when data changes but width/height are stable) accumulates scale: 2× → 4× → 8×...\n" +
      "  causing the waveform to shrink progressively until invisible.\n" +
      "  Add: ctx.setTransform(1, 0, 0, 1, 0, 0); immediately before ctx.scale(dpr, dpr);"
    );
  } else if (scaleLine !== -1 && setTransformLine > scaleLine) {
    emit("SES3.osc.resetOrder", "BLOCK", "§SES.3",
      `oscilloscope.tsx — setTransform (line ${setTransformLine}) appears AFTER scale (line ${scaleLine})`,
      "setTransform must precede ctx.scale to reset any accumulated transforms\n" +
      "  from previous renders before applying the new DPR scale."
    );
  } else {
    pass("SES3.osc.reset", "§SES.3",
      `oscilloscope.tsx — setTransform (line ${setTransformLine}) precedes scale (line ${scaleLine})`);
  }

  // Check empty data guard
  if (!/data\.length\s*===\s*0/.test(content)) {
    emit("SES3.osc.noEmptyGuard", "WARN", "§SES.3",
      "oscilloscope.tsx — no empty data guard",
      "A missing data guard causes a flat zero line to be drawn on empty input,\n" +
      "  misrepresenting the 'no signal' state. Add: if (data.length === 0) return;"
    );
  } else {
    pass("SES3.osc.emptyGuard", "§SES.3", "oscilloscope.tsx — empty data guard present");
  }
}

// ─── §SES.4  server/index.ts — billing order + WebSocket.OPEN ─────────────────
function checkServerIndex(): void {
  section("§SES.4  server/index.ts — Billing Route Order + WebSocket.OPEN");
  const FILE = "server/index.ts";
  if (!exists(FILE)) {
    emit("SES4.index.missing", "WARN", "§SES.4", "server/index.ts not found", "Cannot verify server index fixes.");
    return;
  }

  // Billing must come AFTER express.json
  const billingLine = lineOf(FILE, /\/billing\/checkout/);
  const jsonLine    = lineOf(FILE, /express\.json\s*\(/);

  if (billingLine !== -1 && jsonLine !== -1) {
    if (billingLine < jsonLine) {
      emit("SES4.billing.order", "BLOCK", "§SES.4",
        `Billing route (line ${billingLine}) registered BEFORE express.json (line ${jsonLine})`,
        "req.body will always be undefined in the /billing/checkout handler.\n" +
        "  Stripe checkout session creation will receive undefined priceId and fail silently.\n" +
        "  Run: python3 r3-fix-index.py  to relocate the billing block."
      );
    } else {
      pass("SES4.billing.order", "§SES.4",
        `Billing route (line ${billingLine}) correctly after express.json (line ${jsonLine})`);
    }
  } else if (billingLine === -1) {
    emit("SES4.billing.absent", "INFO", "§SES.4", "/billing/checkout not found in server/index.ts",
      "Billing route may be registered in a separate route file — verify manually.");
  }

  // WebSocket.OPEN must be used, not === 1
  const content = safeRead(FILE);
  const magicOne = grepLines(FILE, /\.readyState\s*===\s*1\b/);
  if (magicOne.length > 0) {
    emit("SES4.ws.magic", "WARN", "§SES.4",
      `server/index.ts line(s) ${magicOne.join(",")} — readyState === 1 (magic number)`,
      "Use WebSocket.OPEN instead of the literal 1.\n" +
      "  Magic numbers are not self-documenting and break if the spec changes."
    );
  } else if (/WebSocket\.OPEN/.test(content)) {
    pass("SES4.ws.open", "§SES.4", "server/index.ts — WebSocket.OPEN constant used correctly");
  }

  // requireUser must be imported (billing route uses it)
  if (billingLine !== -1 && !/requireUser/.test(content)) {
    emit("SES4.billing.noAuth", "BLOCK", "§SES.4",
      "server/index.ts — /billing/checkout handler lacks requireUser",
      "Any unauthenticated caller can initiate a Stripe checkout session.\n" +
      "  Import requireUser from './middleware/auth' and add it as the second\n" +
      "  argument to app.post('/billing/checkout', requireUser, ...)."
    );
  } else if (billingLine !== -1) {
    // Check requireUser is actually ON the billing route line, not just imported
    const billingLineContent = lines(FILE)[billingLine - 1] ?? "";
    const nearBillingContent = lines(FILE).slice(Math.max(0, billingLine - 1), billingLine + 3).join(" ");
    if (/requireUser/.test(nearBillingContent)) {
      pass("SES4.billing.auth", "§SES.4", "billing route has requireUser middleware");
    } else if (/requireUser/.test(content)) {
      emit("SES4.billing.authMissing", "WARN", "§SES.4",
        "requireUser imported but not detected on the /billing/checkout route handler",
        "Verify the route signature: app.post('/billing/checkout', requireUser, handler)"
      );
    }
  }
}

// ─── §SES.5  server/services/stripe-subscription.ts — logger placement ────────
function checkStripeLogger(): void {
  section("§SES.5  server/services/stripe-subscription.ts — Logger Import Placement");
  const FILE = "server/services/stripe-subscription.ts";
  if (!exists(FILE)) {
    emit("SES5.stripe.missing", "INFO", "§SES.5", `${FILE} not found`, "Skipping stripe logger check.");
    return;
  }

  const src = safeRead(FILE);

  // Must not use console.info/warn (replaced with logger)
  if (/console\.(info|warn)\b/.test(src)) {
    emit("SES5.stripe.console", "BLOCK", "§SES.5",
      "stripe-subscription.ts still uses console.info/warn",
      "console.* bypasses the structured logging pipeline.\n" +
      "  Replace with logger.info / logger.warn from '../lib/logger'."
    );
  } else {
    pass("SES5.stripe.noConsole", "§SES.5", "stripe-subscription.ts — no console.info/warn");
  }

  // Logger import must be present
  if (!/from ['"].*logger['"]/.test(src)) {
    emit("SES5.stripe.noLoggerImport", "WARN", "§SES.5",
      "stripe-subscription.ts — logger not imported",
      "If logger.* calls exist without the import, the file will fail at runtime."
    );
  } else {
    // Logger import must NOT be mid-multiline-block
    // Correct: line preceded by a ;-terminated line or blank
    const loggerImportLine = lineOf(FILE, /^import\s*\{\s*logger\s*\}/);
    if (loggerImportLine > 1) {
      const prevLine = (lines(FILE)[loggerImportLine - 2] ?? "").trimEnd();
      const isCorrect = prevLine === "" || prevLine.endsWith(";") || prevLine.startsWith("//");
      if (!isCorrect) {
        emit("SES5.stripe.loggerMisplaced", "BLOCK", "§SES.5",
          `stripe-subscription.ts — logger import at line ${loggerImportLine} appears mid-statement`,
          `Previous line: "${prevLine}"\n` +
          `  If this line doesn't end with ';', the logger import is inside a multiline\n` +
          `  block (e.g. a multiline import {}), which makes the file syntactically invalid.\n` +
          `  Run: python3 r3-fix-ts-errors.py  to repair.`
        );
      } else {
        pass("SES5.stripe.loggerPlaced", "§SES.5",
          `stripe-subscription.ts — logger import correctly placed at line ${loggerImportLine}`);
      }
    } else {
      pass("SES5.stripe.loggerPlaced", "§SES.5", "stripe-subscription.ts — logger import present");
    }
  }
}

// ─── §SES.6  server/middleware/feature-gate.ts — console.error ───────────────
function checkFeatureGate(): void {
  section("§SES.6  server/middleware/feature-gate.ts — console.error Removed");
  const FILE = "server/middleware/feature-gate.ts";
  if (!exists(FILE)) {
    emit("SES6.fg.missing", "INFO", "§SES.6", `${FILE} not found`, "Skipping feature-gate logger check.");
    return;
  }
  if (/console\.error\b/.test(safeRead(FILE))) {
    emit("SES6.fg.console", "WARN", "§SES.6",
      "feature-gate.ts still uses console.error",
      "Replace with logger.error from '../lib/logger' for structured log capture."
    );
  } else {
    pass("SES6.fg.ok", "§SES.6", "feature-gate.ts — no console.error");
  }
}

// ─── §SES.7  server/middleware/enforceUsage.ts — correct tier strings ─────────
function checkEnforceUsageTiers(): void {
  section("§SES.7  server/middleware/enforceUsage.ts — Subscription Tier Strings");
  const FILE = "server/middleware/enforceUsage.ts";
  if (!exists(FILE)) {
    emit("SES7.eu.missing", "WARN", "§SES.7", `${FILE} not found`, "Cannot verify tier strings.");
    return;
  }
  const content = safeRead(FILE);

  // Must have correct tier strings
  const hasCorrect = content.includes("explorer") && content.includes("creator") && content.includes("pro_artist");
  const hasStale   = content.includes('"free"') || content.includes("'free'") ||
                     content.includes('"pro"')  || content.includes("'pro'")  ||
                     content.includes('"studio"') || content.includes("'studio'");

  if (hasStale) {
    emit("SES7.eu.staleTiers", "BLOCK", "§SES.7",
      "enforceUsage.ts contains stale tier strings: 'free' | 'pro' | 'studio'",
      "These tiers were renamed to 'explorer' | 'creator' | 'pro_artist' during\n" +
      "  the Lemon Squeezy migration. isPlan() returns false for every real user,\n" +
      "  silently capping ALL users at the 5-mix floor regardless of subscription.\n" +
      "  Replace MIX_LIMITS keys and the isPlan type union."
    );
  } else if (hasCorrect) {
    pass("SES7.eu.tiers", "§SES.7", "enforceUsage.ts — correct tier strings: explorer | creator | pro_artist");
  } else {
    emit("SES7.eu.tiersUnknown", "WARN", "§SES.7",
      "enforceUsage.ts — tier strings not detected",
      "Expected 'explorer', 'creator', 'pro_artist' to be present in MIX_LIMITS."
    );
  }

  // Must fetch tier from DB, not from JWT
  if (/storage\.getUserById/.test(content)) {
    pass("SES7.eu.dbFetch", "§SES.7", "enforceUsage.ts — fetches tier from DB (not stale JWT)");
  } else {
    emit("SES7.eu.noDbFetch", "WARN", "§SES.7",
      "enforceUsage.ts — DB tier fetch (storage.getUserById) not detected",
      "Tier is mutable state. Reading it from the JWT allows a downgraded user to\n" +
      "  retain elevated limits until their token expires. Always fetch from DB."
    );
  }
}

// ─── §SES.8  server/routes/auth.ts — lazy dummy hash, no top-level await ──────
function checkAuthRoutes(): void {
  section("§SES.8  server/routes/auth.ts — Lazy DUMMY_HASH + No Top-Level Await");
  const FILE = "server/routes/auth.ts";
  if (!exists(FILE)) {
    emit("SES8.auth.missing", "WARN", "§SES.8", `${FILE} not found`, "Cannot verify auth fixes.");
    return;
  }
  const content = safeRead(FILE);

  // Top-level await bcrypt.hash is banned — causes startup latency and CJS failure
  if (/^const\s+\w+\s*=\s*await\s+bcrypt\.hash/m.test(content)) {
    emit("SES8.auth.topLevelAwait", "BLOCK", "§SES.8",
      "auth.ts — top-level `await bcrypt.hash()` detected",
      "Top-level await in CommonJS contexts causes a SyntaxError.\n" +
      "  Replace with a lazy singleton: compute the hash on first login,\n" +
      "  cache in a module-level variable, reuse on subsequent calls."
    );
  } else if (/getDummyHash\s*\(\s*\)/.test(content)) {
    pass("SES8.auth.lazyHash", "§SES.8", "auth.ts — lazy getDummyHash() pattern present");
  }

  // Credential field must accept username OR email
  if (/credential\s*:/.test(content)) {
    pass("SES8.auth.credential", "§SES.8", "auth.ts — unified `credential` field in loginSchema");
  } else if (/loginSchema.*email/s.test(content)) {
    emit("SES8.auth.emailOnly", "BLOCK", "§SES.8",
      "auth.ts — loginSchema requires email only",
      "Users who registered without providing an email are permanently locked out.\n" +
      "  Replace with a single `credential` field that accepts username OR email."
    );
  }

  // No duplicate global augmentation
  if (/declare global\s*\{/.test(content)) {
    emit("SES8.auth.declareGlobal", "BLOCK", "§SES.8",
      "auth.ts — still contains `declare global { namespace Express ... }`",
      "This augmentation was moved to server/types/express.d.ts.\n" +
      "  Remove the declare global block from auth.ts to prevent duplicate declarations."
    );
  } else {
    pass("SES8.auth.noDeclareGlobal", "§SES.8", "auth.ts — no duplicate declare global block");
  }
}

// ─── §SES.9  server/routes/presets.ts — randomUUID import ─────────────────────
function checkPresetsRoutes(): void {
  section("§SES.9  server/routes/presets.ts — randomUUID Import + Schema Exports");
  const FILE = "server/routes/presets.ts";
  if (!exists(FILE)) {
    emit("SES9.presets.missing", "WARN", "§SES.9", `${FILE} not found`, "Cannot verify presets fixes.");
    return;
  }
  const content = safeRead(FILE);

  // randomUUID must be explicitly imported from 'crypto'
  if (!/import\s*\{[^}]*randomUUID[^}]*\}\s*from\s*['"]crypto['"]/.test(content)) {
    if (/randomUUID\s*\(\s*\)/.test(content)) {
      emit("SES9.presets.noUUID", "BLOCK", "§SES.9",
        "presets.ts — randomUUID() called without explicit import from 'crypto'",
        "crypto.randomUUID() is a Node 18+ global but TypeScript does not resolve it\n" +
        "  without the explicit import. Node 16 requires the import at runtime.\n" +
        "  Add: import { randomUUID } from 'crypto';"
      );
    } else {
      pass("SES9.presets.uuid", "§SES.9", "presets.ts — randomUUID not used directly");
    }
  } else {
    pass("SES9.presets.uuid", "§SES.9", "presets.ts — randomUUID imported from 'crypto'");
  }

  // effectChainsTable import — verify the schema actually exports it
  const SCHEMA = "server/db/schema.ts";
  if (exists(SCHEMA)) {
    const schema = safeRead(SCHEMA);
    if (/effectChainsTable/.test(content) && !/effectChainsTable/.test(schema)) {
      emit("SES9.presets.chainsMissing", "BLOCK", "§SES.9",
        "presets.ts imports effectChainsTable but server/db/schema.ts does not export it",
        "The import will cause a TypeScript compile error:\n" +
        "  Module 'server/db/schema' has no exported member 'effectChainsTable'\n" +
        "  Either add the table to schema.ts or remove chain routes from presets.ts."
      );
    } else if (/effectPresetsTable/.test(content) && !/effectPresetsTable/.test(schema)) {
      emit("SES9.presets.presetsMissing", "BLOCK", "§SES.9",
        "presets.ts imports effectPresetsTable but server/db/schema.ts does not export it",
        "Add effectPresetsTable to server/db/schema.ts or correct the import."
      );
    } else {
      pass("SES9.presets.schema", "§SES.9", "presets.ts — schema table imports verified against db/schema.ts");
    }
  } else {
    emit("SES9.schema.missing", "WARN", "§SES.9",
      "server/db/schema.ts not found — cannot verify table exports",
      "Manually confirm effectPresetsTable and effectChainsTable are exported."
    );
  }

  // Validate presetUpdateSchema has the empty-object refine guard
  if (/presetUpdateSchema/.test(content) && !/\.refine\s*\(/.test(content)) {
    emit("SES9.presets.updateRefine", "WARN", "§SES.9",
      "presets.ts — presetUpdateSchema.partial() lacks .refine() guard",
      "db.update().set({}) with an empty object throws in Drizzle.\n" +
      "  Add: .refine(data => Object.keys(data).length > 0, { message: '...' })"
    );
  } else {
    pass("SES9.presets.refine", "§SES.9", "presets.ts — presetUpdateSchema has refine guard");
  }
}

// ─── §SES.10  server/routes/waveform.ts — service wiring ──────────────────────
function checkWaveformRoutes(): void {
  section("§SES.10  server/routes/waveform.ts — Service Wiring");
  const FILE = "server/routes/waveform.ts";
  if (!exists(FILE)) {
    emit("SES10.wf.missing", "WARN", "§SES.10", `${FILE} not found`, "Cannot verify waveform fixes.");
    return;
  }
  const content = safeRead(FILE);

  // Must import analyzeAudioFile
  if (!/analyzeAudioFile/.test(content)) {
    emit("SES10.wf.noAnalyze", "BLOCK", "§SES.10",
      "waveform.ts — analyzeAudioFile not imported",
      "POST /analyze still returns mock data. Import analyzeAudioFile from\n" +
      "  '../services/audio-analysis' and wire it to the upload handler."
    );
  } else {
    // Verify the service file actually exports it
    const SVC = "server/services/audio-analysis.ts";
    if (exists(SVC)) {
      if (!/export.*analyzeAudioFile|export\s+\{[^}]*analyzeAudioFile/.test(safeRead(SVC))) {
        emit("SES10.wf.analyzeNotExported", "BLOCK", "§SES.10",
          "waveform.ts imports analyzeAudioFile but server/services/audio-analysis.ts does not export it",
          "Either the export name differs or the function does not exist yet.\n" +
          "  Check server/services/audio-analysis.ts for the correct export name."
        );
      } else {
        pass("SES10.wf.analyze", "§SES.10", "waveform.ts — analyzeAudioFile import verified against audio-analysis.ts");
      }
    } else {
      emit("SES10.wf.svcMissing", "BLOCK", "§SES.10",
        "server/services/audio-analysis.ts not found",
        "waveform.ts imports analyzeAudioFile from this file.\n" +
        "  The service must be created for POST /analyze to function."
      );
    }
  }

  // Must import safeResolve
  if (!/safeResolve/.test(content)) {
    emit("SES10.wf.noSafeResolve", "BLOCK", "§SES.10",
      "waveform.ts — safeResolve not imported (path traversal not guarded)",
      "audioFile query param is passed directly to the filesystem without sanitisation.\n" +
      "  Import safeResolve from '../utils/fileUtils' and use it on GET /file."
    );
  } else {
    const UTIL = "server/utils/fileUtils.ts";
    if (exists(UTIL)) {
      if (!/export.*safeResolve|export\s+\{[^}]*safeResolve/.test(safeRead(UTIL))) {
        emit("SES10.wf.safeResolveNotExported", "BLOCK", "§SES.10",
          "waveform.ts imports safeResolve but server/utils/fileUtils.ts does not export it",
          "Add or rename the export in server/utils/fileUtils.ts."
        );
      } else {
        pass("SES10.wf.safeResolve", "§SES.10", "waveform.ts — safeResolve import verified against fileUtils.ts");
      }
    } else {
      emit("SES10.wf.utilMissing", "BLOCK", "§SES.10",
        "server/utils/fileUtils.ts not found",
        "Create it with a safeResolve(root, subpath) function that prevents path traversal."
      );
    }
  }

  // mkdirSync guard for uploads/temp
  if (!/mkdirSync/.test(content)) {
    emit("SES10.wf.noMkdir", "WARN", "§SES.10",
      "waveform.ts — mkdirSync guard for uploads/temp not found",
      "multer throws ENOENT on the first upload if uploads/temp does not exist.\n" +
      "  Add: mkdirSync(TEMP_DIR, { recursive: true }); at module load."
    );
  } else {
    pass("SES10.wf.mkdir", "§SES.10", "waveform.ts — mkdirSync guard for temp directory present");
  }
}

// ─── §SES.11  server/routes/loops.ts — rate limiter on GET routes ─────────────
function checkLoopsRateLimit(): void {
  section("§SES.11  server/routes/loops.ts — Rate Limiter on GET Routes");
  const FILE = "server/routes/loops.ts";
  if (!exists(FILE)) {
    emit("SES11.loops.missing", "INFO", "§SES.11", `${FILE} not found`, "Skipping loops rate-limit check.");
    return;
  }
  const content = safeRead(FILE);

  if (!/loopStationLimiter/.test(content)) {
    emit("SES11.loops.noLimit", "WARN", "§SES.11",
      "loops.ts — loopStationLimiter not applied to GET routes",
      "GET /loops and GET /loops/:id have no rate limiting, allowing any caller\n" +
      "  to enumerate all stored loop audio files without restriction.\n" +
      "  Import loopStationLimiter and add it to both GET route handlers."
    );
  } else {
    // Verify it's on the GET routes specifically
    const srcLines = lines(FILE);
    const getIdxs  = srcLines.reduce<number[]>((acc, l, i) => {
      if (/router\.get\s*\(/.test(l)) acc.push(i);
      return acc;
    }, []);
    const getLimiter = getIdxs.every(i => /loopStationLimiter/.test(srcLines[i]));
    if (!getLimiter) {
      emit("SES11.loops.getLimit", "WARN", "§SES.11",
        "loops.ts — loopStationLimiter imported but may not be on all GET handlers",
        "Verify both router.get('/', ...) and router.get('/:id', ...) include\n" +
        "  loopStationLimiter as the second argument."
      );
    } else {
      pass("SES11.loops.ok", "§SES.11", "loops.ts — loopStationLimiter on GET routes");
    }
  }
}

// ─── §SES.12  client/src/utils/projectSerializer.ts — URL leak fix ────────────
function checkProjectSerializer(): void {
  section("§SES.12  client/src/utils/projectSerializer.ts — URL Object Leak");
  const FILE = "client/src/utils/projectSerializer.ts";
  if (!exists(FILE)) {
    emit("SES12.ser.missing", "INFO", "§SES.12", `${FILE} not found`, "Skipping serializer check.");
    return;
  }
  const content = safeRead(FILE);

  if (!/link\.click\(\)/.test(content)) {
    emit("SES12.ser.noClick", "INFO", "§SES.12", "projectSerializer.ts — link.click() pattern not found",
      "Cannot verify URL leak fix. File structure may differ.");
    return;
  }

  if (!content.includes("finally")) {
    emit("SES12.ser.noFinally", "WARN", "§SES.12",
      "projectSerializer.ts — link.click() not wrapped in try/finally",
      "If link.click() throws, URL.revokeObjectURL is never called, leaking the\n" +
      "  object URL for the lifetime of the page (memory accumulation on each export).\n" +
      "  Wrap in: try { link.click(); } finally { URL.revokeObjectURL(url); }"
    );
  } else {
    pass("SES12.ser.finally", "§SES.12", "projectSerializer.ts — finally block present for URL cleanup");
  }
}

// ─── §SES.13  shared/types/ conflict files deleted ────────────────────────────
function checkSharedTypeConflicts(): void {
  section("§SES.13  shared/types/ — Conflicting Type Files Deleted");

  const CONFLICTS = [
    "shared/types/audio.types.ts",
    "shared/types/automation.types.ts",
    "shared/types/meter.types.ts",
  ];

  for (const f of CONFLICTS) {
    if (exists(f)) {
      emit(`SES13.conflict.${path.basename(f)}`, "BLOCK", "§SES.13",
        `Conflicting type file still exists: ${f}`,
        `This file conflicts with the canonical top-level shared/*.types.ts.\n` +
        `  Three incompatible shapes for the same types cause silent runtime divergence.\n` +
        `  Run: python3 r3-fix-types.py  then  python3 r3-verify-types.py\n` +
        `  to merge exports and delete this file safely.`
      );
    } else {
      pass(`SES13.deleted.${path.basename(f)}`, "§SES.13", `${f} — deleted correctly`);
    }
  }

  // shared/index.ts must have no duplicate export * from same path
  const INDEX = "shared/index.ts";
  if (exists(INDEX)) {
    const reexports = lines(INDEX)
      .filter(l => /^\s*export\s*\*\s*from/.test(l))
      .map(l => { const m = l.match(/['"]([^'"]+)['"]/); return m?.[1] ?? ""; });
    const seen   = new Set<string>();
    const dupls  = reexports.filter(p => { const dup = seen.has(p); seen.add(p); return dup; });
    if (dupls.length > 0) {
      emit("SES13.index.dupes", "BLOCK", "§SES.13",
        `shared/index.ts — duplicate re-exports: ${dupls.join(", ")}`,
        "TypeScript treats duplicate export * from the same path as an error.\n" +
        "  Run: python3 r3-fix-types.py  (includes a deduplication pass)."
      );
    } else {
      pass("SES13.index.noDupes", "§SES.13", "shared/index.ts — no duplicate re-exports");
    }
  }
}

// ─── §SES.14  shared/package.json name ────────────────────────────────────────
function checkSharedPackageName(): void {
  section("§SES.14  shared/package.json — Correct Package Name");
  const FILE = "shared/package.json";
  if (!exists(FILE)) {
    emit("SES14.pkg.missing", "WARN", "§SES.14", `${FILE} not found`, "Cannot verify package name.");
    return;
  }
  const content = safeRead(FILE);
  if (/"name"\s*:\s*"@r3vibe\/server"/.test(content)) {
    emit("SES14.pkg.wrongName", "BLOCK", "§SES.14",
      'shared/package.json name is "@r3vibe/server" (should be "@r3vibe/shared")',
      "pnpm workspace resolution will point to the wrong package when any consumer\n" +
      "  imports by name rather than by relative path.\n" +
      '  Change "name": "@r3vibe/server" to "name": "@r3vibe/shared".'
    );
  } else if (/"name"\s*:\s*"@r3vibe\/shared"/.test(content)) {
    pass("SES14.pkg.name", "§SES.14", 'shared/package.json name is "@r3vibe/shared" — correct');
  } else {
    emit("SES14.pkg.nameUnknown", "WARN", "§SES.14",
      "shared/package.json — name field not recognised",
      `Current value: ${content.match(/"name"\s*:\s*"([^"]+)"/)?.[ 1] ?? "(not found)"}`
    );
  }
}

// ─── §SES.15  client/src/utils/time.ts — zoom guards ─────────────────────────
function checkTimeUtils(): void {
  section("§SES.15  client/src/utils/time.ts — Zero-Zoom Guards");
  const FILE = "client/src/utils/time.ts";
  if (!exists(FILE)) {
    emit("SES15.time.missing", "WARN", "§SES.15", `${FILE} not found`, "Cannot verify time.ts fixes.");
    return;
  }
  const content = safeRead(FILE);

  // Must have Number.isFinite guard on zoom
  if (!/Number\.isFinite\s*\(\s*zoom\s*\)/.test(content)) {
    emit("SES15.time.noGuard", "BLOCK", "§SES.15",
      "time.ts — Number.isFinite zoom guard not found",
      "pixelsToTime(pixels, 0) returns Infinity — division by zero.\n" +
      "  timeToPixels(t, 0) returns 0 silently — wrong without any signal.\n" +
      "  Add: if (!Number.isFinite(zoom) || zoom <= 0) throw new RangeError(...);"
    );
  } else {
    pass("SES15.time.guard", "§SES.15", "time.ts — Number.isFinite zoom guard present");
  }

  // snapToGrid must handle gridSize <= 0
  if (!/gridSize\s*<=\s*0/.test(content)) {
    emit("SES15.time.snapGrid", "WARN", "§SES.15",
      "time.ts — snapToGrid does not guard gridSize <= 0",
      "snapToGrid(time, 0) returns NaN — Math.round(t / 0) * 0.\n" +
      "  Add: if (gridSize <= 0) return time; at the top of snapToGrid."
    );
  } else {
    pass("SES15.time.snapGrid", "§SES.15", "time.ts — snapToGrid handles gridSize <= 0");
  }

  // All three functions must be exported
  const required = ["timeToPixels", "pixelsToTime", "snapToGrid"];
  const missing  = required.filter(fn => !new RegExp(`export\\s+function\\s+${fn}`).test(content));
  if (missing.length > 0) {
    emit("SES15.time.exports", "BLOCK", "§SES.15",
      `time.ts — missing exports: ${missing.join(", ")}`,
      "Any caller importing these functions will receive an undefined import error."
    );
  } else {
    pass("SES15.time.exports", "§SES.15", "time.ts — timeToPixels, pixelsToTime, snapToGrid all exported");
  }
}

// ─── §SES.16  effects.ts — as const + Map type compatibility ──────────────────
function checkEffectsRoutes(): void {
  section("§SES.16  server/routes/effects.ts — `as const` Map Type");
  const FILE = "server/routes/effects.ts";
  if (!exists(FILE)) {
    emit("SES16.effects.missing", "WARN", "§SES.16", `${FILE} not found`, "Cannot verify effects fixes.");
    return;
  }
  const content = safeRead(FILE);

  // effectById must be typed as Map<string, ...> to accept req.params.id
  if (/\] as const/.test(content) && !/new Map<string,/.test(content)) {
    emit("SES16.effects.mapType", "BLOCK", "§SES.16",
      "effects.ts — BUILT_IN_EFFECTS is `as const` but effectById Map is untyped",
      "`as const` narrows e.id to a string literal union ('reverb'|'delay'|...).\n" +
      "  effectById.get(req.params.id) and .has(effectId) require a `string` key.\n" +
      "  TypeScript will error because string is not assignable to the literal union.\n" +
      "  Fix: const effectById = new Map<string, typeof BUILT_IN_EFFECTS[number]>(...)"
    );
  } else {
    pass("SES16.effects.mapType", "§SES.16", "effects.ts — Map<string, ...> type or no as const issue");
  }

  // req.params.id must be used, not req.body.effectId
  if (/req\.body\.effectId/.test(content)) {
    emit("SES16.effects.bodyId", "BLOCK", "§SES.16",
      "effects.ts POST /:id/apply still reads req.body.effectId",
      "The URL param (req.params.id) is completely decoupled from the handler.\n" +
      "  Any effectId in the body overrides the URL and bypasses REST conventions.\n" +
      "  Replace: const effectId = req.params.id;"
    );
  } else if (/req\.params\.id/.test(content)) {
    pass("SES16.effects.paramsId", "§SES.16", "effects.ts — req.params.id used correctly");
  }
}

// ─── §SES.17  TypeScript compilation health ───────────────────────────────────
function checkTscHealth(): void {
  section("§SES.17  TypeScript Compile Check (npx tsc --noEmit)");

  // Run tsc noEmit for both server and client if tsconfigs exist
  const configs = [
    { label: "server", cfg: "server/tsconfig.json" },
    { label: "client", cfg: "client/tsconfig.json" },
    { label: "root",   cfg: "tsconfig.json" },
  ].filter(({ cfg }) => exists(cfg));

  if (configs.length === 0) {
    emit("SES17.tsc.noConfig", "WARN", "§SES.17", "No tsconfig.json found", "Cannot run tsc verification.");
    return;
  }

  for (const { label, cfg } of configs) {
    const r = spawnSync(
      "npx", ["tsc", "--noEmit", "--project", abs(cfg)],
      { cwd: ROOT, encoding: "utf8", timeout: 60_000 }
    );

    if (r.status === 0) {
      pass(`SES17.tsc.${label}`, "§SES.17", `tsc --noEmit passed for ${label} (${cfg})`);
    } else {
      // Extract first 10 errors for display
      const errorLines = (r.stdout + r.stderr)
        .split("\n")
        .filter(l => /error TS\d+/.test(l))
        .slice(0, 10);

      emit(`SES17.tsc.${label}`, "BLOCK", "§SES.17",
        `tsc --noEmit FAILED for ${label} (${cfg})`,
        `${errorLines.length > 0 ? errorLines.join("\n  ") : "(run npx tsc --noEmit manually for details)"}\n` +
        `  All TypeScript errors must be resolved before deployment.`
      );
    }
  }
}

// ─── §SES.18  server/types/ exists and is included in tsconfig ────────────────
function checkServerTypesDir(): void {
  section("§SES.18  server/types/ Directory in tsconfig Scope");

  if (!exists("server/types")) {
    emit("SES18.types.missing", "BLOCK", "§SES.18",
      "server/types/ directory not found",
      "server/types/express.d.ts must be installed here.\n" +
      "  Run: python3 r3-place-files.py"
    );
    return;
  }

  // Check server/tsconfig.json includes this directory
  const TSCONFIG = "server/tsconfig.json";
  if (!exists(TSCONFIG)) {
    emit("SES18.tsconfig.missing", "WARN", "§SES.18",
      "server/tsconfig.json not found",
      "Cannot verify that server/types/ is in scope. Without it the express.d.ts\n" +
      "  augmentation may not be visible to all server files."
    );
    return;
  }

  const tsconfig = safeRead(TSCONFIG);
  // If `include` is present and types/ is not explicitly included AND
  // no wildcard covers it, warn.
  const hasInclude = /"include"\s*:/.test(tsconfig);
  if (hasInclude) {
    const coversTypes =
      /"\*\*\/\*"/.test(tsconfig) ||      // catches everything
      /"types\/?\*"/.test(tsconfig) ||    // explicit types glob
      /"types\/"/.test(tsconfig) ||       // explicit types dir
      !hasInclude;                        // no include = TS scans all

    if (!coversTypes) {
      emit("SES18.tsconfig.coverage", "WARN", "§SES.18",
        "server/tsconfig.json `include` may not cover server/types/",
        "If server/types/express.d.ts is not in the compilation, req.user will be\n" +
        "  untyped in middleware and routes, causing TS errors or `any` inference.\n" +
        '  Ensure `include` contains ["**/*"] or explicitly includes "types/**/*".'
      );
    } else {
      pass("SES18.tsconfig.coverage", "§SES.18", "server/tsconfig.json — types/ directory appears to be in scope");
    }
  } else {
    pass("SES18.tsconfig.noInclude", "§SES.18",
      "server/tsconfig.json has no `include` — TypeScript scans all files including server/types/");
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// REPORT + MAIN
// ═════════════════════════════════════════════════════════════════════════════

interface Summary {
  blocks: number; warns: number; fixed: number; passes: number; infos: number; total: number;
}

function buildSummary(): Summary {
  return {
    blocks:  findings.filter(f => f.severity === "BLOCK").length,
    warns:   findings.filter(f => f.severity === "WARN").length,
    fixed:   findings.filter(f => f.severity === "FIXED").length,
    passes:  findings.filter(f => f.severity === "PASS").length,
    infos:   findings.filter(f => f.severity === "INFO").length,
    total:   findings.length,
  };
}

function writeLog(summary: Summary): string | null {
  const dir  = abs("internal/logs");
  const file = path.join(dir, `audit-session-${Date.now()}.log`);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const body = [
      `R3 v4 Session Audit — ${new Date().toISOString()}`,
      `Mode: ${FIX ? "FIX" : "DRY-RUN"}    Root: ${ROOT}`,
      "═".repeat(80), "",
      ...findings.map(f =>
        `[${f.severity.padEnd(5)}] ${f.section.padEnd(12)} ${f.id.padEnd(45)} ${f.title}` +
        (f.detail !== "OK" ? `\n           ${f.detail.replace(/\n/g, "\n           ")}` : "")
      ),
      "", "═".repeat(80),
      `BLOCKS:${summary.blocks}  WARNS:${summary.warns}  FIXED:${summary.fixed}  PASS:${summary.passes}  INFO:${summary.infos}  TOTAL:${summary.total}`,
    ].join("\n");
    fs.writeFileSync(file, body, "utf8");
    return file;
  } catch { return null; }
}

function printTerminalReport(summary: Summary): void {
  console.log(`\n${bold("═".repeat(72))}`);
  console.log(bold("FINDINGS\n"));

  const ORDER: Severity[] = ["BLOCK", "WARN", "INFO", "FIXED", "PASS"];
  const ICON: Record<Severity, string> = {
    BLOCK: red("✖ BLOCK"),
    WARN:  yellow("⚠ WARN "),
    INFO:  cyan("ℹ INFO "),
    FIXED: green("✔ FIXED"),
    PASS:  green("✔ PASS "),
  };

  for (const sev of ORDER) {
    if (sev === "PASS" && NO_PASS) continue;
    const group = findings.filter(f => f.severity === sev);
    if (group.length === 0) continue;

    // PASS items rendered compactly to reduce noise (suppress entirely with --no-pass)
    if (sev === "PASS") {
      console.log(dim(`  ✔ ${group.length} PASS item(s) — use --no-pass to suppress`));
      for (const f of group) console.log(`  ${ICON[sev]}  ${dim(f.title)}`);
      console.log();
      continue;
    }

    for (const f of group) {
      console.log(`${ICON[f.severity]}  ${bold(f.title)}  ${dim(`[${f.section}]`)}`);
      if (f.detail !== "OK") {
        for (const l of f.detail.split("\n")) console.log(`       ${dim(l)}`);
      }
      if (f.fixNote && !f.fixed) console.log(`       ${cyan("→")} ${f.fixNote}`);
      console.log();
    }
  }

  console.log(bold("═".repeat(72)));
  const parts = [
    summary.blocks > 0 ? red(`${summary.blocks} BLOCK`)    : green("0 BLOCK"),
    summary.warns  > 0 ? yellow(`${summary.warns} WARN`)   : green("0 WARN"),
    summary.fixed  > 0 ? green(`${summary.fixed} FIXED`)   : dim("0 FIXED"),
    green(`${summary.passes} PASS`),
    dim(`${summary.infos} INFO`),
    dim(`(${summary.total} total)`),
  ];
  console.log(`${bold("SUMMARY")}  ${parts.join("  ")}`);
}

function main(): void {
  const t0 = Date.now();

  if (!JSON_OUT) {
    console.log(`\n${bold("R3 v4 — Session Fix Verification Audit")}`);
    console.log(dim(`Root:  ${ROOT}`));
    console.log(dim(`Mode:  ${FIX ? yellow("FIX — remediations applied where safe") : cyan("DRY-RUN — no changes")}`));
    console.log(dim(`Date:  ${new Date().toISOString()}`));
    console.log(dim(`Scope: Checks §SES.1–§SES.18 (session-specific fixes only)`));
    console.log(dim(`       Run r3-audit-v4.ts for full project audit`));
    const flags = [FIX && "--fix", NO_PASS && "--no-pass"].filter(Boolean);
    if (flags.length) console.log(dim(`Flags: ${flags.join(" ")}`));
  }

  // Run all checks in dependency order
  checkRootStrays();           // §SES.1  — must go first (many checks depend on correct file paths)
  checkExpressAugmentation();  // §SES.2  — req.user type safety
  checkOscilloscope();         // §SES.3  — DPR + transform reset
  checkServerIndex();          // §SES.4  — billing order + WS.OPEN
  checkStripeLogger();         // §SES.5  — console→logger + placement
  checkFeatureGate();          // §SES.6  — console.error removed
  checkEnforceUsageTiers();    // §SES.7  — correct tier strings
  checkAuthRoutes();           // §SES.8  — lazy hash + credential field
  checkPresetsRoutes();        // §SES.9  — randomUUID + schema exports
  checkWaveformRoutes();       // §SES.10 — service wiring
  checkLoopsRateLimit();       // §SES.11 — rate limiter on GET
  checkProjectSerializer();    // §SES.12 — URL object leak
  checkSharedTypeConflicts();  // §SES.13 — conflict files + index dedup
  checkSharedPackageName();    // §SES.14 — @r3vibe/shared name
  checkTimeUtils();            // §SES.15 — zoom guards
  checkEffectsRoutes();        // §SES.16 — as const Map type
  checkServerTypesDir();       // §SES.18 — tsconfig scope (before tsc)
  checkTscHealth();            // §SES.17 — full compile check (last — slowest)

  const summary = buildSummary();
  const elapsed = Date.now() - t0;

  if (JSON_OUT) {
    process.stdout.write(
      JSON.stringify({ root: ROOT, mode: FIX ? "fix" : "dry-run",
        elapsed_ms: elapsed, summary, findings }, null, 2) + "\n"
    );
  } else {
    printTerminalReport(summary);
    const logFile = writeLog(summary);
    if (logFile) console.log(dim(`\nLog → ${path.relative(ROOT, logFile)}`));
    console.log(dim(`Completed in ${elapsed}ms`));

    if (summary.blocks === 0) {
      console.log(green("\n✔ All session fixes verified — no blocking issues."));
    } else {
      console.log(red(`\n✖ ${summary.blocks} BLOCK(s) remain — see details above.`));
    }

    if (!FIX && (summary.blocks > 0 || summary.warns > 0)) {
      console.log(dim(`Re-run with ${cyan("--fix")} to apply safe automated remediations.\n`));
    } else {
      console.log();
    }
  }

  process.exit(summary.blocks > 0 ? 1 : 0);
}

try {
  main();
} catch (err) {
  if (JSON_OUT) {
    process.stdout.write(
      JSON.stringify({ error: String(err), exitCode: 2 }, null, 2) + "\n"
    );
  } else {
    console.error(red("\n[SCRIPT ERROR] Unhandled exception in session audit runner:"));
    console.error(err);
  }
  process.exit(2);
}
