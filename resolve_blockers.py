#!/usr/bin/env python3
"""
resolve_blockers.py
R3 v4 — Pre-integration blocker resolver
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Resolves the two hard-stops reported by integrate_agent_suite.py --dry-run:

  BLOCKER 1 — isAdmin column missing from shared/schema.ts
    • Reads the live schema, locates the users pgTable
    • Checks whether `boolean` is already imported from drizzle-orm/pg-core
    • Inserts the import if needed (surgical, unique-anchor)
    • Inserts  isAdmin: boolean("is_admin").default(false).notNull(),
      immediately after the passwordHash column line
    • Falls back to before createdAt, then to end-of-table if passwordHash
      not found
    • Runs:  pnpm drizzle-kit generate  →  pnpm drizzle-kit migrate
    • Verifies migration succeeded before proceeding

  BLOCKER 2 — ANTHROPIC_API_KEY missing / empty in .env
    • Prompts for the key interactively (input is hidden)
    • Validates the format (must start with sk-ant-)
    • Appends or replaces the key in .env

  THEN — re-runs the integration
    • Calls integrate_agent_suite.py --apply
    • Streams output live

USAGE
─────
  python3 resolve_blockers.py [--dry-run] [--root "/path/to/R3 v4"]

  --dry-run   Show what would change but write nothing and skip migration.
  --apply     (default) Execute everything.

EXIT CODES
──────────
  0  all blockers resolved, integration applied
  1  schema patch failed
  2  migration failed — schema patched but migration not applied
  3  integration script failed after blockers resolved
"""

from __future__ import annotations

import argparse
import getpass
import re
import shutil
import subprocess
import sys
import textwrap
from datetime import datetime
from pathlib import Path


# ══════════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ══════════════════════════════════════════════════════════════════════════════

SCHEMA_FILE      = "shared/schema.ts"
ENV_FILE         = ".env"
INTEGRATION_SCRIPT = "integrate_agent_suite.py"
BACKUP_DIR       = ".integration_backups"

# The exact Drizzle column declaration to insert
IS_ADMIN_DECL    = '  isAdmin: boolean("is_admin").default(false).notNull(),'

# What we search for in the import list to know boolean is already imported
BOOLEAN_TOKEN    = "boolean"


# ══════════════════════════════════════════════════════════════════════════════
# COLOUR HELPERS
# ══════════════════════════════════════════════════════════════════════════════

class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    RED    = "\033[91m"
    YELLOW = "\033[93m"
    GREEN  = "\033[92m"
    CYAN   = "\033[96m"
    DIM    = "\033[2m"

def ok(msg: str)   -> None: print(f"  {C.GREEN}✓{C.RESET}  {msg}")
def warn(msg: str) -> None: print(f"  {C.YELLOW}⚠{C.RESET}  {msg}")
def err(msg: str)  -> None: print(f"  {C.RED}✗{C.RESET}  {msg}")
def info(msg: str) -> None: print(f"  {C.CYAN}→{C.RESET}  {msg}")
def head(msg: str) -> None: print(f"\n{C.BOLD}{msg}{C.RESET}")
def rule()         -> None: print(f"{C.DIM}{'─' * 72}{C.RESET}")


# ══════════════════════════════════════════════════════════════════════════════
# ROOT DETECTION (mirrors integrate_agent_suite.py)
# ══════════════════════════════════════════════════════════════════════════════

def detect_root(explicit: str | None) -> Path:
    if explicit:
        p = Path(explicit).expanduser().resolve()
        if not p.exists():
            sys.exit(f"Root not found: {p}")
        return p
    cwd = Path.cwd()
    for candidate in [cwd, *cwd.parents]:
        if (candidate / "pnpm-workspace.yaml").exists():
            return candidate
    fallback = Path("~/Stable/R3 v4").expanduser()
    if fallback.exists():
        return fallback
    sys.exit(
        "Cannot locate project root. Run from inside R3 v4 or pass --root."
    )


