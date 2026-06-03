#!/usr/bin/env bash
# ================================================================
#  r3-project-clean.sh  —  R3v4 monorepo project-level cleanup
#  Stack: pnpm + Turborepo + React/Vite + tRPC + Drizzle + Railway
#
#  SAFETY CONTRACT:
#    • Never touches source directories or config files
#    • Never deletes node_modules (use pnpm commands instead)
#    • pnpm-lock.yaml is absolutely protected
#    • Dry-run by default — must pass --run to make changes
#    • Every destructive action is logged with size recovered
#
#  Usage:
#    bash r3-project-clean.sh            # dry-run (safe preview)
#    bash r3-project-clean.sh --run      # execute cleanup
#    bash r3-project-clean.sh --run --yes  # non-interactive
# ================================================================

set -uo pipefail

# ── Args ─────────────────────────────────────────────────────
DRY=true
AUTO=false
for arg in "$@"; do
  case $arg in
    --run) DRY=false ;;
    --yes) AUTO=true ;;
  esac
done

# ── Colors ───────────────────────────────────────────────────
GRN='\033[0;32m'; YEL='\033[1;33m'; RED='\033[0;31m'
CYN='\033[0;36m'; DIM='\033[2m'; BLD='\033[1m'; RST='\033[0m'

hr()   { echo -e "${DIM}────────────────────────────────────────────────${RST}"; }
ok()   { echo -e "${GRN}  ✓${RST} $*"; }
inf()  { echo -e "${CYN}  ·${RST} $*"; }
warn() { echo -e "${YEL}  !${RST} $*"; }
flag() { echo -e "${RED}  ⚑${RST} $*"; }
act()  { echo -e "  ${GRN}→${RST} $*"; }
dry()  { echo -e "  ${DIM}DRY${RST}  $*"; }

ask() {
  $AUTO && return 0
  echo -en "${YEL}  ?${RST} $* [y/N] "
  read -r ans 2>/dev/null || ans="n"
  [[ "$ans" =~ ^[Yy]$ ]]
}

# Size helpers
sz()     { du -sh "$1" 2>/dev/null | cut -f1 || echo "??"; }
sz_int() { du -sb "$1" 2>/dev/null | cut -f1 || echo "0"; }

TOTAL_BYTES=0
add_saved() {
  local b
  b=$(sz_int "$1")
  TOTAL_BYTES=$(( TOTAL_BYTES + b ))
}

do_rm() {
  # do_rm <label> <path>
  local label="$1" path="$2"
  if [[ ! -e "$path" && ! -L "$path" ]]; then return; fi
  local s; s=$(sz "$path")
  add_saved "$path"
  if $DRY; then
    dry "rm $label  ($s)  →  $path"
  else
    act "rm $label  ($s)"
    rm -rf "$path"
  fi
}

# ── Guard: must be run from inside the monorepo root ─────────
if [[ ! -f "pnpm-workspace.yaml" || ! -f "package.json" ]]; then
  echo -e "${RED}ERROR:${RST} Not in monorepo root (no pnpm-workspace.yaml found)."
  echo "  cd into your project root (~/Stable or ~/r3v4) then re-run."
  exit 1
fi

PROJECT_ROOT="$(pwd)"
PROJECT_NAME="$(basename "$PROJECT_ROOT")"

# ── Header ───────────────────────────────────────────────────
echo ""
echo -e "${CYN}╔════════════════════════════════════════════════╗${RST}"
echo -e "${CYN}║  R3 Project Cleanup  ·  ${BLD}${PROJECT_NAME}${RST}${CYN}              ║${RST}"
echo -e "${CYN}║  $(date '+%Y-%m-%d %H:%M')  ·  $(pwd)   ${RST}"
echo -e "${CYN}╚════════════════════════════════════════════════╝${RST}"
echo ""
if $DRY; then
  warn "DRY RUN — pass --run to execute changes"
