#!/usr/bin/env python3
"""
integrate_agent_suite.py
R3 v4 — Admin Agent Suite Integration Script
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Integrates four files from scripts/ into the live monorepo and applies
two surgical patches to server/procedures.ts and client/src/App.tsx.

CLAUDE.md Hard Guards honoured throughout:
  - No write without read first
  - No patch without dry-run confirmation
  - No swallowed exceptions

USAGE
─────
  # Step 1 — audit only (zero writes, always safe)
  python3 integrate_agent_suite.py --dry-run

  # Step 2 — apply after reading the dry-run report
  python3 integrate_agent_suite.py --apply

  # From any directory (pass explicit root)
  python3 integrate_agent_suite.py --dry-run --root "/home/r3/Stable/R3 v4"

EXIT CODES
──────────
  0  success / dry-run clean
  1  hard-stop (pre-flight check failed — do NOT apply)
  2  apply failed mid-run (backups available in .integration_backups/)
"""

from __future__ import annotations

import argparse
import re
import shutil
import sys
import textwrap
from datetime import datetime
from pathlib import Path


# ══════════════════════════════════════════════════════════════════════════════
# CONFIG — all paths relative to project root
# ══════════════════════════════════════════════════════════════════════════════

SOURCES: dict[str, str] = {
    # source (inside scripts/)  →  destination (inside monorepo)
    "scripts/adminRouter.ts":      "server/routers/adminRouter.ts",
    "scripts/AgentSuite.tsx":      "client/src/components/admin/AgentSuite.tsx",
    "scripts/AgentMeshPanel.tsx":  "client/src/components/admin/AgentMeshPanel.tsx",
    "scripts/AgentSuitePage.tsx":  "client/src/pages/admin/AgentSuitePage.tsx",
}

PROCEDURES_FILE  = "server/procedures.ts"
APP_FILE         = "client/src/App.tsx"
SCHEMA_FILE      = "shared/schema.ts"
ENV_FILE         = ".env"
BACKUP_DIR_NAME  = ".integration_backups"


# ══════════════════════════════════════════════════════════════════════════════
# TERMINAL COLOURS
# ══════════════════════════════════════════════════════════════════════════════

class C:
    RESET  = "\033[0m"
    BOLD   = "\033[1m"
    RED    = "\033[91m"
    YELLOW = "\033[93m"
    GREEN  = "\033[92m"
    CYAN   = "\033[96m"
    DIM    = "\033[2m"

def ok(msg: str)    -> None: print(f"  {C.GREEN}✓{C.RESET}  {msg}")
def warn(msg: str)  -> None: print(f"  {C.YELLOW}⚠{C.RESET}  {msg}")
def err(msg: str)   -> None: print(f"  {C.RED}✗{C.RESET}  {msg}")
def info(msg: str)  -> None: print(f"  {C.CYAN}→{C.RESET}  {msg}")
def head(msg: str)  -> None: print(f"\n{C.BOLD}{msg}{C.RESET}")
def rule()          -> None: print(f"{C.DIM}{'─' * 72}{C.RESET}")


# ══════════════════════════════════════════════════════════════════════════════
# RESULT ACCUMULATOR
# ══════════════════════════════════════════════════════════════════════════════

class Report:
    def __init__(self) -> None:
        self.errors:   list[str] = []
        self.warnings: list[str] = []
        self.notes:    list[str] = []

    def hard_stop(self, msg: str) -> None:
        self.errors.append(msg)
        err(msg)

    def soft_warn(self, msg: str) -> None:
        self.warnings.append(msg)
        warn(msg)

    def note(self, msg: str) -> None:
        self.notes.append(msg)
        ok(msg)

    @property
    def has_errors(self) -> bool:
        return bool(self.errors)


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — PRE-FLIGHT CHECKS
# ══════════════════════════════════════════════════════════════════════════════

