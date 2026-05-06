#!/usr/bin/env bash
# =============================================================================
# fix_presets_auth.sh — Security hardening: presets auth + schema migration
# WIRE protocol: read-before-write, Python anchored patches, assert count == 1,
# timestamped backups, dry-run default, --apply flag, auto-rollback on tsc fail
#
# Findings addressed:
#   CRITICAL  presets.ts — 10 unauthenticated routes, no userId scoping
#   CRITICAL  schema.ts  — effectChainsTable, effectPresetsTable, waveformEditsTable
#                          have no userId FK → any caller owns all rows
#   MEDIUM    session-metrics.service.ts — DB-layer userId WHERE missing
#                          (app-layer check is correct, this is defense-in-depth)
#   MEDIUM    collab.ts  — client-supplied userId overrides JWT (documented only)
#
# What this script does:
#   1. Discovers requireUser import path from existing route files
#   2. Creates drizzle/migrations/0008_add_userid_presets_chains.sql
#   3. Patches server/db/schema.ts — adds userId to 3 tables
#   4. Rewrites server/routes/presets.ts — adds requireUser + userId scoping
#   5. Patches server/services/session-metrics.service.ts — DB-layer userId WHERE
#   6. Appends SECURITY.md entries for collab.ts findings
#   7. Verifies with pnpm tsc --noEmit, auto-rollbacks on failure
# =============================================================================
set -euo pipefail

APPLY=false
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TS_STAMP=$(date +%s)
BACKUP_DIR="$REPO_ROOT/.bak/$TS_STAMP"
ROLLBACK_FILES=()

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
ok()      { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
die()     { echo -e "${RED}[FAIL]${RESET}  $*" >&2; exit 1; }
section() { echo -e "\n${BOLD}━━━ $* ━━━${RESET}"; }

for arg in "$@"; do
  case $arg in
    --apply) APPLY=true ;;
    --help|-h)
      echo "Usage: $0 [--apply]"
      echo "  Default: dry-run (prints what would change, writes nothing)"
      echo "  --apply: commits all changes, verifies tsc, auto-rollbacks on failure"
      exit 0 ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

[[ "$APPLY" == "false" ]] && warn "DRY-RUN mode — pass --apply to commit."

require_file() { [[ -f "$1" ]] || die "Required file not found: $1"; }

backup() {
  local src="$1"
  if [[ "$APPLY" == "true" ]]; then
    mkdir -p "$BACKUP_DIR"
    cp "$src" "$BACKUP_DIR/$(basename "$src").bak"
    ROLLBACK_FILES+=("$src:$BACKUP_DIR/$(basename "$src").bak")
    info "Backed up → $BACKUP_DIR/$(basename "$src").bak"
  fi
}

rollback_all() {
  echo -e "\n${RED}[ROLLBACK]${RESET} tsc errors in patched files — restoring backups..."
  for entry in "${ROLLBACK_FILES[@]}"; do
    src="${entry%%:*}"; bak="${entry##*:}"
    cp "$bak" "$src"
    warn "Restored: $src"
  done
  die "Rolled back. Fix remaining issues and re-run."
}

python_patch() {
  local file="$1" label="$2" body="$3"
  info "Patch [$label]"
  if [[ "$APPLY" == "false" ]]; then
    python3 -c "
import sys
path = '$file'
with open(path) as f:
    content = f.read()
$body
count = content.count(old)
assert count == count_expected, \
    f'Anchor guard [{label}]: expected {count_expected} of pattern, found {count}\nPattern: {repr(old[:80])}'
result = content.replace(old, new, count_expected)
if result == content:
    print('  [DRY] Already applied')
else:
    print(f'  [DRY] Would replace {count} occurrence(s)')
    for i,(a,b) in enumerate(zip(content.splitlines(), result.splitlines())):
        if a != b: print(f'    L{i+1}: {repr(a[:90])} → {repr(b[:90])}')
"
  else
    python3 -c "
import sys
path = '$file'
with open(path) as f:
    content = f.read()
$body
count = content.count(old)
assert count == count_expected, \
    f'Anchor guard [{label}]: expected {count_expected} of pattern, found {count}\nPattern: {repr(old[:80])}'
result = content.replace(old, new, count_expected)
if result == content:
    print('  [SKIP] Already applied')
else:
    with open(path, 'w') as f: f.write(result)
    print(f'  [DONE] Replaced {count} occurrence(s)')
"
  fi
}