# ══════════════════════════════════════════════════════════════════════════════
# BACKUP HELPER
# ══════════════════════════════════════════════════════════════════════════════

def backup(path: Path, root: Path) -> None:
    bd = root / BACKUP_DIR
    bd.mkdir(parents=True, exist_ok=True)
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = bd / f"{path.name}.{ts}.bak"
    shutil.copy2(path, dest)
    ok(f"Backup → {dest.relative_to(root)}")


# ══════════════════════════════════════════════════════════════════════════════
# BLOCKER 1 — isAdmin schema patch
# ══════════════════════════════════════════════════════════════════════════════

def patch_schema(root: Path, dry_run: bool) -> bool:
    """
    Returns True if the schema already has isAdmin or the patch succeeded.
    Returns False on any failure.
    """
    head("BLOCKER 1 — shared/schema.ts  isAdmin column")
    rule()

    schema_path = root / SCHEMA_FILE
    if not schema_path.exists():
        err(f"{SCHEMA_FILE} not found at {root}")
        return False

    src = schema_path.read_text(encoding="utf-8")

    # ── Already present? ──────────────────────────────────────────────────────
    if "isAdmin" in src:
        ok("isAdmin already present in schema — nothing to do")
        return True

    # ── Verify this is a Drizzle pg schema file ───────────────────────────────
    if "pgTable" not in src:
        err("pgTable not found in schema.ts — is this the right file?")
        return False

    # ── Step 1: ensure `boolean` is in the pg-core import ─────────────────────
    info("Checking drizzle-orm/pg-core import for `boolean`")
    patched_src = _ensure_boolean_imported(src)
    if patched_src is None:
        err("Could not locate drizzle-orm/pg-core import to add `boolean`.")
        err("Add it manually:  import { ..., boolean } from 'drizzle-orm/pg-core'")
        return False

    boolean_added = patched_src != src
    if boolean_added:
        info("Will add `boolean` to the pg-core import")
    else:
        ok("`boolean` already imported")

    # ── Step 2: find insertion point inside users table ───────────────────────
    info("Locating insertion point inside users pgTable")
    patched_src, strategy = _insert_is_admin(patched_src)
    if patched_src is None:
        err("Could not locate a safe insertion point in the users table.")
        err(
            f"Add manually to shared/schema.ts:\n"
            f"    {IS_ADMIN_DECL}"
        )
        return False

    ok(f"Insertion strategy: {strategy}")

    # ── Step 3: validate the result ───────────────────────────────────────────
    if "isAdmin" not in patched_src:
        err("Patch validation failed — isAdmin not found in result")
        return False
    if patched_src.count(IS_ADMIN_DECL) != 1:
        err("isAdmin declaration appeared ≠1 times — aborting")
        return False

    # ── Show diff ─────────────────────────────────────────────────────────────
    _show_schema_diff(src, patched_src)

    if dry_run:
        info("DRY-RUN: schema patch verified — would write to disk")
        return True

    # ── Write ─────────────────────────────────────────────────────────────────
    backup(schema_path, root)
    schema_path.write_text(patched_src, encoding="utf-8")
    ok(f"Written: {SCHEMA_FILE}")
    return True


