#!/usr/bin/env bash
# r3-definitive-fix.sh
# Reads the ACTUAL App.tsx, diagnoses the structure, then surgically
# inserts /arrangement inside <Switch> — no anchor guessing.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/client/src/App.tsx"
GRN='\033[0;32m'; RED='\033[0;31m'; CYN='\033[0;36m'; DIM='\033[2m'; RST='\033[0m'; BLD='\033[1m'
ok()   { echo -e "${GRN}✓${RST} $1"; }
fail() { echo -e "${RED}✗${RST} $1"; exit 1; }
info() { echo -e "${CYN}→${RST} $1"; }
section() { echo -e "\n${BLD}${CYN}══ $1 ══${RST}"; }

[[ -f "$APP" ]] || fail "App.tsx not found: $APP"

section "Step 1 — Diagnose current App.tsx state"

python3 << 'PYEOF'
import sys

path = "/home/r3/Stable/R3 v4/client/src/App.tsx"
with open(path) as f:
    lines = f.readlines()

src = "".join(lines)

# Print lines around Switch open/close
switch_open  = [(i+1, l.rstrip()) for i, l in enumerate(lines) if "<Switch" in l]
switch_close = [(i+1, l.rstrip()) for i, l in enumerate(lines) if "</Switch>" in l]
arrangement  = [(i+1, l.rstrip()) for i, l in enumerate(lines) if "arrangement" in l.lower()]

print(f"\n  Total lines: {len(lines)}")
print(f"\n  <Switch> open lines:  {switch_open}")
print(f"  </Switch> close lines: {switch_close}")
print(f"\n  Lines containing 'arrangement':")
for ln, txt in arrangement:
    print(f"    {ln:4d}: {txt}")

if not switch_open:
    print("ERROR: No <Switch> found", file=sys.stderr)
    sys.exit(1)
if not switch_close:
    print("ERROR: No </Switch> found", file=sys.stderr)
    sys.exit(1)
PYEOF

section "Step 2 — Surgically rewrite Router function"

info "Backing up App.tsx → App.tsx.bak2"
cp "$APP" "${APP}.bak2"

python3 << 'PYEOF'
import sys, re

path = "/home/r3/Stable/R3 v4/client/src/App.tsx"
with open(path) as f:
    src = f.read()

# ── 1. Strip ALL existing /arrangement route blocks (any form) ──────────────
# Remove comment + Route block pairs
src = re.sub(
    r'[ \t]*\{/\*[^*]*?arrangement[^*]*?\*/\}[ \t]*\n[ \t]*<Route path=["\']\/arrangement["\'][^>]*>.*?</Route>[ \t]*\n?',
    '',
    src,
    flags=re.DOTALL | re.IGNORECASE
)
# Remove bare Route blocks (no preceding comment)
src = re.sub(
    r'[ \t]*<Route path=["\']\/arrangement["\'][^>]*>.*?</Route>[ \t]*\n?',
    '',
    src,
    flags=re.DOTALL
)

# ── 2. Verify ArrangementPage lazy import ───────────────────────────────────
if "ArrangementPage" not in src:
    # Add before first lazy() call
    src = re.sub(
        r"(const \w+Page\s*=\s*lazy\()",
        "const ArrangementPage = lazy(() => import('@/pages/arrangement'));\n\\1",
        src,
        count=1
    )
    print("✓ Added ArrangementPage lazy import")
else:
    print("✓ ArrangementPage lazy import already present")

