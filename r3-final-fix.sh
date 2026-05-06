#!/usr/bin/env bash
# r3-final-fix.sh
# Strategy: restore from the ORIGINAL backup (App.tsx.bak = state before any hotfix),
# then replace Router() by slicing between "function Router()" and "function App()" —
# two named-function boundaries that cannot be confused with anything else.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP="$ROOT/client/src/App.tsx"
GRN='\033[0;32m'; RED='\033[0;31m'; CYN='\033[0;36m'; DIM='\033[2m'; RST='\033[0m'; BLD='\033[1m'
ok()      { echo -e "${GRN}✓${RST} $1"; }
fail()    { echo -e "${RED}✗${RST} $1"; exit 1; }
info()    { echo -e "${CYN}→${RST} $1"; }
section() { echo -e "\n${BLD}${CYN}══ $1 ══${RST}"; }

[[ -f "$APP" ]] || fail "App.tsx not found: $APP"

# ─────────────────────────────────────────────────────────────────────────────
section "Step 1 — Print current lines 595-615 (diagnostic)"
# ─────────────────────────────────────────────────────────────────────────────
sed -n '595,615p' "$APP" | cat -n | sed 's/^/  /'

# ─────────────────────────────────────────────────────────────────────────────
section "Step 2 — Restore from earliest clean backup"
# ─────────────────────────────────────────────────────────────────────────────
# Find the oldest backup — that's App.tsx.bak created by the very first hotfix script
# before any of our patches touched the file.
OLDEST_BAK=""
for bak in "${APP}.bak" "${APP}.bak2" "${APP}.clean-bak"; do
  if [[ -f "$bak" ]]; then
    OLDEST_BAK="$bak"
    info "Found backup: $bak"
    break
  fi
done

if [[ -z "$OLDEST_BAK" ]]; then
  info "No backup found — will work from current file"
  cp "$APP" "${APP}.final-bak"
else
  info "Restoring from: $OLDEST_BAK"
  cp "$OLDEST_BAK" "${APP}.final-bak"   # save current state just in case
  cp "$OLDEST_BAK" "$APP"
  ok "Restored from $OLDEST_BAK"
fi

info "Lines 595-615 AFTER restore:"
sed -n '595,615p' "$APP" | cat -n | sed 's/^/  /'

# ─────────────────────────────────────────────────────────────────────────────
section "Step 3 — Rewrite Router() using function App() as end-boundary"
# ─────────────────────────────────────────────────────────────────────────────
python3 << 'PYEOF'
import sys, re

path = "/home/r3/Stable/R3 v4/client/src/App.tsx"
with open(path) as f:
    src = f.read()

# ── Ensure ArrangementPage lazy import ──────────────────────────────────────
if "ArrangementPage" not in src:
    src = re.sub(
        r"(const \w+Page\s*=\s*lazy\()",
        "const ArrangementPage = lazy(() => import('@/pages/arrangement'));\n\\1",
        src, count=1
    )
    print("✓ Added ArrangementPage lazy import")
else:
    print("✓ ArrangementPage lazy import already present")

# ── Find Router() and App() function start positions ────────────────────────
# We search for the EXACT pattern "^function Router()" and "^function App()"
# at the start of a line — these are unambiguous in this file.

router_m = re.search(r'^function Router\(\)', src, re.MULTILINE)
app_m    = re.search(r'^function App\(\)',    src, re.MULTILINE)

if not router_m:
    print("ERROR: 'function Router()' not found at line start", file=sys.stderr)
    # Try without ^ to find it anywhere
    router_m2 = re.search(r'function Router\(\)', src)
    if router_m2:
        print(f"  Found at char {router_m2.start()} (not at line start) — context:")
        print(src[router_m2.start()-20:router_m2.start()+60])
    sys.exit(1)

if not app_m:
    print("ERROR: 'function App()' not found at line start", file=sys.stderr)
    app_m2 = re.search(r'function App\(\)', src)
    if app_m2:
        print(f"  Found at char {app_m2.start()} (not at line start)")
    sys.exit(1)

router_start = router_m.start()
app_start    = app_m.start()

print(f"✓ Router() starts at char {router_start} (approx line {src[:router_start].count(chr(10))+1})")
print(f"✓ App()    starts at char {app_start}    (approx line {src[:app_start].count(chr(10))+1})")

if router_start >= app_start:
    print("ERROR: Router() must come before App()", file=sys.stderr)
    sys.exit(1)

