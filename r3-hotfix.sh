#!/usr/bin/env bash
# r3-hotfix.sh — Targeted repair for App.tsx JSX break + DIM unbound var
# Run from: ~/Stable/R3 v4/
# Usage:    bash r3-hotfix.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PASS=0; FAIL=0
GRN='\033[0;32m'; RED='\033[0;31m'; CYN='\033[0;36m'; DIM='\033[2m'; RST='\033[0m'; BLD='\033[1m'
ok()      { echo -e "${GRN}✓${RST} $1"; PASS=$((PASS+1)); }
fail()    { echo -e "${RED}✗${RST} $1"; FAIL=$((FAIL+1)); }
info()    { echo -e "${CYN}→${RST} $1"; }
section() { echo -e "\n${BLD}${CYN}══ $1 ══${RST}"; }

APP="$ROOT/client/src/App.tsx"
UPGRADE="$ROOT/r3upgrade"

# ─────────────────────────────────────────────────────────────────────────────
section "Fix 1 — App.tsx route injection"
# ─────────────────────────────────────────────────────────────────────────────

[[ -f "$APP" ]] || { fail "App.tsx not found at $APP"; exit 1; }

info "Backing up App.tsx → App.tsx.bak"
cp "$APP" "${APP}.bak"

python3 << 'PYEOF'
import sys, re

path = "/home/r3/Stable/R3 v4/client/src/App.tsx"
with open(path) as f:
    src = f.read()

# ── Step 1: Remove every existing /arrangement route block (however mangled) ──
# Match any Route block that mentions /arrangement between <Route and </Route>
src = re.sub(
    r'\s*\{/\*[^*]*arrangement[^*]*\*/\}\s*\n\s*<Route path=["\']\/arrangement["\'][^>]*>.*?</Route>\s*\n?',
    '\n',
    src,
    flags=re.DOTALL
)
# Also catch if it was injected without the comment
src = re.sub(
    r'\s*<Route path=["\']\/arrangement["\'][^>]*>.*?</Route>\s*\n?',
    '\n',
    src,
    flags=re.DOTALL
)

# ── Step 2: Ensure ArrangementPage lazy import exists ──
if "ArrangementPage" not in src:
    # Insert before InstrumentPage lazy import
    src = re.sub(
        r"(const InstrumentPage\s*=\s*lazy)",
        "const ArrangementPage = lazy(() => import('@/pages/arrangement'));\n\\1",
        src
    )
    print("✓ Added ArrangementPage lazy import")
else:
    print("✓ ArrangementPage lazy import already present")

# ── Step 3: Re-insert /arrangement route cleanly ──
# Anchor: the closing </Route> of the /visuals route, followed by the 404 comment.
# We find the 404 comment precisely and insert before it.

ARRANGEMENT_ROUTE = """
      {/* ── /arrangement → Full DAW (protected) ── */}
      <Route path="/arrangement">
        {() => (
          <ProtectedRoute>
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback message="Loading DAW..." />}>
                <ArrangementPage />
              </Suspense>
            </ErrorBoundary>
          </ProtectedRoute>
        )}
      </Route>
"""

# Find the 404 block — it is always the last <Route> with no path inside <Switch>
# The safest anchor is the closing of the /visuals route + the blank line + the 404 comment
ANCHOR_404 = "      {/* ── 404 ── */}"

if ANCHOR_404 not in src:
    # Fallback: try without the em-dashes
    ANCHOR_404_FALLBACK = "404"
    # Find the last <Route> without a path argument — that's the 404 catch-all
    # Insert the arrangement route before the last bare <Route>
    last_route_idx = src.rfind("\n      <Route>\n")
    if last_route_idx == -1:
        print("ERROR: Could not locate 404 Route anchor", file=sys.stderr)
        sys.exit(1)
    src = src[:last_route_idx] + "\n" + ARRANGEMENT_ROUTE + src[last_route_idx:]
    print("✓ Added /arrangement route (fallback anchor)")
else:
    src = src.replace(ANCHOR_404, ARRANGEMENT_ROUTE + "      " + "{/* ── 404 ── */}")
    print("✓ Added /arrangement route (primary anchor)")

# ── Step 4: Validate JSX balance (basic sanity check) ──
opens  = src.count("<Route")
closes = src.count("</Route>")
if opens != closes:
    print(f"WARNING: Route tag mismatch — {opens} open, {closes} close", file=sys.stderr)
else:
    print(f"✓ Route tags balanced ({opens} open, {closes} close)")

# ── Step 5: Write ──
with open(path, "w") as f:
    f.write(src)
print("✓ App.tsx written")
PYEOF

ok "App.tsx route repair done"