# ── 3. Find </Switch> position — insert our route BEFORE it ─────────────────
ROUTE_BLOCK = """\
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

# Find the </Switch> closing tag
switch_close_match = list(re.finditer(r'[ \t]*</Switch>', src))
if not switch_close_match:
    print("ERROR: </Switch> not found", file=sys.stderr)
    sys.exit(1)

# Use the FIRST </Switch> (there should only be one)
m = switch_close_match[0]
insert_pos = m.start()

# Insert our route block right before </Switch>
src = src[:insert_pos] + ROUTE_BLOCK + "\n" + src[insert_pos:]
print("✓ Inserted /arrangement route before </Switch>")

# ── 4. Validate balance ─────────────────────────────────────────────────────
route_opens  = len(re.findall(r'<Route[\s>]', src))
route_closes = len(re.findall(r'</Route>',    src))
switch_opens = len(re.findall(r'<Switch[\s>]', src))
switch_close = len(re.findall(r'</Switch>',   src))

print(f"  <Route>  open={route_opens}  close={route_closes}  {'✓' if route_opens==route_closes else '✗ MISMATCH'}")
print(f"  <Switch> open={switch_opens}  close={switch_close}  {'✓' if switch_opens==switch_close else '✗ MISMATCH'}")

if route_opens != route_closes or switch_opens != switch_close:
    print("ERROR: Tag mismatch after insertion — aborting", file=sys.stderr)
    sys.exit(1)

# ── 5. Double-check arrangement route is inside Switch ──────────────────────
# Find the Switch block
switch_m = re.search(r'<Switch[\s>].*?</Switch>', src, re.DOTALL)
if switch_m:
    inside = switch_m.group(0)
    if '/arrangement' in inside:
        print("✓ /arrangement route confirmed INSIDE <Switch>")
    else:
        print("ERROR: /arrangement route is NOT inside <Switch>", file=sys.stderr)
        sys.exit(1)

# ── 6. Write ─────────────────────────────────────────────────────────────────
with open(path, "w") as f:
    f.write(src)
print("✓ App.tsx written successfully")
PYEOF

section "Step 3 — Print the Router function for manual verification"

python3 << 'PYEOF'
path = "/home/r3/Stable/R3 v4/client/src/App.tsx"
with open(path) as f:
    lines = f.readlines()

# Find the Router function and print it
in_router = False
depth = 0
start = 0
for i, line in enumerate(lines):
    if "function Router()" in line:
        in_router = True
        start = i
    if in_router:
        depth += line.count("{") - line.count("}")
        if in_router and i > start and depth <= 0:
            # Print these lines
            for j, l in enumerate(lines[start:i+1], start+1):
                print(f"  {j:4d} | {l}", end="")
            break
PYEOF

section "Step 4 — Validate with node"

node - << 'JSEOF'
const fs   = require("fs");
const path = require("path");

const src = fs.readFileSync(
  path.join(process.env.HOME, "Stable/R3 v4/client/src/App.tsx"),
  "utf8"
);

const routeOpens  = (src.match(/<Route[\s>]/g)  || []).length;
const routeCloses = (src.match(/<\/Route>/g)    || []).length;
const switchOpens = (src.match(/<Switch[\s>]/g) || []).length;
const switchClose = (src.match(/<\/Switch>/g)   || []).length;

const hasRoute  = src.includes('"/arrangement"') || src.includes("'/arrangement'");
const hasImport = src.includes("ArrangementPage");

// Find Switch block and confirm route is inside it
const switchMatch = src.match(/<Switch[\s\S]*?<\/Switch>/);
const routeInSwitch = switchMatch ? switchMatch[0].includes("/arrangement") : false;

console.log(`  <Route>  open=${routeOpens}  close=${routeCloses}  ${routeOpens===routeCloses?"✓ balanced":"✗ MISMATCH"}`);
console.log(`  <Switch> open=${switchOpens}  close=${switchClose}  ${switchOpens===switchClose?"✓ balanced":"✗ MISMATCH"}`);
console.log(`  /arrangement route present:       ${hasRoute        ? "✓" : "✗ MISSING"}`);
console.log(`  ArrangementPage import:           ${hasImport       ? "✓" : "✗ MISSING"}`);
console.log(`  /arrangement inside <Switch>:     ${routeInSwitch   ? "✓" : "✗ OUTSIDE SWITCH"}`);

if (routeOpens!==routeCloses || switchOpens!==switchClose || !hasRoute || !hasImport || !routeInSwitch) {
  console.error("\n  VALIDATION FAILED");
  process.exit(1);
} else {
  console.log("\n  ✓ All checks passed — App.tsx is clean");
}
JSEOF

echo ""
echo -e "${BLD}${GRN}════════════════════════════════════════════════════${RST}"
echo -e "${BLD}${GRN}  FIX COMPLETE — Start your dev server:${RST}"
echo -e "${BLD}${GRN}════════════════════════════════════════════════════${RST}"
echo ""
echo -e "${DIM}    pkill -f 'tsx|vite' 2>/dev/null; sleep 1 && pnpm dev${RST}"
echo -e "${DIM}    http://localhost:5173/arrangement${RST}"
echo ""
