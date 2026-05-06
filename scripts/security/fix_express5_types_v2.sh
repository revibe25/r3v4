#!/usr/bin/env bash
# =============================================================================
# fix_express5_types_v2.sh — Precision Express 5 TS patcher (v2)
# WIRE protocol: read-before-write, Python anchored patches, assert count == 1,
# timestamped backups, dry-run default, --apply flag, auto-rollback on tsc fail
#
# Fixes exactly four tsc error sites in server/routes/effects.ts:
#   L124  EFFECTS_REGISTRY.get(req.params.id)         → as string cast
#   L144  EFFECTS_REGISTRY.get(effectId)              → as string cast
#   L156  effectId, in applyEffectToTrack object      → effectId: effectId as string
#   L183  effectId in removeEffectFromTrack object    → effectId: effectId as string
# =============================================================================
set -euo pipefail

APPLY=false
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_STAMP=$(date +%s)
BACKUP_DIR="$REPO_ROOT/.bak/$TS_STAMP"
ROLLBACK_FILES=()

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
      echo "  Default: dry-run (prints diffs, writes nothing)"
      echo "  --apply: commits patches, runs pnpm tsc --noEmit, auto-rollbacks on failure"
      exit 0 ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

[[ "$APPLY" == "false" ]] && warn "DRY-RUN mode — pass --apply to commit."

require_file() { [[ -f "$1" ]] || die "File not found: $1"; }

backup() {
  local src="$1"
  if [[ "$APPLY" == "true" ]]; then
    mkdir -p "$BACKUP_DIR"
    cp "$src" "$BACKUP_DIR/$(basename "$src")"
    ROLLBACK_FILES+=("$src:$BACKUP_DIR/$(basename "$src")")
    info "Backed up $src → $BACKUP_DIR/$(basename "$src")"
  fi
}

rollback_all() {
  echo -e "\n${RED}[ROLLBACK]${RESET} tsc still has errors — restoring backups..."
  for entry in "${ROLLBACK_FILES[@]}"; do
    src="${entry%%:*}"; bak="${entry##*:}"
    cp "$bak" "$src"
    warn "Restored $src"
  done
  die "Rolled back. Fix remaining issues and re-run."
}

# python_patch <file> <label> <python_body>
# python_body must set: old (str), new (str), count_expected (int)
# Script asserts old appears exactly count_expected times, then replaces.
python_patch() {
  local file="$1" label="$2" body="$3"
  info "Patch [$label]"

  if [[ "$APPLY" == "false" ]]; then
    python3 -c "
import sys

path = '$file'
with open(path) as f:
    content = f.read()

$body

count = content.count(old)
assert count == count_expected, \
    f'Anchor guard: expected {count_expected} occurrence(s) of pattern, found {count}\\nPattern: {repr(old)}'

result = content.replace(old, new, count_expected)
if result == content:
    print('  [DRY] Already applied — no change')
else:
    print(f'  [DRY] Would replace {count} occurrence(s):')
    print(f'        OLD: {repr(old[:120])}')
    print(f'        NEW: {repr(new[:120])}')
"
  else
    python3 -c "
import sys

path = '$file'
with open(path) as f:
    content = f.read()

$body

count = content.count(old)
assert count == count_expected, \
    f'Anchor guard: expected {count_expected} occurrence(s) of pattern, found {count}\\nPattern: {repr(old)}'

result = content.replace(old, new, count_expected)
if result == content:
    print('  [SKIP] Already applied')
else:
    with open(path, 'w') as f:
        f.write(result)
    print(f'  [DONE] Replaced {count} occurrence(s)')
"
  fi
}

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

EFFECTS="server/routes/effects.ts"
require_file "$EFFECTS"
require_file "package.json"
ok "Target files present"

# =============================================================================
section "STEP 1 — Fix L124: EFFECTS_REGISTRY.get(req.params.id)"
# =============================================================================
# Error: Argument of type 'string | string[]' not assignable to 'string'
# The .get() call passes req.params.id directly — add 'as string' cast

backup "$EFFECTS"

python_patch "$EFFECTS" "L124 req.params.id → as string" "
old            = 'EFFECTS_REGISTRY.get(req.params.id)'
new            = 'EFFECTS_REGISTRY.get(req.params.id as string)'
count_expected = 1
"

# =============================================================================
section "STEP 2 — Fix L144: EFFECTS_REGISTRY.get(effectId)"
# =============================================================================
# effectId is typed string | string[] (from req.params). Cast at point of use.

python_patch "$EFFECTS" "L144 EFFECTS_REGISTRY.get(effectId) → as string" "
old            = 'EFFECTS_REGISTRY.get(effectId)'
new            = 'EFFECTS_REGISTRY.get(effectId as string)'
count_expected = 1
"