# ─────────────────────────────────────────────────────────────────────────────
section "Fix 2 — r3upgrade DIM unbound variable"
# ─────────────────────────────────────────────────────────────────────────────

[[ -f "$UPGRADE" ]] || { info "r3upgrade not found — skipping"; }

if [[ -f "$UPGRADE" ]]; then
  # r3upgrade defines RST, GRN, RED, CYN, BLD but not DIM
  # Add DIM next to the existing color declarations
  if ! grep -q '^DIM=' "$UPGRADE" 2>/dev/null; then
    # Insert after the line that defines RST=
    sed -i '/^RST=/a DIM='"'"'\033[2m'"'"'' "$UPGRADE"
    ok "Added DIM='\033[2m' to r3upgrade"
  else
    ok "DIM already defined in r3upgrade"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Fix 3 — r3-repair.sh DIM unbound variable"
# ─────────────────────────────────────────────────────────────────────────────

REPAIR="$ROOT/r3-repair.sh"
if [[ -f "$REPAIR" ]]; then
  if ! grep -q 'DIM=' "$REPAIR" 2>/dev/null; then
    sed -i "s/GRN=.*RST=.*/& DIM='\\\\033[2m'/" "$REPAIR"
    ok "Added DIM to r3-repair.sh"
  else
    ok "DIM already in r3-repair.sh"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Fix 4 — Validate App.tsx parse with TypeScript"
# ─────────────────────────────────────────────────────────────────────────────

info "Running tsc parse check on App.tsx..."
cd "$ROOT"

# Quick syntax-only check (no full build, just check App.tsx parses)
if command -v node &>/dev/null; then
  node - << 'JSEOF'
const fs   = require("fs");
const path = require("path");

const src = fs.readFileSync(
  path.join(process.env.HOME, "Stable/R3 v4/client/src/App.tsx"),
  "utf8"
);

// Count JSX structural balance
const routeOpens  = (src.match(/<Route[\s>]/g)  || []).length;
const routeCloses = (src.match(/<\/Route>/g)    || []).length;
const switchOpens = (src.match(/<Switch/g)      || []).length;
const switchClose = (src.match(/<\/Switch>/g)   || []).length;

console.log(`  <Route>  open=${routeOpens}  close=${routeCloses}  ${routeOpens===routeCloses?"✓ balanced":"✗ MISMATCH"}`);
console.log(`  <Switch> open=${switchOpens}  close=${switchClose}  ${switchOpens===switchClose?"✓ balanced":"✗ MISMATCH"}`);

// Check /arrangement appears
const hasRoute = src.includes('"/arrangement"') || src.includes("'/arrangement'");
console.log(`  /arrangement route present: ${hasRoute ? "✓" : "✗ MISSING"}`);

// Check ArrangementPage
const hasImport = src.includes("ArrangementPage");
console.log(`  ArrangementPage import:     ${hasImport ? "✓" : "✗ MISSING"}`);

if (routeOpens !== routeCloses || switchOpens !== switchClose || !hasRoute || !hasImport) {
  process.exit(1);
}
JSEOF
  ok "App.tsx structural validation passed"
else
  info "node not available for validation — skipping"
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Fix 5 — Arrangement page default export guard"
# ─────────────────────────────────────────────────────────────────────────────

ARRANGEMENT_PAGE="$ROOT/client/src/pages/arrangement.tsx"
if [[ -f "$ARRANGEMENT_PAGE" ]]; then
  if ! grep -q "^export default" "$ARRANGEMENT_PAGE"; then
    info "arrangement.tsx missing default export — appending..."
    echo "" >> "$ARRANGEMENT_PAGE"
    # Check if a named export exists and wrap it
    if grep -q "^export function ArrangementPage" "$ARRANGEMENT_PAGE"; then
      sed -i 's/^export function ArrangementPage/function ArrangementPage/' "$ARRANGEMENT_PAGE"
      echo "export default ArrangementPage;" >> "$ARRANGEMENT_PAGE"
      ok "Converted named export to default export in arrangement.tsx"
    fi
  else
    ok "arrangement.tsx has default export"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
section "Summary"
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${BLD}${CYN}════════════════════════════════════════════════════${RST}"
echo -e "${BLD}${CYN}  HOTFIX COMPLETE — Pass: $PASS / Fail: $FAIL${RST}"
echo -e "${BLD}${CYN}════════════════════════════════════════════════════${RST}"
echo ""
echo -e "${DIM}  Restart dev server:${RST}"
echo -e "${DIM}    pkill -f 'tsx|vite' 2>/dev/null; sleep 1${RST}"
echo -e "${DIM}    pnpm dev${RST}"
echo -e "${DIM}    → http://localhost:5173/arrangement${RST}"
echo ""

exit $FAIL
