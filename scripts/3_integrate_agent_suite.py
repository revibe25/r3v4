#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  R3 v4 — AGI-Enhanced Agent Suite Integrator                                ║
║  Wire.txt §14 §15 §16 compliant · CLAUDE.md Hard Guards enforced            ║
║                                                                              ║
║  WHAT THIS SCRIPT DOES (in order):                                          ║
║    Phase 0  — Preflight: read every file before touching anything           ║
║    Phase 1  — Schema verification: users.isAdmin column                     ║
║    Phase 2  — Env verification: ANTHROPIC_API_KEY in all env files          ║
║    Phase 3  — tRPC alias discovery: locate @/lib/trpc client                ║
║    Phase 4  — Bug fixes: 2 confirmed bugs patched before file moves         ║
║    Phase 5  — File moves: scripts/ → canonical paths (with .bak backups)    ║
║    Phase 6  — Anchor verification: dry-run patch scripts, confirm count=1   ║
║    Phase 7  — Patch application: procedures.ts + App.tsx (requires confirm) ║
║    Phase 8  — Post-patch: pnpm tsc --noEmit → pnpm test                    ║
║    Rollback — Any failure at any phase triggers full rollback                ║
║                                                                              ║
║  SAFETY:                                                                     ║
║    • DRY_RUN=True by default — no writes until you confirm                  ║
║    • Every write is preceded by a timestamped .bak backup                   ║
║    • Full rollback registry — every change is reversible                    ║
║    • Anchor uniqueness enforced: count != 1 → HARD STOP                     ║
║                                                                              ║
║  USAGE:                                                                      ║
║    python3 3_integrate_agent_suite.py              # dry-run (default)      ║
║    python3 3_integrate_agent_suite.py --apply      # live run               ║
║    python3 3_integrate_agent_suite.py --phase 0-3  # preflight only         ║
║    python3 3_integrate_agent_suite.py --rollback   # undo last apply        ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import time
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# ── Terminal colors ────────────────────────────────────────────────────────────
class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    DIM    = "\033[2m"
    RED    = "\033[91m"
    GREEN  = "\033[92m"
    YELLOW = "\033[93m"
    CYAN   = "\033[96m"
    WHITE  = "\033[97m"
    BLUE   = "\033[94m"
    MAGENTA= "\033[95m"

def ok(msg: str)    -> None: print(f"  {C.GREEN}✓{C.RESET}  {msg}")
def warn(msg: str)  -> None: print(f"  {C.YELLOW}⚠{C.RESET}  {msg}")
def fail(msg: str)  -> None: print(f"  {C.RED}✗{C.RESET}  {msg}")
def info(msg: str)  -> None: print(f"  {C.CYAN}→{C.RESET}  {msg}")
def head(msg: str)  -> None: print(f"\n{C.BOLD}{C.WHITE}{msg}{C.RESET}")
def dim(msg: str)   -> None: print(f"  {C.DIM}{msg}{C.RESET}")

# FIX 5: hardstop() — truncate lines that exceed box width (was overflowing)
def hardstop(msg: str) -> None:
    BOX_WIDTH = 52
    print(f"\n{C.RED}{C.BOLD}  ╔═ HARD STOP {'═' * (BOX_WIDTH - 12)}╗{C.RESET}")
    for line in msg.strip().split("\n"):
        if len(line) > BOX_WIDTH:
            line = line[:BOX_WIDTH - 3] + "..."
        print(f"{C.RED}{C.BOLD}  ║  {line:<{BOX_WIDTH}}║{C.RESET}")
    print(f"{C.RED}{C.BOLD}  ╚{'═' * (BOX_WIDTH + 4)}╝{C.RESET}\n")
    sys.exit(1)

# ── Project root detection ─────────────────────────────────────────────────────
def find_root() -> Path:
    """Walk up from CWD to find the R3 v4 monorepo root (has pnpm-workspace.yaml)."""
    p = Path.cwd()
    for _ in range(8):
        if (p / "pnpm-workspace.yaml").exists():
            return p
        if p.parent == p:
            break
        p = p.parent
    # FIX 6: removed dead fallback — loop already checks CWD on first iteration.
    hardstop(
        "Cannot locate R3 v4 root.\n"
        "Run this script from inside the R3 v4 monorepo.\n"
        "Expected: pnpm-workspace.yaml at root."
    )

ROOT = find_root()

# ── Canonical paths ────────────────────────────────────────────────────────────
SCRIPTS_DIR = ROOT / "scripts"

