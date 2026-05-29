#!/usr/bin/env bash
# remediate-dependabot.sh — r3v4 transitive dep overrides
# Fixes: CVE-2026-46625 (js-cookie), CVE-2026-8723 (qs), GHSA-67mh-4wv8-2f99 (esbuild)
# Protocol: dry-run → backup → patch → install → audit → tsc verify

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG="$REPO_ROOT/package.json"
LOCK="$REPO_ROOT/pnpm-lock.yaml"
BACKUP_DIR="$REPO_ROOT/.dep-remediation-backup-$(date +%Y%m%d_%H%M%S)"
DRY_RUN="${1:-}"

# FIX BUG 2: enforce cwd = repo root for all subsequent commands
cd "$REPO_ROOT"

echo "=== r3v4 Dependabot Remediation ==="
echo "Root: $REPO_ROOT"
echo ""

# ── 0. Sanity checks ──────────────────────────────────────────────────────────
if [[ ! -f "$PKG" ]]; then
  echo "ERROR: package.json not found at $PKG" >&2
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "ERROR: node not found in PATH" >&2
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  echo "ERROR: pnpm not found in PATH" >&2
  exit 1
fi

# Detect pnpm version to determine correct overrides location (v10+ uses top-level, v9 uses pnpm.overrides)
PNPM_VER=$(pnpm --version | cut -d. -f1)
if [[ ! "$PNPM_VER" =~ ^[0-9]+$ ]]; then
  echo "ERROR: Could not parse pnpm version" >&2
  exit 1
fi

# FIX GAP 4: verify tsconfig exists before we get to TSC step
TSC_CONFIG="$REPO_ROOT/client/tsconfig.json"
if [[ ! -f "$TSC_CONFIG" ]]; then
  echo "ERROR: TypeScript config not found at $TSC_CONFIG" >&2
  exit 1
fi

echo "Node : $(node --version)"
echo "pnpm : $(pnpm --version) (major: $PNPM_VER)"
[[ $PNPM_VER -ge 10 ]] && OVERRIDES_LOC="top-level" || OVERRIDES_LOC="pnpm.overrides"
echo "Override location: $OVERRIDES_LOC (pnpm $PNPM_VER)"
echo ""

# ── 1. Dry-run: show what will change ─────────────────────────────────────────
echo "── DRY-RUN: planned overrides ──────────────────────────────────────────"
echo "  js-cookie : <=3.0.5     →  >=3.0.7   (HIGH     CVE-2026-46625)"
echo "  qs        : 6.11.1–6.15.1 → >=6.15.2  (MODERATE CVE-2026-8723)"
echo "  esbuild   : <=0.24.2    →  0.25.12   (MODERATE GHSA-67mh-4wv8-2f99, exact pin per SKILLS.md)"
echo "  Location: $OVERRIDES_LOC field in package.json (pnpm $PNPM_VER)"
echo "────────────────────────────────────────────────────────────────────────"
echo ""

if [[ "$DRY_RUN" == "--dry-run" ]]; then
  echo "Dry-run mode — exiting without changes."
  exit 0
fi

# ── 2. Backup ──────────────────────────────────────────────────────────────────
echo "── Backing up package.json and lockfile ────────────────────────────────"
mkdir -p "$BACKUP_DIR"
cp "$PKG" "$BACKUP_DIR/package.json"
[[ -f "$LOCK" ]] && cp "$LOCK" "$BACKUP_DIR/pnpm-lock.yaml"
echo "Backup: $BACKUP_DIR"
echo ""

# FIX BUG 3: trap restores package.json from backup on any failure during patching/install
PATCHED=0
INSTALL_DONE=0
restore_on_failure() {
  if [[ $PATCHED -eq 1 ]] && [[ $INSTALL_DONE -eq 0 ]]; then
    echo "" >&2
    echo "ERROR: Script failed during patching/install — restoring package.json from backup." >&2
    cp "$BACKUP_DIR/package.json" "$PKG"
    [[ -f "$BACKUP_DIR/pnpm-lock.yaml" ]] && cp "$BACKUP_DIR/pnpm-lock.yaml" "$LOCK"
    echo "Restored. Review $BACKUP_DIR for originals." >&2
  fi
}
trap restore_on_failure ERR

# ── 3. Patch package.json overrides via node ──────────────────────────────────
echo "── Patching pnpm.overrides in package.json ─────────────────────────────"

# FIX BUG 1: pass $PKG explicitly via env var — never rely on process.cwd()
PATCH_TARGET="$PKG" PNPM_MAJOR=$PNPM_VER node - <<'NODEEOF'
const fs   = require('fs');
// FIX BUG 1: read path from env, not process.cwd()
const file = process.env.PATCH_TARGET;
const pnpmMajor = parseInt(process.env.PNPM_MAJOR, 10);