def _ensure_boolean_imported(src: str) -> str | None:
    """
    Finds the  import { ..., text, integer, ... } from 'drizzle-orm/pg-core'
    line and adds `boolean` to the import list if absent.
    Returns modified src, or original src if boolean already present,
    or None if the pg-core import cannot be found.
    """
    # Drizzle pg-core import — single or multi-line
    # Matches: import { foo, bar } from "drizzle-orm/pg-core"
    #          import {
    #            foo,
    #            bar,
    #          } from "drizzle-orm/pg-core"
    pg_core_pattern = re.compile(
        r'(import\s*\{[^}]*?\})\s*from\s*["\']drizzle-orm/pg-core["\']',
        re.DOTALL,
    )
    m = pg_core_pattern.search(src)
    if not m:
        return None

    import_block = m.group(1)   # e.g.  import { text, integer, timestamp }
    full_match   = m.group(0)   # the whole import statement

    # Already has boolean?
    if re.search(r'\bboolean\b', import_block):
        return src

    # Insert `boolean` into the import list — add before the closing `}`
    # Preserve existing formatting (single-line or multi-line)
    if "\n" in import_block:
        # Multi-line: add as a new line before the closing }
        new_import_block = import_block.rstrip().rstrip("}").rstrip() + ",\n  boolean\n}"
    else:
        # Single-line: insert before closing }
        new_import_block = import_block.rstrip().rstrip("}").rstrip() + ", boolean }"

    new_full = new_import_block + f' from "drizzle-orm/pg-core"'

    # Safety: the replacement must be unique
    if src.count(full_match) != 1:
        return None

    return src.replace(full_match, new_full)


def _insert_is_admin(src: str) -> tuple[str | None, str]:
    """
    Tries three strategies in order to insert IS_ADMIN_DECL:

    Strategy A — after passwordHash column line
    Strategy B — before createdAt column line
    Strategy C — before closing }); of the users table

    Returns (patched_src, strategy_name) or (None, "failed").
    """
    lines = src.splitlines(keepends=True)

    # ── Strategy A: after passwordHash ───────────────────────────────────────
    password_hash_pattern = re.compile(r'^\s+passwordHash\s*:', re.IGNORECASE)
    for i, line in enumerate(lines):
        if password_hash_pattern.search(line):
            # Get indentation from this line
            indent = len(line) - len(line.lstrip())
            decl   = " " * indent + IS_ADMIN_DECL.lstrip() + "\n"
            candidate = lines[:i + 1] + [decl] + lines[i + 1:]
            result = "".join(candidate)
            if result.count(IS_ADMIN_DECL.strip()) == 1:
                return result, "after passwordHash"

    # ── Strategy B: before createdAt ─────────────────────────────────────────
    created_at_pattern = re.compile(r'^\s+createdAt\s*:', re.IGNORECASE)
    for i, line in enumerate(lines):
        if created_at_pattern.search(line):
            indent = len(line) - len(line.lstrip())
            decl   = " " * indent + IS_ADMIN_DECL.lstrip() + "\n"
            candidate = lines[:i] + [decl] + lines[i:]
            result = "".join(candidate)
            if result.count(IS_ADMIN_DECL.strip()) == 1:
                return result, "before createdAt"

    # ── Strategy C: before closing }); of users table ────────────────────────
    # Find the users pgTable definition block and locate its closing });
    users_table_pattern = re.compile(
        r'(export\s+const\s+users\s*=\s*pgTable\s*\([^)]*,\s*\{)',
        re.DOTALL,
    )
    m = users_table_pattern.search(src)
    if m:
        # Find the first  });  after the users table opening
        table_start = m.end()
        close_pattern = re.compile(r'\n(\s*)\}\s*\)')
        cm = close_pattern.search(src, table_start)
        if cm:
            # Insert before the closing }
            insert_pos = cm.start()
            decl_line  = "\n  " + IS_ADMIN_DECL.lstrip()
            result = src[:insert_pos] + decl_line + src[insert_pos:]
            if result.count(IS_ADMIN_DECL.strip()) == 1:
                return result, "before closing }); of users table"

    return None, "failed"


def _show_schema_diff(original: str, patched: str) -> None:
    orig_lines  = original.splitlines()
    patch_lines = patched.splitlines()
    print(f"\n  {C.DIM}── schema diff preview ──{C.RESET}")
    for i, line in enumerate(patch_lines):
        if i >= len(orig_lines) or line != orig_lines[i]:
            print(f"  {C.GREEN}+{C.RESET} {line}")
    print()