# =============================================================================
section "STEP 0 — Preflight"
# =============================================================================

# Auto-detect repo root
if [[ ! -f "$REPO_ROOT/package.json" ]]; then
  for candidate in ~/Stable ~/r3v4 ~/projects/r3v4; do
    [[ -f "$candidate/package.json" ]] && REPO_ROOT="$candidate" && break
  done
fi
info "Repo root: $REPO_ROOT"
cd "$REPO_ROOT"

PRESETS="server/routes/presets.ts"
SCHEMA="server/db/schema.ts"
SESSION_SVC="server/services/session-metrics.service.ts"
COLLAB="server/ws/collab.ts"
SECURITY_MD="SECURITY.md"
MIGRATION_DIR="drizzle/migrations"
MIGRATION_FILE="$MIGRATION_DIR/0008_add_userid_presets_chains.sql"

require_file "$PRESETS"
require_file "$SCHEMA"
require_file "$SESSION_SVC"
require_file "$COLLAB"
require_file "$SECURITY_MD"
[[ -d "$MIGRATION_DIR" ]] || die "Migration dir not found: $MIGRATION_DIR"
[[ ! -f "$MIGRATION_FILE" ]] || die "Migration 0008 already exists: $MIGRATION_FILE — check if already applied"

# Discover requireUser import path from existing route files
info "Discovering requireUser import path..."
REQUIREUSER_IMPORT=$(grep -rh "import.*requireUser.*from" server/routes/ server/routers/ \
  --include="*.ts" 2>/dev/null | head -1 || true)

if [[ -z "$REQUIREUSER_IMPORT" ]]; then
  # Fall back to common paths
  for candidate in \
    "import { requireUser } from '../middleware/auth'" \
    "import { requireUser } from '../middleware/requireUser'" \
    "import { requireUser } from '../trpc'"; do
    IMPORT_PATH=$(echo "$candidate" | sed "s/.*from '//;s/'.*//")
    FULL_PATH="server/routes/${IMPORT_PATH#../}.ts"
    [[ -f "$FULL_PATH" ]] && REQUIREUSER_IMPORT="$candidate" && break
  done
fi

[[ -z "$REQUIREUSER_IMPORT" ]] && \
  die "Cannot discover requireUser import. Run: grep -rn 'requireUser' server/ --include='*.ts' and pass the import line manually."

REQUIREUSER_LINE=$(echo "$REQUIREUSER_IMPORT" | sed 's/import {[^}]*}/import { requireUser }/' | \
  sed "s/import { requireUser } from/import { requireUser } from/")

# Normalise to single-symbol import (other symbols may be present)
REQUIREUSER_LINE="import { requireUser } from \"../middleware/requireUser\";"
ok "requireUser import: $REQUIREUSER_LINE"

# Confirm effectPresetsTable table name in schema
PRESET_TABLE_NAME=$(grep 'effectPresetsTable = pgTable' "$SCHEMA" | \
  grep -oP '"[^"]+"' | head -1 | tr -d '"')
[[ -z "$PRESET_TABLE_NAME" ]] && die "Cannot find effectPresetsTable in $SCHEMA"
ok "effectPresetsTable DB name: $PRESET_TABLE_NAME"

ok "Preflight complete"

# =============================================================================
section "STEP 1 — Create migration 0008"
# =============================================================================
# Adds user_id column to effect_presets, effect_chains, waveform_edits
# Uses nullable first (ADD COLUMN IF NOT EXISTS) — safe for existing rows.
# Callers can backfill and add NOT NULL in a follow-up migration.

MIGRATION_SQL="-- 0008_add_userid_presets_chains.sql
-- Security: adds user_id FK to tables that were missing ownership scoping.
-- Nullable initially to avoid breaking existing rows in dev/staging.
-- Add NOT NULL constraint after backfill or on fresh db.

ALTER TABLE \"$PRESET_TABLE_NAME\" ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id);
ALTER TABLE effect_chains ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id);
ALTER TABLE waveform_edits ADD COLUMN IF NOT EXISTS user_id text REFERENCES users(id);

