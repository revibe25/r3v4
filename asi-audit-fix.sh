#!/usr/bin/env bash
#
# ASI Audit Automation — Mastery Level
# Fixes: instrument.tsx prose injection, Vite esbuild→rolldown deprecation,
#        aiMix.router.ts server cleanup
#
# Usage:
#   ./asi-audit-fix.sh [PROJECT_ROOT] [--dry-run] [--restore]
#
# Examples:
#   ./asi-audit-fix.sh                    # Auto-detect project, apply fixes
#   ./asi-audit-fix.sh /home/r3v/Stable   # Explicit path
#   ./asi-audit-fix.sh --dry-run          # Preview only, no changes
#   ./asi-audit-fix.sh --restore          # Rollback last run
#

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────
PROJECT_ROOT="${1:-$(pwd)}"
DRY_RUN=false
RESTORE_MODE=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --restore) RESTORE_MODE=true ;;
    --help|-h)
      sed -n '/^# Usage:/,/^# /p' "$0" | sed 's/^# //'
      exit 0
      ;;
  esac
done

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="$PROJECT_ROOT/.asi-audit-backups"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"
LATEST_LINK="$BACKUP_ROOT/latest"

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

# ─── Logging ─────────────────────────────────────────────────────────────────
info()  { echo -e "${BLUE}ℹ${NC}  $1"; }
ok()    { echo -e "${GREEN}✔${NC}  $1"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $1"; }
err()   { echo -e "${RED}✖${NC}  $1"; }
head()  { echo -e "\n${BOLD}${CYAN}▶ $1${NC}"; }

# ─── Helpers ─────────────────────────────────────────────────────────────────
backup() {
  local src="$1"
  if [[ "$DRY_RUN" == true ]]; then
    info "[DRY-RUN] Would backup: $(basename "$src")"
    return
  fi
  mkdir -p "$BACKUP_DIR"
  cp "$src" "$BACKUP_DIR/$(basename "$src").bak"
}

ensure_latest_link() {
  if [[ "$DRY_RUN" == false && -d "$BACKUP_DIR" ]]; then
    rm -f "$LATEST_LINK"
    ln -s "$BACKUP_DIR" "$LATEST_LINK"
  fi
}

# ─── Fix 1: instrument.tsx prose injection ───────────────────────────────────
fix_instrument() {
  head "FIX 1: client/src/pages/instrument.tsx — Prose Injection"

  local file="$PROJECT_ROOT/client/src/pages/instrument.tsx"
  if [[ ! -f "$file" ]]; then
    warn "File not found: $file"
    return 0
  fi

  local first_line
  first_line=$(head -n 1 "$file")

  # Valid TSX/TS starts with: import, export, const, let, var, function,
  # interface, type, declare, //, /*, *, class, "use strict", or JSX <
  if [[ "$first_line" =~ ^[[:space:]]*(import|export|const|let|var|function|interface|type|declare|//|/\*|\*|class|\"use\ strict\"|\') ]] ||
     [[ "$first_line" =~ ^[[:space:]]*\< ]]; then
    ok "instrument.tsx starts with valid code. Skipping."
    return 0
  fi

  warn "Detected prose injection on line 1"
  info "  → ${first_line:0:75}..."

  backup "$file"

  if [[ "$DRY_RUN" == true ]]; then
    info "[DRY-RUN] Would extract code or strip prose"
    return 0
  fi

  # Strategy A: File wrapped in markdown code blocks (```tsx ... ```)
  if grep -qE '^```(tsx|typescript|jsx)' "$file"; then
    info "Markdown code blocks detected. Extracting TypeScript..."

    awk '
      BEGIN {block=0; printed=0}
      /^```(tsx|typescript|jsx)$/ {block=1; next}
      /^```$/ {block=0; next}
      block {print; printed=1}
      END {if(!printed) exit 1}
    ' "$file" > "$file.asi-extracted"

    if [[ -s "$file.asi-extracted" ]]; then
      mv "$file.asi-extracted" "$file"
      ok "Extracted clean TypeScript from markdown fences"
    else
      rm -f "$file.asi-extracted"
      warn "Extraction failed. Falling back to prose strip."
      tail -n +2 "$file" > "$file.asi-stripped" && mv "$file.asi-stripped" "$file"
      ok "Removed first line (prose preamble)"
    fi

  # Strategy B: Plain prose preamble — remove first line
  else
    tail -n +2 "$file" > "$file.asi-stripped"
    mv "$file.asi-stripped" "$file"
    ok "Removed prose preamble (first line)"
  fi

  # Post-fix validation
  local new_first
  new_first=$(head -n 1 "$file" | sed 's/[[:space:]]//g')
  if [[ -z "$new_first" ]]; then
    warn "File is empty or starts with blank lines after fix."
  elif [[ "$new_first" =~ ^(import|export|const|let|var|function|interface|type|declare|//|/\*|class|\"|\`) ]]; then
    ok "instrument.tsx now begins with valid TypeScript"
  else
    warn "instrument.tsx may still be invalid. Review required."
    info "  → First line now: ${new_first:0:75}"
  fi
}

# ─── Fix 2: Vite esbuildOptions → rolldownOptions ────────────────────────────
fix_vite_config() {
  head "FIX 2: Vite Config — esbuildOptions Deprecation"

  local config
  config=$(find "$PROJECT_ROOT/client" -maxdepth 1 -name "vite.config.*" -type f | head -n 1)

  if [[ -z "$config" ]]; then
    warn "No vite.config.* found in client/"
    return 0
  fi

  info "Found: $(basename "$config")"

  if ! grep -q "esbuildOptions" "$config"; then
    ok "No esbuildOptions key found. Already clean."
    return 0
  fi

  warn "Found deprecated esbuildOptions in $(basename "$config")"

  backup "$config"

  if [[ "$DRY_RUN" == true ]]; then
    info "[DRY-RUN] Would rename esbuildOptions → rolldownOptions"
    return 0
  fi

  # Surgical replacement: only inside optimizeDeps object context
  # We prepend a warning comment and rename the key
  sed -i \
    -e '/optimizeDeps/,/}/ s/esbuildOptions/rolldownOptions/' \
    -e '/rolldownOptions/i\
    // [ASI-AUDIT] Migrated from esbuildOptions to rolldownOptions for Vite 6+\
    // TODO: Verify rolldown API compatibility if build fails.' \
    "$config"

  ok "Renamed esbuildOptions → rolldownOptions"
  warn "Review $(basename "$config") — rolldown API may differ from esbuild"
}

# ─── Fix 3: aiMix.router.ts server cleanup ───────────────────────────────────
fix_aimix_router() {
  head "FIX 3: Server — aiMix.router.ts Deprecation"

  local matches
  matches=$(grep -rlE "import.*aiMix\.router|require.*aiMix\.router" \
    "$PROJECT_ROOT/server" --include="*.ts" --include="*.js" --include="*.mjs" 2>/dev/null || true)

  if [[ -z "$matches" ]]; then
    ok "No active aiMix.router imports found. Already clean."
    return 0
  fi

  while IFS= read -r file; do
    warn "Found aiMix.router import in: $(basename "$file")"
    backup "$file"

    if [[ "$DRY_RUN" == true ]]; then
      info "[DRY-RUN] Would comment out aiMix.router lines"
      continue
    fi

    # Comment out lines that import or use aiMix.router
    sed -i '/aiMix\.router/s/^/\/\/ [ASI-AUDIT] Deprecated — use daw.ai.suggestions instead.\n\/\/ /' "$file"

    ok "Commented out aiMix.router references in $(basename "$file")"
  done <<< "$matches"
}

# ─── Validation ────────────────────────────────────────────────────────────────
validate() {
  head "VALIDATION"

  local file="$PROJECT_ROOT/client/src/pages/instrument.tsx"
  if [[ ! -f "$file" ]]; then
    warn "Cannot validate — instrument.tsx missing"
    return 0
  fi

  # Try TypeScript compiler if available
  if command -v npx &>/dev/null && [[ -f "$PROJECT_ROOT/client/tsconfig.json" ]]; then
    info "Running tsc --noEmit (client)..."
    if (cd "$PROJECT_ROOT/client" && npx tsc --noEmit --skipLibCheck 2>/dev/null); then
      ok "TypeScript compilation clean"
    else
      warn "tsc reported issues (may be pre-existing or rolldown API mismatch)"
    fi
  else
    # Node can't parse TSX, so we just do a heuristic check
    local first
    first=$(head -n 1 "$file" | sed 's/[[:space:]]//g')
    if [[ "$first" =~ ^(import|export|const|let|var|function|interface|type|declare|//|/\*|class|\"|\`) ]]; then
      ok "Heuristic syntax check passed for instrument.tsx"
    else
      warn "Heuristic check failed — instrument.tsx needs manual review"
    fi
  fi
}

# ─── Restore Mode ──────────────────────────────────────────────────────────────
run_restore() {
  head "RESTORE MODE"

  if [[ ! -L "$LATEST_LINK" && ! -d "$LATEST_LINK" ]]; then
    err "No backup symlink found at $LATEST_LINK"
    info "Look in $BACKUP_ROOT for manual restoration."
    exit 1
  fi

  local src_dir
  src_dir=$(readlink -f "$LATEST_LINK")
  info "Restoring from: $src_dir"

  for bak in "$src_dir"/*.bak; do
    [[ -f "$bak" ]] || continue
    local fname
    fname=$(basename "$bak" .bak)

    # Resolve original path by filename
    local orig=""
    case "$fname" in
      instrument.tsx) orig="$PROJECT_ROOT/client/src/pages/instrument.tsx" ;;
      vite.config.*)
        orig=$(find "$PROJECT_ROOT/client" -maxdepth 1 -name "$fname" -type f | head -n 1)
        ;;
      *)
        orig=$(find "$PROJECT_ROOT/server" -name "$fname" -type f | head -n 1)
        ;;
    esac

    if [[ -n "$orig" && -f "$orig" ]]; then
      cp "$bak" "$orig"
      ok "Restored: $orig"
    else
      warn "Could not locate original for: $fname"
    fi
  done

  ok "Rollback complete"
}

# ─── Main ────────────────────────────────────────────────────────────────────
main() {
  echo -e "${BOLD}ASI Audit Automation${NC}  |  Mode: $([[ "$DRY_RUN" == true ]] && echo "DRY-RUN" || echo "LIVE")"
  echo "Project: $PROJECT_ROOT"
  echo "────────────────────────────────────────"

  if [[ "$RESTORE_MODE" == true ]]; then
    run_restore
    exit 0
  fi

  # Preflight
  if [[ ! -d "$PROJECT_ROOT/client" || ! -d "$PROJECT_ROOT/server" ]]; then
    err "Expected client/ and server/ directories under $PROJECT_ROOT"
    info "Usage: $0 [path] [--dry-run] [--restore]"
    exit 1
  fi

  fix_instrument
  fix_vite_config
  fix_aimix_router
  ensure_latest_link
  validate

  echo -e "\n${BOLD}${GREEN}Audit Complete${NC}"
  if [[ "$DRY_RUN" == false ]]; then
    echo "Backups: $BACKUP_DIR"
    echo "Rollback: $0 --restore"
  fi
  echo "Preview changes: $0 --dry-run"
}

main "$@"
