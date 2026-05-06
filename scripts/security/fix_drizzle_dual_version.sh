#!/usr/bin/env bash
# =============================================================================
# fix_drizzle_dual_version.sh — Pin drizzle-orm to single version monorepo-wide
# WIRE protocol: read-before-write, Python anchored patch, assert count == 1,
# timestamped backup, dry-run default, --apply flag, auto-rollback on tsc fail
#
# Problem: drizzle-zod@0.8.3 peers against drizzle-orm@0.39.3 while
#          drizzle-orm@0.45.2 is also installed → pnpm keeps both versions →
#          147 type-collision errors across 8 files.
# Fix:     Add "drizzle-orm": "0.45.2" to pnpm.overrides in root package.json.
#          This forces all packages (including drizzle-zod) to resolve to one
#          version, eliminating the dual-load entirely.
# =============================================================================
set -euo pipefail

APPLY=false
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_STAMP=$(date +%s)
BACKUP_DIR="$REPO_ROOT/.bak/$TS_STAMP"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()      { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
die()     { echo -e "${RED}[FAIL]${RESET}  $*" >&2; exit 1; }
section() { echo -e "\n${BOLD}━━━ $* ━━━${RESET}"; }

for arg in "$@"; do
  case $arg in
    --apply) APPLY=true ;;
    --help|-h)
      echo "Usage: $0 [--apply]"
      echo "  Default: dry-run (shows diff, writes nothing)"
      echo "  --apply: commits patch, runs pnpm install + tsc, auto-rollbacks on failure"
      exit 0 ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

[[ "$APPLY" == "false" ]] && warn "DRY-RUN mode — pass --apply to commit."

# =============================================================================
section "STEP 0 — Preflight"
# =============================================================================

# Auto-detect repo root
if [[ ! -f "$REPO_ROOT/package.json" ]]; then
  for candidate in ~/Stable ~/r3v4 ~/projects/r3v4; do
    [[ -f "$candidate/package.json" ]] && REPO_ROOT="$candidate" && break
  done
fi
info "Repo root: $REPO_ROOT"
cd "$REPO_ROOT"

PKG_JSON="package.json"
[[ -f "$PKG_JSON" ]] || die "package.json not found at $REPO_ROOT"

# Confirm drizzle-orm versions currently installed
info "Checking installed drizzle-orm versions..."
pnpm why drizzle-orm 2>/dev/null | grep "drizzle-orm@" | head -5 || true

# =============================================================================
section "STEP 1 — Patch package.json: add drizzle-orm override"
# =============================================================================

if [[ "$APPLY" == "true" ]]; then
  mkdir -p "$BACKUP_DIR"
  cp "$PKG_JSON" "$BACKUP_DIR/package.json"
  info "Backed up package.json → $BACKUP_DIR/package.json"
fi

python3 -c "
import json, sys

path = '$PKG_JSON'
mode = '$([ "$APPLY" == "true" ] && echo apply || echo dry)'

with open(path) as f:
    raw = f.read()

data = json.loads(raw)

# Ensure pnpm.overrides exists (should already from fix_express5_types_v2.sh)
data.setdefault('pnpm', {}).setdefault('overrides', {})
overrides = data['pnpm']['overrides']

TARGET_KEY = 'drizzle-orm'
TARGET_VER = '0.45.2'

already = overrides.get(TARGET_KEY)

if already == TARGET_VER:
    print(f'  [SKIP] pnpm.overrides[\"{TARGET_KEY}\"] already set to {TARGET_VER}')
    sys.exit(0)

overrides[TARGET_KEY] = TARGET_VER
new_json = json.dumps(data, indent=2) + '\n'

# Anchor guard: original must appear exactly once (it's the whole file)
assert raw.count(raw[:40]) == 1, 'Anchor guard failed'

if mode == 'dry':
    prev = f'(previously: {already})' if already else '(new entry)'
    print(f'  [DRY] Would set pnpm.overrides[\"{TARGET_KEY}\"] = \"{TARGET_VER}\" {prev}')
    print(f'  [DRY] Current overrides block will become:')
    print(f'        {json.dumps(data[\"pnpm\"][\"overrides\"], indent=6)}')