def phase1_preflight(root: Path, report: Report) -> dict[str, object]:
    """
    Read every relevant file, verify structure, and collect all
    anchor strings needed for Phase 3 patches.  Returns a findings
    dict that Phase 3 consumes.  No files are written here.
    """
    head("PHASE 1 — PRE-FLIGHT VERIFICATION")
    rule()
    findings: dict[str, object] = {}

    # ── 1a. Source files exist ────────────────────────────────────────────────
    info("Checking source files in scripts/")
    for src_rel in SOURCES:
        src = root / src_rel
        if src.exists():
            ok(f"Found  {src_rel}  ({src.stat().st_size:,} bytes)")
        else:
            report.hard_stop(f"Missing source file: {src_rel}")

    # ── 1b. shared/schema.ts — isAdmin column ─────────────────────────────────
    info("Checking shared/schema.ts for isAdmin column")
    schema_path = root / SCHEMA_FILE
    if not schema_path.exists():
        report.hard_stop(f"Cannot locate {SCHEMA_FILE}")
    else:
        schema_src = schema_path.read_text(encoding="utf-8")
        if "isAdmin" in schema_src:
            ok("isAdmin column found in shared/schema.ts")
            findings["isAdmin_present"] = True
        else:
            report.hard_stop(
                "isAdmin column NOT found in shared/schema.ts. "
                "Run a Drizzle migration before applying this integration. "
                "Add:  isAdmin: boolean('is_admin').default(false).notNull()  "
                "to the users table, then: pnpm drizzle-kit generate && pnpm drizzle-kit migrate"
            )
            findings["isAdmin_present"] = False

    # ── 1c. server/procedures.ts — find anchors ────────────────────────────────
    info("Analysing server/procedures.ts")
    procedures_path = root / PROCEDURES_FILE
    if not procedures_path.exists():
        report.hard_stop(f"Cannot locate {PROCEDURES_FILE}")
    else:
        proc_src = procedures_path.read_text(encoding="utf-8")
        findings["proc_src"] = proc_src

        # Already applied?
        if "adminRouter" in proc_src:
            report.soft_warn(
                "adminRouter already referenced in procedures.ts — "
                "patch will be skipped (idempotent)"
            )
            findings["proc_already_patched"] = True
        else:
            findings["proc_already_patched"] = False
            _analyse_procedures(proc_src, findings, report)

    # ── 1d. client/src/App.tsx — find anchors ────────────────────────────────
    info("Analysing client/src/App.tsx")
    app_path = root / APP_FILE
    if not app_path.exists():
        report.hard_stop(f"Cannot locate {APP_FILE}")
    else:
        app_src = app_path.read_text(encoding="utf-8")
        findings["app_src"] = app_src

        if "AdminAgentSuitePage" in app_src:
            report.soft_warn(
                "AdminAgentSuitePage already referenced in App.tsx — "
                "patch will be skipped (idempotent)"
            )
            findings["app_already_patched"] = True
        else:
            findings["app_already_patched"] = False
            _analyse_app(app_src, findings, report)

    # ── 1e. tRPC alias check ──────────────────────────────────────────────────
    info("Detecting tRPC client alias")
    _detect_trpc_alias(root, findings, report)

    # ── 1f. ANTHROPIC_API_KEY ─────────────────────────────────────────────────
    info("Checking ANTHROPIC_API_KEY")
    env_path = root / ENV_FILE
    if env_path.exists():
        env_src = env_path.read_text(encoding="utf-8")
        if "ANTHROPIC_API_KEY" in env_src and "ANTHROPIC_API_KEY=" in env_src:
            lines = [l for l in env_src.splitlines() if "ANTHROPIC_API_KEY=" in l]
            # check it's not blank
            blank = any(l.strip() == "ANTHROPIC_API_KEY=" for l in lines)
            if blank:
                report.soft_warn("ANTHROPIC_API_KEY is present but empty in .env")
            else:
                ok("ANTHROPIC_API_KEY is set in .env")
        else:
            report.soft_warn(
                "ANTHROPIC_API_KEY not found in .env — "
                "server will throw INTERNAL_SERVER_ERROR until this is set"
            )
    else:
        report.soft_warn(".env not found at project root — cannot verify ANTHROPIC_API_KEY")

    # ── 1g. Destination directories exist (create if needed) ──────────────────
    info("Checking destination directories")
    for dst_rel in SOURCES.values():
        dst_dir = (root / dst_rel).parent
        if dst_dir.exists():
            ok(f"Dir exists:  {dst_dir.relative_to(root)}")
        else:
            report.note(f"Will create: {dst_dir.relative_to(root)}")
            findings.setdefault("dirs_to_create", []).append(dst_dir)  # type: ignore[union-attr]

    return findings


