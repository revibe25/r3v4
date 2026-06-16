#!/usr/bin/env bash
# =============================================================================
# playwright-auth-setup.sh
# R3 v4 — Playwright storageState auth infrastructure
#
# WIRE-protocol compliant:
#   • reads before every write
#   • anchor-count assertions via Python before mutations
#   • timestamped backups of every modified file
#   • Python patch scripts, never sed/awk for multi-line changes
#   • dry-run by default  |  --apply to execute
#
# Fixes:
#   1. audio.spec.ts: page.goto('/') → page.goto('/instrument')
#      (/ redirects to /pricing; play-button never mounts)
#   2. playwright.config.ts: adds setup project + chromium dependency
#   3. Creates tests/e2e/setup/auth.setup.ts with Hard Guard #7 assertion
#   4. Creates tests/e2e/.auth/ (gitignored) for storageState file
#
# Usage:
#   bash playwright-auth-setup.sh            # dry-run  (always safe)
#   bash playwright-auth-setup.sh --apply    # write all changes
#   bash playwright-auth-setup.sh --apply --skip-tsc   # skip tsc gate
# =============================================================================
set -euo pipefail

# ── Args ──────────────────────────────────────────────────────────────────────
APPLY=false
SKIP_TSC=false
for arg in "$@"; do
  [[ "$arg" == "--apply"    ]] && APPLY=true
  [[ "$arg" == "--skip-tsc" ]] && SKIP_TSC=true
done

# ── Paths ─────────────────────────────────────────────────────────────────────
REPO="${HOME}/Stable"
TS="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="${REPO}/.backups/playwright-auth-${TS}"

PW_CONFIG="${REPO}/playwright.config.ts"
AUDIO_SPEC="${REPO}/tests/e2e/audio.spec.ts"
AUTH_DIR="${REPO}/tests/e2e/.auth"
SETUP_DIR="${REPO}/tests/e2e/setup"
AUTH_SETUP_FILE="${SETUP_DIR}/auth.setup.ts"
ENV_EXAMPLE="${REPO}/.env.test.example"
GITIGNORE="${REPO}/.gitignore"

# ── Temp file registry (cleaned up on exit) ───────────────────────────────────
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
echo -e "  ${BLD}playwright-auth-setup.sh${RST}  |  R3 v4  |  ${TS}"
if [[ "$APPLY" == false ]]; then
  echo -e "  ${YLW}DRY-RUN — pass --apply to write changes${RST}"
else
  echo -e "  ${GRN}APPLY MODE — changes will be written${RST}"
fi
sep
echo ""

# =============================================================================
# STEP 1 — Precondition checks
# =============================================================================
log "STEP 1 — Precondition checks"

[[ -d "$REPO"       ]] || err "Repo not found: $REPO"
[[ -f "$PW_CONFIG"  ]] || err "playwright.config.ts not found: $PW_CONFIG"
[[ -f "$AUDIO_SPEC" ]] || err "audio.spec.ts not found: $AUDIO_SPEC"
command -v python3  >/dev/null 2>&1 || err "python3 required but not found"
command -v pnpm     >/dev/null 2>&1 || err "pnpm required but not found"

ok "All preconditions met"
echo ""

# =============================================================================
# STEP 2 — Read phase (display current state)
# =============================================================================
log "STEP 2 — Read existing files"
echo ""

sep
echo -e "  ${BLD}playwright.config.ts${RST}"
sep
cat -n "$PW_CONFIG"
echo ""

sep
echo -e "  ${BLD}tests/e2e/audio.spec.ts${RST}"
sep
cat -n "$AUDIO_SPEC"
echo ""

# =============================================================================
# STEP 3 — Anchor-count assertions
# =============================================================================
log "STEP 3 — Anchor-count assertions"

ANCHOR_PY="$(mktemp /tmp/r3_anchors_XXXXXX.py)"
TMPS+=("$ANCHOR_PY")