# ── The clean Router function we are inserting ──────────────────────────────
CLEAN_ROUTER = '''function Router() {
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
}

'''

# ── Splice: before Router + clean Router + App onwards ──────────────────────
before = src[:router_start]
after  = src[app_start:]      # starts with "function App() {"
new_src = before + CLEAN_ROUTER + after

# ── Validate ─────────────────────────────────────────────────────────────────
ro = len(re.findall(r'<Route[\s>/]', new_src))
rc = len(re.findall(r'</Route>',     new_src))
so = len(re.findall(r'<Switch[\s>]', new_src))
sc = len(re.findall(r'</Switch>',    new_src))

print(f"  <Route>  open={ro} close={rc} {'✓ balanced' if ro==rc else '✗ MISMATCH — ABORTING'}")
print(f"  <Switch> open={so} close={sc} {'✓ balanced' if so==sc else '✗ MISMATCH — ABORTING'}")

if ro != rc or so != sc:
    sys.exit(1)

# Confirm /arrangement is in our Router block (between router_start and app_start)
router_block = new_src[new_src.index("function Router()"):new_src.index("function App()")]
if "/arrangement" not in router_block:
    print("ERROR: /arrangement not found inside Router() block", file=sys.stderr)
    sys.exit(1)
print("✓ /arrangement confirmed inside Router()")

# Confirm Router() and App() are both still present
assert "function Router()" in new_src
assert "function App()"    in new_src
print("✓ Both function Router() and function App() present")

with open(path, "w") as f:
    f.write(new_src)
print("✓ App.tsx written")
PYEOF

# ─────────────────────────────────────────────────────────────────────────────
section "Step 4 — Independent Node.js validation"
# ─────────────────────────────────────────────────────────────────────────────
node - << 'JSEOF'
const fs   = require("fs");
const path = require("path");
const src  = fs.readFileSync(
  path.join(process.env.HOME, "Stable/R3 v4/client/src/App.tsx"), "utf8"
);

const checks = [
  ["<Route> balanced",
    (src.match(/<Route[\s>/]/g)||[]).length === (src.match(/<\/Route>/g)||[]).length],
  ["<Switch> balanced",
    (src.match(/<Switch[\s>]/g)||[]).length === (src.match(/<\/Switch>/g)||[]).length],
  ["/arrangement route present",
    src.includes('"/arrangement"') || src.includes("'/arrangement'")],
  ["ArrangementPage import",
    src.includes("ArrangementPage")],
  ["function Router() exists",
    /^function Router\(\)/m.test(src)],
  ["function App() exists",
    /^function App\(\)/m.test(src)],
  ["/arrangement inside Router block", (() => {
    const ri = src.indexOf("function Router()");
    const ai = src.indexOf("function App()");
    return ri !== -1 && ai !== -1 && src.slice(ri, ai).includes("/arrangement");
  })()],
];

let pass = true;
for (const [label, result] of checks) {
  console.log(`  ${result ? "✓" : "✗"} ${label}`);
  if (!result) pass = false;
}

if (!pass) {
  console.error("\n  VALIDATION FAILED");
  process.exit(1);
}
console.log("\n  ✓ All checks passed — App.tsx is clean");
JSEOF

# ─────────────────────────────────────────────────────────────────────────────
section "Step 5 — Show the final Router() function for visual confirmation"
# ─────────────────────────────────────────────────────────────────────────────
python3 << 'PYEOF'
import re
path = "/home/r3/Stable/R3 v4/client/src/App.tsx"
with open(path) as f:
    src = f.read()
ri = src.index("function Router()")
ai = src.index("function App()")
router_block = src[ri:ai]
lines = router_block.splitlines()
start_line = src[:ri].count("\n") + 1
print(f"\n  Router() function ({len(lines)} lines, starting at line {start_line}):\n")
for i, line in enumerate(lines, start_line):
    print(f"  {i:4d} │ {line}")
PYEOF

echo ""
echo -e "${BLD}${GRN}════════════════════════════════════════════════════${RST}"
echo -e "${BLD}${GRN}  DONE — Run:${RST}"
echo -e "${BLD}${GRN}════════════════════════════════════════════════════${RST}"
echo ""
echo -e "${DIM}    pkill -f 'tsx|vite' 2>/dev/null; sleep 1 && pnpm dev${RST}"
echo -e "${DIM}    http://localhost:5173/arrangement${RST}"
echo ""