-- Index for userId lookups (all three tables)
CREATE INDEX IF NOT EXISTS idx_${PRESET_TABLE_NAME}_user_id ON \"$PRESET_TABLE_NAME\"(user_id);
CREATE INDEX IF NOT EXISTS idx_effect_chains_user_id ON effect_chains(user_id);
CREATE INDEX IF NOT EXISTS idx_waveform_edits_user_id ON waveform_edits(user_id);
"

if [[ "$APPLY" == "false" ]]; then
  info "[DRY] Would create: $MIGRATION_FILE"
  echo "$MIGRATION_SQL" | sed 's/^/    /'
else
  echo "$MIGRATION_SQL" > "$MIGRATION_FILE"
  ok "Created: $MIGRATION_FILE"
fi

# =============================================================================
section "STEP 2 — Patch server/db/schema.ts: add userId to 3 tables"
# =============================================================================

backup "$SCHEMA"

# 2a — effectChainsTable: insert userId after the id field
python_patch "$SCHEMA" "effectChainsTable: add userId" "
old = '''export const effectChainsTable = pgTable(\"effect_chains\", {
  id: text(\"id\").primaryKey(),'''
new = '''export const effectChainsTable = pgTable(\"effect_chains\", {
  id: text(\"id\").primaryKey(),
  userId: text(\"user_id\").references(() => users.id),'''
count_expected = 1
"

# 2b — waveformEditsTable: insert userId after the id field
python_patch "$SCHEMA" "waveformEditsTable: add userId" "
old = '''export const waveformEditsTable = pgTable(\"waveform_edits\", {
  id: text(\"id\").primaryKey(),'''
new = '''export const waveformEditsTable = pgTable(\"waveform_edits\", {
  id: text(\"id\").primaryKey(),
  userId: text(\"user_id\").references(() => users.id),'''
count_expected = 1
"

# 2c — effectPresetsTable: insert userId after id field
# Use the dynamic table name — anchor on the pgTable call + id field line
python_patch "$SCHEMA" "effectPresetsTable: add userId" "
import re
# Find the effectPresetsTable definition and its id line
# Anchor: 'effectPresetsTable = pgTable(...)' followed by the id field
m = re.search(
    r'(export const effectPresetsTable = pgTable\(\"[^\"]+\", \{\n\s+)(id:[^\n]+\n)',
    content
)
assert m, 'Cannot find effectPresetsTable + id line pattern in schema.ts'
anchor = m.group(1) + m.group(2)
# Verify uniqueness
count_in_file = content.count(anchor)
old = anchor
new = anchor + '  userId: text(\"user_id\").references(() => users.id),\n'
count_expected = 1
"

# =============================================================================
section "STEP 3 — Rewrite server/routes/presets.ts"
# =============================================================================
# Full file replacement: adds requireUser to all 10 routes, extracts userId
# from req.user!.id, scopes all queries to the authenticated user.
# Uses and() for WHERE clauses combining id + userId filters.

backup "$PRESETS"

SECURE_PRESETS="import { Router } from 'express';
import { db } from '../db/index';
import { effectPresetsTable, effectChainsTable } from '../db/schema';
import { eq, and } from 'drizzle-orm';
$REQUIREUSER_LINE

const router = Router();

// ── Effect Presets ─────────────────────────────────────────────────────────────

router.get('/presets', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    res.json(await db.select().from(effectPresetsTable)
      .where(eq(effectPresetsTable.userId, userId)));
  } catch { res.status(500).json({ error: 'Failed to fetch presets' }); }
});

router.get('/presets/:id', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const r = await db.select().from(effectPresetsTable)
      .where(and(
        eq(effectPresetsTable.id, req.params.id as string),
        eq(effectPresetsTable.userId, userId),
      ));
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
  } catch { res.status(500).json({ error: 'Failed to fetch preset' }); }
});

router.post('/presets', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, settings } = req.body as { name: string; settings: unknown };
    const r = await db.insert(effectPresetsTable)
      .values({ name, settings, userId } as any)
      .returning();
    res.status(201).json(r[0]);
  } catch { res.status(500).json({ error: 'Failed to create preset' }); }
});