cat > "$ANCHOR_PY" << 'PYEOF'
import sys

pw_path    = sys.argv[1]
audio_path = sys.argv[2]

pw    = open(pw_path).read()
audio = open(audio_path).read()

errors = []

# ── playwright.config.ts ──────────────────────────────────────
n = pw.count("name: 'chromium'")
if n == 0:
    errors.append("playwright.config.ts: anchor \"name: 'chromium'\" not found")
elif n > 1:
    errors.append(f"playwright.config.ts: anchor \"name: 'chromium'\" ambiguous ({n} matches)")

if "projects:" not in pw:
    errors.append("playwright.config.ts: anchor 'projects:' not found")

# ── audio.spec.ts ─────────────────────────────────────────────
goto_count = audio.count("page.goto('/')")
if goto_count == 0:
    print("[ANCHOR SKIP] audio.spec.ts: no page.goto('/') found — may already be patched")
else:
    print(f"[ANCHOR OK ] audio.spec.ts: {goto_count} page.goto('/') instance(s) to patch")

# Already-patched guard for playwright.config.ts
if "name: 'setup'" in pw:
    print("[ANCHOR SKIP] playwright.config.ts: setup project already present — will skip patch")

if errors:
    for e in errors:
        print(f"[ANCHOR FAIL] {e}", file=sys.stderr)
    sys.exit(1)

print("[ANCHOR OK ] playwright.config.ts: 'name: chromium' is unique")
print("[ANCHOR OK ] playwright.config.ts: 'projects:' anchor present")
PYEOF

python3 "$ANCHOR_PY" "$PW_CONFIG" "$AUDIO_SPEC"
echo ""

# =============================================================================
# STEP 4 — Plan
# =============================================================================
log "STEP 4 — Planned changes"
echo ""
plan "CREATE  tests/e2e/setup/auth.setup.ts"
plan "          └─ authenticate() setup fixture"
plan "          └─ Hard Guard #7: waitForURL('/instrument'), assert not /daw"
plan "          └─ page.context().storageState() → tests/e2e/.auth/user.json"
plan "CREATE  tests/e2e/.auth/.gitkeep"
plan "          └─ directory placeholder (auth tokens gitignored)"
plan "CREATE  .env.test.example  (if absent)"
plan "PATCH   playwright.config.ts"
plan "          └─ inject setup project before chromium in projects: []"
plan "          └─ add dependencies: ['setup'] to chromium project"
plan "          └─ add storageState: 'tests/e2e/.auth/user.json' to chromium use block"
plan "PATCH   tests/e2e/audio.spec.ts"
plan "          └─ page.goto('/') → page.goto('/instrument')  [all occurrences]"
plan "UPDATE  .gitignore"
plan "          └─ tests/e2e/.auth/  !tests/e2e/.auth/.gitkeep"
if [[ "$SKIP_TSC" == false ]]; then
  plan "VERIFY  pnpm tsc --noEmit (server package)"
fi
echo ""

# ── Dry-run exit ──────────────────────────────────────────────────────────────
if [[ "$APPLY" == false ]]; then
  echo -e "${YLW}Dry-run complete. Re-run with --apply to execute all changes.${RST}"
  echo ""
  exit 0
fi

# =============================================================================
# APPLY MODE
# =============================================================================

# =============================================================================
# STEP 5 — Timestamped backups
# =============================================================================
log "STEP 5 — Timestamped backups → ${BACKUP_DIR}"
mkdir -p "$BACKUP_DIR"
cp "$PW_CONFIG"  "${BACKUP_DIR}/playwright.config.ts.bak"
cp "$AUDIO_SPEC" "${BACKUP_DIR}/audio.spec.ts.bak"
ok "Backed up to ${BACKUP_DIR}"
echo ""