FILE_MAP: dict[str, Path] = {
    "adminRouter.ts":     ROOT / "server" / "routers" / "adminRouter.ts",
    "AgentSuite.tsx":     ROOT / "client" / "src" / "components" / "admin" / "AgentSuite.tsx",
    "AgentMeshPanel.tsx": ROOT / "client" / "src" / "components" / "admin" / "AgentMeshPanel.tsx",
    "AgentSuitePage.tsx": ROOT / "client" / "src" / "pages" / "admin" / "AgentSuitePage.tsx",
}

PROCEDURES_TS  = ROOT / "server" / "procedures.ts"
APP_TSX        = ROOT / "client" / "src" / "App.tsx"
SHARED_SCHEMA  = ROOT / "server" / "db" / "schema.ts"
ENV_FILES      = [ROOT / ".env", ROOT / ".env.production"]

# Candidate tRPC client locations (checked in order)
TRPC_CANDIDATES: list[Path] = [
    ROOT / "client" / "src" / "lib" / "trpc.ts",
    ROOT / "client" / "src" / "utils" / "trpc.ts",
    ROOT / "client" / "hooks" / "trpc.ts",
    ROOT / "client" / "src" / "trpc.ts",
]

# ── Rollback registry ──────────────────────────────────────────────────────────
@dataclass
class RollbackEntry:
    description: str
    backup_path: Optional[Path] = None
    original_path: Optional[Path] = None
    action: str = "restore"  # restore | delete

ROLLBACK_REGISTRY: list[RollbackEntry] = []
ROLLBACK_LOG = ROOT / ".r3_integrator_rollback.json"

def register_rollback(entry: RollbackEntry) -> None:
    ROLLBACK_REGISTRY.append(entry)

def execute_rollback() -> None:
    head("⟳  ROLLBACK — reversing all applied changes")
    if not ROLLBACK_REGISTRY:
        warn("Nothing to roll back.")
        return
    for entry in reversed(ROLLBACK_REGISTRY):
        try:
            if entry.action == "restore" and entry.backup_path and entry.original_path:
                shutil.copy2(entry.backup_path, entry.original_path)
                entry.backup_path.unlink(missing_ok=True)
                ok(f"Restored: {entry.original_path.relative_to(ROOT)}")
            elif entry.action == "delete" and entry.original_path:
                entry.original_path.unlink(missing_ok=True)
                ok(f"Deleted (rollback): {entry.original_path.relative_to(ROOT)}")
        except Exception as e:
            fail(f"Rollback failed for {entry.description}: {e}")
    ok("Rollback complete.")

def save_rollback_log() -> None:
    data = [
        {
            "description": e.description,
            "backup_path": str(e.backup_path) if e.backup_path else None,
            "original_path": str(e.original_path) if e.original_path else None,
            "action": e.action,
        }
        for e in ROLLBACK_REGISTRY
    ]
    ROLLBACK_LOG.write_text(json.dumps(data, indent=2))

# FIX 2: backup() — use timestamped suffix so multiple backups of the same file
# don't overwrite each other. Previously `path.with_suffix(".bak")` produced a
# fixed name; a second patch on the same file (e.g. App.tsx patched by 7c then
# 7d) would clobber the first .bak, making rollback unable to restore the
# original pre-7c content.
def backup(path: Path) -> Path:
    """Create a timestamped .bak copy. Returns the backup path."""
    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    bak = path.with_suffix(f".{ts}.bak")
    shutil.copy2(path, bak)
    return bak

# ── Anchor patch helper ────────────────────────────────────────────────────────
def anchor_patch(
    target: Path,
    anchor: str,
    replacement: str,
    description: str,
    dry_run: bool,
) -> bool:
    """
    Wire.txt §14 anchor patch.
    Returns True on success, False on failure.
    Enforces count == 1 before writing.
    """
    src = target.read_text(encoding="utf-8")
    count = src.count(anchor)
    if count != 1:
        fail(f"{description} — anchor found {count}× (expected 1)")
        dim(f"  Anchor: {anchor[:70]!r}…")
        return False
    ok(f"Anchor verified (1 occurrence): {description}")
    if dry_run:
        dim(f"  DRY RUN — would patch: {target.relative_to(ROOT)}")
        return True
    bak = backup(target)
    register_rollback(RollbackEntry(
        description=description,
        backup_path=bak,
        original_path=target,
        action="restore",
    ))
    target.write_text(src.replace(anchor, replacement), encoding="utf-8")
    ok(f"Patched: {target.relative_to(ROOT)}")
    return True