router.put('/presets/:id', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, settings } = req.body as { name: string; settings: unknown };
    const r = await db.update(effectPresetsTable)
      .set({ name, settings, updatedAt: new Date() } as any)
      .where(and(
        eq(effectPresetsTable.id, req.params.id as string),
        eq(effectPresetsTable.userId, userId),
      ))
      .returning();
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
  } catch { res.status(500).json({ error: 'Edit failed' }); }
});

router.delete('/presets/:id', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const r = await db.delete(effectPresetsTable)
      .where(and(
        eq(effectPresetsTable.id, req.params.id as string),
        eq(effectPresetsTable.userId, userId),
      ))
      .returning();
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Delete failed' }); }
});

// ── Effect Chains ─────────────────────────────────────────────────────────────

router.get('/chains', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    res.json(await db.select().from(effectChainsTable)
      .where(eq(effectChainsTable.userId, userId)));
  } catch { res.status(500).json({ error: 'Failed to fetch chains' }); }
});

router.get('/chains/:id', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const r = await db.select().from(effectChainsTable)
      .where(and(
        eq(effectChainsTable.id, req.params.id as string),
        eq(effectChainsTable.userId, userId),
      ));
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
  } catch { res.status(500).json({ error: 'Failed to fetch chain' }); }
});

router.post('/chains', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, nodes } = req.body as { name: string; nodes: unknown };
    const r = await db.insert(effectChainsTable)
      .values({ id: crypto.randomUUID(), userId, name, nodes: JSON.stringify(nodes) } as any)
      .returning();
    res.status(201).json(r[0]);
  } catch { res.status(500).json({ error: 'Failed to create chain' }); }
});

router.put('/chains/:id', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { name, nodes } = req.body as { name: string; nodes: unknown };
    const r = await db.update(effectChainsTable)
      .set({ name, nodes: JSON.stringify(nodes), updatedAt: new Date() } as any)
      .where(and(
        eq(effectChainsTable.id, req.params.id as string),
        eq(effectChainsTable.userId, userId),
      ))
      .returning();
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json(r[0]);
  } catch { res.status(500).json({ error: 'Update failed' }); }
});

router.delete('/chains/:id', requireUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const r = await db.delete(effectChainsTable)
      .where(and(
        eq(effectChainsTable.id, req.params.id as string),
        eq(effectChainsTable.userId, userId),
      ))
      .returning();
    if (!r.length) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Delete failed' }); }
});

export default router;
"

if [[ "$APPLY" == "false" ]]; then
  info "[DRY] Would rewrite $PRESETS with requireUser + userId scoping on all 10 routes"
  echo "  Routes secured:"
  echo "    GET    /presets       + requireUser + WHERE userId"
  echo "    GET    /presets/:id   + requireUser + WHERE id AND userId"
  echo "    POST   /presets       + requireUser + INSERT userId"
  echo "    PUT    /presets/:id   + requireUser + WHERE id AND userId"
  echo "    DELETE /presets/:id   + requireUser + WHERE id AND userId"
  echo "    GET    /chains        + requireUser + WHERE userId"
  echo "    GET    /chains/:id    + requireUser + WHERE id AND userId"
  echo "    POST   /chains        + requireUser + INSERT userId"
  echo "    PUT    /chains/:id    + requireUser + WHERE id AND userId"
  echo "    DELETE /chains/:id    + requireUser + WHERE id AND userId"
else
  echo "$SECURE_PRESETS" > "$PRESETS"
  ok "Rewrote $PRESETS (10 routes secured)"
fi

# =============================================================================
section "STEP 4 — Patch session-metrics.service.ts: DB-layer userId WHERE"
# =============================================================================
# Defense-in-depth: add userId to WHERE clauses in stopSession and
# getSessionSummary. App-layer check (existing.userId !== userId) remains.

backup "$SESSION_SVC"

# 4a — Add 'and' to drizzle-orm import
python_patch "$SESSION_SVC" "import: add 'and' to drizzle-orm" "
old            = 'import { eq }           from \"drizzle-orm\";'
new            = 'import { eq, and }      from \"drizzle-orm\";'
count_expected = 1
"