# =============================================================================
# STEP 6 — Create directory structure
# =============================================================================
log "STEP 6 — Create directory structure"
mkdir -p "$AUTH_DIR" "$SETUP_DIR"
touch "${AUTH_DIR}/.gitkeep"
ok "Created ${AUTH_DIR}"
ok "Created ${SETUP_DIR}"
echo ""

# =============================================================================
# STEP 7 — Write auth.setup.ts
# =============================================================================
log "STEP 7 — Write auth.setup.ts"

cat > "$AUTH_SETUP_FILE" << 'AUTH_EOF'
/**
 * auth.setup.ts — Playwright global setup: authenticate once, persist storageState.
 *
 * Runs before every test project that declares `dependencies: ['setup']`.
 * Auth state is reused across all worker processes — login happens exactly once
 * per test run. The .auth/user.json file is gitignored; regenerated on each run.
 *
 * Required environment variables (set in .env.test, never committed):
 *   TEST_EMAIL     — test account email address
 *   TEST_PASSWORD  — test account password
 *
 * Output: tests/e2e/.auth/user.json
 *
 * CLAUDE.md Hard Guard #7:
 *   Post-login redirect target is /instrument — NEVER /daw.
 *   This fixture asserts the URL after login; if the target drifts,
 *   the entire test suite fails fast here rather than with confusing
 *   "element not found" errors downstream.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';

export const AUTH_FILE = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page }) => {
  const email    = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      [
        '',
        'Missing test credentials.',
        'Copy .env.test.example → .env.test and fill in TEST_EMAIL + TEST_PASSWORD.',
        'Use a dedicated test account, not your dev credentials.',
        '',
      ].join('\n')
    );
  }

  await page.goto('/auth');

  // Wait for the auth form to be interactive before filling
  await page.waitForSelector('[data-test=email]', { timeout: 10_000 });

  await page.fill('[data-test=email]',    email);
  await page.fill('[data-test=password]', password);
  await page.click('[data-test=submit]');

  // ── Hard Guard #7 ────────────────────────────────────────────────────────
  // Post-login redirect MUST land on /instrument.
  // If this assertion fails: audit AuthPage redirect logic and ProtectedRoute.
  // "Check redirect targets — /daw is always wrong" (AgentMeshPanel.tsx)
  await page.waitForURL('**/instrument', { timeout: 15_000 });
  await expect(page).toHaveURL(/\/instrument/, {
    message:
      'Hard Guard #7 violation: post-login redirect landed somewhere other than /instrument. ' +
      'Check AuthPage.tsx Wouter redirect and ProtectedRoute.tsx.',
  });

  // Persist session cookies + localStorage to disk; shared across all workers
  await page.context().storageState({ path: AUTH_FILE });
});
AUTH_EOF

ok "Written: ${AUTH_SETUP_FILE}"
echo ""

# =============================================================================
# STEP 8 — Write .env.test.example
# =============================================================================
log "STEP 8 — Write .env.test.example"

if [[ -f "$ENV_EXAMPLE" ]]; then
  warn ".env.test.example already exists — skipping (not overwriting)"
else
  cat > "$ENV_EXAMPLE" << 'ENV_EOF'
# .env.test.example
# ─────────────────────────────────────────────────────────────────────────────
# Copy this file to .env.test and fill in real values before running e2e tests.
# .env.test is gitignored and must NEVER be committed.
#
# Used by: tests/e2e/setup/auth.setup.ts (Playwright storageState pre-auth)
#
# Recommended: create a dedicated test@r3vibe.local account in your dev DB
# rather than using personal credentials.

TEST_EMAIL=testuser@r3vibe.local
TEST_PASSWORD=change-me-to-real-test-password
ENV_EOF
  ok "Written: ${ENV_EXAMPLE}"
fi
echo ""

# =============================================================================
# STEP 9 — Patch playwright.config.ts
# =============================================================================
log "STEP 9 — Patch playwright.config.ts (Python)"

PW_PATCH_PY="$(mktemp /tmp/r3_pw_patch_XXXXXX.py)"
TMPS+=("$PW_PATCH_PY")

