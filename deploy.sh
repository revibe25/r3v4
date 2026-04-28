#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# R3 v4 UI Audit Patch Deploy Script
# Generated from audit of client/src/pages/*.tsx vs instrument.tsx master
#
# Usage:
#   chmod +x deploy.sh
#   ./deploy.sh            # dry-run — shows what would change
#   ./deploy.sh --apply    # applies all patches
#
# All source files must exist in the same directory as this script.
# Run from: ~/Stable   (the repo root)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="client/src"
DRY_RUN=true

[[ "${1:-}" == "--apply" ]] && DRY_RUN=false

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_dry()   { echo -e "${YELLOW}[DRY]${NC}   Would: $*"; }

copy_file() {
  local src="$1"
  local dst="$2"
  if $DRY_RUN; then
    log_dry "cp $src → $dst"
  else
    cp "$src" "$dst"
    log_ok "$dst"
  fi
}

delete_file() {
  local path="$1"
  if $DRY_RUN; then
    log_dry "rm $path"
  else
    if [[ -f "$path" ]]; then
      rm "$path"
      log_ok "Deleted $path"
    else
      log_warn "$path not found (already deleted?)"
    fi
  fi
}

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  R3 v4 UI Audit Patch Deploy"
$DRY_RUN && echo "  MODE: DRY RUN — pass --apply to write files"
$DRY_RUN || echo "  MODE: LIVE — writing files"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── P0: Runtime bug fix ───────────────────────────────────────────────────────
log_info "P0 — Runtime bug: double PageNav on /visuals"
copy_file "$SCRIPT_DIR/pages/visuals.tsx"            "$TARGET/pages/visuals.tsx"

# ── P1: Height overflow fixes ─────────────────────────────────────────────────
log_info "P1 — Height overflow: collaborative-daw-pro, AdminPage, AgentSuitePage"
copy_file "$SCRIPT_DIR/pages/collaborative-daw-pro.tsx"    "$TARGET/pages/collaborative-daw-pro.tsx"
copy_file "$SCRIPT_DIR/pages/AdminPage.tsx"                "$TARGET/pages/AdminPage.tsx"
copy_file "$SCRIPT_DIR/pages/admin/AgentSuitePage.tsx"     "$TARGET/pages/admin/AgentSuitePage.tsx"

# ── P2: Major structural + VST page ──────────────────────────────────────────
log_info "P2 — DAW.tsx: ag-header injection + lime accent; vst.tsx: ag-* shell"
copy_file "$SCRIPT_DIR/pages/DAW.tsx"                "$TARGET/pages/DAW.tsx"
copy_file "$SCRIPT_DIR/pages/vst.tsx"                "$TARGET/pages/vst.tsx"
copy_file "$SCRIPT_DIR/pages/not-found.tsx"          "$TARGET/pages/not-found.tsx"

# ── P3: Minor accent + offset fixes ──────────────────────────────────────────
log_info "P3 — login.tsx: hardcoded nav offset; AuthPage.tsx: amber→lime"
copy_file "$SCRIPT_DIR/pages/login.tsx"              "$TARGET/pages/login.tsx"
copy_file "$SCRIPT_DIR/pages/AuthPage.tsx"           "$TARGET/pages/AuthPage.tsx"

# ── P4: Orphan deletion ───────────────────────────────────────────────────────
log_info "P4 — Delete orphaned pages/page-nav.tsx"
delete_file "$TARGET/pages/page-nav.tsx"
if [[ -f "$TARGET/pages/page-nav.tsx.bak" ]]; then
  delete_file "$TARGET/pages/page-nav.tsx.bak"
fi

# ── App.tsx + components/page-nav.tsx ─────────────────────────────────────────
log_info "App.tsx — wire /vst route; components/page-nav.tsx — add VST to PAGES"
copy_file "$SCRIPT_DIR/App.tsx"                      "$TARGET/App.tsx"
copy_file "$SCRIPT_DIR/components/page-nav.tsx"      "$TARGET/components/page-nav.tsx"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if $DRY_RUN; then
  echo -e "  ${YELLOW}DRY RUN complete — no files written.${NC}"
  echo "  Run with --apply to execute."
else
  echo -e "  ${GREEN}All patches applied.${NC}"
  echo ""
  echo "  Next: verify the build"
  echo "    cd ~/Stable"
  echo "    pnpm --filter client build"
  echo "  Or dev server:"
  echo "    pnpm --filter client dev"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
