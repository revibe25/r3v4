#!/usr/bin/env bash
# VocalSpectra ASI Level 4+ Build & Integration Script
# v3 — Adds Mythos Security Triage gate and tunes for R3 v4 monorepo.
#      Mythos discipline derived from Mythos-Skills.pdf, which traces to
#      "Assessing Claude Mythos Preview's cybersecurity capabilities"
#      (red.anthropic.com, Apr 7 2026, edited Apr 9 2026).
#
# Threat-model reframe (read first):
#   1. Assume adversary has Mythos-class AI assistance.
#   2. A published CVE is not a queue item, it is a countdown.
#
# Five lessons enforced as gates:
#   L1 Severity is calibrated, not looked up — each finding gets a per-finding
#      note in MYTHOS_AUDIT for human re-grading against project context.
#   L2 The known queue is a floor — SECURITY.md captures audit gaps.
#   L3 Friction ≠ security — deferrals must declare interim-control class.
#   L4 Surface matters — runtime/dev-build paths split via `pnpm audit --prod`.
#   L5 N-day rewrites the terms — public CVE deferrals need date triggers + SLA.

set -euo pipefail
shopt -s globstar nullglob   # globstar: enables DSP/**/*.ts; nullglob: empty globs → nothing

### CONFIGURATION — all overridable from environment ----------------------------
SRC_ROOT="$(pwd)"
BUILD_DIR="${SRC_ROOT}/build"
DIST_DIR="${SRC_ROOT}/dist"

# Default integration target — override with STACK_INTEGRATION_DIR=/abs/path.
# For R3 v4: typically apps/r3-agi/public/worklets or similar audio-engine path.
STACK_INTEGRATION_DIR="${STACK_INTEGRATION_DIR:-${SRC_ROOT}/your-stack}"

DRY_RUN="${DRY_RUN:-true}"

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
LOG_FILE="${SRC_ROOT}/build.${TIMESTAMP}.log"
WIRE_AUDIT="${SRC_ROOT}/WIRE_AUDIT.${TIMESTAMP}.txt"
MYTHOS_AUDIT="${SRC_ROOT}/MYTHOS_AUDIT.${TIMESTAMP}.txt"

REQUIRE_NODE_VERSION="22"
REQUIRE_PNPM_VERSION="10"
REQUIRE_ESBUILD_VERSION="0.25.12"

# Mythos triage knobs ---------------------------------------------------------
SECURITY_MD="${SECURITY_MD:-${SRC_ROOT}/SECURITY.md}"
# Block on unmanaged or SLA-violating *runtime* findings. Dev-build findings warn.
MYTHOS_BLOCK_ON_UNMANAGED="${MYTHOS_BLOCK_ON_UNMANAGED:-true}"
# Also block on dev-build findings (stricter; useful for release builds where
# build-time supply-chain compromise could pivot into shipped artifacts).
MYTHOS_BLOCK_ON_DEV_BUILD="${MYTHOS_BLOCK_ON_DEV_BUILD:-false}"
# N-day SLA windows (days after advisory publication). Defaults match the PDF.
MYTHOS_NDAY_HIGH_SLA_DAYS="${MYTHOS_NDAY_HIGH_SLA_DAYS:-30}"
MYTHOS_NDAY_MED_SLA_DAYS="${MYTHOS_NDAY_MED_SLA_DAYS:-90}"
# Escape hatch — never use for release builds.
MYTHOS_SKIP="${MYTHOS_SKIP:-false}"

# Workspace root (one level up from package by default; override if monorepo
# layout differs). Validated below.
WORKSPACE_ROOT="${WORKSPACE_ROOT:-$(cd "${SRC_ROOT}/.." && pwd)}"
if [[ ! -d "${WORKSPACE_ROOT}/node_modules/.pnpm" ]]; then
  echo "[ERROR] Cannot find workspace node_modules/.pnpm at: ${WORKSPACE_ROOT}/node_modules/.pnpm"
  echo "        Expected workspace root to be: ${WORKSPACE_ROOT}"
  echo "        If your workspace root is elsewhere, set WORKSPACE_ROOT= before running this script."
  exit 2
fi

### helper: log + echo -------------------------------------------------------
log() { echo "$*" | tee -a "$LOG_FILE"; }

### 1. ENVIRONMENT VERIFICATION ----------------------------------------------

echo "[INIT] $(date) — Starting VocalSpectra ASI Level 4+ build (v3, Mythos-aware)"
echo "[ENV] Node: $(node --version 2>/dev/null || echo MISSING), Pnpm: $(pnpm --version 2>/dev/null || echo MISSING)"
echo "[WIRE] Logs → $LOG_FILE | $WIRE_AUDIT | $MYTHOS_AUDIT"

NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//;s/\..*//')
if [[ "$NODE_VERSION" != "$REQUIRE_NODE_VERSION" ]]; then
  echo "[ERROR] Node.js $REQUIRE_NODE_VERSION.x required (found: v$NODE_VERSION). Aborting."
  exit 7
fi

pnpm --version | grep -q "^${REQUIRE_PNPM_VERSION}\." || {
  echo "[ERROR] pnpm $REQUIRE_PNPM_VERSION.x required (found: $(pnpm --version)). Aborting."
  exit 7
}

if ! ls "${WORKSPACE_ROOT}/node_modules/.pnpm/" 2>/dev/null \
    | grep -Fq "esbuild@${REQUIRE_ESBUILD_VERSION}"; then
  echo "[ERROR] esbuild@${REQUIRE_ESBUILD_VERSION} not found in pnpm store."
  echo "        Run 'pnpm install' from workspace root: ${WORKSPACE_ROOT}"
  exit 9
fi

### 2. MYTHOS SECURITY TRIAGE (NEW) ------------------------------------------
# Runs before hygiene/build so a runtime N-day blocker fails fast.

if [[ "$MYTHOS_SKIP" == "true" ]]; then
  log "[WARN] MYTHOS_SKIP=true — security triage SKIPPED. Do not use this for release builds."
else
  log "[STEP] Mythos security triage"

  # Generate SECURITY.md scaffold if absent. Pre-fills your vite 5→6 deferral
  # (path traversal CVE with no 5.x backport) as the worked example.
  if [[ ! -f "$SECURITY_MD" ]]; then
    log "[INFO] $SECURITY_MD not found; generating scaffold."
    cat > "$SECURITY_MD" <<'SECURITY_EOF'
# SECURITY.md

Tracks deferred security findings under the Mythos triage discipline
(see Mythos-Skills.pdf / red.anthropic.com Apr 7 2026 writeup).

Every entry below is either:
  - a deferred finding with **owner + trigger + interim control** (Lesson 5), OR
  - a documented audit gap (Lesson 2)

Deferred findings missing any required field are **unmanaged** and will block
builds. N-day (publicly disclosed CVE) deferrals require a **date** trigger
within the SLA window — not a vague event like "post-MVP".

## Deferred findings

### CVE-EXAMPLE-vite5-path-traversal — vite@5.x

- **Status:** Deferred
- **Advisory status:** public
- **Advisory published:** 2025-XX-XX  <!-- TODO: replace with real CVE pub date -->
- **Surface:** dev-build-supply-chain  <!-- vite is a build tool; bundle output ships -->
- **Our severity assessment:** High — path traversal in dev server has no
  5.x backport; build-time exposure during local dev and CI.
- **Advisory severity:** High
- **Mythos-class re-price:** "attacker would need a dev to run a malicious
  page locally" — under Mythos-class, mass exploitation of dev environments
  via crafted dependency README/changelog content is in scope. Friction-only.
- **Why deferred:** vite 5→6 is a breaking migration; touches every page-level
  import, plugin, and config across apps/api-server and apps/r3-agi.
- **Interim control:** dev-server bound to 127.0.0.1 only (barrier-class for
  remote attackers); no exposure to public networks during dev. CI runs vite
  build only, never dev server.
- **Revisit trigger:** YYYY-MM-DD  <!-- TODO: set a date ≤30d from advisory -->
- **Owner:** @ty
- **Upgrade path:** vite 5 → 6 migration; sequence after MVP ships.

## Audit gaps

(Lesson 2: known queue is a floor. List surfaces never independently audited.)

- LLPTE inference pipeline node boundaries — never independently audited for
  prototype pollution in node-config merging or untrusted-input deserialization.
- WebSocket/SharedArrayBuffer audio-engine boundary — never audited for
  cross-origin isolation bypass shapes.
- tRPC router input validators — surveyed but no formal review against
  the auth-bypass shapes catalogued in the Mythos writeup.