cat > "$PW_PATCH_PY" << 'PYEOF'
import sys, re

path    = sys.argv[1]
content = open(path).read()

# ── Already-patched guard ─────────────────────────────────────────────────────
if "name: 'setup'" in content:
    print("SKIP: setup project already present in playwright.config.ts")
    sys.exit(0)

# ── Pre-mutation anchor assertions ────────────────────────────────────────────
n_chromium = content.count("name: 'chromium'")
assert n_chromium == 1, \
    f"anchor \"name: 'chromium'\" must appear exactly once, found {n_chromium}"
assert "projects:" in content, \
    "anchor 'projects:' not found in playwright.config.ts"


# ═════════════════════════════════════════════════════════════════════════════
# MUTATION 1 — Inject setup project at the START of the projects array
#
# Strategy: find `projects: [` (with optional whitespace / newline),
# then detect the indentation of the first existing project object.
# Insert the setup block before that object.
# ═════════════════════════════════════════════════════════════════════════════
m_projects = re.search(r'projects:\s*\[\s*\n', content)
if not m_projects:
    # Fallback: projects: [ with content on same line
    m_projects = re.search(r'projects:\s*\[', content)
    if not m_projects:
        print("ERROR: cannot locate projects: [ in config", file=sys.stderr)
        sys.exit(1)

after_bracket = content[m_projects.end():]

# Detect indent of first project entry
m_first_obj = re.search(r'^([ \t]+)\{', after_bracket, re.MULTILINE)
indent = m_first_obj.group(1) if m_first_obj else '    '

setup_block = (
    f"{indent}{{\n"
    f"{indent}  name: 'setup',\n"
    f"{indent}  testMatch: '**/setup/*.setup.ts',\n"
    f"{indent}}},\n"
)

insert_pos = m_projects.end()
content = content[:insert_pos] + setup_block + content[insert_pos:]

# Post-mutation assertion
assert content.count("name: 'setup'") == 1, "setup project injection failed"
print("  ✓ setup project injected into projects array")


# ═════════════════════════════════════════════════════════════════════════════
# MUTATION 2 — Add dependencies: ['setup'] to the chromium project
#
# Target: `name: 'chromium',` → add dependencies line immediately after.
# ═════════════════════════════════════════════════════════════════════════════
assert content.count("name: 'chromium',") == 1, \
    "anchor \"name: 'chromium',\" must be unique"

content = content.replace(
    "name: 'chromium',",
    "name: 'chromium',\n      dependencies: ['setup'],",
    1
)

assert content.count("dependencies: ['setup']") == 1, \
    "dependencies injection assertion failed"
print("  ✓ dependencies: ['setup'] added to chromium project")


# ═════════════════════════════════════════════════════════════════════════════
# MUTATION 3 — Add storageState to the chromium project's use block
#
# Handles the most common Playwright config patterns:
#   A) use: { ...devices['Desktop Chrome'] },
#   B) use: { ...devices['Desktop Chrome'],\n      ... }  (multi-prop, trailing comma)
# Falls through to a manual-patch warning if neither matches.
# ═════════════════════════════════════════════════════════════════════════════
STORAGE_STATE = "storageState: 'tests/e2e/.auth/user.json'"
storage_injected = False

# Pattern A — single-line spread, closing brace on same line
pat_inline = r"(use:\s*\{\s*\.\.\.devices\['Desktop Chrome'\]\s*\})"
m_inline = re.search(pat_inline, content)
if m_inline:
    old = m_inline.group(1)
    # Insert storageState before the closing }
    new = old[:-1].rstrip() + f", {STORAGE_STATE} }}"
    content = content[:m_inline.start()] + new + content[m_inline.end():]
    storage_injected = True
    print("  ✓ storageState injected (inline use block)")

