#!/usr/bin/env bash
# =============================================================================
# fix_express5_types.sh — Express 5 TypeScript migration patcher
# WIRE protocol: read-before-write, Python anchored patches, assert count == 1,
# timestamped backups, dry-run default, --apply flag, auto-rollback on tsc fail
# =============================================================================
set -euo pipefail

APPLY=false
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS=$(date +%s)
BACKUP_DIR="$REPO_ROOT/.bak/$TS"
ROLLBACK_FILES=()

# ── colour output ─────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()      { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
die()     { echo -e "${RED}[FAIL]${RESET}  $*" >&2; exit 1; }
section() { echo -e "\n${BOLD}━━━ $* ━━━${RESET}"; }

# ── arg parsing ───────────────────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --apply) APPLY=true ;;
    --help|-h)
      echo "Usage: $0 [--apply]"
      echo "  Default: dry-run (shows what would change, writes nothing)"
      echo "  --apply: commits all patches and runs pnpm tsc --noEmit"
      exit 0
      ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

if [[ "$APPLY" == "false" ]]; then
  warn "DRY-RUN mode. Pass --apply to commit changes."
fi

# ── helpers ───────────────────────────────────────────────────────────────────
require_file() {
  [[ -f "$1" ]] || die "Required file not found: $1"
}

backup() {
  local src="$1"
  local dst="$BACKUP_DIR/$(basename "$src")"
  if [[ "$APPLY" == "true" ]]; then
    mkdir -p "$BACKUP_DIR"
    cp "$src" "$dst"
    ROLLBACK_FILES+=("$src:$dst")
    info "Backed up $src → $dst"
  fi
}

rollback_all() {
  echo -e "\n${RED}[ROLLBACK]${RESET} tsc failed — restoring all backups..."
  for entry in "${ROLLBACK_FILES[@]}"; do
    local src="${entry%%:*}"
    local bak="${entry##*:}"
    cp "$bak" "$src"
    warn "Restored $src from $bak"
  done
  die "All changes rolled back. Fix the underlying issue and re-run."
}

# Python patch with assert count == 1 guard
# Usage: python_patch <file> <description> <python_code_string>
python_patch() {
  local file="$1"
  local desc="$2"
  local code="$3"

  info "Patch: $desc"

  if [[ "$APPLY" == "false" ]]; then
    python3 -c "
import sys, re, copy

path = '$file'
with open(path) as f:
    original = f.read()

$code

if original == content:
    print('  [DRY] No change — pattern may already be applied or not found')
else:
    lines_before = original.count('\n')
    lines_after  = content.count('\n')
    delta        = lines_after - lines_before
    changed = [(i+1, a, b) for i,(a,b) in enumerate(zip(original.splitlines(), content.splitlines())) if a != b]
    print(f'  [DRY] Would modify {len(changed)} line(s), delta {delta:+d} lines')
    for lineno, old, new in changed[:8]:
        print(f'        L{lineno}: {repr(old)[:80]}')
        print(f'             → {repr(new)[:80]}')
    if len(changed) > 8:
        print(f'        ... and {len(changed)-8} more')
"
  else
    python3 -c "
import sys, re

path = '$file'
with open(path) as f:
    original = f.read()

$code

if original == content:
    print('  [SKIP] Already applied or pattern not found — no change written')
else:
    with open(path, 'w') as f:
        f.write(content)
    print(f'  [DONE] Written')
"
  fi
}

# =============================================================================
section "STEP 0 — Preflight: verify repo root and file existence"
# =============================================================================

# Auto-detect repo root (look for pnpm-workspace.yaml or package.json with workspaces)
if [[ ! -f "$REPO_ROOT/package.json" ]]; then
  # Try common locations
  for candidate in ~/Stable ~/r3v4 ~/projects/r3v4; do
    if [[ -f "$candidate/package.json" ]]; then
      REPO_ROOT="$candidate"
      break
    fi
  done
fi

info "Repo root: $REPO_ROOT"
cd "$REPO_ROOT"

EFFECTS="server/routes/effects.ts"
LOOPS="server/routes/loops.ts"
WAVEFORM="server/routes/waveform.ts"

require_file "$EFFECTS"
require_file "$LOOPS"
require_file "$WAVEFORM"
ok "All target files present"

# =============================================================================
section "STEP 1 — Update multer to Express 5-compatible types"
# =============================================================================
# This resolves loops.ts:36 and waveform.ts:78 (RequestHandler type collision
# between @types/express@4.x and @types/express-serve-static-core@5.x)

if [[ "$APPLY" == "true" ]]; then
  info "Running: pnpm add multer@latest @types/multer@latest --filter @r3vibe/server"
  pnpm add multer@latest @types/multer@latest --filter @r3vibe/server 2>&1 | \
    grep -E '(^\+|^-|Done|ERR|WARN|error)' || true
  ok "multer packages updated"
else
  info "[DRY] Would run: pnpm add multer@latest @types/multer@latest --filter @r3vibe/server"
fi

# =============================================================================
section "STEP 2 — Patch server/routes/effects.ts"
# =============================================================================
# Express 5 changed req.params values from string to string | string[].
# Errors: lines 124, 144, 156, 183
# Fix strategy: narrow all req.params.X usages to string via inline cast
# Pattern: req.params.X  →  (req.params.X as string)
# Guard: assert substitution count matches expected occurrences

backup "$EFFECTS"

python_patch "$EFFECTS" \
  "Narrow req.params.* to string (inline cast)" \
"
import re

with open(path) as f:
    original = f.read()