SECURITY_EOF
    log "[INFO] Scaffold written. Edit $SECURITY_MD before next run."
  fi

  # Run pnpm audit twice: --prod isolates the runtime surface (Lesson 4).
  log "[STEP] Running pnpm audit (runtime + full)"
  AUDIT_RUNTIME_JSON="${SRC_ROOT}/.audit-runtime.${TIMESTAMP}.json"
  AUDIT_FULL_JSON="${SRC_ROOT}/.audit-full.${TIMESTAMP}.json"

  # pnpm audit exits non-zero when findings exist; we want the JSON either way.
  pnpm audit --prod --json > "$AUDIT_RUNTIME_JSON" 2>/dev/null || true
  pnpm audit --json        > "$AUDIT_FULL_JSON"    2>/dev/null || true

  # Empty/invalid JSON guard — pnpm sometimes emits nothing on no findings.
  [[ -s "$AUDIT_RUNTIME_JSON" ]] || echo '{"advisories":{}}' > "$AUDIT_RUNTIME_JSON"
  [[ -s "$AUDIT_FULL_JSON"    ]] || echo '{"advisories":{}}' > "$AUDIT_FULL_JSON"

  # Embed triage logic. Node, not jq, because pnpm-audit JSON shape varies
  # across versions and defensive parsing is easier in JS.
  TRIAGE_SCRIPT="${SRC_ROOT}/.mythos-triage.${TIMESTAMP}.mjs"
  cat > "$TRIAGE_SCRIPT" <<'TRIAGE_EOF'
import { readFileSync, writeFileSync } from 'node:fs';

const env = process.env;
const ROOT          = env.SRC_ROOT;
const SECURITY_MD   = env.SECURITY_MD;
const AUDIT_FULL    = env.AUDIT_FULL_JSON;
const AUDIT_RUNTIME = env.AUDIT_RUNTIME_JSON;
const MYTHOS_AUDIT  = env.MYTHOS_AUDIT;
const NDAY_HIGH     = parseInt(env.MYTHOS_NDAY_HIGH_SLA_DAYS, 10);
const NDAY_MED      = parseInt(env.MYTHOS_NDAY_MED_SLA_DAYS,  10);
const BLOCK_RUNTIME = env.MYTHOS_BLOCK_ON_UNMANAGED === 'true';
const BLOCK_DEVBUILD= env.MYTHOS_BLOCK_ON_DEV_BUILD === 'true';

function loadJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); }
  catch { return { advisories: {} }; }
}

// pnpm audit JSON shapes seen in the wild:
//   { advisories: { "<id>": {...} }, metadata: {...} }
//   { vulnerabilities: [ {...} ] }
//   { actions: [...], advisories: {...} }
function getAdvisories(audit) {
  if (!audit) return [];
  if (audit.advisories && typeof audit.advisories === 'object') {
    return Object.values(audit.advisories);
  }
  if (Array.isArray(audit.vulnerabilities)) return audit.vulnerabilities;
  return [];
}

const fullAdvs    = getAdvisories(loadJson(AUDIT_FULL));
const runtimeAdvs = getAdvisories(loadJson(AUDIT_RUNTIME));

// Build a set of identifiers present in the runtime-only audit so we can
// label each finding's surface class (Lesson 4).
function advKey(a) {
  return a.github_advisory_id || (a.cves && a.cves[0]) || `id-${a.id}`;
}
const runtimeIds = new Set(runtimeAdvs.map(advKey));

// Dedupe (CVE/GHSA, package, version range) per the PDF batch workflow.
const byKey = new Map();
for (const adv of fullAdvs) {
  const id  = advKey(adv);
  const mod = adv.module_name || adv.module || 'unknown';
  const ver = adv.vulnerable_versions || adv.range || '*';
  const key = `${id}|${mod}|${ver}`;
  if (!byKey.has(key)) byKey.set(key, adv);
}

