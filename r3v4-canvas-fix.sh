#!/usr/bin/env bash
###############################################################################
# R3v4 Canvas Gradient + AudioContext Fix -- WIRE-Protocol Deployment
# Version: 1.1.0 | Date: 2026-05-04 | Author: R3Team
# Reference: R3v4_PRD_v5.pdf sections 2, 4.1, 4.2, 7.1, 7.5, 8.1, WIRE.txt
###############################################################################
#
# ACTUAL BUGS FROM CONSOLE:
#   1. CRITICAL: addColorStop CanvasGradient SyntaxError in collaborative-daw-pro.tsx:719
#      'var(--accent-cyan)30' is NOT valid Canvas color syntax -- CSS vars don't work in Canvas 2D.
#      PRD VIOLATION: section 8.1 -- No direct color hex in className; Canvas API needs resolved hex.
#   2. INFO: AudioContext warnings -- already handled by audio.ts user gesture resume.
#   3. tRPC subscription error -- separate auth/DB issue, out of scope for this patch.
#
# FIX STRATEGY:
#   - Resolve CSS variables to hex before passing to CanvasGradient.addColorStop()
#   - Use getComputedStyle() or canonical T-object hex values (#a3e635, #bfff00)
#   - Maintain PRD section 4.2 palette contract
#
###############################################################################

set -euo pipefail
IFS=$'\n\t'

readonly SCRIPT_VERSION="1.1.0"
readonly SCRIPT_DATE="2026-05-04"
readonly PROJECT_ROOT="${HOME}/Stable"
readonly CLIENT_DIR="${PROJECT_ROOT}/client"
readonly NODE_REQUIRED="22"
readonly PNPM_REQUIRED="10.33"
readonly ESBUILD_PIN="0.25.12"

readonly TS=$(date +%Y%m%d_%H%M%S)
readonly BAK_DIR="${PROJECT_ROOT}/.bak/${TS}"
LOG_FILE="${PROJECT_ROOT}/.logs/r3v4-canvas-fix-${TS}.log"
mkdir -p "$(dirname "$LOG_FILE")" "${BAK_DIR}"

log() {
    local level="$1"; shift
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${level}] $*" | tee -a "$LOG_FILE"
}
info() { log "INFO" "$@"; }
warn() { log "WARN" "$@"; }
fatal() { log "FATAL" "$@"; exit 1; }

info "============================================================"
info "TRIPLE-CHECK PHASE -- Canvas Gradient Bug Fix"
info "============================================================"

# [PASS 1] Machine check
HOSTNAME=$(hostname 2>/dev/null || echo 'unknown')
if [[ "$HOSTNAME" != *"kali"* ]]; then fatal "Must run on Kali"; fi
info "  PASS: Kali host confirmed"

# [PASS 2] Node 22.x
NODE_V=$(node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1) || NODE_V="0"
if [[ "$NODE_V" != "$NODE_REQUIRED" ]]; then
    fatal "Node.js ${NODE_REQUIRED}.x required, found: $(node --version 2>/dev/null || echo 'none')"
fi
info "  PASS: Node.js $(node --version)"

# [PASS 3] pnpm 10.33.x
PNPM_V=$(pnpm --version 2>/dev/null | cut -d'.' -f1-2) || PNPM_V="0"
if [[ "$PNPM_V" != "$PNPM_REQUIRED" ]]; then
    fatal "pnpm ${PNPM_REQUIRED}.x required, found: $(pnpm --version 2>/dev/null || echo 'none')"
fi
info "  PASS: pnpm $(pnpm --version)"

# [PASS 4] Target file exists
TARGET_FILE="${CLIENT_DIR}/src/pages/collaborative-daw-pro.tsx"
if [[ ! -f "$TARGET_FILE" ]]; then
    ALT_PATHS=(
        "${CLIENT_DIR}/src/pages/collaborative-daw-pro.tsx"
        "${CLIENT_DIR}/src/components/collaborative-daw-pro.tsx"
        "${PROJECT_ROOT}/src/pages/collaborative-daw-pro.tsx"
    )
    for p in "${ALT_PATHS[@]}"; do
        if [[ -f "$p" ]]; then TARGET_FILE="$p"; break; fi
    done
    if [[ ! -f "$TARGET_FILE" ]]; then
        fatal "collaborative-daw-pro.tsx not found in any canonical path"
    fi
fi
info "  PASS: Target file found at: ${TARGET_FILE}"