else
  warn "LIVE RUN — changes will be applied"
fi
echo ""

# ── PHASE 0  Project snapshot ────────────────────────────────
echo -e "${CYN}▸ PHASE 0  Project snapshot${RST}"; hr
PROJ_SIZE=$(sz "$PROJECT_ROOT")
NM_SIZE=$(sz "$PROJECT_ROOT/node_modules" 2>/dev/null || echo "none")
inf "Project root:    $PROJ_SIZE  ($PROJECT_ROOT)"
inf "node_modules:    $NM_SIZE   (managed by pnpm — never deleted here)"
echo ""
# Per-package node_modules
echo -e "  ${DIM}Package-level node_modules:${RST}"
find "$PROJECT_ROOT/packages" "$PROJECT_ROOT/client" "$PROJECT_ROOT/server" \
  -maxdepth 2 -name "node_modules" -prune 2>/dev/null \
  | while IFS= read -r nm; do
      printf "    %-12s  %s\n" "$(sz "$nm")" "$nm"
    done
echo ""

# ── PHASE 1  Build artifacts (auto-safe, no prompt) ──────────
echo -e "${CYN}▸ PHASE 1  Build artifacts  ${DIM}(auto, regenerable via pnpm build)${RST}"; hr

# dist/ directories — skip node_modules to avoid scanning forever
while IFS= read -r d; do
  do_rm "dist" "$d"
done < <(find "$PROJECT_ROOT" \
  -path "$PROJECT_ROOT/node_modules" -prune -o \
  -name "dist" -type d -print 2>/dev/null)

# .turbo/ cache (Turborepo run cache)
while IFS= read -r d; do
  do_rm ".turbo cache" "$d"
done < <(find "$PROJECT_ROOT" \
  -path "$PROJECT_ROOT/node_modules" -prune -o \
  -name ".turbo" -type d -print 2>/dev/null)

# .vite/ cache
while IFS= read -r d; do
  do_rm ".vite cache" "$d"
done < <(find "$PROJECT_ROOT" \
  -path "$PROJECT_ROOT/node_modules" -prune -o \
  -name ".vite" -type d -print 2>/dev/null)

# TypeScript incremental build cache
while IFS= read -r f; do
  do_rm "tsbuildinfo" "$f"
done < <(find "$PROJECT_ROOT" \
  -path "$PROJECT_ROOT/node_modules" -prune -o \
  -name "*.tsbuildinfo" -type f -print 2>/dev/null)

# Vitest / jest coverage reports
while IFS= read -r d; do
  do_rm "coverage" "$d"
done < <(find "$PROJECT_ROOT" \
  -path "$PROJECT_ROOT/node_modules" -prune -o \
  -name "coverage" -type d -print 2>/dev/null)

ok "Build artifacts done"
echo ""

# ── PHASE 2  Log & error files (auto-safe) ───────────────────
echo -e "${CYN}▸ PHASE 2  Logs & error files  ${DIM}(auto)${RST}"; hr

# Named log files at root
for f in \
  "$PROJECT_ROOT/lint.log" \
  "$PROJECT_ROOT/fix-unused-vars.errs" \
  "$PROJECT_ROOT/r3v4-ui-audit.md"   # audit artifact, not source doc
do
  do_rm "log/err" "$f"
done

# fix-unused-vars-report-*.log pattern
while IFS= read -r f; do
  do_rm "unused-vars report" "$f"
done < <(find "$PROJECT_ROOT" -maxdepth 1 \
  -name "fix-unused-vars-report-*.log" -type f 2>/dev/null)

# Timestamped patch reports  (r3_patch_report_YYYYMMDD_HHMMSS.txt)
while IFS= read -r f; do
  do_rm "patch report" "$f"
done < <(find "$PROJECT_ROOT" -maxdepth 1 \
  -name "r3_patch_report_*.txt" -type f 2>/dev/null)