// Parse SECURITY.md for deferred findings.
function parseSecurityMd(md) {
  const out = new Map();
  const lines = md.split('\n');
  let inDeferred = false;
  let cur = null;
  const flush = () => { if (cur && cur.id) out.set(cur.id, cur); cur = null; };

  for (const line of lines) {
    if (/^##\s+Deferred findings/i.test(line)) { inDeferred = true; continue; }
    if (/^##\s+/.test(line) && !/^##\s+Deferred findings/i.test(line)) {
      inDeferred = false; flush(); continue;
    }
    if (!inDeferred) continue;

    const idMatch = line.match(/^###\s+((?:CVE-\d{4}-\d+|GHSA-[a-z0-9-]+|CVE-EXAMPLE-[a-z0-9-]+))/i);
    if (idMatch) { flush(); cur = { id: idMatch[1].toUpperCase() }; continue; }
    if (!cur) continue;

    const grab = (re, key) => {
      const m = line.match(re);
      if (m) cur[key] = m[1].trim();
    };
    grab(/\*\*Owner:\*\*\s+(.+)/i,                 'owner');
    grab(/\*\*Revisit trigger:\*\*\s+(.+)/i,       'trigger');
    grab(/\*\*Interim control:\*\*\s+(.+)/i,       'interim');
    grab(/\*\*Advisory status:\*\*\s+(.+)/i,       'advisoryStatus');
    grab(/\*\*Advisory published:\*\*\s+(.+)/i,    'advisoryPublished');
    grab(/\*\*Surface:\*\*\s+(.+)/i,               'surface');
    grab(/\*\*Status:\*\*\s+(.+)/i,                'status');
  }
  flush();
  return out;
}

const securityMd = readFileSync(SECURITY_MD, 'utf8');
const deferred = parseSecurityMd(securityMd);

function parseDate(s) {
  if (!s) return null;
  const m = s.match(/(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  const d = new Date(m[1] + 'T00:00:00Z');
  return isNaN(d.getTime()) ? null : d;
}

const today = new Date();
const notes = [];
const blockers = [];
const warnings = [];

for (const adv of byKey.values()) {
  const id = advKey(adv);
  const sevRaw = (adv.severity || 'unknown').toLowerCase();
  const isRuntime = runtimeIds.has(id);
  const surface = isRuntime ? 'runtime' : 'dev-build';
  const def = deferred.get(id);

  let decision = '';
  let blocker  = null;
  let warning  = null;

  if (def) {
    // L5 required-field check.
    const missing = [];
    if (!def.owner)   missing.push('owner');
    if (!def.trigger) missing.push('trigger');
    if (!def.interim) missing.push('interim control');

    if (missing.length) {
      decision = `UNMANAGED — deferred entry missing: ${missing.join(', ')}`;
      if (isRuntime && BLOCK_RUNTIME) blocker = decision;
      else if (!isRuntime && BLOCK_DEVBUILD) blocker = decision;
      else warning = decision;
    } else {
      const isPublicCve = (def.advisoryStatus || '').toLowerCase().includes('public');
      const sevHi = (sevRaw === 'high' || sevRaw === 'critical');
      const sevMed= (sevRaw === 'medium' || sevRaw === 'moderate');

      if (isPublicCve && (sevHi || sevMed)) {
        // L5 N-day rules: date trigger required, SLA window enforced.
        const trigDate = parseDate(def.trigger);
        if (!trigDate) {
          decision = `BLOCK — N-day with non-date trigger ("${def.trigger}"); date required (L5)`;
          blocker = decision;
        } else {
          const pubDate = parseDate(def.advisoryPublished);
          if (pubDate) {
            const slaDays = sevHi ? NDAY_HIGH : NDAY_MED;
            const slaCutoff = new Date(pubDate.getTime() + slaDays * 86400000);
            if (trigDate > slaCutoff) {
              decision = `BLOCK — N-day SLA exceeded: trigger ${def.trigger} > ${slaDays}d after advisory ${def.advisoryPublished}`;
              blocker = decision;
            } else if (today > trigDate) {
              decision = `BLOCK — deferred trigger ${def.trigger} has passed (today ${today.toISOString().slice(0,10)})`;
              blocker = decision;
            } else {
              decision = `DEFERRED OK — N-day, date trigger ${def.trigger} within ${slaDays}d SLA`;
            }
          } else {
            decision = `DEFERRED — N-day; advisory date missing in SECURITY.md, verify SLA manually`;
            warning = decision;
          }
        }
      } else {
        decision = 'DEFERRED OK — non-N-day with all required fields';
      }
    }
  } else {
    // Not deferred. Apply the PDF decision table.
    if (isRuntime) {
      if (sevRaw === 'critical' || sevRaw === 'high') {
        decision = `BLOCK RELEASE — runtime ${sevRaw}, not deferred`;
        if (BLOCK_RUNTIME) blocker = decision;
      } else if (sevRaw === 'moderate' || sevRaw === 'medium') {
        decision = 'BLOCK MERGE — runtime medium, fix in same change';
        if (BLOCK_RUNTIME) blocker = decision;
      } else if (sevRaw === 'low') {
        decision = 'FIX NOW — runtime low (cheap)';
        warning = decision;
      } else {
        decision = `REVIEW — unknown severity (${sevRaw})`;
        warning = decision;
      }
    } else {
      decision = 'REVIEW (L4) — dev-build path; check supply-chain / attacker-input / credential pivot';
      if (BLOCK_DEVBUILD) blocker = decision;
      else warning = decision;
    }
  }

  notes.push({ id, severity: sevRaw, surface, decision, advisory: adv });
  if (blocker) blockers.push({ id, blocker, surface });
  if (warning) warnings.push({ id, warning, surface });
}

// Emit MYTHOS_AUDIT report.
const out = [];
out.push('Mythos Security Triage Report');
out.push('Generated: ' + today.toISOString());
out.push('Source skill: Mythos-Skills.pdf (red.anthropic.com Apr 7 2026, edited Apr 9 2026)');
out.push('');
out.push('THREAT MODEL');
out.push('  Adversary has Mythos-class AI assistance.');
out.push('  Friction is not security; barriers are. Re-price every');
out.push('  "attacker would need X" claim before accepting it.');
out.push('  Published CVE = countdown, not queue item.');
out.push('');
out.push(`Findings: ${notes.length} unique`);
out.push(`  Runtime: ${notes.filter(n => n.surface === 'runtime').length}`);
out.push(`  Dev-build: ${notes.filter(n => n.surface === 'dev-build').length}`);
out.push(`Blockers: ${blockers.length}`);
out.push(`Warnings: ${warnings.length}`);
out.push('');

if (notes.length === 0) {
  out.push('No findings reported by `pnpm audit`.');
  out.push('');
  out.push('REMINDER (Lesson 2): the known queue is a floor, not a ceiling.');
  out.push('See SECURITY.md "Audit gaps" section for surfaces never independently audited.');
} else {
  out.push('=== PER-FINDING NOTES ===');
  for (const n of notes) {
    const a = n.advisory;
    out.push('');
    out.push(`Finding: ${n.id} — ${a.module_name || a.module || 'unknown'}`);
    out.push(`  Advisory severity: ${n.severity}`);
    out.push(`  Surface: ${n.surface}`);
    out.push(`  Decision: ${n.decision}`);
    if (a.url)                  out.push(`  URL: ${a.url}`);
    if (a.vulnerable_versions)  out.push(`  Vulnerable: ${a.vulnerable_versions}`);
    if (a.patched_versions)     out.push(`  Patched: ${a.patched_versions}`);
    out.push(`  Mythos-class re-price: <list which "attacker would need X" claims no longer hold>`);
    out.push(`  Independent severity (yours): <Critical/High/Medium/Low — re-grade against project context>`);
  }
}

out.push('');
if (blockers.length) {
  out.push('=== BLOCKERS ===');
  for (const b of blockers) out.push(`- [${b.surface}] ${b.id}: ${b.blocker}`);
} else {
  out.push('=== BLOCKERS ===');
  out.push('(none)');
}

out.push('');
if (warnings.length) {
  out.push('=== WARNINGS ===');
  for (const w of warnings) out.push(`- [${w.surface}] ${w.id}: ${w.warning}`);
}

writeFileSync(MYTHOS_AUDIT, out.join('\n') + '\n');

console.log(`[MYTHOS] Findings: ${notes.length} | Blockers: ${blockers.length} | Warnings: ${warnings.length}`);
console.log(`[MYTHOS] Report: ${MYTHOS_AUDIT}`);

if (blockers.length) {
  console.error(`[MYTHOS] FAIL — ${blockers.length} blocker(s):`);
  for (const b of blockers) console.error(`  - [${b.surface}] ${b.id}: ${b.blocker}`);
  process.exit(14);
}
TRIAGE_EOF

  # Run the triage, exporting required env to the child node process.
  if ! SRC_ROOT="$SRC_ROOT" \
       SECURITY_MD="$SECURITY_MD" \
       AUDIT_FULL_JSON="$AUDIT_FULL_JSON" \
       AUDIT_RUNTIME_JSON="$AUDIT_RUNTIME_JSON" \
       MYTHOS_AUDIT="$MYTHOS_AUDIT" \
       MYTHOS_NDAY_HIGH_SLA_DAYS="$MYTHOS_NDAY_HIGH_SLA_DAYS" \
       MYTHOS_NDAY_MED_SLA_DAYS="$MYTHOS_NDAY_MED_SLA_DAYS" \
       MYTHOS_BLOCK_ON_UNMANAGED="$MYTHOS_BLOCK_ON_UNMANAGED" \
       MYTHOS_BLOCK_ON_DEV_BUILD="$MYTHOS_BLOCK_ON_DEV_BUILD" \
       node "$TRIAGE_SCRIPT" 2>&1 | tee -a "$LOG_FILE"; then
    log "[FAIL] Mythos triage produced blocker(s). See $MYTHOS_AUDIT"
    rm -f "$AUDIT_RUNTIME_JSON" "$AUDIT_FULL_JSON" "$TRIAGE_SCRIPT"
    exit 14
  fi

  rm -f "$AUDIT_RUNTIME_JSON" "$AUDIT_FULL_JSON" "$TRIAGE_SCRIPT"
  log "[OK] Mythos triage passed. See $MYTHOS_AUDIT for the per-finding notes."
fi

### 3. HYGIENE: TSC, ESLINT, COLOR AUDIT --------------------------------------

log "[STEP] TypeScript check (strict, noEmit — VocalSpectra sources only)"
# Scoped to tsconfig.vocalspectra.json so R3 v4 client TypeScript debt does not
# bleed into this gate. Create that file if it doesn't exist yet.
if [[ ! -f "${SRC_ROOT}/tsconfig.vocalspectra.json" ]]; then
  log "[INFO] tsconfig.vocalspectra.json not found; generating scaffold."
  cat > "${SRC_ROOT}/tsconfig.vocalspectra.json" <<'TSCONFIG_EOF'
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["DSP/**/*.ts", "Parameters.ts"]
}
TSCONFIG_EOF
fi
pnpm tsc --noEmit --project "${SRC_ROOT}/tsconfig.vocalspectra.json" 2>&1 | tee -a "$LOG_FILE" || {
  log "[FAIL] TypeScript errors found in VocalSpectra sources. See $LOG_FILE"
  exit 11
}

log "[STEP] ESLint (no warnings/errors)"
dsp_ts_files=( DSP/**/*.ts )
if [[ ${#dsp_ts_files[@]} -eq 0 ]]; then
  log "[FAIL] ESLint: no .ts files found under DSP/ — nothing to lint."
  exit 12
fi
pnpm eslint "${dsp_ts_files[@]}" Parameters.ts 2>&1 | tee -a "$LOG_FILE" || {
  log "[FAIL] ESLint errors found. See $LOG_FILE"
  exit 12
}

log "[STEP] Hygiene audit for prohibited color tokens (DSP/ and Parameters.ts only)"
# Scoped to DSP/ — not src/ — because R3 v4 client legitimately uses
# Tailwind JIT arbitrary values (bg-[#1a1a2e], text-[rgb(...)]) as its design
# token system. VocalSpectra DSP worklet sources must use CSS variables only.
# Pattern covers:
#   - bare semantic violations:  bg-black, border-green (not opacity variants)
#   - arbitrary hex:             bg-[#aabbcc], text-[#abc], etc.
#   - arbitrary rgb/hsl:         bg-[rgb(...)], text-[rgba(...)], etc.
#   - bare inline hex anywhere:  #rrggbb / #rgb outside Tailwind brackets
HYGIENE_RE='bg-black($|[^/])|border-green|(bg|text|border|ring|from|to|via)-\[#[0-9a-fA-F]{3,8}\]|(bg|text|border|ring)-\[(rgb|rgba|hsl|hsla)\(|(?<!\[)#[0-9a-fA-F]{6}(?!\])|(?<!\[)#[0-9a-fA-F]{3}(?!\])'
hygiene_targets=( DSP/**/*.ts Parameters.ts )
if [[ ${#hygiene_targets[@]} -eq 0 ]]; then
  log "[WARN] Hygiene: no DSP/*.ts or Parameters.ts files found; skipping."
else
  if grep -rnEP "$HYGIENE_RE" "${hygiene_targets[@]}" </dev/null 2>/dev/null; then
    log "[FAIL] Hygiene: prohibited color tokens found in VocalSpectra sources (above)"
    exit 13
  fi
fi

### 4. BACKUPS ----------------------------------------------------------------

BACKUP_DIR="${SRC_ROOT}/.r3-build-backup-${TIMESTAMP}"
log "[STEP] Backing up key sources to $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"
cp -r DSP Parameters.ts "$BACKUP_DIR"
for f in README*.md WIRE.txt R3v4_PRD_v5.txt SECURITY.md; do
  [[ -f "$f" ]] && cp "$f" "$BACKUP_DIR" || true
done

### 5. CLEAN, BUILD, BUNDLE ---------------------------------------------------

log "[STEP] Cleaning $BUILD_DIR, $DIST_DIR"
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

log "[STEP] Transpiling DSP modules"
pnpm tsc --outDir "$BUILD_DIR" 2>&1 | tee -a "$LOG_FILE" || {
  log "[FAIL] tsc emit failed. See $LOG_FILE"
  exit 21
}

if [[ -f "$BUILD_DIR/DSP/Core.js" ]]; then
  log "[STEP] Bundling AudioWorklet"
  pnpm esbuild "$BUILD_DIR/DSP/Core.js" \
    --bundle \
    --format=iife \
    --outfile="$DIST_DIR/VocalSpectraWorklet.js" \
    --global-name="VocalSpectraWorklet" \
    2>&1 | tee -a "$LOG_FILE" || {
      log "[FAIL] esbuild failed. See $LOG_FILE"
      exit 22
    }
else
  log "[FAIL] Core.js not found at $BUILD_DIR/DSP/Core.js (expected build artifact missing)"
  exit 23
fi

### 6. TEST (ALL VITESTS) -----------------------------------------------------

log "[STEP] Running all Vitest suites"
pnpm vitest run --reporter=verbose 2>&1 | tee -a "$LOG_FILE" || {
  log "[FAIL] Vitest DSP/unit tests failed. See $LOG_FILE"
  exit 31
}

### 7. WIRE-TXT AUDIT LOG -----------------------------------------------------

{
  echo "FILES READ:"
  grep -hE '^import' DSP/*.ts </dev/null 2>/dev/null | sed 's/^/- /' | sort -u || true
  echo ""
  echo "FINDINGS:"
  echo "- Node version: v$NODE_VERSION, pnpm: $(pnpm --version), esbuild: $REQUIRE_ESBUILD_VERSION"
  echo "- TypeScript/ESLint/hygiene/test all PASSED"
  if [[ "$MYTHOS_SKIP" != "true" ]]; then
    echo "- Mythos security triage PASSED — see $MYTHOS_AUDIT"
  else
    echo "- Mythos security triage SKIPPED (MYTHOS_SKIP=true) — not for release"
  fi
  echo "- Bundle ready at $DIST_DIR/VocalSpectraWorklet.js"
  echo ""
  echo "CHANGES:"
  echo "- Built all modules per PRD; see backup at $BACKUP_DIR"
  echo ""
  echo "REMAINING AMBIGUITIES:"
  echo "- DSP algorithm blocks in stubs/pass-through where PRD specs placeholder"
  echo "- If integrating with a different DAW/stack, ensure parameter wire-up and UI messages match"
  echo "- See README.md for integration"
  echo ""
  echo "MYTHOS-ENFORCED INVARIANTS:"
  echo "- Per-finding notes in $MYTHOS_AUDIT — re-grade severity against project context (L1)"
  echo "- SECURITY.md 'Audit gaps' section enumerates surfaces never independently audited (L2)"
  echo "- Deferrals require owner + trigger + interim control class (L3, L5)"
  echo "- Runtime vs dev-build surface split via 'pnpm audit --prod' (L4)"
  echo "- N-day SLA: ≤${MYTHOS_NDAY_HIGH_SLA_DAYS}d for High/Critical, ≤${MYTHOS_NDAY_MED_SLA_DAYS}d for Medium (L5)"
} > "$WIRE_AUDIT"

### 8. DRY RUN / INTEGRATION / DIFF / CONFIRM ---------------------------------

echo
echo "[INTEGRATION DRY_RUN=$DRY_RUN]"

if [[ ! -d "$STACK_INTEGRATION_DIR" ]]; then
  echo "[WARN] Integration dir '$STACK_INTEGRATION_DIR' does not exist."
  if [[ "$DRY_RUN" == "false" ]]; then
    echo "[ERROR] Directory must exist for real integration. Exiting."
    exit 41
  fi
  echo "[DRY-RUN] Would create: $STACK_INTEGRATION_DIR"
fi

show_diff() {
  local src="$1" dest="$2"
  if [[ -f "$dest" ]]; then
    echo "----------- DIFF: $src → $dest -----------"
    diff -u "$dest" "$src" || true
    echo "-------------------------------------------"
  else
    echo "[DIFF] $dest did not previously exist; would be new."
  fi
}

echo
echo "### INTEGRATION PREVIEW ###"
show_diff "$DIST_DIR/VocalSpectraWorklet.js" "$STACK_INTEGRATION_DIR/VocalSpectraWorklet.js"
show_diff Parameters.ts "$STACK_INTEGRATION_DIR/Parameters.ts"
for rmd in README*.md; do
  show_diff "$rmd" "$STACK_INTEGRATION_DIR/$rmd"
done

if [[ "$DRY_RUN" == "true" ]]; then
  echo "[DRY-RUN] No files copied. To integrate for real, run:"
  echo "          DRY_RUN=false $0"
  exit 0
else
  mkdir -p "$STACK_INTEGRATION_DIR"
  read -rp "[CONFIRM] Copy built artifacts into $STACK_INTEGRATION_DIR? (y/n): " reply
  if [[ "$reply" != "y" ]]; then
    echo "[ABORT] Integration cancelled by user."
    exit 0
  fi
  echo "[STEP] Copying built artifacts to $STACK_INTEGRATION_DIR"
  cp "$DIST_DIR/VocalSpectraWorklet.js" "$STACK_INTEGRATION_DIR/"
  cp Parameters.ts "$STACK_INTEGRATION_DIR/"
  for rmd in README*.md; do
    cp "$rmd" "$STACK_INTEGRATION_DIR/"
  done
  echo "[SUCCESS] Integration copy complete."
fi

echo
echo "[FINISH] $(date) — Build, hygiene, security triage, test, and integration PASSED."
echo "[WIRE]   See $WIRE_AUDIT for findings. Artifacts in $DIST_DIR"
echo "[MYTHOS] See $MYTHOS_AUDIT for per-finding security notes."
echo "NEXT STEPS:"
echo "- Register VocalSpectraWorklet.js in your DAW or stack (see README)."
echo "- Re-grade each Mythos finding against project context — advisory severity is a starting point, not a verdict."
echo "- For debugging, check $LOG_FILE or $BACKUP_DIR for this build."

# =============================================================================
# CHANGE LOG
#
# v3 — Mythos integration (this revision):
# v3-ADD-1  New Step 2: Mythos security triage gate, runs before hygiene/build
#           so runtime N-day blockers fail fast.
# v3-ADD-2  pnpm audit --prod vs full split → runtime/dev-build surface labels (L4).
# v3-ADD-3  SECURITY.md auto-scaffold on first run, with vite 5→6 deferral as
#           the worked example (path traversal CVE, no 5.x backport, R3 v4 ctx).
# v3-ADD-4  Embedded node triage parses SECURITY.md for owner/trigger/interim
#           and enforces L5 N-day SLA windows (30d Hi/Crit, 90d Med by default).
# v3-ADD-5  MYTHOS_AUDIT artifact emits per-finding notes with re-grade prompts
#           and the Mythos-class re-price slot left explicit (not auto-filled).
# v3-ADD-6  WIRE_AUDIT now references MYTHOS_AUDIT and lists L1–L5 invariants.
# v3-ADD-7  STACK_INTEGRATION_DIR now overridable from environment.
# v3-ADD-8  Backups now include SECURITY.md.
# v3-ADD-9  New exit code 14 = Mythos triage blocker.
# v3-ADD-10 MYTHOS_SKIP escape hatch (with loud warning) for CI debugging only.
# v3-ADD-11 tsc scoped to tsconfig.vocalspectra.json (auto-generated if absent),
#           covering DSP/**/*.ts + Parameters.ts only — isolates VocalSpectra from
#           R3 v4 client TypeScript debt.
# v3-ADD-12 Hygiene scoped to DSP/ + Parameters.ts; upgraded regex catches Tailwind
#           JIT arbitrary values (bg-[#...], text-[rgb(...)]) plus bare hex literals
#           via PCRE negative-lookbehind. R3 v4 src/ excluded (uses these tokens
#           legitimately as its design system).
#
# v2 — triple-check verification pass:
# v2-FIX-1  WIRE_AUDIT grep hang on empty nullglob expansion → </dev/null + || true
# v2-FIX-2  esbuild grep regex dots literal → grep -Fq
# v2-FIX-3  [FAIL] banners now tee to $LOG_FILE via log() helper
# v2-FIX-4  ESLint: nullglob empty expansion guarded with array-length check
# v2-FIX-5  Hygiene grep: explicit [[ -d src/ ]] guard so missing dir ≠ silent pass
# v2-FIX-6  DRY_RUN environment-overridable
# v2-FIX-7  WORKSPACE_ROOT validated; clear error on missing .pnpm
#
# v1 — initial audit:
# v1-FIX-1  esbuild pre-flight: workspace-root .pnpm, not client-local
# v1-FIX-2  Dead-code if [[ $? ]] under set -euo pipefail → || { } blocks
# v1-FIX-3  DRY_RUN default flipped to true
# v1-FIX-4  Color hygiene grep path (client/src/ → src/)
# v1-FIX-5  shopt -s globstar for DSP/**/*.ts
# v1-FIX-6  WIRE_AUDIT grep -h to suppress filename prefix
# v1-FIX-7  shopt -s nullglob for README*.md loops
# v1-FIX-8  Dry-run mkdir no longer creates the integration dir
# =============================================================================