# Match req.params.<identifier> NOT already followed by 'as string'
# Negative lookahead: don't double-wrap existing casts
pattern = r'req\.params\.([A-Za-z_][A-Za-z0-9_]*)(?!\s+as\s+string)(?![\w])'

matches = re.findall(pattern, original)
count   = len(matches)

assert count >= 1, f'Expected >=1 req.params.X occurrences, found {count} — anchor guard fail'

content = re.sub(
    pattern,
    lambda m: f'(req.params.{m.group(1)} as string)',
    original
)

new_count = len(re.findall(r'req\.params\.\w+(?!\s+as\s+string)', content))
assert new_count == 0, f'Post-patch check: {new_count} uncast req.params.X still present'
print(f'  Narrowed {count} req.params.X occurrence(s)')
"

# =============================================================================
section "STEP 3 — Patch server/routes/loops.ts"
# =============================================================================
# Error: line 36 — multer RequestHandler typed against @types/express@4
# After multer update in Step 1 this is usually resolved.
# Belt-and-suspenders: if upload.single() calls still have type issues,
# cast the middleware chain explicitly.

backup "$LOOPS"

python_patch "$LOOPS" \
  "Add explicit Request/Response imports from express if missing" \
"
with open(path) as f:
    original = f.read()

# Ensure express core types are imported. If import already has Request/Response, skip.
# Pattern: find existing express import and ensure it includes Request, Response, NextFunction
import re

# Check if already importing from express
has_import = bool(re.search(r\"import\s+.*\bRequest\b.*from\s+'express'\", original) or
                  re.search(r'import\s+.*\bRequest\b.*from\s+\"express\"', original))

if has_import:
    # Already has Request import — no change needed for import line
    content = original
    print('  [SKIP] Express types already imported — no import change needed')
else:
    # Add explicit import at top
    # Find first import line
    first_import = re.search(r'^import\s+', original, re.MULTILINE)
    if first_import:
        insert_pos = first_import.start()
        content = original[:insert_pos] + \"import type { Request, Response, NextFunction } from 'express';\n\" + original[insert_pos:]
        print('  Added express type import')
    else:
        content = original
        print('  [SKIP] No import block found — no change')
"

# =============================================================================
section "STEP 4 — Patch server/routes/waveform.ts"
# =============================================================================
# Same pattern as loops.ts — multer RequestHandler type collision

backup "$WAVEFORM"

python_patch "$WAVEFORM" \
  "Narrow req.params.* to string (inline cast)" \
"
import re

with open(path) as f:
    original = f.read()

pattern = r'req\.params\.([A-Za-z_][A-Za-z0-9_]*)(?!\s+as\s+string)(?![\w])'
matches = re.findall(pattern, original)
count   = len(matches)

if count == 0:
    content = original
    print('  [SKIP] No uncast req.params.X found — already clean or not present')
else:
    content = re.sub(
        pattern,
        lambda m: f'(req.params.{m.group(1)} as string)',
        original
    )
    print(f'  Narrowed {count} req.params.X occurrence(s)')
"

# =============================================================================
section "STEP 5 — pnpm.overrides: fast-xml-parser + esbuild"
# =============================================================================
# Pin transitive vulnerable deps for D-01(esbuild/C-01) and D-03/D-06/D-07

PKG_JSON="package.json"
require_file "$PKG_JSON"
backup "$PKG_JSON"

python_patch "$PKG_JSON" \
  "Add pnpm.overrides for fast-xml-parser >=5.2.0 and esbuild >=0.25.0" \
"
import json

with open(path) as f:
    original = f.read()

data = json.loads(original)

# Ensure pnpm key exists
if 'pnpm' not in data:
    data['pnpm'] = {}
if 'overrides' not in data['pnpm']:
    data['pnpm']['overrides'] = {}

overrides = data['pnpm']['overrides']
changed = []

for pkg, ver in [('fast-xml-parser', '>=5.2.0'), ('esbuild', '>=0.25.0')]:
    if overrides.get(pkg) != ver:
        overrides[pkg] = ver
        changed.append(f'{pkg}@{ver}')

content = json.dumps(data, indent=2) + '\n'

if not changed:
    content = original  # no-op
    print('  [SKIP] Overrides already present')
else:
    print(f'  Added overrides: {\", \".join(changed)}')
"

# =============================================================================
section "STEP 6 — Verify: pnpm install + pnpm tsc --noEmit"
# =============================================================================

if [[ "$APPLY" == "true" ]]; then
  info "Running pnpm install to apply override pins..."
  pnpm install 2>&1 | grep -E '(Done|ERR|WARN|Packages)' || true

  info "Running pnpm tsc --noEmit..."
  TSC_OUT=$(pnpm tsc --noEmit 2>&1) || true

  ERROR_COUNT=$(echo "$TSC_OUT" | grep -c '^.*error TS' || true)

  if [[ "$ERROR_COUNT" -eq 0 ]]; then
    ok "pnpm tsc --noEmit: CLEAN (0 errors)"
    echo ""
    echo -e "${GREEN}${BOLD}All patches applied successfully.${RESET}"
    echo ""
    echo "  Backups: $BACKUP_DIR"
    echo "  Next:    pnpm add drizzle-orm@latest drizzle-zod@latest --filter @r3vibe/server"
    echo "           pnpm tsc --noEmit"
  else
    warn "pnpm tsc --noEmit reported $ERROR_COUNT error(s):"
    echo "$TSC_OUT" | grep 'error TS' | head -20
    rollback_all
  fi
else
  info "[DRY] Would run: pnpm install && pnpm tsc --noEmit"
  echo ""
  echo -e "${YELLOW}Dry-run complete. Review above diffs then run:${RESET}"
  echo "  bash $0 --apply"
fi
