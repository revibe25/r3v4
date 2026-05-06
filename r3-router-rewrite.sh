#!/usr/bin/env bash
# r3-router-rewrite.sh — replaces Router() body entirely. No anchors, no guessing.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/client/src/App.tsx"
GRN='\033[0;32m'; RED='\033[0;31m'; CYN='\033[0;36m'; DIM='\033[2m'; RST='\033[0m'; BLD='\033[1m'
ok()   { echo -e "${GRN}✓${RST} $1"; }
fail() { echo -e "${RED}✗${RST} $1"; exit 1; }
info() { echo -e "${CYN}→${RST} $1"; }

[[ -f "$APP" ]] || fail "App.tsx not found"

info "Backing up → App.tsx.clean-bak"
cp "$APP" "${APP}.clean-bak"

# Print current Router lines so we can see exactly what's there
echo ""
info "Current Router() function (lines shown):"
python3 - "$APP" << 'DIAG'
import sys
path = sys.argv[1]
with open(path) as f:
    lines = f.readlines()
in_fn = False; depth = 0; start = 0
for i, line in enumerate(lines):
    if "function Router()" in line:
        in_fn = True; start = i
    if in_fn:
        depth += line.count("{") - line.count("}")
        print(f"  {i+1:4d}│{line}", end="")
        if i > start and depth <= 0:
            break
DIAG

echo ""
info "Rewriting Router() function..."

python3 << 'PYEOF'
import sys, re

path = "/home/r3/Stable/R3 v4/client/src/App.tsx"
with open(path) as f:
    src = f.read()

# Ensure ArrangementPage lazy import exists above the Router function
if "ArrangementPage" not in src:
    # insert before the first lazy( call
    src = re.sub(
        r"(const \w+Page\s*=\s*lazy\()",
        "const ArrangementPage = lazy(() => import('@/pages/arrangement'));\n\\1",
        src, count=1
    )
    print("✓ Added ArrangementPage lazy import")
else:
    print("✓ ArrangementPage lazy import present")

# ── The canonical Router function we will substitute in ────────────────────
ROUTER_FN = '''function Router() {
  const { hydrateFromToken, token } = useAuthStore();
  useEffect(() => {
    if (token) hydrateFromToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Switch>
      <Route path="/">
        {() => <PricingRoute />}
      </Route>

      <Route path="/login">
        {() => <AuthRoute />}
      </Route>

      <Route path="/instrument">
        {() => (
          <ProtectedRoute>
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback message="Loading Instrument..." />}>
                <InstrumentPage autoInitialize={true} />
              </Suspense>
            </ErrorBoundary>
          </ProtectedRoute>
        )}
      </Route>

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

      <Route path="/multitrack">
        {() => <MultiTrackPage />}
      </Route>

      <Route path="/vst">
        {() => <VSTRoute />}
      </Route>

      <Route path="/loopstation">
        {() => <LoopStationPage />}
      </Route>

      <Route path="/pricing">
        {() => <PricingRoute />}
      </Route>

      <Route path="/visuals">
        {() => (
          <ProtectedRoute>
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback message="Loading Visuals..." />}>
                <VisualsPage />
              </Suspense>
            </ErrorBoundary>
          </ProtectedRoute>
        )}
      </Route>

      <Route>
        {() => (
          <Suspense fallback={null}>
            <NotFound />
          </Suspense>
        )}
      </Route>
    </Switch>
  );
}'''

# ── Find function Router() {...} and replace its entire body ────────────────
# Strategy: find "function Router()" then track brace depth to find the
# closing "}" of the function, replace that entire span.

lines   = src.splitlines(keepends=True)
fn_start = None
fn_end   = None
depth    = 0
in_fn    = False

for i, line in enumerate(lines):
    if "function Router()" in line and not in_fn:
        fn_start = i
        in_fn = True
    if in_fn:
        depth += line.count("{") - line.count("}")
        if fn_start is not None and i > fn_start and depth <= 0:
            fn_end = i
            break

if fn_start is None or fn_end is None:
    print(f"ERROR: Could not locate Router() function (start={fn_start}, end={fn_end})", file=sys.stderr)
    sys.exit(1)

print(f"✓ Located Router() at lines {fn_start+1}–{fn_end+1}")

# Reconstruct: everything before Router, then our clean Router, then everything after
before = "".join(lines[:fn_start])
after  = "".join(lines[fn_end+1:])
new_src = before + ROUTER_FN + "\n" + after

# ── Validate ────────────────────────────────────────────────────────────────
ro = len(re.findall(r'<Route[\s>]', new_src))
rc = len(re.findall(r'</Route>',    new_src))
so = len(re.findall(r'<Switch[\s>]', new_src))
sc = len(re.findall(r'</Switch>',   new_src))

print(f"  <Route>  open={ro} close={rc} {'✓' if ro==rc else '✗ MISMATCH'}")
print(f"  <Switch> open={so} close={sc} {'✓' if so==sc else '✗ MISMATCH'}")

if ro != rc or so != sc:
    print("ERROR: Tag mismatch — not writing", file=sys.stderr)
    sys.exit(1)

# Confirm /arrangement is inside Router
router_match = re.search(r'function Router\(\).*?^}', new_src, re.DOTALL | re.MULTILINE)
if router_match:
    inside = router_match.group(0)
    ok = "/arrangement" in inside
    print(f"  /arrangement inside Router: {'✓' if ok else '✗ MISSING'}")
    if not ok:
        sys.exit(1)

with open(path, "w") as f:
    f.write(new_src)
print("✓ App.tsx written")
PYEOF

echo ""
info "Verifying with node..."
node - << 'JSEOF'
const fs = require("fs");
const src = fs.readFileSync(
  require("path").join(process.env.HOME, "Stable/R3 v4/client/src/App.tsx"), "utf8"
);
const ro = (src.match(/<Route[\s>]/g)||[]).length;
const rc = (src.match(/<\/Route>/g)||[]).length;
const so = (src.match(/<Switch[\s>]/g)||[]).length;
const sc = (src.match(/<\/Switch>/g)||[]).length;
// Extract Router function body
const routerMatch = src.match(/function Router\(\)[\s\S]*?\n\}/);
const inSwitch = routerMatch ? routerMatch[0].includes("/arrangement") : false;
console.log(`  <Route>  ${ro}/${rc} ${ro===rc?"✓":"✗"}`);
console.log(`  <Switch> ${so}/${sc} ${so===sc?"✓":"✗"}`);
console.log(`  /arrangement in Router: ${inSwitch?"✓":"✗"}`);
console.log(`  ArrangementPage import: ${src.includes("ArrangementPage")?"✓":"✗"}`);
if (ro!==rc||so!==sc||!inSwitch||!src.includes("ArrangementPage")) {
  console.error("VALIDATION FAILED"); process.exit(1);
}
console.log("\n  ✓ App.tsx is clean — start your server");
JSEOF

echo ""
echo -e "${BLD}${GRN}  Done. Run:${RST}"
echo -e "${DIM}    pkill -f 'tsx|vite' 2>/dev/null; sleep 1 && pnpm dev${RST}"