# ══════════════════════════════════════════════════════════════════════════════
# BLOCKER 1b — run Drizzle migration
# ══════════════════════════════════════════════════════════════════════════════

def run_drizzle_migration(root: Path, dry_run: bool) -> bool:
    head("BLOCKER 1b — Drizzle migration")
    rule()

    if dry_run:
        info("DRY-RUN: would run:")
        info("  pnpm drizzle-kit generate")
        info("  pnpm drizzle-kit migrate")
        return True

    for cmd_args, label in [
        (["pnpm", "drizzle-kit", "generate"], "drizzle-kit generate"),
        (["pnpm", "drizzle-kit", "migrate"],  "drizzle-kit migrate"),
    ]:
        info(f"Running: {' '.join(cmd_args)}")
        result = subprocess.run(
            cmd_args,
            cwd=str(root),
            capture_output=False,   # stream directly to terminal
            text=True,
        )
        if result.returncode != 0:
            err(f"{label} exited with code {result.returncode}")
            err("Migration failed — schema file has been patched but migration not applied.")
            err("Fix the issue above then run manually:")
            err("  pnpm drizzle-kit generate && pnpm drizzle-kit migrate")
            return False
        ok(f"{label} succeeded")

    return True


# ══════════════════════════════════════════════════════════════════════════════
# BLOCKER 2 — ANTHROPIC_API_KEY
# ══════════════════════════════════════════════════════════════════════════════

def patch_env_key(root: Path, dry_run: bool) -> bool:
    head("BLOCKER 2 — ANTHROPIC_API_KEY in .env")
    rule()

    env_path = root / ENV_FILE

    # Read existing content (create empty if absent)
    if env_path.exists():
        env_src = env_path.read_text(encoding="utf-8")
    else:
        env_src = ""
        warn(".env not found — will create it")

    # Check if already set and non-empty
    existing_lines = [
        l for l in env_src.splitlines()
        if l.startswith("ANTHROPIC_API_KEY=") and len(l) > len("ANTHROPIC_API_KEY=")
    ]
    if existing_lines:
        ok("ANTHROPIC_API_KEY already set in .env")
        return True

    # Prompt for key
    print(f"\n  {C.CYAN}Enter your Anthropic API key{C.RESET} (starts with sk-ant-)")
    print(f"  {C.DIM}Input is hidden — paste and press Enter{C.RESET}")
    try:
        key = getpass.getpass("  ANTHROPIC_API_KEY=").strip()
    except (KeyboardInterrupt, EOFError):
        print()
        err("Interrupted — API key not set")
        warn("You can set it manually:  echo 'ANTHROPIC_API_KEY=sk-ant-...' >> .env")
        return False

    if not key:
        warn("Empty input — skipping API key. Set it manually before the server starts.")
        return False

    if not key.startswith("sk-ant-"):
        warn(
            f"Key does not start with sk-ant- — proceeding anyway, "
            "but verify it is a valid Anthropic key."
        )

    if dry_run:
        info("DRY-RUN: would append ANTHROPIC_API_KEY to .env")
        return True

    # Remove any blank ANTHROPIC_API_KEY= lines, then append the real one
    cleaned_lines = [
        l for l in env_src.splitlines()
        if not l.startswith("ANTHROPIC_API_KEY=")
    ]
    new_env = "\n".join(cleaned_lines)
    if new_env and not new_env.endswith("\n"):
        new_env += "\n"
    new_env += f"ANTHROPIC_API_KEY={key}\n"

    if env_path.exists():
        backup(env_path, root)
    env_path.write_text(new_env, encoding="utf-8")
    ok("ANTHROPIC_API_KEY written to .env")
    warn("Add it to .env.production and Railway/Docker env config too")
    return True


# ══════════════════════════════════════════════════════════════════════════════
# STEP 3 — run integrate_agent_suite.py --apply
# ══════════════════════════════════════════════════════════════════════════════