# Pattern B — multi-line use block with trailing comma before }
if not storage_injected:
    pat_multi = r"(use:\s*\{[^}]*?)(,?\s*\})"
    # Only target the chromium project's use block — find it after 'chromium'
    chromium_start = content.index("name: 'chromium'")
    chunk = content[chromium_start:]
    m_multi = re.search(pat_multi, chunk, re.DOTALL)
    if m_multi and "devices['Desktop Chrome']" in m_multi.group(0):
        full_match = m_multi.group(0)
        # Insert storageState as a new property
        new_use = m_multi.group(1).rstrip() + f",\n      {STORAGE_STATE}\n    }}"
        new_chunk = chunk[:m_multi.start()] + new_use + chunk[m_multi.end():]
        content = content[:chromium_start] + new_chunk
        storage_injected = True
        print("  ✓ storageState injected (multi-line use block)")

if not storage_injected:
    print(
        "  ⚠ storageState NOT injected automatically — add manually to chromium use block:\n"
        f"    {STORAGE_STATE}"
    )


# ═════════════════════════════════════════════════════════════════════════════
# Final write (atomic for this process — no partial state on error above)
# ═════════════════════════════════════════════════════════════════════════════
open(path, 'w').write(content)
print(f"OK: playwright.config.ts written ({len(content)} chars)")
PYEOF

python3 "$PW_PATCH_PY" "$PW_CONFIG"
ok "playwright.config.ts patched"
echo ""

# =============================================================================
# STEP 10 — Patch audio.spec.ts
# =============================================================================
log "STEP 10 — Patch tests/e2e/audio.spec.ts (Python)"

AUDIO_PATCH_PY="$(mktemp /tmp/r3_audio_patch_XXXXXX.py)"
TMPS+=("$AUDIO_PATCH_PY")

cat > "$AUDIO_PATCH_PY" << 'PYEOF'
import sys

path    = sys.argv[1]
content = open(path).read()

# ── Already-patched guard ─────────────────────────────────────────────────────
n_root   = content.count("page.goto('/')")
n_instru = content.count("page.goto('/instrument')")

if n_root == 0:
    if n_instru > 0:
        print(f"SKIP: audio.spec.ts already navigates to /instrument ({n_instru} occurrence(s))")
    else:
        print("SKIP: no page.goto('/') or page.goto('/instrument') found — inspect manually")
    sys.exit(0)

# ── Patch: replace all goto('/') with goto('/instrument') ─────────────────────
# Audio tests exercise the DAW surface, which mounts only at /instrument.
# Navigation to / redirects client-side to /pricing; play-button never renders.
patched = content.replace("page.goto('/')", "page.goto('/instrument')")

# ── Post-mutation assertions ──────────────────────────────────────────────────
assert patched.count("page.goto('/')") == 0, \
    "Unreplaced page.goto('/') instances remain after patch"
assert patched.count("page.goto('/instrument')") == n_root + n_instru, \
    f"Expected {n_root + n_instru} '/instrument' instances after patch, count mismatch"

open(path, 'w').write(patched)
print(f"OK: audio.spec.ts — replaced {n_root} page.goto('/') → page.goto('/instrument')")
PYEOF

python3 "$AUDIO_PATCH_PY" "$AUDIO_SPEC"
ok "audio.spec.ts patched"
echo ""

# =============================================================================
# STEP 11 — Update .gitignore
# =============================================================================
log "STEP 11 — Update .gitignore"

if grep -qF "tests/e2e/.auth/" "$GITIGNORE" 2>/dev/null; then
  warn ".gitignore already contains tests/e2e/.auth/ — skipping"
else
  printf '\n# Playwright storageState — contains auth tokens, never commit\ntests/e2e/.auth/\n!tests/e2e/.auth/.gitkeep\n' \
    >> "$GITIGNORE"
  ok ".gitignore updated"
fi
echo ""

# =============================================================================
# STEP 12 — TypeScript gate
# =============================================================================
if [[ "$SKIP_TSC" == true ]]; then
  warn "STEP 12 — tsc check skipped (--skip-tsc)"