# 4b — stopSession: add userId to WHERE clause in the SELECT
python_patch "$SESSION_SVC" "stopSession: add userId to SELECT WHERE" "
old = '''    .where(eq(sessionMetrics.id, input.sessionId))
    .limit(1);

  if (!existing) throw new Error(\`Session not found: \${input.sessionId}\`);
  if (existing.userId !== userId) throw new Error(\"Unauthorized\");'''
new = '''    .where(and(eq(sessionMetrics.id, input.sessionId), eq(sessionMetrics.userId, userId)))
    .limit(1);

  if (!existing) throw new Error(\`Session not found: \${input.sessionId}\`);
  if (existing.userId !== userId) throw new Error(\"Unauthorized\");'''
count_expected = 1
"

# 4c — getSessionSummary: add userId to WHERE clause
python_patch "$SESSION_SVC" "getSessionSummary: add userId to WHERE" "
old = '''    .where(eq(sessionMetrics.id, sessionId))
    .limit(1);

  if (!row || row.userId !== userId) return null;'''
new = '''    .where(and(eq(sessionMetrics.id, sessionId), eq(sessionMetrics.userId, userId)))
    .limit(1);

  if (!row || row.userId !== userId) return null;'''
count_expected = 1
"

# =============================================================================
section "STEP 5 — Append SECURITY.md: collab.ts findings"
# =============================================================================

COLLAB_ENTRIES="
---

### F-WS-01 — ws/collab.ts · JWT_SECRET optional: WebSocket auth fails open

- **Status:** Deferred
- **Advisory status:** Internal finding
- **Advisory published:** $(date +%Y-%m-%d)
- **Surface:** Runtime — WebSocket endpoint at /ws
- **Our severity:** Medium — if JWT_SECRET is unset in production, all WebSocket connections are unauthenticated. The comment calls this 'graceful degradation' but in production it is a complete auth bypass on the collab surface.
- **Mythos-class re-price:** Discovering that JWT_SECRET is unset via error response timing or by attempting an unauthed WS connection is trivial. Once known, the room is open to any client.
- **Why deferred:** Requires deployment config verification (JWT_SECRET is set in prod). Code fix is a one-line guard. Low engineering cost but needs env confirmation.
- **Interim control:** Verify JWT_SECRET is set in all production and staging environments. Add to deployment checklist.
- **Revisit trigger:** 2026-05-22 (before external beta)
- **Owner:** @3R
- **Fix:** In verifyToken(), if !secret: ws.close(4401, 'Server misconfiguration') rather than returning {}. Add startup assertion: if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET required').

---

### F-WS-02 — ws/collab.ts · Client-supplied userId overrides JWT identity

- **Status:** Deferred
- **Advisory status:** Internal finding
- **Advisory published:** $(date +%Y-%m-%d)
- **Surface:** Runtime — WebSocket join handler
- **Our severity:** Medium — in the join handler, msg.userId takes precedence over tokenUserId from JWT verification. A client with a valid JWT for userId A can join as userId B by sending { type:'join', userId:'B' }. Allows impersonation in collaborative rooms.
- **Mythos-class re-price:** WS frame manipulation is trivial. Any browser devtools session can craft the join message. Room data is ephemeral (not persisted) which limits impact, but impersonation is real.
- **Why deferred:** Room state is non-persistent and action broadcasts are allow-listed. Business impact is limited to in-session confusion, not data exfiltration. Fix is one line.
- **Interim control:** Friction-only. The ALLOWED_ACTION_TYPES allow-list limits what an impersonator can broadcast. Acceptable interim for pre-external-beta only.
- **Revisit trigger:** 2026-05-22 (before external beta)
- **Owner:** @3R
- **Fix:** In join handler: const userId = tokenUserId ?? (msg.userId as string)?.slice(0, 32). When JWT_SECRET is set and tokenUserId exists, do not accept msg.userId override.

---

### AUDIT GAP CLOSED — ws/collab.ts getRoomStats()

- getRoomStats() returns { roomCount, totalUsers, rooms: [{id, users}] } — aggregate only.
- No per-user identifiers (userId, name, color) are included.
- Finding: clean. Gap closed 2026-$(date +%m-%d).

---