# [PASS 5] Read-before-write -- inspect the buggy line
info "[PASS 5] READ-BEFORE-WRITE: Inspecting line ~719"
info "---------------------------------------------------------"
if command -v sed >/dev/null 2>&1; then
    sed -n '710,730p' "$TARGET_FILE" | while read line; do info "  ${line}"; done
else
    head -n 730 "$TARGET_FILE" | tail -n 20 | while read line; do info "  ${line}"; done
fi

# Confirm the bug pattern exists
if grep -q "var(--accent-cyan)" "$TARGET_FILE" 2>/dev/null; then
    info "  CONFIRMED: Found 'var(--accent-cyan)' bug pattern"
    BUG_COUNT=$(grep -c "var(--accent-cyan)" "$TARGET_FILE")
    info "  Occurrences: ${BUG_COUNT}"
elif grep -q "var(--" "$TARGET_FILE" 2>/dev/null; then
    info "  CONFIRMED: Found generic CSS var(--*) pattern in Canvas context"
    grep -n "var(--" "$TARGET_FILE" | while read line; do info "    ${line}"; done
else
    warn "  WARNING: CSS var pattern not found -- file may already be fixed or path is wrong"
    read -p "Continue anyway? [y/N] " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then fatal "Aborted by user"; fi
fi

info "============================================================"
info "TRIPLE-CHECK COMPLETE -- Proceeding with fix"
info "============================================================"

# -- Backup Phase --
info "BACKUP: Creating .bak files in ${BAK_DIR}"
cp "$TARGET_FILE" "${BAK_DIR}/$(basename "$TARGET_FILE").${TS}.bak"
info "  BACKUP: ${TARGET_FILE} -> ${BAK_DIR}/"

# -- Fix Phase -- Resolve CSS vars to hex for Canvas API --
info ""
info "============================================================"
info "APPLYING FIX: CSS var -> Hex resolution for CanvasGradient"
info "============================================================"

python3 << 'PYEOF'
import re
import sys

target_path = sys.argv[1]

with open(target_path, 'r') as f:
    content = f.read()

# Check if already fixed (idempotency)
if 'resolveCanvasColor' in content or 'getCanvasHex' in content:
    print('IDEMPOTENCY: Color resolver already present -- skipping')
    sys.exit(0)

# The bug: 'var(--accent-cyan)30' is trying to use CSS var with opacity 30%
# but Canvas 2D addColorStop expects valid CSS color strings, not CSS custom properties.
# CSS variables only work in DOM styling, NOT in Canvas 2D API.

helper_code = '''
// -- Canvas Color Resolver (injected by r3v4-canvas-fix.sh v1.1.0) --
// PRD section 4.2: CSS vars cannot be used directly in Canvas 2D API.
// This helper resolves CSS custom properties to computed hex values.
// Canonical palette: accent=#a3e635, neon-lime=#bfff00, etc.

const CANVAS_PALETTE: Record<string, string> = {
  '--accent-cyan': '#22d3ee',      // fallback if CSS var not found
  '--accent': '#a3e635',           // PRD T-object accent
  '--neon-lime': '#bfff00',        // PRD CSS var system
  '--bg': '#0a0a0a',
  '--surface': '#0d0d0d',
  '--text': '#e5e5e5',
  '--dim': '#555555',
  '--rec': '#ef4444',
};

function resolveCanvasColor(cssVarOrColor: string): string {
  // If it is a CSS custom property, resolve it
  if (cssVarOrColor.startsWith('var(')) {
    const varName = cssVarOrColor.replace(/^var\(/, '').replace(/\)$/, '').trim();
    
    // Try computed style from document
    if (typeof document !== 'undefined') {
      const testEl = document.documentElement;
      const computed = getComputedStyle(testEl).getPropertyValue(varName).trim();
      if (computed) {
        return computed;
      }
    }
    
    // Fallback to canonical palette
    return CANVAS_PALETTE[varName] || '#a3e635';
  }
  
  // If it has malformed suffix like 'var(--accent-cyan)30', extract and fix
  const malformedMatch = cssVarOrColor.match(/^var\((--[^)]+)\)(\d+)$/);
  if (malformedMatch) {
    const [, varName, opacityDigits] = malformedMatch;
    const opacity = parseInt(opacityDigits, 10) / 100;
    const baseColor = resolveCanvasColor(`var(${varName})`);
    // Convert hex to rgba for opacity support
    const hex = baseColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  
  // Pass through if already valid color
  return cssVarOrColor;
}

'''

