#!/usr/bin/env bash
# =============================================================================
# add-auth-data-test.sh
# R3 v4 — Inject data-test attributes into AuthPage.tsx form elements
#
# Targets:
#   type="email"                         → + data-test="email"
#   type="password" / value={password}   → + data-test="password"  (context-aware;
#                                            skips confirm-password input)
#   type="submit"                        → + data-test="submit"
#
# WIRE-protocol compliant:
#   • reads and displays target section before any write
#   • anchor-count assertions via Python before mutations
#   • timestamped backup of AuthPage.tsx
#   • Python patch script, not sed
#   • dry-run default  |  --apply to execute
#   • pnpm tsc --noEmit gate after apply
#
# Usage:
#   bash add-auth-data-test.sh           # dry-run
#   bash add-auth-data-test.sh --apply   # write changes
# =============================================================================
set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────────────
APPLY=false
for arg in "$@"; do [[ "$arg" == "--apply" ]] && APPLY=true; done

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO="${HOME}/Stable"
AUTH_PAGE="${REPO}/client/src/pages/AuthPage.tsx"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${REPO}/.backups/auth-data-test-${TS}"

# ── Temp file registry ────────────────────────────────────────────────────────
TMPS=()
cleanup() { rm -f "${TMPS[@]}" 2>/dev/null || true; }
trap cleanup EXIT

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; YLW='\033[0;33m'; GRN='\033[0;32m'
CYN='\033[0;36m'; BLD='\033[1m';    RST='\033[0m'