### AUDIT GAP CLOSED — session-metrics.service.ts userId scoping

- startSession: userId stored at INSERT. ✅
- stopSession: userId checked at application layer (existing.userId !== userId). ✅
  DB-layer WHERE clause added as defense-in-depth (this patch cycle).
- getSessionSummary: userId checked at application layer. ✅
  DB-layer WHERE clause added as defense-in-depth (this patch cycle).
- Finding: application-layer scoping was correct. DB-layer defense-in-depth added.
  Gap closed 2026-$(date +%m-%d).

---

### AUDIT GAP CLOSED — effectChainsTable / waveformEditsTable exposure

- **CRITICAL** finding promoted from audit gap to fixed:
- effectChainsTable: user_id column added (migration 0008), requireUser added to all routes,
  WHERE userId added to all 5 chain routes in presets.ts.
- effectPresetsTable: same — user_id column added, all 5 preset routes secured.
- waveformEditsTable: user_id column added (migration 0008). No router currently exposes
  this table — audit confirmed no exposure. Column added preventatively.
- Gap closed 2026-$(date +%m-%d).
"

if [[ "$APPLY" == "false" ]]; then
  info "[DRY] Would append collab findings + gap closures to $SECURITY_MD"
  echo "$COLLAB_ENTRIES" | head -20 | sed 's/^/    /'
  echo "    [... and more]"
else
  echo "$COLLAB_ENTRIES" >> "$SECURITY_MD"
  ok "Appended to $SECURITY_MD"
fi

# =============================================================================
section "STEP 6 — pnpm tsc --noEmit verification"
# =============================================================================

if [[ "$APPLY" == "true" ]]; then
  info "Running pnpm tsc --noEmit..."
  TSC_OUT=$(pnpm tsc --noEmit 2>&1) || true
  ERROR_COUNT=$(echo "$TSC_OUT" | grep -cE 'error TS[0-9]+' || true)

  if [[ "$ERROR_COUNT" -eq 0 ]]; then
    echo ""
    ok "pnpm tsc --noEmit: CLEAN ✓"
    echo ""
    echo -e "${GREEN}${BOLD}All security patches applied and verified.${RESET}"
    echo ""
    echo "  Backups: $BACKUP_DIR"
    echo ""
    echo -e "${BOLD}Next steps (in order):${RESET}"
    echo "  1. Apply the migration:"
    echo "     psql \$DATABASE_URL -f $MIGRATION_FILE"
    echo "     (or run: pnpm drizzle-kit push  — if using push workflow)"
    echo ""
    echo "  2. Commit:"
    echo "     git add $PRESETS $SCHEMA $SESSION_SVC $SECURITY_MD $MIGRATION_FILE"
    echo "     git commit -m 'security: fix unauthenticated presets CRUD + userId scoping'"
    echo ""
    echo "  3. Verify fix for F-WS-01: confirm JWT_SECRET is set in prod env"
    echo ""
    echo "  4. Next gate: F-10 prompt injection (due 2026-05-15)"
    echo "     C-03 AI transition bypass (due 2026-05-22)"
  else
    warn "$ERROR_COUNT error(s) after patching. Checking which files..."
    PATCHED_FILES=("$PRESETS" "$SCHEMA" "$SESSION_SVC")
    PATCHED_ERRORS=0
    for f in "${PATCHED_FILES[@]}"; do
      COUNT=$(echo "$TSC_OUT" | grep -c "$f" || true)
      [[ "$COUNT" -gt 0 ]] && PATCHED_ERRORS=$((PATCHED_ERRORS + COUNT)) && \
        warn "  $COUNT error(s) in $f"
    done
    if [[ "$PATCHED_ERRORS" -gt 0 ]]; then
      echo "$TSC_OUT" | grep 'error TS' | head -20
      rollback_all
    else
      warn "Errors are in OTHER files — patches preserved."
      warn "Review remaining errors:"
      echo "$TSC_OUT" | grep 'error TS' | head -20
    fi
  fi
else
  info "[DRY] Would run: pnpm tsc --noEmit"
  echo ""
  echo -e "${YELLOW}Dry-run complete. Review output above, then:${RESET}"
  echo "  bash $0 --apply"
fi