def _analyse_procedures(src: str, findings: dict, report: Report) -> None:
    """
    Dynamically find two unique anchors in procedures.ts:
      anchor_import  — line after which we insert the adminRouter import
      anchor_router  — line after which we insert  admin: adminRouter,
    """
    lines = src.splitlines()

    # ── Anchor A: last  import { ... } from "./routers/..."  line ─────────────
    router_import_lines = [
        l for l in lines
        if re.search(r'import\s*\{[^}]+\}\s*from\s*["\']\.\/routers\/', l)
    ]
    if router_import_lines:
        anchor_import = router_import_lines[-1]
        count = src.count(anchor_import)
        if count == 1:
            ok(f"Import anchor (unique):  {anchor_import.strip()[:72]}")
            findings["anchor_import"] = anchor_import
        else:
            report.hard_stop(
                f"Import anchor appears {count}× in procedures.ts — "
                f"cannot safely patch.  Line: {anchor_import.strip()[:60]}"
            )
    else:
        # Fallback: last import line of any kind
        import_lines = [l for l in lines if l.strip().startswith("import ")]
        if import_lines:
            anchor_import = import_lines[-1]
            if src.count(anchor_import) == 1:
                ok(f"Import anchor (fallback, unique):  {anchor_import.strip()[:60]}")
                findings["anchor_import"] = anchor_import
            else:
                report.hard_stop(
                    "Could not find a unique import anchor in procedures.ts. "
                    "Inspect the file and set anchor_import manually."
                )
        else:
            report.hard_stop("No import statements found in procedures.ts.")

    # ── Anchor B: last  xxxRouter,  line inside appRouter export ─────────────
    # Strategy: find all  `key: someRouter,`  patterns
    router_key_lines = [
        l for l in lines
        if re.search(r'^\s+\w+:\s+\w+Router,\s*$', l)
    ]
    if router_key_lines:
        anchor_router = router_key_lines[-1]
        count = src.count(anchor_router)
        if count == 1:
            ok(f"Router-key anchor (unique):  {anchor_router.strip()[:72]}")
            findings["anchor_router"] = anchor_router
        else:
            # Not unique — qualify it by grabbing the preceding line too.
            # IMPORTANT: use the LAST occurrence index, not first (.index() returns first).
            idx = len(lines) - 1 - lines[::-1].index(anchor_router)
            if idx == 0:
                report.hard_stop(
                    f"Router-key anchor appears {count}× and is on line 0 — "
                    "cannot qualify with a preceding line. Add  admin: adminRouter,  manually."
                )
            else:
                combined = lines[idx - 1] + "\n" + anchor_router
                if src.count(combined) == 1:
                    ok(f"Router-key anchor (qualified, unique):  {combined.strip()[:60]}")
                    # Store the combined (unique) string — NOT the bare non-unique anchor_router.
                    # phase3 will replace `combined` with `combined + new_key`, which is correct.
                    findings["anchor_router"] = combined
                else:
                    report.hard_stop(
                        f"Router-key anchor appears {count}× and qualified form is also "
                        f"non-unique — cannot safely patch. Add  admin: adminRouter,  manually."
                    )
    else:
        report.hard_stop(
            "No  key: someRouter,  pattern found inside appRouter in procedures.ts. "
            "The script cannot locate a safe insertion point. "
            "Inspect procedures.ts and add  admin: adminRouter,  manually."
        )