# Find insertion point: after last import, before first function/component
lines = content.split('\n')
insert_idx = 0
for i, line in enumerate(lines):
    if line.strip().startswith('import '):
        insert_idx = i + 1

lines.insert(insert_idx, helper_code)
content = '\n'.join(lines)

# Now fix the specific addColorStop call at line ~719
# Replace: gradient.addColorStop(offset, 'var(--accent-cyan)30')
# With:    gradient.addColorStop(offset, resolveCanvasColor('var(--accent-cyan)30'))

# Pattern to match the buggy addColorStop calls
buggy_pattern = r"(\w+)\.addColorStop\(([^,]+),\s*['"]([^'"]+)['"]\)"

def fix_addColorStop(match: re.Match) -> str:
    gradient_var = match.group(1)
    offset = match.group(2)
    color_arg = match.group(3)
    
    # If color arg contains CSS var syntax, wrap with resolver
    if 'var(' in color_arg:
        return f"{gradient_var}.addColorStop({offset}, resolveCanvasColor('{color_arg}'))"
    
    # Otherwise leave unchanged
    return match.group(0)

fixed_content = re.sub(buggy_pattern, fix_addColorStop, content)

# Count replacements
original_count = len(re.findall(buggy_pattern, content))
fixed_count = len(re.findall(buggy_pattern, fixed_content))
replaced_count = original_count - fixed_count + len(re.findall(r"resolveCanvasColor", fixed_content))
print(f'Replaced {replaced_count} buggy addColorStop calls with resolveCanvasColor()')

with open(target_path, 'w') as f:
    f.write(fixed_content)

print(f'FIXED: {target_path} -- {len(fixed_content)} chars')
PYEOF

info "  FIX APPLIED: Canvas color resolution helper injected"

# -- Verification Phase -- Zero Drift Rule (PRD section 7.1) --
info ""
info "============================================================"
info "VERIFICATION PHASE -- Zero Drift Rule"
info "============================================================"

cd "$PROJECT_ROOT"

info "[VERIFY 1/4] TypeScript strict check: pnpm tsc --noEmit"
if pnpm tsc --noEmit 2>&1 | tee -a "$LOG_FILE"; then
    info "  PASS: Zero type errors"
else
    fatal "TYPE ERROR: pnpm tsc --noEmit failed -- rollback required"
fi

info "[VERIFY 2/4] ESLint check"
if pnpm eslint "$TARGET_FILE" --max-warnings 0 2>&1 | tee -a "$LOG_FILE"; then
    info "  PASS: ESLint clean"
else
    warn "  ESLint issues detected -- review required"
fi

info "[VERIFY 3/4] Theme token audit"
NON_TOKEN=$(grep -rn 'bg-black|text-white|border-green' "${CLIENT_DIR}/src/" 2>/dev/null | grep -v 'theme.css' | grep -v '\.bak' | head -10 || true)
if [[ -z "$NON_TOKEN" ]]; then
    info "  PASS: No non-token color violations"
else
    warn "  Potential violations:"
    echo "$NON_TOKEN" | while read line; do warn "    ${line}"; done
fi

info "[VERIFY 4/4] esbuild pin verification"
if ls node_modules/.pnpm/ 2>/dev/null | grep -q 'esbuild.*0.25.12'; then
    info "  PASS: esbuild 0.25.12 pinned"
else
    warn "  esbuild pin not verified -- check pnpm-lock.yaml"
fi

info ""
info "============================================================"
info "DEPLOYMENT COMPLETE"
info "============================================================"

info "Fixed file: ${TARGET_FILE}"
info "Backup:     ${BAK_DIR}/$(basename "$TARGET_FILE").${TS}.bak"
info "Log:        ${LOG_FILE}"

info "ROLLBACK:"
info "  cp ${BAK_DIR}/$(basename "$TARGET_FILE").${TS}.bak ${TARGET_FILE}"

info "NEXT STEPS:"
info "  1. Reload browser -- Canvas gradient error should be gone"
info "  2. Verify: No addColorStop SyntaxError in console"
info "  3. Run: pnpm vitest run"
info "  4. Commit: git add -A && git commit -m 'fix(canvas): resolve CSS vars to hex for Canvas 2D API (PRD 4.2, 8.1)'"

info "============================================================"