# =============================================================================
section "STEP 3 — Fix L156: effectId in applyEffectToTrack object literal"
# =============================================================================
# Shorthand property 'effectId' in the storage.applyEffectToTrack({...}) call
# is typed string | string[]. Expand shorthand to explicit cast.
# Anchor: unique combination of surrounding properties in the object

python_patch "$EFFECTS" "L156 effectId shorthand in applyEffectToTrack" "
old            = '''storage.applyEffectToTrack({
      userId,
      trackId,
      effectId,
      settings: parameters,
    })'''
new            = '''storage.applyEffectToTrack({
      userId,
      trackId,
      effectId: effectId as string,
      settings: parameters,
    })'''
count_expected = 1
"

# =============================================================================
section "STEP 4 — Fix L183: effectId in removeEffectFromTrack object literal"
# =============================================================================
# Same pattern — shorthand property in removeEffectFromTrack call

python_patch "$EFFECTS" "L183 effectId shorthand in removeEffectFromTrack" "
old            = 'storage.removeEffectFromTrack({ userId, trackId, effectId })'
new            = 'storage.removeEffectFromTrack({ userId, trackId, effectId: effectId as string })'
count_expected = 1
"

# =============================================================================
section "STEP 5 — pnpm.overrides: fast-xml-parser + esbuild"
# =============================================================================
# Pin transitive vulnerable deps (D-03/D-06/D-07 and C-01)

backup "package.json"

python_patch "package.json" "pnpm.overrides: fast-xml-parser >=5.2.0, esbuild >=0.25.0" "
import json

with open(path) as f:
    raw = f.read()

data = json.loads(raw)
data.setdefault('pnpm', {}).setdefault('overrides', {})

overrides = data['pnpm']['overrides']
targets   = [('fast-xml-parser', '>=5.2.0'), ('esbuild', '>=0.25.0')]
changed   = [f'{k}@{v}' for k, v in targets if overrides.get(k) != v]

for k, v in targets:
    overrides[k] = v

new_json = json.dumps(data, indent=2) + '\n'

# Reuse python_patch variables
old            = raw
new            = new_json
count_expected = 1 if changed else 0

if not changed:
    print('  [SKIP] Overrides already present')
    # prevent replace below from running
    old = new  # identical strings → no-op
"

# =============================================================================
section "STEP 6 — pnpm install + pnpm tsc --noEmit verification"
# =============================================================================

if [[ "$APPLY" == "true" ]]; then
  info "Running pnpm install..."
  pnpm install 2>&1 | grep -E '(Done|ERR|error|Packages|WARN.*deprecated)' | head -10 || true

  info "Running pnpm tsc --noEmit..."
  TSC_OUT=$(pnpm tsc --noEmit 2>&1) || true
  ERROR_COUNT=$(echo "$TSC_OUT" | grep -cE 'error TS[0-9]+' || true)

  if [[ "$ERROR_COUNT" -eq 0 ]]; then
    echo ""
    ok "pnpm tsc --noEmit: CLEAN ✓"
    echo ""
    echo -e "${GREEN}${BOLD}All patches applied and verified.${RESET}"
    echo ""
    echo "  Backups: $BACKUP_DIR"
    echo ""
    echo "  Remaining security work:"
    echo "  1. pnpm add drizzle-orm@latest drizzle-zod@latest --filter @r3vibe/server"
    echo "     pnpm tsc --noEmit"
    echo "  2. pnpm add express@5 @types/express@5 --filter @r3vibe/server"
    echo "     pnpm tsc --noEmit   (resolves D-02 path-to-regexp)"
    echo "  3. Update SECURITY.md with new Dependabot entries (D-01 through D-10)"
  else
    warn "$ERROR_COUNT error(s) remain after patching:"
    echo "$TSC_OUT" | grep 'error TS' | head -20
    echo ""
    warn "Remaining errors may be pre-existing or require manual review."
    warn "Checking if errors are in files we patched..."

    PATCHED_ERRORS=$(echo "$TSC_OUT" | grep 'error TS' | grep -c 'effects\.ts' || true)
    if [[ "$PATCHED_ERRORS" -gt 0 ]]; then
      warn "$PATCHED_ERRORS error(s) still in effects.ts — rolling back"
      rollback_all
    else
      warn "Errors are in OTHER files (not effects.ts) — patches preserved."
      warn "Review the remaining errors manually:"
      echo "$TSC_OUT" | grep 'error TS'
    fi
  fi
else
  info "[DRY] Would run: pnpm install && pnpm tsc --noEmit"
  echo ""
  echo -e "${YELLOW}Dry-run complete. If diffs look correct:${RESET}"
  echo "  bash $0 --apply"
fi