def _analyse_app(src: str, findings: dict, report: Report) -> None:
    """
    Dynamically find two unique anchors in App.tsx:
      anchor_page_import  — line after which we insert the AdminAgentSuitePage import
      anchor_route        — the catch-all <Route> block before which we insert our route
    """
    lines = src.splitlines()

    # ── Anchor C: last  import { ... } from "@/pages/..."  line ──────────────
    page_import_lines = [
        l for l in lines
        if re.search(r'import\s*\{[^}]+\}\s*from\s*["\']@\/pages\/', l)
    ]
    if page_import_lines:
        anchor_page_import = page_import_lines[-1]
        count = src.count(anchor_page_import)
        if count == 1:
            ok(f"Page-import anchor (unique):  {anchor_page_import.strip()[:72]}")
            findings["anchor_page_import"] = anchor_page_import
        else:
            report.hard_stop(
                f"Page-import anchor appears {count}× in App.tsx. "
                f"Line: {anchor_page_import.strip()[:60]}"
            )
    else:
        # Fallback: any last import line
        import_lines = [l for l in lines if l.strip().startswith("import ")]
        if import_lines:
            anchor_page_import = import_lines[-1]
            if src.count(anchor_page_import) == 1:
                ok(f"Page-import anchor (fallback):  {anchor_page_import.strip()[:60]}")
                findings["anchor_page_import"] = anchor_page_import
            else:
                report.hard_stop("Could not find unique import anchor in App.tsx.")
        else:
            report.hard_stop("No import statements found in App.tsx.")

    # ── Anchor D: catch-all / redirect route block ────────────────────────────
    # Look for the Wouter catch-all:  <Route>  with a <Redirect to="/instrument" />
    # We search for a multi-line block and take it as a raw string anchor.
    catchall_patterns = [
        # Exact pattern from INTEGRATION_PATCH.md
        r'<Route>\s*\n\s*<Redirect to=["\']\/instrument["\'] \/>\s*\n\s*<\/Route>',
        # Variant with self-closing Route
        r'<Route\s*>\s*\n\s*<Redirect\s+to=["\']\/instrument["\']',
        # Without explicit to="/instrument" — just any bare catch-all route
        r'<Route>\s*\n\s*<Redirect\b',
    ]
    anchor_route: str | None = None
    for pattern in catchall_patterns:
        m = re.search(pattern, src)
        if m:
            anchor_route = m.group(0)
            count = src.count(anchor_route)
            if count == 1:
                ok(f"Catch-all route anchor (unique):  {anchor_route[:60].strip()!r}")
                findings["anchor_route"] = anchor_route
                break
            else:
                warn(f"Catch-all pattern matched {count}× — trying next pattern")
                anchor_route = None

    if anchor_route is None:
        # Last resort: find </Switch> or </Routes> and insert before it
        switch_close = re.search(r'(\s*<\/Switch>|\s*<\/Routes>)', src)
        if switch_close:
            anchor_route = switch_close.group(0)
            if src.count(anchor_route) == 1:
                ok(f"Using </Switch> as route insertion anchor (unique)")
                findings["anchor_route"] = anchor_route
                findings["anchor_route_insert_before"] = True  # insert BEFORE this
            else:
                report.hard_stop(
                    "Multiple </Switch> or </Routes> tags found. "
                    "Cannot safely locate route insertion point in App.tsx. "
                    "Add the /admin/agents route manually."
                )
        else:
            report.hard_stop(
                "Could not locate the catch-all route or </Switch> in App.tsx. "
                "Add the /admin/agents route manually."
            )


