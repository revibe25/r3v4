#!/usr/bin/env bash
# run_all_patches.sh
# Mythos audit 2026-04-22 — F-10 + C-01 + C-03 remediation runner
#
# Usage (from ~/Stable):
#   bash scripts/security/run_all_patches.sh
#
# Order:
#   1. C-01  — esbuild pnpm.overrides (no TSC impact)
#   2. F-10  — prompt injection sanitiser (TSC gate after)
#   3. C-03  — (userId,date) schema + migration emit (TSC gate after)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PATCHES_DIR="${SCRIPT_DIR}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'; BOLD='\033[1m'

ok()  { echo -e "${GREEN}[ OK ]${RESET}  $*"; }
err() { echo -e "${RED}[ERR ]${RESET}  $*"; }
hdr() { echo -e "\n${BOLD}${YELLOW}━━━ $* ━━━${RESET}"; }

ERRORS=0

run_patch() {
  local label="$1"; local script="$2"
  hdr "${label}"
  if python3 "${PATCHES_DIR}/${script}"; then
    ok "${label} complete"
  else
    err "${label} FAILED"
    ((ERRORS++)) || true
  fi
}

tsc_gate() {
  local label="$1"
  echo -e "\n  ${YELLOW}→ TSC check: ${label}${RESET}"
  if pnpm tsc --noEmit 2>&1; then
    ok "tsc clean after ${label}"
  else
    err "tsc errors after ${label} — review output above before proceeding"
    ((ERRORS++)) || true
  fi
}

hdr "Mythos patch runner — F-10 + C-01 + C-03"
echo "  Working dir: $(pwd)"
echo "  Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Sanity check
if [[ ! -f "package.json" || ! -d "server/routers" ]]; then
  err "Not in ~/Stable root. cd ~/Stable first."
  exit 1
fi

run_patch "C-01 — esbuild pnpm.overrides"    "fix_c01_esbuild_override.py"
run_patch "F-10 — prompt injection sanitiser" "fix_f10_prompt_injection.py"
tsc_gate  "F-10"
run_patch "C-03 — (userId,date) daily window" "fix_c03_session_bypass.py"
tsc_gate  "C-03"

hdr "SUMMARY"
if [[ $ERRORS -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All patches applied — 0 errors${RESET}"
  echo ""
  echo "  Remaining manual steps:"
  echo "  1. pnpm install                    (C-01 — relock esbuild override)"
  echo "  2. pnpm drizzle-kit generate       (C-03 — generate migration from new schema)"
  echo "  3. pnpm drizzle-kit migrate        (C-03 — apply 0002_c03 migration)"
  echo "  4. pnpm tsc --noEmit               (final clean check)"
  echo "  5. Update SECURITY.md: mark F-10, C-01, C-03 as Fixed"
else
  echo -e "${RED}${BOLD}Completed with ${ERRORS} error(s) — review above before proceeding${RESET}"
  exit 1
fi