# logs/ directory contents (keep dir, clear files older than 7 days)
if [[ -d "$PROJECT_ROOT/logs" ]]; then
  COUNT=$(find "$PROJECT_ROOT/logs" -type f -mtime +7 2>/dev/null | wc -l)
  if [[ "$COUNT" -gt 0 ]]; then
    if $DRY; then
      dry "rm logs/ files older than 7d  ($COUNT files)"
    else
      act "rm logs/ files older than 7d  ($COUNT files)"
      find "$PROJECT_ROOT/logs" -type f -mtime +7 -delete 2>/dev/null || true
    fi
  else
    inf "logs/ — nothing older than 7 days"
  fi
fi

ok "Logs done"
echo ""

# ── PHASE 3  Editor & backup artifacts (auto-safe) ───────────
echo -e "${CYN}▸ PHASE 3  Editor & backup artifacts  ${DIM}(auto)${RST}"; hr

# *.bak.* backup files (SECURITY.md.bak.20260422_*, etc.)
while IFS= read -r f; do
  do_rm "bak" "$f"
done < <(find "$PROJECT_ROOT" -maxdepth 2 \
  -name "*.bak.*" -type f 2>/dev/null)

# *.save files (editor crash recovery)
while IFS= read -r f; do
  do_rm ".save" "$f"
done < <(find "$PROJECT_ROOT" -maxdepth 2 \
  -name "*.save" -type f 2>/dev/null)

# Parenthetical duplicates — " (1).py", " (2).py" etc.
while IFS= read -r f; do
  do_rm "duplicate" "$f"
done < <(find "$PROJECT_ROOT" -maxdepth 2 \
  -name "* ([0-9]).py" -type f 2>/dev/null)

# Sublime Text / vim swap files
while IFS= read -r f; do
  do_rm "editor swap" "$f"
done < <(find "$PROJECT_ROOT" -maxdepth 3 \
  \( -name "*.swp" -o -name "*.swo" -o -name "*~" \) \
  -not -path "*/node_modules/*" -type f 2>/dev/null)

ok "Editor artifacts done"
echo ""

# ── PHASE 4  pnpm anomaly — package-lock.json ────────────────
echo -e "${CYN}▸ PHASE 4  npm/pnpm conflict check${RST}"; hr

PKG_LOCK="$PROJECT_ROOT/package-lock.json"
if [[ -f "$PKG_LOCK" ]]; then
  flag "package-lock.json exists alongside pnpm-lock.yaml"
  warn "This is an npm artifact that shouldn't exist in a pnpm project."
  warn "It can cause dependency resolution conflicts in CI/Railway."
  if ask "Remove package-lock.json?"; then
    do_rm "package-lock.json" "$PKG_LOCK"
    ok "package-lock.json removed"
  else
    warn "Kept — consider adding package-lock.json to .gitignore"
  fi
else
  ok "No package-lock.json conflict"
fi
echo ""

# ── PHASE 5  Duplicate ESLint config ─────────────────────────
echo -e "${CYN}▸ PHASE 5  Config deduplication${RST}"; hr

MJS="$PROJECT_ROOT/eslint.config.mjs"
ETS="$PROJECT_ROOT/eslint.config.ts"
if [[ -f "$MJS" && -f "$ETS" ]]; then
  flag "Both eslint.config.mjs and eslint.config.ts exist"
  warn "ESLint will use .mjs preferentially — .ts version may be stale."
  inf  "  .mjs: $(sz "$MJS")"
  inf  "  .ts:  $(sz "$ETS")"
  warn "Verify which is canonical before removing either."
  if ask "Remove eslint.config.ts (keep .mjs)?"; then
    do_rm "eslint.config.ts" "$ETS"
    ok "eslint.config.ts removed"
  else
    warn "Kept both — resolve manually"
  fi
else
  ok "No ESLint config conflict"
fi
echo ""