def _detect_trpc_alias(root: Path, findings: dict, report: Report) -> None:
    """
    Check which path the project uses for the tRPC React client.
    Updates AgentSuite.tsx and AgentMeshPanel.tsx if the alias differs
    from '@/lib/trpc' (the default in the generated files).
    """
    candidates = [
        "client/src/lib/trpc.ts",
        "client/src/lib/trpc.tsx",
        "client/src/utils/trpc.ts",
        "client/src/hooks/trpc.ts",
        "client/hooks/trpc.ts",
    ]
    found: list[str] = []
    for c in candidates:
        if (root / c).exists():
            found.append(c)

    if not found:
        report.soft_warn(
            "Could not auto-detect tRPC client file. "
            "After apply, verify the import path in "
            "AgentSuite.tsx and AgentMeshPanel.tsx matches your project."
        )
        findings["trpc_alias"] = "@/lib/trpc"  # use default
        return

    # Derive the @/ alias from the first hit
    # e.g. client/src/lib/trpc.ts  →  @/lib/trpc
    hit = found[0]
    # Strip client/src/ prefix and .ts/.tsx suffix
    alias_path = re.sub(r'^client/src/', '', hit)
    alias_path = re.sub(r'\.(tsx?|js)$', '', alias_path)
    trpc_alias = f"@/{alias_path}"

    ok(f"tRPC client detected:  {hit}  →  alias: {trpc_alias}")
    findings["trpc_alias"] = trpc_alias

    if trpc_alias != "@/lib/trpc" and len(found) == 1:
        warn(
            f"Generated files use '@/lib/trpc' but your project has '{trpc_alias}'. "
            "The apply step will rewrite the import in AgentSuite.tsx and AgentMeshPanel.tsx."
        )
        findings["trpc_alias_needs_rewrite"] = True
    elif len(found) > 1:
        warn(f"Multiple tRPC candidates found: {found}. Using first: {hit}")
        findings["trpc_alias_needs_rewrite"] = trpc_alias != "@/lib/trpc"


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — FILE COPY
# ══════════════════════════════════════════════════════════════════════════════

def phase2_copy_files(
    root: Path,
    findings: dict,
    dry_run: bool,
    backup_dir: Path,
    report: Report,
) -> None:
    head("PHASE 2 — COPY NEW FILES")
    rule()

    trpc_alias: str        = findings.get("trpc_alias", "@/lib/trpc")  # type: ignore[assignment]
    needs_rewrite: bool    = findings.get("trpc_alias_needs_rewrite", False)  # type: ignore[assignment]

    for src_rel, dst_rel in SOURCES.items():
        src = root / src_rel
        dst = root / dst_rel

        if not src.exists():
            report.hard_stop(f"Source vanished: {src_rel}")
            continue

        # Read source content
        content = src.read_text(encoding="utf-8")

        # Rewrite tRPC alias if necessary (only in component files)
        if needs_rewrite and dst_rel.endswith((".tsx", ".ts")) and "@/lib/trpc" in content:
            content = content.replace("@/lib/trpc", trpc_alias)
            info(f"Rewrote tRPC alias in {dst_rel}")

        if dst.exists():
            existing = dst.read_text(encoding="utf-8")
            if existing == content:
                ok(f"SKIP (identical): {dst_rel}")
                continue
            else:
                warn(f"OVERWRITE: {dst_rel} already exists with different content")
                if not dry_run:
                    _backup(dst, backup_dir)

        if dry_run:
            info(f"DRY-RUN would write: {dst_rel}  ({len(content):,} chars)")
        else:
            dst.parent.mkdir(parents=True, exist_ok=True)
            dst.write_text(content, encoding="utf-8")
            ok(f"Written: {dst_rel}")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — SURGICAL PATCHES
# ══════════════════════════════════════════════════════════════════════════════