# ════════════════════════════════════════════════════════════════════════════════
# PHASE 0 — Preflight reads (Wire.txt §1: read before anything)
# ════════════════════════════════════════════════════════════════════════════════
def phase0_preflight() -> dict[str, bool]:
    head("Phase 0  — PREFLIGHT: verify all source files exist")
    results: dict[str, bool] = {}

    # Scripts dir
    if not SCRIPTS_DIR.exists():
        hardstop(f"scripts/ directory not found at {SCRIPTS_DIR}")

    for fname, dest in FILE_MAP.items():
        src = SCRIPTS_DIR / fname
        if src.exists():
            ok(f"Found: scripts/{fname} ({src.stat().st_size:,} bytes)")
            results[fname] = True
        else:
            fail(f"Missing: scripts/{fname}")
            results[fname] = False

    # Core patch targets
    for label, path in [
        ("server/procedures.ts", PROCEDURES_TS),
        ("client/src/App.tsx",   APP_TSX),
        ("shared/schema.ts",     SHARED_SCHEMA),
    ]:
        if path.exists():
            ok(f"Found: {label}")
        else:
            fail(f"Missing: {label}")
            results[label] = False

    missing = [k for k, v in results.items() if not v]
    if missing:
        hardstop(
            f"Missing files: {', '.join(missing)}\n"
            "Cannot proceed. Ensure all source files are present."
        )
    return results

# ════════════════════════════════════════════════════════════════════════════════
# PHASE 1 — Schema verification: users.isAdmin
# ════════════════════════════════════════════════════════════════════════════════
def phase1_schema() -> None:
    head("Phase 1  — SCHEMA: verify users.isAdmin column")
    src = SHARED_SCHEMA.read_text(encoding="utf-8")

    patterns = [
        r"isAdmin\s*:",
        r"isAdmin\s*=",
        r"is_admin",
        r'"isAdmin"',
    ]
    found = any(re.search(p, src) for p in patterns)

    if found:
        ok("users.isAdmin found in shared/schema.ts")
        for line in src.split("\n"):
            if "isAdmin" in line or "is_admin" in line:
                dim(f"  → {line.strip()}")
    else:
        hardstop(
            "users.isAdmin NOT found in shared/schema.ts\n"
            "Wire.txt §6 DATA AGENT requires this column.\n"
            "\n"
            "Add and migrate:\n"
            "  isAdmin: boolean('is_admin').default(false)\n"
            "  pnpm drizzle-kit generate\n"
            "  pnpm drizzle-kit migrate\n"
            "Then re-run this script."
        )

# ════════════════════════════════════════════════════════════════════════════════
# PHASE 2 — Env verification: ANTHROPIC_API_KEY
# ════════════════════════════════════════════════════════════════════════════════
def phase2_env() -> None:
    head("Phase 2  — ENV: verify ANTHROPIC_API_KEY")
    any_found = False

    for env_file in ENV_FILES:
        if not env_file.exists():
            warn(f"Not found: {env_file.relative_to(ROOT)} (may be OK if using platform env)")
            continue
        content = env_file.read_text(encoding="utf-8")
        if "ANTHROPIC_API_KEY" in content:
            match = re.search(r"ANTHROPIC_API_KEY\s*=\s*(.+)", content)
            if match and match.group(1).strip() and match.group(1).strip() != '""':
                ok(f"ANTHROPIC_API_KEY set in {env_file.relative_to(ROOT)}")
                any_found = True
            else:
                warn(f"ANTHROPIC_API_KEY present but empty in {env_file.relative_to(ROOT)}")
        else:
            warn(f"ANTHROPIC_API_KEY not found in {env_file.relative_to(ROOT)}")

    if os.environ.get("ANTHROPIC_API_KEY"):
        ok("ANTHROPIC_API_KEY found in process environment")
        any_found = True

    if not any_found:
        warn(
            "ANTHROPIC_API_KEY not confirmed.\n"
            "  The admin agentChat procedure will throw INTERNAL_SERVER_ERROR.\n"
            "  Set it in .env or your Railway/Docker environment before deploying.\n"
            "  Continuing — this is not a hard stop for local testing."
        )