def run_integration(root: Path, dry_run: bool) -> bool:
    head("STEP 3 — Run integration script")
    rule()

    script = root / INTEGRATION_SCRIPT
    if not script.exists():
        err(f"{INTEGRATION_SCRIPT} not found at {root}")
        err("Copy integrate_agent_suite.py to the project root first.")
        return False

    mode = "--dry-run" if dry_run else "--apply"
    cmd  = [sys.executable, str(script), mode]

    info(f"Running: {' '.join(cmd)}")
    print()

    result = subprocess.run(cmd, cwd=str(root))

    print()
    if result.returncode == 0:
        ok("Integration script completed successfully")
        return True
    else:
        err(f"Integration script exited with code {result.returncode}")
        return False


# ══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(
        description="R3 v4 — resolve integration blockers then apply",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dry-run", action="store_true", default=False,
        help="Show what would change but write nothing",
    )
    parser.add_argument(
        "--root", default=None,
        help="Explicit path to R3 v4 root (auto-detected if omitted)",
    )
    parser.add_argument(
        "--skip-key", action="store_true", default=False,
        help="Skip the ANTHROPIC_API_KEY prompt (set it manually later)",
    )
    args = parser.parse_args()

    dry_run = args.dry_run
    root    = detect_root(args.root)

    print(f"\n{C.BOLD}{'═' * 72}{C.RESET}")
    print(f"  R3 v4 — Blocker Resolver + Integration")
    print(f"  Root:  {root}")
    print(f"  Mode:  {'DRY-RUN' if dry_run else C.YELLOW + 'APPLY' + C.RESET}")
    print(f"{C.BOLD}{'═' * 72}{C.RESET}")

    # ── Blocker 1: schema patch ───────────────────────────────────────────────
    ok1 = patch_schema(root, dry_run)
    if not ok1:
        err("Schema patch failed — cannot continue.")
        sys.exit(1)

    # ── Blocker 1b: migration (skip in dry-run) ───────────────────────────────
    if not dry_run:
        ok1b = run_drizzle_migration(root, dry_run=False)
        if not ok1b:
            sys.exit(2)
    else:
        run_drizzle_migration(root, dry_run=True)

    # ── Blocker 2: API key ────────────────────────────────────────────────────
    if not args.skip_key:
        ok2 = patch_env_key(root, dry_run)
        if not ok2:
            warn("API key not set — continuing anyway (server will error on agent calls).")
    else:
        warn("--skip-key: ANTHROPIC_API_KEY not checked")

    # ── Integration ───────────────────────────────────────────────────────────
    ok3 = run_integration(root, dry_run)
    if not ok3:
        sys.exit(3)

    # ── Final instructions ────────────────────────────────────────────────────
    if not dry_run:
        head("POST-INTEGRATION CHECKLIST")
        rule()
        print(textwrap.dedent(f"""
  {C.BOLD}Run in order — stop if anything fails:{C.RESET}

  {C.CYAN}1.  Type-check{C.RESET}
        pnpm tsc --noEmit

  {C.CYAN}2.  Test suite (must stay at 42 passing){C.RESET}
        pnpm test

  {C.CYAN}3.  Smoke test{C.RESET}
        Admin login → /admin/agents
          ✓ ADMIN badge visible
          ✓ Expert Agents tab loads
          ✓ Agent Mesh tab loads
          ✓ Chat fires → Anthropic response returned
        Non-admin login → /admin/agents
          ✓ AdminForbidden screen, no agent panel

  {C.CYAN}4.  Set ANTHROPIC_API_KEY in production environments{C.RESET}
        .env.production · Railway dashboard · Docker env config

  {C.CYAN}5.  Seed an admin user if you haven't already{C.RESET}
        node server/scripts/seedAdmin.ts   (or equivalent)
        """))

    sys.exit(0)


if __name__ == "__main__":
    main()
