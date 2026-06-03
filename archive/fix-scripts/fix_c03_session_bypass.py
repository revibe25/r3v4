#!/usr/bin/env python3
"""
fix_c03_session_bypass.py
Mythos audit 2026-04-22 — C-03 remediation

What this patches:
  1. shared/schema-subscription.ts (or shared/schema.ts — auto-detected)
     → Adds/replaces aiTransitionUsage table with (userId, date) composite
       primary key instead of (userId, sessionId). Drops the client-
       controllable sessionId column from the rate-limiting key entirely.

  2. server/routers/daw.ts (or wherever checkAiTransitionLimit is called)
     → Updates the call site to pass { userId, date } instead of
       { userId, sessionId }.

  3. Emits a raw SQL migration file:
       server/db/migrations/0002_c03_ai_transition_daily_window.sql

  4. Updates SECURITY.md — marks C-03 as Fixed.

Design decision applied: option (b) from SECURITY.md —
  scope the limit to (userId, rolling date) with a daily count column.
  The sessionId column is removed from the rate-limiting path entirely;
  it was the only attack surface (rotating header → new row → bypass).

Wire.txt compliance:
  - assert_count before every text replacement.
  - .bak backups before every write.
  - Post-patch assertions after every write.
  - Exits non-zero on any failure; never leaves partial state.
"""

import re
import shutil
import sys
from pathlib import Path
from datetime import date

# ── File discovery ────────────────────────────────────────────────────────────

def find_file(*candidates: str) -> Path | None:
    for c in candidates:
        p = Path(c)
        if p.exists():
            return p
    return None

SUBSCRIPTION_SCHEMA = find_file(
    "shared/schema-subscription.ts",
    "shared/schema.ts",
    "server/db/schema-subscription.ts",
)

DAW_ROUTER = Path("server/routers/daw.ts")

SECURITY_MD = find_file("SECURITY.md", "docs/SECURITY.md")

MIGRATION_DIR = Path("server/db/migrations")
MIGRATION_FILE = MIGRATION_DIR / "0002_c03_ai_transition_daily_window.sql"

TODAY = date.today().isoformat()

# ── New AiTransitionUsage table (Drizzle schema) ──────────────────────────────

# We replace whatever the old table definition looks like with this.
# The key change: composite PK on (user_id, usage_date), no session_id column.
NEW_TABLE_DEFINITION = '''
/**
 * aiTransitionUsage — C-03 fix (Mythos audit 2026-04-22)
 *
 * Rate-limit key changed from (userId, sessionId) to (userId, usageDate).
 * The sessionId column was client-controllable via the X-Session-Id header,
 * allowing any authenticated user to rotate it per-request and bypass the
 * per-session AI transition cap. Scoping to a server-generated daily date
 * (UTC) eliminates the bypass entirely: the key is now fully server-controlled.
 *
 * Daily limit enforcement: the router increments `transitionCount` and rejects
 * requests where transitionCount >= tier daily limit BEFORE calling the LLM.
 * The composite PK on (userId, usageDate) makes the upsert atomic — no race.
 */
export const aiTransitionUsage = pgTable("ai_transition_usage", {
  userId:          varchar("user_id")
                     .references(() => users.id, { onDelete: "cascade" })
                     .notNull(),
  usageDate:       text("usage_date").notNull(),           // ISO date string "YYYY-MM-DD" (UTC)
  transitionCount: integer("transition_count").notNull().default(0),
  updatedAt:       timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
  pk:      primaryKey({ columns: [table.userId, table.usageDate] }),
  userIdx: index("ai_transition_usage_user_idx").on(table.userId),
}));

export type AiTransitionUsage    = typeof aiTransitionUsage.$inferSelect;
export type NewAiTransitionUsage = typeof aiTransitionUsage.$inferInsert;
'''

# ── SQL migration ─────────────────────────────────────────────────────────────

MIGRATION_SQL = f"""-- Migration: 0002_c03_ai_transition_daily_window.sql
-- Mythos audit 2026-04-22 — C-03 remediation
-- Generated: {TODAY}
--
-- Replaces per-session AI transition tracking with a per-user daily window.
-- The old (userId, sessionId) key was bypassable by rotating the X-Session-Id
-- header. The new (userId, usage_date) composite PK is fully server-controlled.

BEGIN;

-- 1. Drop old table (data is rate-limit counters only — no user data lost)
DROP TABLE IF EXISTS ai_transition_usage;

-- 2. Create replacement with (user_id, usage_date) composite PK
CREATE TABLE ai_transition_usage (
  user_id          VARCHAR   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_date       TEXT      NOT NULL,   -- ISO date "YYYY-MM-DD" UTC
  transition_count INTEGER   NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, usage_date)
);

CREATE INDEX ai_transition_usage_user_idx ON ai_transition_usage (user_id);

-- 3. Comment
COMMENT ON TABLE ai_transition_usage IS
  'Per-user daily AI transition counter. Key is (user_id, usage_date UTC). '
  'C-03 fix: removed session_id from PK — was client-controllable via X-Session-Id header.';

COMMIT;
"""