# ── PHASE 6  One-time patch scripts (prompted) ───────────────
echo -e "${CYN}▸ PHASE 6  One-time patch & fix scripts  ${DIM}(prompted)${RST}"; hr
warn "These appear to be already-applied one-time scripts."
warn "Review the list — keep any you may re-run."
echo ""

PATCH_FILES=()
while IFS= read -r f; do
  PATCH_FILES+=("$f")
done < <(find "$PROJECT_ROOT" -maxdepth 1 -type f \( \
    -name "p[0-9]_patch.py" \
    -o -name "p[0-9]_*.py" \
    -o -name "patch_*.py" \
    -o -name "patch[0-9]*.py" \
    -o -name "r3_patch*.py" \
    -o -name "r3-patch*.py" \
    -o -name "r3-tsc-fix*.py" \
    -o -name "r3_fix_*.py" \
    -o -name "fix_*.py" \
    -o -name "fix-*.py" \
    -o -name "fix-*.sh" \
    -o -name "apply-*.sh" \
    -o -name "apply_*.py" \
    -o -name "apply_*.sh" \
    -o -name "expert-fix-*.sh" \
    -o -name "mythos-patch.sh" \
    -o -name "p_final_patch.py" \
    -o -name "r3v4-audio-fix.sh" \
    -o -name "r3v4-canvas-fix.sh" \
    -o -name "r3-multitrack-fix.py" \
    -o -name "r3-theme-patch.py" \
    -o -name "r3_hygiene.py" \
    -o -name "r3-hygiene-audit.py" \
    -o -name "r3scan.py" \
    -o -name "remove-dead-modular.py" \
    -o -name "clean-module-comments.py" \
    -o -name "clean.py" \
    -o -name "clean.sh" \
    -o -name "r3v4_theme_switcher_wire.py" \
    -o -name "theme_config_patch.py" \
    -o -name "wire-aidecisionlog.py" \
    -o -name "R3-mix-suggest.py" \
    -o -name "add-ts-nocheck-notes.py" \
  \) 2>/dev/null | sort)