def phase3_patch_procedures(
    root: Path,
    findings: dict,
    dry_run: bool,
    backup_dir: Path,
    report: Report,
) -> None:
    head("PHASE 3a — PATCH server/procedures.ts")
    rule()

    if findings.get("proc_already_patched"):
        ok("Already patched — skipping")
        return
    if "anchor_import" not in findings or "anchor_router" not in findings:
        report.hard_stop("Anchors missing — Phase 1 failed, cannot patch procedures.ts")
        return

    path       = root / PROCEDURES_FILE
    src        = findings["proc_src"]
    ai         = findings["anchor_import"]
    ar         = findings["anchor_router"]

    new_import = 'import { adminRouter } from "./routers/adminRouter";'
    new_key    = "  admin: adminRouter,"

    # Triple-check uniqueness RIGHT NOW against the live string
    _assert_unique(src, ai, "Import anchor", report)
    _assert_unique(src, ar, "Router-key anchor", report)
    if report.has_errors:
        return

    # Build patched content — two independent replacements
    patched = src.replace(ai, f"{ai}\n{new_import}")
    patched = patched.replace(ar, f"{ar}\n{new_key}")

    # Verify the result contains exactly what we expect
    if new_import not in patched:
        report.hard_stop("Import insertion failed — new_import not found after replace")
        return
    if new_key not in patched:
        report.hard_stop("Router key insertion failed — new_key not found after replace")
        return
    # Verify we haven't doubled up (idempotency check on result)
    if patched.count(new_import) > 1:
        report.hard_stop("Import appeared more than once after patch — aborting")
        return
    if patched.count(new_key) > 1:
        report.hard_stop("Router key appeared more than once after patch — aborting")
        return

    ok("Patch verified — content correct")

    if dry_run:
        info("DRY-RUN: would write patched procedures.ts")
        _show_diff_snippet(src, patched, path.name)
    else:
        _backup(path, backup_dir)
        path.write_text(patched, encoding="utf-8")
        ok(f"Written: {PROCEDURES_FILE}")


def phase3_patch_app(
    root: Path,
    findings: dict,
    dry_run: bool,
    backup_dir: Path,
    report: Report,
) -> None:
    head("PHASE 3b — PATCH client/src/App.tsx")
    rule()

    if findings.get("app_already_patched"):
        ok("Already patched — skipping")
        return
    if "anchor_page_import" not in findings or "anchor_route" not in findings:
        report.hard_stop("Anchors missing — Phase 1 failed, cannot patch App.tsx")
        return

    path    = root / APP_FILE
    src     = findings["app_src"]
    ai      = findings["anchor_page_import"]
    ar      = findings["anchor_route"]

    new_import = 'import { AdminAgentSuitePage } from "@/pages/admin/AgentSuitePage";'
    new_route  = textwrap.dedent("""\
      <Route path="/admin/agents">
        <ProtectedRoute>
          <AdminAgentSuitePage />
        </ProtectedRoute>
      </Route>""")

    # Triple-check uniqueness
    _assert_unique(src, ai, "Page-import anchor", report)
    _assert_unique(src, ar, "Route anchor", report)
    if report.has_errors:
        return

    # Build patched content
    patched = src.replace(ai, f"{ai}\n{new_import}")

    insert_before: bool = findings.get("anchor_route_insert_before", False)  # type: ignore[assignment]
    if insert_before:
        # Insert the route BEFORE the anchor (</Switch> case)
        patched = patched.replace(ar, f"\n{new_route}{ar}")
    else:
        # Insert the route BEFORE the catch-all anchor
        patched = patched.replace(ar, f"{new_route}\n{ar}")

    # Verify
    if new_import not in patched:
        report.hard_stop("Import insertion failed in App.tsx")
        return
    if 'path="/admin/agents"' not in patched:
        report.hard_stop("Route insertion failed in App.tsx")
        return
    if patched.count(new_import) > 1:
        report.hard_stop("Import duplicated in App.tsx — aborting")
        return
    if patched.count('path="/admin/agents"') > 1:
        report.hard_stop("Route duplicated in App.tsx — aborting")
        return

    ok("Patch verified — content correct")

    if dry_run:
        info("DRY-RUN: would write patched App.tsx")
        _show_diff_snippet(src, patched, path.name)
    else:
        _backup(path, backup_dir)
        path.write_text(patched, encoding="utf-8")
        ok(f"Written: {APP_FILE}")


# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — POST-APPLY INSTRUCTIONS
# ══════════════════════════════════════════════════════════════════════════════

def phase4_instructions(dry_run: bool) -> None:
    head("PHASE 4 — POST-APPLY VERIFICATION SEQUENCE")
    rule()
    if dry_run:
        info("Dry-run complete — run with --apply to execute all writes.")
        return

    print(textwrap.dedent(f"""
  {C.BOLD}Run these in order — stop if any step fails:{C.RESET}

  {C.CYAN}1. Type-check (must be zero errors){C.RESET}
     pnpm tsc --noEmit

  {C.CYAN}2. Full test suite (must remain 42 passing){C.RESET}
     pnpm test

  {C.CYAN}3. Manual smoke test{C.RESET}
     a. Login as admin → navigate to /admin/agents
        ✓ TopBar shows ADMIN badge + "R3 V4 · AGENT SUITE"
        ✓ Expert Agents tab loads AgentSuite
        ✓ Agent Mesh tab loads AgentMeshPanel
        ✓ Chat prompt fires via tRPC → Anthropic response returned
     b. Login as non-admin → navigate to /admin/agents
        ✓ AdminForbidden screen renders
        ✓ No agent panel or system prompts visible

  {C.CYAN}4. Verify ANTHROPIC_API_KEY is set in all environments{C.RESET}
     .env · .env.production · Railway / Docker env config

  {C.CYAN}5. Backups (if needed){C.RESET}
     Original files backed up to: {BACKUP_DIR_NAME}/
    """))


# ══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════════════════

def _assert_unique(src: str, anchor: str, label: str, report: Report) -> None:
    count = src.count(anchor)
    if count == 1:
        ok(f"{label} confirmed unique (count=1)")
    elif count == 0:
        report.hard_stop(f"{label} not found in source — stale findings, re-run Phase 1")
    else:
        report.hard_stop(
            f"{label} found {count}× — not safe to patch. "
            f"Anchor: {anchor.strip()[:60]!r}"
        )


def _backup(path: Path, backup_dir: Path) -> None:
    backup_dir.mkdir(parents=True, exist_ok=True)
    ts   = datetime.now().strftime("%Y%m%d_%H%M%S")
    dest = backup_dir / f"{path.name}.{ts}.bak"
    shutil.copy2(path, dest)
    ok(f"Backup: {dest.name}")


def _show_diff_snippet(original: str, patched: str, filename: str) -> None:
    """
    Print added lines using a positional diff, not set-membership.
    Set-membership ( l not in orig_lines ) incorrectly hides lines that were
    genuinely added but also exist elsewhere in the original.  We walk both
    line lists in lockstep and surface every line that is new or changed.
    """
    orig_lines  = original.splitlines()
    patch_lines = patched.splitlines()

    added: list[str] = []
    for i, line in enumerate(patch_lines):
        if i >= len(orig_lines):
            added.append(line)        # net-new line past end of original
        elif line != orig_lines[i]:
            added.append(line)        # replacement line at this position

    print(f"\n  {C.DIM}── diff preview: {filename} ──{C.RESET}")
    for line in added[:20]:
        print(f"  {C.GREEN}+{C.RESET} {line}")
    if len(added) > 20:
        print(f"  {C.DIM}  … {len(added) - 20} more lines{C.RESET}")
    print()