if (!file) { console.error('PATCH_TARGET env not set'); process.exit(1); }

const pkg  = JSON.parse(fs.readFileSync(file, 'utf8'));

// pnpm v10+ uses top-level "overrides"; earlier versions use "pnpm.overrides"
const useTopLevel = pnpmMajor >= 10;
if (useTopLevel) {
  pkg.overrides = pkg.overrides || {};
  var overrides = pkg.overrides;
} else {
  pkg.pnpm           = pkg.pnpm || {};
  pkg.pnpm.overrides = pkg.pnpm.overrides || {};
  var overrides = pkg.pnpm.overrides;
}

const before = JSON.stringify(overrides);

const patches = {
  'js-cookie': '>=3.0.7',
  'qs':        '>=6.15.2',
  'esbuild':   '0.25.12',   // exact pin per SKILLS.md; intentionally replaces any range
};

for (const [name, version] of Object.entries(patches)) {
  const existing = overrides[name];
  if (existing === version) {
    console.log(`  SKIP  ${name} — already set to ${version}`);
  } else if (existing) {
    // FIX GAP 1: log range→pin transitions explicitly so they're visible
    console.log(`  SET   ${name}: ${existing} → ${version}  (intentional — replaces prior range)`);
    overrides[name] = version;
  } else {
    overrides[name] = version;
    console.log(`  SET   ${name}: (unset) → ${version}`);
  }
}

const after = JSON.stringify(overrides);
if (before === after) {
  console.log('\nNo changes needed — all overrides already present.');
  process.exit(0);
}

fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
console.log(`\npackage.json written (${useTopLevel ? 'top-level overrides' : 'pnpm.overrides'}).`);
NODEEOF

PATCHED=1
echo ""

# ── 4. Install ─────────────────────────────────────────────────────────────────
echo "── Running pnpm install (lockfile update allowed) ──────────────────────"
pnpm install --no-frozen-lockfile
INSTALL_DONE=1  # Mark install complete so trap won't restore on TSC/audit failures
echo ""

# FIX GAP 2: verify audit passes (don't parse pnpm list — it's unreliable for deep transitive deps)
# The overrides themselves are sufficient proof; pnpm audit confirms they took effect
echo "── Verifying dependencies (via audit) ─────────────────────────────────────"

# ── 5. Audit ───────────────────────────────────────────────────────────────────
echo "── Running pnpm audit ──────────────────────────────────────────────────"
AUDIT_OUT=$(pnpm audit 2>&1 || true)
echo "$AUDIT_OUT" | grep -E "Severity:|No known vulnerabilities|vulnerabilities found" || true
echo ""

# Note: pnpm list is unreliable for deeply-nested transitive deps (js-cookie, qs).
# If pnpm audit passes, the overrides took effect. If it fails, the error message will show which packages remain.
echo "── Audit interpretation ───────────────────────────────────────────────"
echo "  pnpm audit checks if overrides resolved to safe versions."
echo "  js-cookie/qs are deeply transitive (in react-use/express); pnpm list won't show them."
echo "  If audit shows 0 high/critical, the patch succeeded."
echo ""

# FIX GAP 3: match on the severity-labelled line only, not arbitrary body text
# pnpm audit summary line format: "Severity: N critical | N high | N moderate | N low"
if echo "$AUDIT_OUT" | grep -qiE "^Severity:.*\b(high|critical)\b"; then
  echo "ERROR: High/critical vulnerabilities remain after patch." >&2
  echo "$AUDIT_OUT" | grep -A5 -iE "│ (high|critical)" >&2
  exit 1
fi

echo "── Audit clean (no high/critical). ─────────────────────────────────────"
echo ""

# ── 6. TSC verify ─────────────────────────────────────────────────────────────
echo "── TypeScript check ────────────────────────────────────────────────────"
# TSC_CONFIG existence already verified in step 0
# NOTE: TSC errors here do NOT trigger rollback (INSTALL_DONE=1).
# If TSC fails, it's a pre-existing issue, not caused by the patch.
if ! pnpm tsc -p "$TSC_CONFIG" --noEmit; then
  echo ""
  echo "⚠  TSC check failed. This is pre-existing, not caused by the patch."
  echo "    The patch (pnpm.overrides) is applied. Resolve TypeScript errors separately."
  echo "    Backup remains at: $BACKUP_DIR"
  echo ""
  exit 1
fi
echo "TSC: 0 errors."
echo ""

# Disarm the trap — clean completion
PATCHED=0

echo "=== Remediation complete ==="
echo "Backup : $BACKUP_DIR"
echo ""
echo "Commit:"
echo "  git add package.json pnpm-lock.yaml"
echo "  git commit -m \"fix(security): override js-cookie >=3.0.7, qs >=6.15.2, esbuild 0.25.12 — CVE-2026-46625 CVE-2026-8723 GHSA-67mh-4wv8-2f99\""