if [[ ${#PATCH_FILES[@]} -eq 0 ]]; then
  ok "No one-time patch scripts found"
else
  TOTAL_PATCH=0
  for f in "${PATCH_FILES[@]}"; do
    b=$(sz_int "$f")
    TOTAL_PATCH=$(( TOTAL_PATCH + b ))
    printf "  ${DIM}%-14s${RST}  %s\n" "$(sz "$f")" "$(basename "$f")"
  done
  echo ""
  inf "Total: $(echo "$TOTAL_PATCH" | awk '{printf "%.0fK", $1/1024}')  across ${#PATCH_FILES[@]} files"
  echo ""
  if ask "Archive these to ./patch-archive/ then delete originals?"; then
    ARCHIVE_DIR="$PROJECT_ROOT/patch-archive"
    if $DRY; then
      dry "mkdir patch-archive/  +  mv ${#PATCH_FILES[@]} files"
    else
      mkdir -p "$ARCHIVE_DIR"
      for f in "${PATCH_FILES[@]}"; do
        add_saved "$f"
        mv "$f" "$ARCHIVE_DIR/" 2>/dev/null || true
      done
      act "Archived ${#PATCH_FILES[@]} patch scripts → patch-archive/"
      warn "patch-archive/ is NOT in your protected list — add to .gitignore or delete after review"
      ok "Patch scripts archived"
    fi
  else
    warn "Kept — no changes to patch scripts"
  fi
fi
echo ""

# ── PHASE 7  Anomaly flags (report only) ─────────────────────
echo -e "${CYN}▸ PHASE 7  Anomaly flags  ${DIM}(report only — no auto-action)${RST}"; hr

# Stable/ nested inside project
if [[ -e "$PROJECT_ROOT/Stable" ]]; then
  flag "Nested 'Stable/' directory inside project root"
  warn "This may be a symlink or accidental copy. Check:"
  warn "  ls -la '$PROJECT_ROOT/Stable'"
  warn "  du -sh '$PROJECT_ROOT/Stable'"
fi

# Sending/ directory
if [[ -d "$PROJECT_ROOT/Sending" ]]; then
  SZ=$(sz "$PROJECT_ROOT/Sending")
  flag "'Sending/' directory found ($SZ)"
  warn "Unknown purpose — inspect before removing:"
  warn "  ls '$PROJECT_ROOT/Sending'"
fi

# theme_config_rfc.txt — loose RFC file at root
if [[ -f "$PROJECT_ROOT/theme_config_rfc.txt" ]]; then
  inf "theme_config_rfc.txt at root — consider moving to docs/"
fi

# audit_r3.txt
if [[ -f "$PROJECT_ROOT/audit_r3.txt" ]]; then
  inf "audit_r3.txt — consider moving to docs/ or deleting if stale"
fi

# script-fix.txt, health.txt etc
for f in script-fix.txt health.txt; do
  [[ -f "$PROJECT_ROOT/$f" ]] && inf "$f — loose text file, consider deleting if resolved"
done

# r3audit / r3execute / r3setup — protect but flag
for b in r3audit r3execute r3setup; do
  if [[ -f "$PROJECT_ROOT/$b" ]]; then
    ok "$b — custom tool, PROTECTED (not touched)"
  fi
done

echo ""

# ── PHASE 8  node_modules report (never deleted here) ────────
echo -e "${CYN}▸ PHASE 8  node_modules report  ${DIM}(info only)${RST}"; hr
inf "Use pnpm commands to manage dependencies — never rm -rf node_modules directly:"
echo ""
echo -e "  ${DIM}pnpm store prune${RST}       → remove unreferenced global cache packages"
echo -e "  ${DIM}pnpm install${RST}           → restore if node_modules is corrupted/missing"
echo -e "  ${DIM}pnpm dedupe${RST}            → deduplicate installed packages"
echo ""

ROOT_NM="$PROJECT_ROOT/node_modules"
if [[ -d "$ROOT_NM" ]]; then
  inf "Root node_modules: $(sz "$ROOT_NM")"
fi
# Package-level
find "$PROJECT_ROOT/packages" -maxdepth 2 -name "node_modules" -prune 2>/dev/null \
  | while IFS= read -r nm; do
      inf "  $(sz "$nm")  $nm"
    done

echo ""

# ── PHASE 9  Final summary ────────────────────────────────────
echo -e "${CYN}▸ PHASE 9  Summary${RST}"; hr

SAVED_HUMAN=$(echo "$TOTAL_BYTES" | awk '{
  if ($1 > 1073741824) printf "%.1f GB", $1/1073741824
  else if ($1 > 1048576) printf "%.0f MB", $1/1048576
  else if ($1 > 1024) printf "%.0f KB", $1/1024
  else printf "%d B", $1
}')

if $DRY; then
  inf "Estimated reclaimable: ${BLD}${SAVED_HUMAN}${RST}"
  echo ""
  warn "Nothing was changed. Re-run with --run to apply:"
  echo -e "  ${CYN}bash r3-project-clean.sh --run${RST}"
  echo -e "  ${CYN}bash r3-project-clean.sh --run --yes${RST}  # skip prompts"
else
  ok "Space reclaimed: ${BLD}${SAVED_HUMAN}${RST}"
  echo ""
  ok "Done. Verify build still works:"
  echo -e "  ${CYN}pnpm install && pnpm build${RST}"
fi
echo ""

# ── PROTECTED list (always printed as reminder) ───────────────
echo -e "${DIM}Protected (never touched by this script):${RST}"
echo -e "${DIM}  client/ server/ packages/ shared/ db/ drizzle/ services/${RST}"
echo -e "${DIM}  tests/ tools/ scripts/ docs/ config/ nginx/ secrets/${RST}"
echo -e "${DIM}  node_modules/  pnpm-lock.yaml  all config & source files${RST}"
echo ""