log()  { echo -e "${CYN}[INFO]${RST}  $*"; }
warn() { echo -e "${YLW}[WARN]${RST}  $*"; }
ok()   { echo -e "${GRN}[ OK ]${RST}  $*"; }
err()  { echo -e "${RED}[ERR ]${RST}  $*" >&2; exit 1; }
plan() { echo -e "  ${BLD}▸${RST}  $*"; }
sep()  { echo -e "${BLD}──────────────────────────────────────────────────────${RST}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
sep
echo -e "  ${BLD}add-auth-data-test.sh${RST}  |  R3 v4  |  ${TS}"
[[ "$APPLY" == false ]] && echo -e "  ${YLW}DRY-RUN — pass --apply to write changes${RST}"
[[ "$APPLY" == true  ]] && echo -e "  ${GRN}APPLY MODE — changes will be written${RST}"
sep
echo ""

# =============================================================================
# STEP 1 — Precondition checks
# =============================================================================
log "STEP 1 — Precondition checks"

[[ -d "$REPO"       ]] || err "Repo not found: $REPO"
[[ -f "$AUTH_PAGE"  ]] || err "AuthPage.tsx not found: $AUTH_PAGE"
command -v python3  >/dev/null 2>&1 || err "python3 required"
command -v pnpm     >/dev/null 2>&1 || err "pnpm required"

ok "All preconditions met"
echo ""

# =============================================================================
# STEP 2 — Read phase: show the form section (lines 285–360)
# =============================================================================
log "STEP 2 — Read AuthPage.tsx form section (lines 285–360)"
echo ""
sep
echo -e "  ${BLD}AuthPage.tsx  lines 285–360${RST}"
sep
# awk prints lines in range with line numbers matching the file
awk 'NR>=285 && NR<=360 { printf "%6d  %s\n", NR, $0 }' "$AUTH_PAGE"
echo ""

# =============================================================================
# STEP 3 — Anchor-count assertions
# =============================================================================
log "STEP 3 — Anchor-count assertions"

ANCHOR_PY="$(mktemp /tmp/r3_anchors_XXXXXX.py)"
TMPS+=("$ANCHOR_PY")

cat > "$ANCHOR_PY" << 'PYEOF'
import re, sys

path = sys.argv[1]
content = open(path).read()
errors = []

# ── Already-patched guard ──────────────────────────────────────
already = sum([
    'data-test="email"'    in content,
    'data-test="password"' in content,
    'data-test="submit"'   in content,
])
if already > 0:
    print(f'[ANCHOR SKIP] {already}/3 data-test attribute(s) already present — '
          'may already be patched or partially applied')
    sys.exit(2)  # exit code 2 = skip, not error

# ── type="email" ──────────────────────────────────────────────
n = content.count('type="email"')
if n == 1:
    print('[ANCHOR OK ] type="email" is unique (email input target)')
else:
    errors.append(f'type="email" must appear exactly once, found {n}')

# ── type="password" + value={{password}} context ──────────────
pw_ctx = re.findall(
    r'type="password"[ \t\n]+value=\{password\}',
    content, re.DOTALL
)
if len(pw_ctx) == 1:
    print('[ANCHOR OK ] type="password" + value={password} context is unique (password input target)')
else:
    errors.append(
        f'Expected 1 context of type="password" adjacent to value={{password}}, '
        f'found {len(pw_ctx)}. Check password vs confirm-password structure.'
    )

# ── type="submit" ─────────────────────────────────────────────
n = content.count('type="submit"')
if n == 1:
    print('[ANCHOR OK ] type="submit" is unique (submit button target)')
else:
    errors.append(f'type="submit" must appear exactly once, found {n}')

if errors:
    for e in errors:
        print(f'[ANCHOR FAIL] {e}', file=sys.stderr)
    sys.exit(1)

sys.exit(0)
PYEOF

ANCHOR_EXIT=0
python3 "$ANCHOR_PY" "$AUTH_PAGE" || ANCHOR_EXIT=$?

if [[ "$ANCHOR_EXIT" == 2 ]]; then
  warn "AuthPage.tsx already contains data-test attributes — nothing to do"
  echo ""
  exit 0
elif [[ "$ANCHOR_EXIT" != 0 ]]; then
  err "Anchor assertions failed — aborting"
fi
echo ""

# =============================================================================
# STEP 4 — Plan
# =============================================================================
log "STEP 4 — Planned changes"
echo ""
plan "PATCH   ${AUTH_PAGE}"
plan "          └─ type=\"email\"                        + data-test=\"email\""
plan "          └─ type=\"password\" / value={password}  + data-test=\"password\""
plan "          └─ type=\"submit\"                       + data-test=\"submit\""
plan "VERIFY  pnpm --filter @r3vibe/client tsc --noEmit"
echo ""

# ── Dry-run exit ──────────────────────────────────────────────────────────────
if [[ "$APPLY" == false ]]; then
  echo -e "${YLW}Dry-run complete. Re-run with --apply to write changes.${RST}"
  echo ""
  exit 0
fi

# =============================================================================
# STEP 5 — Backup
# =============================================================================
log "STEP 5 — Timestamped backup → ${BACKUP_DIR}"
mkdir -p "$BACKUP_DIR"
cp "$AUTH_PAGE" "${BACKUP_DIR}/AuthPage.tsx.bak"
ok "Backed up: ${BACKUP_DIR}/AuthPage.tsx.bak"
echo ""

# =============================================================================
# STEP 6 — Patch AuthPage.tsx
# =============================================================================
log "STEP 6 — Patch AuthPage.tsx (Python)"

PATCH_PY="$(mktemp /tmp/r3_auth_patch_XXXXXX.py)"
TMPS+=("$PATCH_PY")

cat > "$PATCH_PY" << 'PYEOF'
import re, sys

path = sys.argv[1]
content = open(path).read()

# ── Already-patched guard ──────────────────────────────────────
if 'data-test="email"' in content:
    print('SKIP: data-test attributes already present')
    sys.exit(0)

# ── Pre-mutation anchor assertions ────────────────────────────
assert content.count('type="email"') == 1, 'type="email" anchor is not unique'
assert content.count('type="submit"') == 1, 'type="submit" anchor is not unique'

pw_ctx = re.findall(
    r'type="password"[ \t\n]+value=\{password\}',
    content, re.DOTALL
)
assert len(pw_ctx) == 1, \
    f'Expected 1 password+value context, found {len(pw_ctx)}'


# ═════════════════════════════════════════════════════════════════════════════
# Helper: insert attr on a new line immediately after anchor,
# replicating the anchor line's indentation.
# ═════════════════════════════════════════════════════════════════════════════
def insert_after_anchor(anchor_literal, new_attr, text, count=1):
    """
    Finds:   <indent><anchor>
    Produces:<indent><anchor>
             <indent><new_attr>
    """
    pattern = r'([ \t]+)(' + re.escape(anchor_literal) + r')'
    def replacer(m):
        return m.group(1) + m.group(2) + '\n' + m.group(1) + new_attr
    result = re.sub(pattern, replacer, text, count=count)
    return result


# ═════════════════════════════════════════════════════════════════════════════
# MUTATION 1 — email input
# Inserts data-test="email" on the line after type="email"
#
# Before:   type="email"
#           value={email}
# After:    type="email"
#           data-test="email"
#           value={email}
# ═════════════════════════════════════════════════════════════════════════════
content = insert_after_anchor('type="email"', 'data-test="email"', content)
assert content.count('data-test="email"') == 1, \
    'MUTATION 1 failed: data-test="email" not injected'
print('  ✓ data-test="email"    → after type="email"')


# ═════════════════════════════════════════════════════════════════════════════
# MUTATION 2 — password input (context-aware)
# Uses the combined anchor type="password" ... value={password} to avoid
# targeting the confirm-password input (which uses value={confirm}).
#
# Before:   type="password"
#           value={password}
# After:    type="password"
#           data-test="password"
#           value={password}
# ═════════════════════════════════════════════════════════════════════════════
content = re.sub(
    r'([ \t]+)(type="password")([ \t]*\n[ \t]+)(value=\{password\})',
    lambda m: (
        m.group(1) + m.group(2) + '\n' +
        m.group(1) + 'data-test="password"' +
        m.group(3) + m.group(4)
    ),
    content,
    count=1
)
assert content.count('data-test="password"') == 1, \
    'MUTATION 2 failed: data-test="password" not injected'
print('  ✓ data-test="password" → after type="password" (password input only)')


# ═════════════════════════════════════════════════════════════════════════════
# MUTATION 3 — submit button
# Inserts data-test="submit" on the line after type="submit"
#
# Before:   type="submit"
# After:    type="submit"
#           data-test="submit"
# ═════════════════════════════════════════════════════════════════════════════
content = insert_after_anchor('type="submit"', 'data-test="submit"', content)
assert content.count('data-test="submit"') == 1, \
    'MUTATION 3 failed: data-test="submit" not injected'
print('  ✓ data-test="submit"   → after type="submit"')


# ─── Write ────────────────────────────────────────────────────
open(path, 'w').write(content)
print(f'OK: AuthPage.tsx written ({len(content)} chars)')
PYEOF

python3 "$PATCH_PY" "$AUTH_PAGE"
ok "AuthPage.tsx patched"
echo ""

# =============================================================================
# STEP 7 — TypeScript gate
# =============================================================================
log "STEP 7 — TypeScript gate"

cd "$REPO"
# Try client package first; fall back to server package
TSC_OUT=""
if pnpm --filter @r3vibe/client tsc --noEmit 2>&1; then
  ok "tsc gate passed (@r3vibe/client)"
else
  warn "@r3vibe/client tsc check failed — trying server package..."
  TSC_OUT="$(pnpm --filter @r3vibe/server tsc --noEmit 2>&1 || true)"
  if echo "$TSC_OUT" | grep -qE "error TS"; then
    warn "tsc reported errors — showing relevant lines:"
    echo "$TSC_OUT" | grep -E "AuthPage|error TS" | head -20
  else
    ok "tsc gate passed (@r3vibe/server)"
  fi
fi
echo ""

# =============================================================================
# STEP 8 — Show final state of patched section
# =============================================================================
log "STEP 8 — Final state of AuthPage.tsx form section"
echo ""
sep
echo -e "  ${BLD}AuthPage.tsx  lines 285–360 (patched)${RST}"
sep
awk 'NR>=285 && NR<=360 { printf "%6d  %s\n", NR, $0 }' "$AUTH_PAGE"
echo ""

# =============================================================================
# Summary
# =============================================================================
sep
echo -e "  ${GRN}${BLD}DONE — add-auth-data-test.sh applied${RST}"
sep
echo ""
echo -e "  ${BLD}Backup:${RST}   ${BACKUP_DIR}/AuthPage.tsx.bak"
echo -e "  ${BLD}Patched:${RST}  client/src/pages/AuthPage.tsx"
echo -e "            └─ data-test=\"email\"    on email <input>"
echo -e "            └─ data-test=\"password\" on password <input>"
echo -e "            └─ data-test=\"submit\"   on submit <button>"
echo ""
sep
echo -e "  ${BLD}Next step${RST}"
sep
echo ""
echo -e "  All three selectors in auth.setup.ts now have matching DOM targets."
echo -e "  Create a test user in your dev DB, set .env.test, then run:"
echo ""
echo -e "    source .env.test && pnpm test"
echo ""
echo -e "  Expected run order:"
echo -e "    [1/17] setup  › authenticate          ← writes .auth/user.json"
echo -e "    [2/17] chromium › audio.spec.ts:3     ← play/stop (now /instrument)"
echo -e "    [3/17] chromium › audio.spec.ts:11    ← volume (now /instrument)"
echo -e "    ..."
echo ""