def _detect_root(explicit: str | None) -> Path:
    """Walk up from CWD looking for pnpm-workspace.yaml as project root marker."""
    if explicit:
        p = Path(explicit).expanduser().resolve()
        if not p.exists():
            sys.exit(f"Explicit root does not exist: {p}")
        return p

    cwd = Path.cwd()
    for candidate in [cwd, *cwd.parents]:
        if (candidate / "pnpm-workspace.yaml").exists():
            return candidate

    # Default fallback matching the known project path
    fallback = Path("~/Stable/R3 v4").expanduser()
    if fallback.exists():
        return fallback

    sys.exit(
        "Could not locate project root (pnpm-workspace.yaml not found). "
        "Run from inside the R3 v4 directory or pass --root explicitly."
    )


# ══════════════════════════════════════════════════════════════════════════════
# SUMMARY PRINTER
# ══════════════════════════════════════════════════════════════════════════════

def print_summary(report: Report, dry_run: bool) -> None:
    head("SUMMARY")
    rule()
    mode = "DRY-RUN" if dry_run else "APPLY"
    print(f"  Mode: {C.BOLD}{mode}{C.RESET}")
    print(f"  Errors:   {C.RED}{len(report.errors)}{C.RESET}")
    print(f"  Warnings: {C.YELLOW}{len(report.warnings)}{C.RESET}")

    if report.errors:
        print(f"\n{C.RED}{C.BOLD}HARD STOPS — do not apply until resolved:{C.RESET}")
        for e in report.errors:
            print(f"  {C.RED}✗{C.RESET}  {e}")

    if report.warnings:
        print(f"\n{C.YELLOW}Warnings (non-blocking):{C.RESET}")
        for w in report.warnings:
            print(f"  {C.YELLOW}⚠{C.RESET}  {w}")

    print()


# ══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    parser = argparse.ArgumentParser(
        description="R3 v4 Admin Agent Suite — integration script",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dry-run", action="store_true", default=False,
        help="Audit only — no files written (safe to run any time)",
    )
    parser.add_argument(
        "--apply", action="store_true", default=False,
        help="Execute all writes after passing pre-flight checks",
    )
    parser.add_argument(
        "--root", default=None,
        help="Explicit path to R3 v4 project root (auto-detected if omitted)",
    )
    args = parser.parse_args()

    # Default to dry-run if neither flag given
    if not args.dry_run and not args.apply:
        args.dry_run = True
        print(f"\n{C.YELLOW}No mode flag given — defaulting to --dry-run (safe){C.RESET}")

    if args.dry_run and args.apply:
        sys.exit("Specify --dry-run OR --apply, not both.")

    dry_run = not args.apply

    root       = _detect_root(args.root)
    backup_dir = root / BACKUP_DIR_NAME
    report     = Report()

    print(f"\n{C.BOLD}{'═' * 72}{C.RESET}")
    print(f"  R3 v4 — Admin Agent Suite Integration")
    print(f"  Root: {root}")
    print(f"  Mode: {'DRY-RUN' if dry_run else C.RED + 'APPLY' + C.RESET}")
    print(f"{C.BOLD}{'═' * 72}{C.RESET}")

    # Phase 1 — always run
    findings = phase1_preflight(root, report)

    if report.has_errors:
        print_summary(report, dry_run)
        print(f"{C.RED}Pre-flight failed — resolve errors above before --apply.{C.RESET}\n")
        sys.exit(1)

    # Phase 2 — copy files
    phase2_copy_files(root, findings, dry_run, backup_dir, report)
    if report.has_errors:
        print_summary(report, dry_run)
        sys.exit(2)

    # Phase 3a — patch procedures.ts
    phase3_patch_procedures(root, findings, dry_run, backup_dir, report)
    if report.has_errors:
        print_summary(report, dry_run)
        sys.exit(2)

    # Phase 3b — patch App.tsx
    phase3_patch_app(root, findings, dry_run, backup_dir, report)
    if report.has_errors:
        print_summary(report, dry_run)
        sys.exit(2)

    # Phase 4 — instructions
    phase4_instructions(dry_run)

    print_summary(report, dry_run)
    sys.exit(0)


if __name__ == "__main__":
    main()