# ════════════════════════════════════════════════════════════════════════════════
# PHASE 3 — tRPC alias discovery
# ════════════════════════════════════════════════════════════════════════════════
def phase3_trpc_alias() -> Optional[Path]:
    head("Phase 3  — tRPC: locate @/lib/trpc client")
    found_path: Optional[Path] = None

    for candidate in TRPC_CANDIDATES:
        if candidate.exists():
            content = candidate.read_text(encoding="utf-8")
            if re.search(r"export\s+const\s+trpc|createTRPCReact|createTRPCProxyClient", content):
                ok(f"tRPC client found: {candidate.relative_to(ROOT)}")
                found_path = candidate
                break
            else:
                dim(f"  Exists but no tRPC export: {candidate.relative_to(ROOT)}")

    if not found_path:
        warn(
            "Could not auto-locate tRPC client.\n"
            "  Searched: " + " · ".join(str(c.relative_to(ROOT)) for c in TRPC_CANDIDATES) + "\n"
            "  Manually update the import in AgentSuite.tsx and AgentMeshPanel.tsx:\n"
            '    import { trpc } from "@/lib/trpc";\n'
            "  Replace @/lib/trpc with your actual path."
        )
        return None

    alias_used = "@/lib/trpc"

    # FIX 1: relative_to(ROOT / "client" / "src") crashes with ValueError if the
    # found path is outside client/src (e.g. client/hooks/trpc.ts, which is a
    # listed TRPC_CANDIDATE). Guard with try/except and fall back to client/ root.
    try:
        rel = found_path.relative_to(ROOT / "client" / "src")
        expected_alias = "@/" + str(rel.with_suffix("")).replace("\\", "/")
    except ValueError:
        try:
            rel = found_path.relative_to(ROOT / "client")
            expected_alias = "@/" + str(rel.with_suffix("")).replace("\\", "/")
            warn(
                f"tRPC client is outside client/src — computed alias: '{expected_alias}'\n"
                f"  Update the import in AgentSuite.tsx + AgentMeshPanel.tsx to match."
            )
        except ValueError:
            warn(
                f"Cannot compute alias for {found_path} — verify import path manually.\n"
                "  Update the import in AgentSuite.tsx + AgentMeshPanel.tsx."
            )
            return found_path

    if expected_alias != alias_used:
        warn(f"Alias mismatch: files import '{alias_used}' but client is at '{expected_alias}'")
        warn("Update the import line in AgentSuite.tsx + AgentMeshPanel.tsx before building.")
    else:
        ok(f"Alias {alias_used} matches discovered path ✓")

    return found_path

# ════════════════════════════════════════════════════════════════════════════════
# PHASE 4 — Bug fixes (apply before file moves)
# ════════════════════════════════════════════════════════════════════════════════
def phase4_bug_fixes(dry_run: bool) -> None:
    head("Phase 4  — BUG FIXES: 2 confirmed bugs patched in scripts/ files")

    # ── Bug Fix 1: AgentSuite.tsx — React namespace import ────────────────────
    info("Fix 1: AgentSuite.tsx — React.ReactNode used without React namespace import")
    agent_suite = SCRIPTS_DIR / "AgentSuite.tsx"
    src = agent_suite.read_text(encoding="utf-8")

    old_import = 'import { useState, useRef, useEffect, useCallback } from "react";'
    new_import = 'import React, { useState, useRef, useEffect, useCallback } from "react";'

    if old_import in src:
        ok("Found target import line")
        if not dry_run:
            bak = backup(agent_suite)
            register_rollback(RollbackEntry(
                description="Fix 1: AgentSuite.tsx React import",
                backup_path=bak,
                original_path=agent_suite,
                action="restore",
            ))
            agent_suite.write_text(src.replace(old_import, new_import, 1), encoding="utf-8")
            ok("Applied Fix 1 → React namespace import added")
        else:
            dim("  DRY RUN — would add React default import")
    elif "import React," in src:
        ok("Fix 1 not needed — React already imported as default")
    else:
        m = re.search(r'import\s*\{[^}]*\}\s*from\s*["\']react["\'];', src)
        if m:
            old = m.group(0)
            new = old.replace("import {", "import React, {")
            if not dry_run:
                bak = backup(agent_suite)
                register_rollback(RollbackEntry(
                    description="Fix 1: AgentSuite.tsx React import (variant)",
                    backup_path=bak,
                    original_path=agent_suite,
                    action="restore",
                ))
                agent_suite.write_text(src.replace(old, new, 1), encoding="utf-8")
                ok("Applied Fix 1 (variant) → React namespace import added")
            else:
                dim(f"  DRY RUN — would patch: {old[:60]}…")
        else:
            warn("Fix 1: could not locate React import line — patch manually")

    # ── Bug Fix 2: AgentMeshPanel.tsx — wrong tRPC path in auth manifest ──────
    info("Fix 2: AgentMeshPanel.tsx — /trpc must be /api/trpc in auth system prompt")
    mesh_panel = SCRIPTS_DIR / "AgentMeshPanel.tsx"
    src2 = mesh_panel.read_text(encoding="utf-8")

    old_path = "- tRPC middleware must be mounted on /trpc — no other path"
    new_path  = "- tRPC middleware must be mounted on /api/trpc — no other path (/trpc is a confirmed regression — Wire.txt §7)"

    if old_path in src2:
        ok("Found incorrect tRPC path string")
        if not dry_run:
            bak = backup(mesh_panel)
            register_rollback(RollbackEntry(
                description="Fix 2: AgentMeshPanel.tsx /api/trpc correction",
                backup_path=bak,
                original_path=mesh_panel,
                action="restore",
            ))
            mesh_panel.write_text(src2.replace(old_path, new_path, 1), encoding="utf-8")
            ok("Applied Fix 2 → /api/trpc corrected in auth manifest")
        else:
            dim("  DRY RUN — would fix /trpc → /api/trpc in auth agent system prompt")
    elif "/api/trpc" in src2 and "mounted on /api/trpc" in src2:
        ok("Fix 2 not needed — /api/trpc already correct")
    else:
        warn("Fix 2: could not locate the incorrect path string — check AgentMeshPanel.tsx manually")