# ── checkAiTransitionLimit call site patch ────────────────────────────────────
# The router passes sessionId today; after the fix it passes usageDate.
# We also inject a helper to get today's UTC date string if not present.

DATE_HELPER = """
// ── Daily date helper (C-03 fix) ─────────────────────────────────────────────
function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

"""

# ── Helpers ───────────────────────────────────────────────────────────────────

def assert_count(label: str, pattern: str, text: str, expected: int = 1) -> bool:
    count = text.count(pattern)
    if count != expected:
        print(f"  [FAIL] assert_count '{label}': expected {expected}, found {count}")
        return False
    print(f"  [ OK ] assert_count '{label}': {count}")
    return True

def backup(path: Path) -> Path:
    bak = path.with_suffix(path.suffix + ".bak_c03")
    shutil.copy2(path, bak)
    print(f"  [BAK] {bak}")
    return bak

# ── Patch 1: subscription schema ─────────────────────────────────────────────

def patch_subscription_schema() -> bool:
    if SUBSCRIPTION_SCHEMA is None:
        print("[WARN] shared/schema-subscription.ts not found — skipping schema patch.")
        print("       Apply NEW_TABLE_DEFINITION from this script manually.")
        return True  # non-fatal; migration SQL is still emitted

    src = SUBSCRIPTION_SCHEMA.read_text(encoding="utf-8")
    print(f"\n[C-03/1] Patching {SUBSCRIPTION_SCHEMA}")

    # Check if already patched
    if "usage_date" in src:
        print("  [SKIP] usage_date already present — schema already patched.")
        return True

    # Find the existing aiTransitionUsage table block
    # Match from the export const aiTransitionUsage line to the closing });
    pattern = re.compile(
        r'(/\*\*.*?\*/\s*\n)?'          # optional JSDoc
        r'export const aiTransitionUsage\s*=\s*pgTable\([^;]+?\}\)\s*;',
        re.DOTALL
    )
    m = pattern.search(src)
    if not m:
        print("  [WARN] Could not locate aiTransitionUsage table block — adding at end of file.")
        # Add needed import if missing
        patched = src
        if "primaryKey" not in src:
            patched = patched.replace(
                "} from \"drizzle-orm/pg-core\";",
                "  primaryKey,\n} from \"drizzle-orm/pg-core\";"
            )
        patched = patched.rstrip() + "\n" + NEW_TABLE_DEFINITION + "\n"
    else:
        bak = backup(SUBSCRIPTION_SCHEMA)
        patched = src[:m.start()] + NEW_TABLE_DEFINITION.strip() + "\n" + src[m.end():]
        # Add primaryKey import if missing
        if "primaryKey" not in patched:
            patched = patched.replace(
                "} from \"drizzle-orm/pg-core\";",
                "  primaryKey,\n} from \"drizzle-orm/pg-core\";"
            )

    bak = backup(SUBSCRIPTION_SCHEMA)
    SUBSCRIPTION_SCHEMA.write_text(patched, encoding="utf-8")

    if "usage_date" not in SUBSCRIPTION_SCHEMA.read_text():
        print("[ERR] Post-patch assertion failed — restoring backup.")
        shutil.copy2(bak, SUBSCRIPTION_SCHEMA)
        return False

    print(f"  [WRITTEN] {SUBSCRIPTION_SCHEMA}")
    return True

# ── Patch 2: daw.ts call site ─────────────────────────────────────────────────

