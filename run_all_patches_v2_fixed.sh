#!/usr/bin/env bash
# run_all_patches_v2.sh (FIXED)
# Mythos audit 2026-04-22 — F-10 + C-01 + C-03 remediation
#
# This version uses the v2 patches that fix:
#  - C-01: Use .pnpmrc instead of deprecated package.json.pnpm field
#  - F-10: Revised assertion logic that doesn't count comment mentions
#  - C-03: Remove duplicate table definitions
#
# Usage (from ~/Stable):
#   bash run_all_patches_v2_fixed.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RESET='\033[0m'; BOLD='\033[1m'

ok()  { echo -e "${GREEN}[ OK ]${RESET}  $*"; }
err() { echo -e "${RED}[ERR ]${RESET}  $*"; }
wrn() { echo -e "${YELLOW}[WRN]${RESET}  $*"; }
hdr() { echo -e "\n${BOLD}${YELLOW}━━━ $* ━━━${RESET}"; }

ERRORS=0
WARNINGS=0

run_patch() {
  local label="$1"; local script="$2"
  hdr "${label}"
  
  # Check if script exists
  if [[ ! -f "${SCRIPT_DIR}/${script}" ]]; then
    err "Script not found: ${script}"
    ((ERRORS++)) || true
    return 1
  fi
  
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
  
  # Check if script exists
  if [[ ! -f "${SCRIPT_DIR}/${script}" ]]; then
    err "Script not found: ${script}"
    ((ERRORS++)) || true
    return 1
  fi
  
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
  local strict="${2:-false}"  # Set to 'true' to fail on tsc errors
  
  echo -e "\n  ${YELLOW}→ TSC check: ${label}${RESET}"
  if pnpm tsc --noEmit 2>&1 | tee tsc_${label}.log | head -100; then
    ok "tsc clean after ${label}"
    return 0
  else
    local exit_code=${PIPESTATUS[0]}
    if [[ $exit_code -ne 0 ]]; then
      wrn "tsc errors after ${label} (full output in tsc_${label}.log)"
      if [[ "$strict" == "true" ]]; then
        ((ERRORS++)) || true
        return 1
      else
        # Non-blocking warning
        ((WARNINGS++)) || true
        return 0
      fi
    fi
  fi
}

hdr "Mythos patch runner v2 — F-10 + C-01 + C-03 (FIXED)"
echo "  Working dir: $(pwd)"
echo "  Script dir:  ${SCRIPT_DIR}"
echo "  Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Sanity check
if [[ ! -f "package.json" || ! -d "server/routers" ]]; then
  err "Not in ~/Stable root. cd ~/Stable first."
  exit 1
fi

# ─── Run patches ──────────────────────────────────────────────────────────────

run_patch "C-01 v2 — esbuild override (.pnpmrc)" "fix_c01_esbuild_override_v2.py"

run_patch "F-10 v2 — prompt injection sanitiser" "fix_f10_prompt_injection_v2.py"
tsc_gate "F-10 v2" "false" || true

# Try both possible C-03 script names
if [[ -f "${SCRIPT_DIR}/fix_c03_duplicates.sh" ]]; then
  run_bash "C-03 FIX — remove duplicate table definitions" "fix_c03_duplicates.sh"
elif [[ -f "${SCRIPT_DIR}/fixduplicate.sh" ]]; then
  wrn "Using fallback script name: fixduplicate.sh (expected: fix_c03_duplicates.sh)"
  run_bash "C-03 FIX — remove duplicate table definitions" "fixduplicate.sh"
else
  err "C-03 script not found (tried: fix_c03_duplicates.sh, fixduplicate.sh)"
  ((ERRORS++)) || true
fi

tsc_gate "C-03 cleanup" "false" || true

# ─── Summary ──────────────────────────────────────────────────────────────────

hdr "SUMMARY"
echo "  Errors: $ERRORS | Warnings: $WARNINGS"

if [[ $ERRORS -eq 0 ]]; then
  echo -e "${GREEN}${BOLD}All patches applied successfully${RESET}"
  echo ""
  echo "  Next steps:"
  echo "  1. pnpm install                       (apply esbuild override from C-01)"
  echo "  2. pnpm drizzle-kit generate          (C-03 — generate migration)"
  echo "  3. pnpm drizzle-kit migrate           (C-03 — apply 0002_c03 migration)"
  echo "  4. pnpm tsc --noEmit                  (verify full TypeScript build)"
  echo "  5. Review tsc errors — may need environment setup (node types, etc)"
  echo "  6. Commit and update SECURITY.md → mark F-10, C-01, C-03 as Fixed"
  echo ""
  [[ $WARNINGS -gt 0 ]] && echo "  ⚠ Note: $WARNINGS warning(s) above — review if needed"
else
  echo -e "${RED}${BOLD}Completed with ${ERRORS} error(s) — review above${RESET}"
  exit 1
fi