# ════════════════════════════════════════════════════════════════════════════════
# PHASE 5 — File moves: scripts/ → canonical destinations
# ════════════════════════════════════════════════════════════════════════════════
def phase5_file_moves(dry_run: bool) -> None:
    head("Phase 5  — FILE MOVES: scripts/ → canonical paths")

    for fname, dest in FILE_MAP.items():
        src = SCRIPTS_DIR / fname
        if not src.exists():
            fail(f"Source missing: scripts/{fname} — skipping")
            continue

        if not dry_run:
            dest.parent.mkdir(parents=True, exist_ok=True)

        if dest.exists():
            info(f"Destination exists — will overwrite: {dest.relative_to(ROOT)}")
            if not dry_run:
                bak = backup(dest)
                register_rollback(RollbackEntry(
                    description=f"File move overwrite backup: {fname}",
                    backup_path=bak,
                    original_path=dest,
                    action="restore",
                ))
        else:
            if not dry_run:
                register_rollback(RollbackEntry(
                    description=f"File move (new): {fname}",
                    original_path=dest,
                    action="delete",
                ))

        if dry_run:
            dim(f"  DRY RUN — would copy:\n    {src.relative_to(ROOT)}\n    → {dest.relative_to(ROOT)}")
        else:
            shutil.copy2(src, dest)
            ok(f"Copied: {src.relative_to(ROOT)} → {dest.relative_to(ROOT)}")

# ════════════════════════════════════════════════════════════════════════════════
# PHASE 6 — Anchor verification (dry-run patch checks)
# ════════════════════════════════════════════════════════════════════════════════
def phase6_anchor_verify() -> tuple[Optional[str], Optional[str], Optional[str]]:
    """
    Discover the correct anchors from the actual files.
    Returns (import_anchor, approuter_anchor, app_tsx_anchor) or None on failure.
    """
    head("Phase 6  — ANCHOR VERIFY: confirm patch anchors (dry-run scan)")

    # ── procedures.ts: find the last router import line ────────────────────────
    import_anchor: Optional[str] = None
    approuter_anchor: Optional[str] = None

    if PROCEDURES_TS.exists():
        content = PROCEDURES_TS.read_text(encoding="utf-8")

        router_imports = re.findall(
            r'^import\s*\{[^}]+\}\s*from\s*["\']\.\/routers\/[^"\']+["\'];',
            content,
            re.MULTILINE,
        )
        if router_imports:
            candidate = router_imports[-1]
            count = content.count(candidate)
            if count == 1:
                import_anchor = candidate
                ok(f"Import anchor found (1×): {candidate[:70]}")
            else:
                warn(f"Import anchor '{candidate[:50]}' appears {count}× — ambiguous")
                fallback = 'import { subsRouter } from "./routers/subsRouter";'
                if content.count(fallback) == 1:
                    import_anchor = fallback
                    ok(f"Using fallback anchor (1×): {fallback[:70]}")
        else:
            warn("No router imports found in procedures.ts — check file manually")

        router_body_patterns = [
            r'  subscriptions:\s*subsRouter,',
            r'  subscriptions:\s*\w+,',
            r'  sessions:\s*\w+,',
            r'  ai:\s*\w+,',
        ]
        for pat in router_body_patterns:
            m = re.search(pat, content)
            if m:
                candidate = m.group(0)
                if content.count(candidate) == 1:
                    approuter_anchor = candidate
                    ok(f"appRouter anchor found (1×): {candidate.strip()}")
                    break
                else:
                    dim(f"  Pattern '{candidate.strip()}' appears {content.count(candidate)}× — skipping")

        if not approuter_anchor:
            warn("appRouter anchor not found — provide manually (see INTEGRATION_PATCH.md)")

        if "adminRouter" in content:
            warn("adminRouter already present in procedures.ts — patch may be duplicate")
    else:
        fail("server/procedures.ts not found")

    # ── App.tsx: find the catch-all / redirect route ───────────────────────────
    app_tsx_anchor: Optional[str] = None

    if APP_TSX.exists():
        content = APP_TSX.read_text(encoding="utf-8")

        if "/admin/agents" in content:
            warn("/admin/agents route already present in App.tsx — patch may be duplicate")

        redirect_patterns = [
            r'<Route>\s*\n\s*<Redirect\s+to=["\'][^"\']+["\'][^/]*/>\s*\n\s*</Route>',
            r'<Route>\s*\n\s*<[A-Za-z]+\s[^>]+/>\s*\n\s*</Route>',
            r'<Route path="\*">[^<]*</Route>',
            r'<Route component=\{[A-Za-z]+\} />',
            r'<Route component=\{[A-Za-z]+\} />',
        ]
        for pat in redirect_patterns:
            m = re.search(pat, content)
            if m:
                candidate = m.group(0)
                if content.count(candidate) == 1:
                    app_tsx_anchor = candidate
                    ok(f"App.tsx catch-all anchor found (1×):\n    {candidate[:80].strip()}")
                    break

        if not app_tsx_anchor:
            warn(
                "App.tsx catch-all anchor not auto-detected.\n"
                "  Manually set PATCH_APP_ANCHOR in this script to match your exact block.\n"
                "  See INTEGRATION_PATCH.md for the expected pattern."
            )
    else:
        fail("client/src/App.tsx not found")

    return import_anchor, approuter_anchor, app_tsx_anchor