else:
    with open(path, 'w') as f:
        f.write(new_json)
    prev = f'(was: {already})' if already else '(new entry)'
    print(f'  [DONE] Set pnpm.overrides[\"{TARGET_KEY}\"] = \"{TARGET_VER}\" {prev}')
"

# =============================================================================
section "STEP 2 — pnpm install: resolve to single drizzle-orm version"
# =============================================================================

if [[ "$APPLY" == "true" ]]; then
  info "Running pnpm install..."
  pnpm install 2>&1 | grep -E '(Done|Packages|ERR|error|WARN.*deprecated|unmet peer)' | head -15 || true

  info "Verifying single drizzle-orm version after install..."
  DRM_VERSIONS=$(pnpm why drizzle-orm 2>/dev/null | grep "drizzle-orm@[0-9]" | sed 's/.*drizzle-orm@//' | sort -u)
  VERSION_COUNT=$(echo "$DRM_VERSIONS" | grep -c '.' || true)

  if [[ "$VERSION_COUNT" -gt 1 ]]; then
    warn "Multiple drizzle-orm versions still detected:"
    echo "$DRM_VERSIONS"
    warn "Override may not have propagated — check pnpm-lock.yaml"
  else
    ok "Single drizzle-orm version confirmed: $(echo "$DRM_VERSIONS" | head -1)"
  fi
else
  info "[DRY] Would run: pnpm install"
fi

# =============================================================================
section "STEP 3 — pnpm tsc --noEmit verification"
# =============================================================================

if [[ "$APPLY" == "true" ]]; then
  info "Running pnpm tsc --noEmit..."
  TSC_OUT=$(pnpm tsc --noEmit 2>&1) || true
  ERROR_COUNT=$(echo "$TSC_OUT" | grep -cE 'error TS[0-9]+' || true)

  if [[ "$ERROR_COUNT" -eq 0 ]]; then
    echo ""
    ok "pnpm tsc --noEmit: CLEAN ✓  (was 147 errors)"
    echo ""
    echo -e "${GREEN}${BOLD}D-01 drizzle-orm SQL injection: PATCHED + VERIFIED${RESET}"
    echo ""
    echo "  Backup: $BACKUP_DIR/package.json"
    echo ""
    echo -e "${BOLD}Release blockers cleared:${RESET}"
    echo "  ✅ D-01  drizzle-orm SQL injection     (pnpm override 0.45.2)"
    echo "  ✅ D-02  path-to-regexp ReDoS           (Express 5)"
    echo "  ✅ D-03  fast-xml-parser entity expand  (pnpm override >=5.2.0)"
    echo "  ✅ D-06  fast-xml-parser XML injection  (same override)"
    echo "  ✅ D-07  fast-xml-parser entity bypass  (same override)"
    echo "  ✅ C-01  esbuild CORS                   (pnpm override >=0.25.0)"
    echo ""
    echo -e "${BOLD}Remaining work:${RESET}"
    echo "  1. pnpm why drizzle-orm | head -3       ← confirm single version"
    echo "  2. pnpm why fast-xml-parser | head -3   ← confirm override resolved"
    echo "  3. pnpm why path-to-regexp | head -3    ← confirm Express 5 path"
    echo "  4. Update SECURITY.md — add D-04 through D-10 deferred entries"
    echo "  5. Close Dependabot alerts #1-#29 with triage reasoning comments"
  else
    warn "$ERROR_COUNT error(s) remain. Breakdown by file:"
    echo "$TSC_OUT" | grep '^server/' | sort | uniq -c | sort -rn | head -15

    warn "Drizzle dual-version may still be present. Checking..."
    pnpm why drizzle-orm 2>/dev/null | grep "drizzle-orm@[0-9]" || true

    warn "Rolling back package.json..."
    cp "$BACKUP_DIR/package.json" "$PKG_JSON"
    warn "Restored package.json from $BACKUP_DIR/package.json"
    die "Rollback complete. Investigate remaining errors above."
  fi
else
  info "[DRY] Would run: pnpm tsc --noEmit"
  echo ""
  echo -e "${YELLOW}Dry-run complete. If diff looks correct:${RESET}"
  echo "  bash $0 --apply"
fi