else
  log "STEP 12 — TypeScript gate (pnpm --filter @r3vibe/server tsc --noEmit)"
  cd "$REPO"
  TSC_OUT="$(pnpm --filter @r3vibe/server tsc --noEmit 2>&1 || true)"
  if echo "$TSC_OUT" | grep -qE "error TS"; then
    warn "tsc reported errors — showing relevant lines:"
    echo "$TSC_OUT" | grep -E "error TS" | head -20
    warn "auth.setup.ts is a Playwright test file and may not be in server tsconfig scope"
    warn "Run: cd ${REPO} && npx tsc --noEmit --project tsconfig.json to check manually"
  else
    ok "tsc gate passed"
  fi
fi
echo ""

# =============================================================================
# STEP 13 — Show final state
# =============================================================================
log "STEP 13 — Final state of modified files"
echo ""

sep
echo -e "  ${BLD}playwright.config.ts (patched)${RST}"
sep
cat -n "$PW_CONFIG"
echo ""

sep
echo -e "  ${BLD}tests/e2e/audio.spec.ts (patched)${RST}"
sep
cat -n "$AUDIO_SPEC"
echo ""

sep
echo -e "  ${BLD}tests/e2e/setup/auth.setup.ts (new)${RST}"
sep
cat -n "$AUTH_SETUP_FILE"
echo ""

# =============================================================================
# STEP 14 — Summary
# =============================================================================
sep
echo -e "  ${GRN}${BLD}DONE — playwright-auth-setup.sh applied${RST}"
sep
echo ""
echo -e "  ${BLD}Backups:${RST}   ${BACKUP_DIR}"
echo -e "  ${BLD}Created:${RST}   tests/e2e/setup/auth.setup.ts"
echo -e "  ${BLD}Created:${RST}   tests/e2e/.auth/.gitkeep"
[[ -f "$ENV_EXAMPLE" ]] && echo -e "  ${BLD}Created:${RST}   .env.test.example"
echo -e "  ${BLD}Patched:${RST}   playwright.config.ts"
echo -e "  ${BLD}Patched:${RST}   tests/e2e/audio.spec.ts"
echo ""
sep
echo -e "  ${BLD}Next steps${RST}"
sep
echo ""
echo -e "  ${BLD}1.${RST}  Create test credentials in your dev DB:"
echo -e "       INSERT a user row with a known email + hashed password"
echo -e "       (never use personal dev credentials for automated tests)"
echo ""
echo -e "  ${BLD}2.${RST}  Set up .env.test:"
echo -e "       cp .env.test.example .env.test"
echo -e "       # Edit: TEST_EMAIL=..., TEST_PASSWORD=..."
echo ""
echo -e "  ${BLD}3.${RST}  Verify AuthPage data-test attribute names match auth.setup.ts:"
echo -e "       ${YLW}[data-test=email]${RST}     — email <input>"
echo -e "       ${YLW}[data-test=password]${RST}  — password <input>"
echo -e "       ${YLW}[data-test=submit]${RST}    — submit <button>"
echo -e "       If they differ, edit tests/e2e/setup/auth.setup.ts accordingly"
echo ""
echo -e "  ${BLD}4.${RST}  Confirm storageState was injected — check playwright.config.ts:"
echo -e "       grep storageState playwright.config.ts"
echo -e "       If missing (edge-case config format), add manually to chromium use block:"
echo -e "       ${YLW}storageState: 'tests/e2e/.auth/user.json'${RST}"
echo ""
echo -e "  ${BLD}5.${RST}  Run the suite:"
echo -e "       source .env.test && pnpm test"
echo ""
echo -e "  ${BLD}6.${RST}  If test [2/16] volume control also fails, confirm audio.spec.ts:11"
echo -e "       navigates to /instrument (the patch covers all goto('/') in that file)"
echo ""