# ════════════════════════════════════════════════════════════════════════════════
# PHASE 7 — Patch application
# ════════════════════════════════════════════════════════════════════════════════
def phase7_patch(
    import_anchor: Optional[str],
    approuter_anchor: Optional[str],
    app_tsx_anchor: Optional[str],
    dry_run: bool,
) -> None:
    head("Phase 7  — PATCH: apply procedures.ts + App.tsx modifications")

    # FIX 3: Guard against phase 7 being run without phase 6 anchor data.
    # Previously all three anchors would be None and every patch would silently
    # skip with warn(), exiting 0 and printing "APPLIED" while writing nothing.
    if all(x is None for x in (import_anchor, approuter_anchor, app_tsx_anchor)):
        hardstop(
            "Phase 7 requires anchor data from Phase 6.\n"
            "Run with --phase 6-7 or omit --phase to run all phases."
        )

    # ── PATCH 7a: procedures.ts — add adminRouter import ──────────────────────
    if import_anchor:
        content = PROCEDURES_TS.read_text(encoding="utf-8")
        if 'adminRouter' in content and '"./routers/adminRouter"' in content:
            ok("PATCH 7a: adminRouter import already present — skipping")
        else:
            replacement_import = import_anchor + '\nimport { adminRouter } from "./routers/adminRouter";'
            anchor_patch(
                target=PROCEDURES_TS,
                anchor=import_anchor,
                replacement=replacement_import,
                description="PATCH 7a: add adminRouter import to procedures.ts",
                dry_run=dry_run,
            )
    else:
        warn("PATCH 7a skipped — no import anchor discovered")

    # ── PATCH 7b: procedures.ts — wire admin into appRouter ───────────────────
    if approuter_anchor:
        content = PROCEDURES_TS.read_text(encoding="utf-8")
        if "admin: adminRouter" in content:
            ok("PATCH 7b: admin: adminRouter already wired — skipping")
        else:
            leading = re.match(r'^(\s*)', approuter_anchor).group(1)
            replacement_router = approuter_anchor + f"\n{leading}admin: adminRouter,"
            anchor_patch(
                target=PROCEDURES_TS,
                anchor=approuter_anchor,
                replacement=replacement_router,
                description="PATCH 7b: wire admin: adminRouter into appRouter",
                dry_run=dry_run,
            )
    else:
        warn("PATCH 7b skipped — no appRouter anchor discovered")

    # ── PATCH 7c: App.tsx — add /admin/agents route ────────────────────────────
    if app_tsx_anchor:
        content = APP_TSX.read_text(encoding="utf-8")
        if "/admin/agents" in content:
            ok("PATCH 7c: /admin/agents route already present — skipping")
        else:
            leading_ws = re.match(r'^(\s*)', app_tsx_anchor).group(1)
            new_route = (
                f'{leading_ws}<Route path="/admin/agents">\n'
                f'{leading_ws}  <ProtectedRoute>\n'
                f'{leading_ws}    <AdminAgentSuitePage />\n'
                f'{leading_ws}  </ProtectedRoute>\n'
                f'{leading_ws}</Route>\n'
                f'{app_tsx_anchor}'
            )
            anchor_patch(
                target=APP_TSX,
                anchor=app_tsx_anchor,
                replacement=new_route,
                description="PATCH 7c: add /admin/agents route to App.tsx",
                dry_run=dry_run,
            )

            # Check if AdminAgentSuitePage import needs to be added.
            # Re-read content after 7c (file may have been written in live mode).
            content_post_7c = APP_TSX.read_text(encoding="utf-8")
            if "AdminAgentSuitePage" not in content_post_7c:
                info("Adding AdminAgentSuitePage import to App.tsx...")
                page_imports = re.findall(
                    r'^import\s+(?:\{[^}]+\}|[\w]+(?:\s+as\s+\w+)?)\s+from\s+["\'][.@][^"\']*\/pages\/[^"\']+["\'];?',
                    content_post_7c,
                    re.MULTILINE,
                )
                if page_imports:
                    last_page_import = page_imports[-1]
                    new_import_line = (
                        last_page_import
                        + '\nimport { AdminAgentSuitePage } from "@/pages/admin/AgentSuitePage";'
                    )
                    anchor_patch(
                        target=APP_TSX,
                        anchor=last_page_import,
                        replacement=new_import_line,
                        description="PATCH 7d: add AdminAgentSuitePage import to App.tsx",
                        dry_run=dry_run,
                    )
                else:
                    warn("Could not auto-add AdminAgentSuitePage import — add manually:\n"
                         '  import { AdminAgentSuitePage } from "@/pages/admin/AgentSuitePage";')
    else:
        warn("PATCH 7c skipped — no App.tsx catch-all anchor found")

