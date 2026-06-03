#!/usr/bin/env bash
# run_all_patches_v2.sh
# Mythos audit 2026-04-22 — F-10 + C-01 + C-03 remediation (REVISED)
#
# This version uses the v2 patches that fix:
#  - C-01: Use .pnpmrc instead of deprecated package.json.pnpm field
#  - F-10: Revised assertion logic that doesn't count comment mentions
#  - C-03: Remove duplicate table definitions
#
# Usage (from ~/Stable):
#   bash run_all_patches_v2.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'; BOLD='\033[1m'

ok()  { echo -e "${GREEN}[ OK ]${RESET}  $*"; }
err() { echo -e "${RED}[ERR ]${RESET}  $*"; }
hdr() { echo -e "\n${BOLD}${YELLOW}━━━ $* ━━━${RESET}"; }

ERRORS=0

run_patch() {
  local label="$1"; local script="$2"
  hdr "${label}"
  if python3 "${SCRIPT_DIR}/${script}"; then
    ok "${label} complete"
    return 0
  else
    err "${label} FAILED"
    ((ERRORS++)) || true
    return 1
  fi
}

run_bash() {
  local label="$1"; local script="$2"
  hdr "${label}"
  if bash "${SCRIPT_DIR}/${script}"; then
    ok "${label} complete"
    return 0
  else
    err "${label} FAILED"
    ((ERRORS++)) || true
    return 1
  fi
}

tsc_gate() {
  local label="$1"
  echo -e "\n  ${YELLOW}→ TSC check: ${label}${RESET}"
  if pnpm tsc --noEmit 2>&1 | head -100; then
    ok "tsc clean after ${label}"
    return 0
  else
    local exit_code=${PIPESTATUS[0]}
    if [[ $exit_code -ne 0 ]]; then
      err "tsc errors after ${label}"
      echo "       (first 100 lines shown; full output in run.log)"
      ((ERRORS++)) || true
      return 1
    fi
  fi
}

hdr "Mythos patch runner v2 — F-10 + C-01 + C-03"
echo "  Working dir: $(pwd)"
echo "  Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Sanity check
if [[ ! -f "package.json" || ! -d "server/routers" ]]; then
  err "Not in ~/Stable root. cd ~/Stable first."
  exit 1
fi

# ─── Run patches ──────────────────────────────────────────────────────────────

run_patch "C-01 v2 — esbuild override (.pnpmrc)" "fix_c01_esbuild_override_v2.py"

run_patch "F-10 v2 — prompt injection sanitiser" "fix_f10_prompt_injection_v2.py"
tsc_gate  "F-10 v2" || true

run_bash "C-03 FIX — remove duplicate table definitions" "fix_c03_duplicates.sh"
tsc_gate "C-03 cleanup" || true

# ─── Summary ──────────────────────────────────────────────────────────────────

hdr "SUMMARY"
if [[ $ERRORS -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All patches applied — 0 errors${RESET}"
  echo ""
  echo "  Remaining manual steps:"
  echo "  1. pnpm install                       (C-01 — apply esbuild override)"
  echo "  2. pnpm drizzle-kit generate          (C-03 — generate migration)"
  echo "  3. pnpm drizzle-kit migrate           (C-03 — run 0002_c03 migration)"
  echo "  4. pnpm tsc --noEmit                  (final clean check)"
  echo "  5. Commit and update SECURITY.md → mark F-10, C-01, C-03 as Fixed"
else
  echo -e "${RED}${BOLD}Completed with ${ERRORS} error(s) — review above${RESET}"
  exit 1
fi