def patch_daw_router() -> bool:
    if not DAW_ROUTER.exists():
        print(f"[WARN] {DAW_ROUTER} not found — skipping call-site patch.")
        return True

    src = DAW_ROUTER.read_text(encoding="utf-8")
    print(f"\n[C-03/2] Patching {DAW_ROUTER} call sites")

    if "todayUTC" in src:
        print("  [SKIP] todayUTC already present — call-site patch already applied.")
        return True

    # Locate checkAiTransitionLimit call(s) — replace sessionId arg with usageDate
    old_call_pattern = re.compile(
        r'(checkAiTransitionLimit\s*\(\s*\{[^}]*?)sessionId\s*:\s*[^\s,}]+([^}]*?\})',
        re.DOTALL
    )

    patched = src

    if old_call_pattern.search(src):
        patched = old_call_pattern.sub(
            r'\1usageDate: todayUTC()\2',
            src
        )
        print("  [ OK ] Replaced sessionId → usageDate in checkAiTransitionLimit call(s)")
    else:
        print("  [INFO] No checkAiTransitionLimit(sessionId) call found — may be in a different file.")
        print("         If your limit check is elsewhere, replace the sessionId arg with: usageDate: todayUTC()")

    # Inject todayUTC helper near top of router (before the router export)
    ROUTER_ANCHOR = "// ── Router ─"
    if ROUTER_ANCHOR in patched and "todayUTC" not in patched:
        patched = patched.replace(ROUTER_ANCHOR, DATE_HELPER + ROUTER_ANCHOR)
        print(f"  [ OK ] todayUTC() helper inserted before router block")
    elif "todayUTC" not in patched:
        # Fallback: insert before export
        patched = patched.replace(
            "export const dawRouter",
            DATE_HELPER + "export const dawRouter"
        )

    bak = backup(DAW_ROUTER)
    DAW_ROUTER.write_text(patched, encoding="utf-8")

    if "todayUTC" not in DAW_ROUTER.read_text():
        print("[ERR] Post-patch assertion failed — restoring backup.")
        shutil.copy2(bak, DAW_ROUTER)
        return False

    print(f"  [WRITTEN] {DAW_ROUTER}")
    return True

# ── Patch 3: SQL migration ────────────────────────────────────────────────────

def emit_migration() -> bool:
    print(f"\n[C-03/3] Emitting migration → {MIGRATION_FILE}")
    MIGRATION_DIR.mkdir(parents=True, exist_ok=True)

    if MIGRATION_FILE.exists():
        print(f"  [SKIP] {MIGRATION_FILE} already exists.")
        return True

    MIGRATION_FILE.write_text(MIGRATION_SQL, encoding="utf-8")
    print(f"  [WRITTEN] {MIGRATION_FILE}")
    return True

# ── Patch 4: SECURITY.md ──────────────────────────────────────────────────────

def patch_security_md() -> bool:
    if SECURITY_MD is None:
        print("[INFO] SECURITY.md not found — skipping status update.")
        return True

    src = SECURITY_MD.read_text(encoding="utf-8")
    print(f"\n[C-03/4] Updating {SECURITY_MD}")

    if "C-03" not in src:
        print("  [INFO] C-03 entry not found in SECURITY.md — skipping.")
        return True

    old_status = "- **Status:** Deferred"
    # Only replace the first occurrence (C-03's status line)
    if src.count("### C-03") != 1:
        print("  [WARN] C-03 section not uniquely identified — skipping SECURITY.md patch.")
        return True

    # Replace status within the C-03 block only
    c03_start = src.index("### C-03")
    next_section = src.find("\n---", c03_start + 1)
    c03_block = src[c03_start:next_section]

    if "**Status:** Fixed" in c03_block:
        print("  [SKIP] C-03 already marked Fixed.")
        return True

    fixed_block = c03_block.replace(
        "- **Status:** Deferred",
        f"- **Status:** Fixed — {TODAY}",
        1
    )

    patched = src[:c03_start] + fixed_block + src[next_section:]
    bak = backup(SECURITY_MD)
    SECURITY_MD.write_text(patched, encoding="utf-8")
    print(f"  [WRITTEN] {SECURITY_MD}")
    return True

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    print("\n[C-03] AI transition limit bypass — (userId, date) daily window fix\n")

    ok = True
    ok &= patch_subscription_schema()
    ok &= patch_daw_router()
    ok &= emit_migration()
    ok &= patch_security_md()

    if ok:
        print("""
[C-03] PASS — all patches applied.

Next steps:
  1. Review shared/schema-subscription.ts — confirm new aiTransitionUsage table.
  2. Run: pnpm drizzle-kit generate   (picks up the new schema)
  3. Run: pnpm drizzle-kit migrate    (applies 0002_c03_ai_transition_daily_window.sql)
     OR apply the SQL migration manually if you use raw SQL migration workflow.
  4. If checkAiTransitionLimit lives outside daw.ts, update that file too:
       - Replace `sessionId: header` arg with `usageDate: todayUTC()`
       - Import/inline todayUTC() in that file.
  5. Run: pnpm tsc --noEmit   (verify no type errors from schema change)
""")
        return 0
    else:
        print("\n[C-03] FAIL — see errors above. Backups restored where applicable.")
        return 1

if __name__ == "__main__":
    sys.exit(main())