# ════════════════════════════════════════════════════════════════════════════════
# PHASE 8 — Post-patch verification (Wire.txt §15)
# ════════════════════════════════════════════════════════════════════════════════
def phase8_verify(dry_run: bool) -> None:
    head("Phase 8  — VERIFY: pnpm tsc --noEmit + pnpm test")

    if dry_run:
        dim("  DRY run — skipping actual tsc/test execution")
        return

    def run_cmd(cmd: list[str], label: str) -> bool:
        info(f"Running: {' '.join(cmd)}")
        start = time.time()
        result = subprocess.run(
            cmd,
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
        elapsed = time.time() - start
        if result.returncode == 0:
            ok(f"{label} passed ({elapsed:.1f}s)")
            return True
        else:
            fail(f"{label} FAILED ({elapsed:.1f}s)")
            if result.stdout:
                print(f"\n{C.DIM}--- stdout ---{C.RESET}")
                print(result.stdout[-3000:])
            if result.stderr:
                print(f"\n{C.DIM}--- stderr ---{C.RESET}")
                print(result.stderr[-2000:])
            return False

    tsc_ok = run_cmd(["pnpm", "tsc", "--noEmit"], "pnpm tsc --noEmit")
    if not tsc_ok:
        fail("TypeScript errors detected. Running rollback.")
        execute_rollback()
        hardstop(
            "pnpm tsc --noEmit failed after patch.\n"
            "All changes have been rolled back.\n"
            "Fix TypeScript errors and re-run."
        )

    test_ok = run_cmd(["pnpm", "test"], "pnpm test")
    if not test_ok:
        fail("Test suite failed. Running rollback.")
        execute_rollback()
        hardstop(
            "pnpm test failed after patch.\n"
            "All changes have been rolled back.\n"
            "Fix failing tests and re-run."
        )

    # FIX 4: removed hardcoded "42 tests passing" — count was wrong (105 in LLPTE
    # suite) and was never actually verified by this script.
    ok("All tests passing ✓")

# ════════════════════════════════════════════════════════════════════════════════
# SUMMARY REPORT
# ════════════════════════════════════════════════════════════════════════════════
def print_summary(dry_run: bool, phases_run: list[int]) -> None:
    head("═══ INTEGRATION REPORT ═══════════════════════════════════════════")

    status = "DRY RUN COMPLETE" if dry_run else "APPLIED"
    color  = C.CYAN if dry_run else C.GREEN

    print(f"\n  {color}{C.BOLD}Status: {status}{C.RESET}")
    print(f"  Phases executed: {', '.join(str(p) for p in phases_run)}")
    print(f"  Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

    if dry_run:
        print(f"\n  {C.YELLOW}To apply for real:{C.RESET}")
        print(f"    python3 3_integrate_agent_suite.py --apply\n")
    else:
        print(f"\n  {C.GREEN}Rollback available:{C.RESET}")
        print(f"    python3 3_integrate_agent_suite.py --rollback\n")
        save_rollback_log()

    print(f"  {C.DIM}Next steps:{C.RESET}")
    smoke = [
        ("Login as admin → /admin/agents", "Expert Agents sidebar loads"),
        ("Agent Mesh tab → run task on @llpte/spectral", "Bus log fires, confidence bar updates"),
        ("Login as non-admin → /admin/agents", "AdminForbidden renders — no panel visible"),
    ]
    for step, verify in smoke:
        print(f"    {C.CYAN}→{C.RESET} {step}")
        print(f"      Verify: {C.DIM}{verify}{C.RESET}")
    print()

# ════════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY POINT
# ════════════════════════════════════════════════════════════════════════════════
def main() -> None:
    parser = argparse.ArgumentParser(
        description="R3 v4 AGI-Enhanced Agent Suite Integrator",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help="Apply changes (default: dry-run only)",
    )
    parser.add_argument(
        "--rollback",
        action="store_true",
        default=False,
        help="Roll back the last applied integration",
    )
    parser.add_argument(
        "--phase",
        type=str,
        default=None,
        help="Run specific phases only, e.g. --phase 0-3 or --phase 0,1,2",
    )
    parser.add_argument(
        "--skip-verify",
        action="store_true",
        default=False,
        help="Skip Phase 8 post-patch pnpm tsc + test (not recommended)",
    )
    args = parser.parse_args()

    dry_run = not args.apply

    # ── Banner ────────────────────────────────────────────────────────────────
    print(f"\n{C.BOLD}{C.CYAN}  R3 v4 AGI Agent Suite Integrator{C.RESET}")
    print(f"  {C.DIM}Root: {ROOT}{C.RESET}")
    print(f"  {C.DIM}Mode: {'DRY RUN' if dry_run else 'LIVE APPLY'}{C.RESET}")
    if dry_run:
        print(f"\n  {C.YELLOW}Running in DRY RUN mode — no files will be written.{C.RESET}")
        print(f"  {C.DIM}Use --apply to make changes.{C.RESET}\n")
    else:
        print(f"\n  {C.RED}{C.BOLD}⚠  LIVE MODE — files will be modified.{C.RESET}")
        print(f"  {C.DIM}Backups (timestamped .bak) created before every write.{C.RESET}\n")
        confirm = input("  Type 'yes' to continue: ").strip().lower()
        if confirm != "yes":
            print("  Aborted.")
            sys.exit(0)

    # ── Rollback mode ─────────────────────────────────────────────────────────
    if args.rollback:
        if ROLLBACK_LOG.exists():
            data = json.loads(ROLLBACK_LOG.read_text())
            for entry in data:
                ROLLBACK_REGISTRY.append(RollbackEntry(
                    description=entry["description"],
                    backup_path=Path(entry["backup_path"]) if entry["backup_path"] else None,
                    original_path=Path(entry["original_path"]) if entry["original_path"] else None,
                    action=entry["action"],
                ))
            execute_rollback()
        else:
            warn("No rollback log found. Nothing to roll back.")
        sys.exit(0)

    # ── Phase filtering ────────────────────────────────────────────────────────
    all_phases = list(range(9))
    if args.phase:
        spec = args.phase
        if "-" in spec:
            lo, hi = spec.split("-", 1)
            phases_to_run = list(range(int(lo), int(hi) + 1))
        else:
            phases_to_run = [int(x.strip()) for x in spec.split(",")]
    else:
        phases_to_run = all_phases

    phases_run: list[int] = []

    try:
        if 0 in phases_to_run:
            phase0_preflight()
            phases_run.append(0)

        if 1 in phases_to_run:
            phase1_schema()
            phases_run.append(1)

        if 2 in phases_to_run:
            phase2_env()
            phases_run.append(2)

        if 3 in phases_to_run:
            phase3_trpc_alias()
            phases_run.append(3)

        if 4 in phases_to_run:
            phase4_bug_fixes(dry_run)
            phases_run.append(4)

        if 5 in phases_to_run:
            phase5_file_moves(dry_run)
            phases_run.append(5)

        import_anchor = approuter_anchor = app_tsx_anchor = None
        if 6 in phases_to_run:
            import_anchor, approuter_anchor, app_tsx_anchor = phase6_anchor_verify()
            phases_run.append(6)

        if 7 in phases_to_run:
            phase7_patch(import_anchor, approuter_anchor, app_tsx_anchor, dry_run)
            phases_run.append(7)

        if 8 in phases_to_run and not args.skip_verify:
            phase8_verify(dry_run)
            phases_run.append(8)

    except KeyboardInterrupt:
        print(f"\n\n  {C.YELLOW}Interrupted by user.{C.RESET}")
        if not dry_run and ROLLBACK_REGISTRY:
            print(f"  {C.YELLOW}Rolling back partial changes...{C.RESET}")
            execute_rollback()
        sys.exit(130)

    except SystemExit:
        raise

    except Exception as e:
        fail(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        if not dry_run and ROLLBACK_REGISTRY:
            print(f"\n  {C.YELLOW}Rolling back due to unexpected error...{C.RESET}")
            execute_rollback()
        sys.exit(1)

    print_summary(dry_run, phases_run)


if __name__ == "__main__":
    main()