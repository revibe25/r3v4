#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  R3 v4 — Hygiene Maintenance Super Script                                   ║
║  Wire.txt §1: Read before touch. Triple-check before write.                 ║
║                                                                              ║
║  Phases:                                                                     ║
║    0  — Root detection + full file map                                       ║
║    1  — CLAUDE.md hard guard violations                                      ║
║    2  — Duplicate / misplaced directories                                    ║
║    3  — .bak / backup artifact proliferation                                 ║
║    4  — Compiled artifacts alongside source (.js .d.ts .map)                ║
║    5  — Orphaned untracked junk (git status cross-ref)                       ║
║    6  — Schema consistency (shared vs server/db)                             ║
║    7  — Import health (wrong paths, banned imports)                          ║
║    8  — pnpm tsc --noEmit                                                    ║
║    9  — PRD metric deltas (test count, tier strings, router shape)           ║
║   10  — Remediation: auto-delete safe artifacts (requires --apply)           ║
║                                                                              ║
║  USAGE:                                                                      ║
║    python3 scripts/r3_hygiene.py              # dry-run report only          ║
║    python3 scripts/r3_hygiene.py --apply      # delete safe junk             ║
║    python3 scripts/r3_hygiene.py --phase 0-5  # specific phases              ║
║    python3 scripts/r3_hygiene.py --skip-tests # skip pnpm test in phase 9   ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import argparse
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

# ── Terminal colors ────────────────────────────────────────────────────────────
class C:
    RESET = "\033[0m"; BOLD = "\033[1m"; DIM = "\033[2m"
    RED = "\033[91m";  GREEN = "\033[92m"; YELLOW = "\033[93m"
    CYAN = "\033[96m"; WHITE = "\033[97m"; MAGENTA = "\033[95m"

def ok(m):   print(f"  {C.GREEN}✓{C.RESET}  {m}")
def warn(m): print(f"  {C.YELLOW}⚠{C.RESET}  {m}")
def fail(m): print(f"  {C.RED}✗{C.RESET}  {m}")
def info(m): print(f"  {C.CYAN}→{C.RESET}  {m}")
def head(m): print(f"\n{C.BOLD}{C.WHITE}{m}{C.RESET}")
def dim(m):  print(f"  {C.DIM}{m}{C.RESET}")

# ── Root detection ─────────────────────────────────────────────────────────────
def find_root() -> Path:
    p = Path.cwd()
    for _ in range(8):
        if (p / "pnpm-workspace.yaml").exists():
            return p
        if p.parent == p:
            break
        p = p.parent
    print(f"{C.RED}Cannot find R3 v4 root (pnpm-workspace.yaml){C.RESET}")
    sys.exit(1)

ROOT = find_root()

# ── Issue registry ─────────────────────────────────────────────────────────────
class Issue:
    def __init__(self, phase, severity, message, path=None, fix=None, safe_delete=False):
        self.phase = phase
        self.severity = severity  # CRITICAL | WARN | INFO
        self.message = message
        self.path = path
        self.fix = fix
        self.safe_delete = safe_delete

ISSUES: list[Issue] = []

def add(phase, severity, message, path=None, fix=None, safe_delete=False):
    ISSUES.append(Issue(phase, severity, message, path, fix, safe_delete))

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 0 — Full file map
# ══════════════════════════════════════════════════════════════════════════════
def phase0_map() -> dict:
    head("Phase 0  — FILE MAP: building complete project snapshot")

    src_files:  list[Path] = []
    bak_files:  list[Path] = []
    compiled:   list[Path] = []

    skip_dirs = {
        "node_modules", ".git", "coverage", "dist", "build",
        ".r3-backup", ".r3-backups",
    }

    for p in ROOT.rglob("*"):
        if p.is_dir():
            continue
        if any(s in p.parts for s in skip_dirs):
            continue

        rel = p.relative_to(ROOT)
        suf = p.suffix.lower()

        if suf in {".ts", ".tsx", ".js", ".jsx", ".css", ".json", ".py", ".sql", ".md"}:
            src_files.append(p)

        if suf == ".bak" or any(str(rel).endswith(x) for x in [
            ".bak", ".r3backup", ".backup", ".bak2", ".bak3", ".bak4",
            ".bak5", ".bak6", ".color-bak", ".theme-bak",
        ]):
            bak_files.append(p)

        # Compiled artifacts: .js / .d.ts / .map next to .ts source outside client/
        if suf in {".js", ".d.ts"} and not str(rel).startswith("client/"):
            ts_peer = p.with_suffix(".ts")
            if suf == ".d.ts":
                ts_peer = Path(str(p)[:-len(".d.ts")] + ".ts")
            if ts_peer.exists():
                compiled.append(p)

        if suf == ".map" and not str(rel).startswith("client/"):
            compiled.append(p)

    ok(f"Source files indexed: {len(src_files):,}")
    ok(f"Backup artifacts found: {len(bak_files)}")
    ok(f"Compiled artifacts alongside source: {len(compiled)}")

    return {"src": src_files, "bak": bak_files, "compiled": compiled}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — CLAUDE.md hard guard violations
# ══════════════════════════════════════════════════════════════════════════════
# Each entry: (regex_pattern, description, severity, file_extensions)
# NOTE: patterns match actual code, NOT comments.
# The scanner skips lines that start with // or *
BANNED_PATTERNS = [
    # Real `any` type usage in TypeScript — matches type positions only
    (
        r"(?::\s*any[\s,><\)\[]|<any>|\bas any\b|,\s*any[\s,>\)]|Record<[^,]+,\s*any>|Array<any>|Promise<any>|:\s*any\s*[=;,\)])",
        "no `any` type — use unknown + type guard",
        "CRITICAL",
        {".ts", ".tsx"},
    ),
    (
        r"console\.log\s*\(",
        "no console.log in committed code",
        "CRITICAL",
        {".ts", ".tsx"},
    ),
    (
        r"(?i)lemonsqueezy|lemon.squeezy",
        "no Lemon Squeezy — ever (Stripe only)",
        "CRITICAL",
        {".ts", ".tsx", ".js"},
    ),
    (
        r"hydrateFromToken\s*\(\s*\)",
        "no hydrateFromToken() — removed, creates race condition",
        "CRITICAL",
        {".tsx"},
    ),
    (
        r"""(?:tier|plan)\s*[=:]\s*['"]free['"]""",
        "no 'free' tier string — use 'explorer'",
        "CRITICAL",
        {".ts", ".tsx"},
    ),
    (
        r"catch\s*\([^)]*\)\s*\{\s*\}|catch\s*\{\s*\}",
        "no swallowed exceptions — empty catch block",
        "WARN",
        {".ts", ".tsx"},
    ),
]

SKIP_DIRS_PHASE1 = {
    "node_modules", ".git", "coverage", "dist", "scripts",
    ".r3-backup", ".r3-backups", "drizzle",
}

def phase1_hard_guards():
    head("Phase 1  — CLAUDE.md HARD GUARDS: scanning for violations")

    violations = 0

    for p in ROOT.rglob("*"):
        if p.is_dir():
            continue
        if any(s in p.parts for s in SKIP_DIRS_PHASE1):
            continue
        if p.suffix.lower() not in {".ts", ".tsx", ".js"}:
            continue
        if p.suffix == ".d.ts":
            continue  # skip compiled declaration files

        try:
            raw = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        lines = raw.splitlines()

        for pat, desc, sev, globs in BANNED_PATTERNS:
            if p.suffix.lower() not in globs:
                continue

            for i, line in enumerate(lines, 1):
                # Skip pure comment lines — they contain the word "any" etc legitimately
                stripped = line.strip()
                if stripped.startswith("//"):
                    continue
                if stripped.startswith("*"):
                    continue
                if stripped.startswith("#"):
                    continue
                # Skip eslint-disable comments
                if "eslint-disable" in line:
                    continue

                if re.search(pat, line):
                    rel = str(p.relative_to(ROOT))
                    add(1, sev, f"{desc}\n    {rel}:{i}  →  {line.strip()[:80]}", p)
                    violations += 1

    if violations == 0:
        ok("Zero hard guard violations")
    else:
        warn(f"{violations} violations found — see issues list")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — Duplicate / misplaced directories
# ══════════════════════════════════════════════════════════════════════════════
KNOWN_PHANTOM_DIRS = [
    ROOT / "client" / "client",
    ROOT / "client" / "hooks",
    ROOT / "client" / "components",
    ROOT / "client" / "stores",
    ROOT / "client" / "src" / "hook",
    ROOT / "client" / "src" / "context",
    ROOT / "client" / "src" / "contexts",
    ROOT / "client" / "src" / "store",
    ROOT / "db" / "schema",
    ROOT / "src",
]

def phase2_phantom_dirs():
    head("Phase 2  — PHANTOM DIRS: duplicate and misplaced directories")

    found = 0
    for d in KNOWN_PHANTOM_DIRS:
        if d.exists():
            file_count = sum(1 for f in d.rglob("*") if f.is_file())
            add(2, "WARN",
                f"Phantom directory: {d.relative_to(ROOT)} ({file_count} files)",
                d,
                fix=f"Audit and merge, then: rm -rf '{d}'",
                safe_delete=False)
            warn(f"Phantom dir: {d.relative_to(ROOT)} — {file_count} files")
            found += 1

    if found == 0:
        ok("No phantom directories found")
    else:
        warn(f"{found} phantom directories — review before deleting")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — .bak artifact proliferation
# ══════════════════════════════════════════════════════════════════════════════
BAK_SUFFIX_RE = re.compile(
    r"\.(bak\d*|r3backup|backup\.\d+|backup\.\d{8}_\d+|color-bak|theme-bak|"
    r"bak-\w+|bak2|bak3|bak4|bak5|bak6)$",
    re.IGNORECASE,
)
BAK_DIR_RE = re.compile(
    r"\.r3-(backup|backups|ts-fix-\d+-backups|wire-fix-backups|"
    r"audits-\d+-\d+-backups|cleanup-manifest)"
)
TIMESTAMP_BAK_RE = re.compile(r"\.\d{8}_\d{6}_\d+\.bak$")

def phase3_bak_artifacts(file_map: dict):
    head("Phase 3  — BAK ARTIFACTS: backup file proliferation audit")

    safe_count = 0

    for p in ROOT.rglob("*.bak"):
        if "node_modules" in str(p):
            continue
        rel = str(p.relative_to(ROOT))
        if TIMESTAMP_BAK_RE.search(str(p)):
            add(3, "INFO", f"Integrator backup (safe to delete): {rel}", p, safe_delete=True)
            safe_count += 1
        else:
            add(3, "WARN", f"Manual backup file: {rel}", p, safe_delete=False)
        warn(f"BAK: {rel}")

    for p in ROOT.rglob("*.r3backup"):
        if "node_modules" in str(p):
            continue
        add(3, "WARN", f"r3backup file: {p.relative_to(ROOT)}", p, safe_delete=False)
        warn(f"r3backup: {p.relative_to(ROOT)}")

    for p in ROOT.rglob("*"):
        if p.is_dir() or "node_modules" in str(p):
            continue
        if BAK_SUFFIX_RE.search(p.name):
            add(3, "WARN", f"Backup suffix: {p.relative_to(ROOT)}", p, safe_delete=False)
            warn(f"Backup: {p.relative_to(ROOT)}")

    for d in ROOT.iterdir():
        if d.is_dir() and BAK_DIR_RE.search(d.name):
            size = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
            add(3, "WARN", f"Backup directory: {d.name} ({size/1024:.0f}KB)", d, safe_delete=False)
            warn(f"Backup dir: {d.name}")

    ok(f"{safe_count} timestamped integrator backups safe to delete with --apply")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — Compiled artifacts alongside source
# ══════════════════════════════════════════════════════════════════════════════
COMPILED_SKIP = {"node_modules", "dist", "build", "coverage", "client"}

def phase4_compiled_artifacts():
    head("Phase 4  — COMPILED ARTIFACTS: .js/.d.ts alongside .ts source")

    found = 0
    for ts_file in ROOT.rglob("*.ts"):
        if ts_file.suffix == ".d.ts":
            continue
        if any(s in ts_file.parts for s in COMPILED_SKIP):
            continue

        for artifact in [
            ts_file.with_suffix(".js"),
            Path(str(ts_file) + ".map"),
            Path(str(ts_file)[:-3] + ".d.ts"),
            Path(str(ts_file)[:-3] + ".d.ts.map"),
            Path(str(ts_file)[:-3] + ".js.map"),
        ]:
            if artifact.exists() and artifact != ts_file:
                rel = str(artifact.relative_to(ROOT))
                add(4, "WARN", f"Compiled artifact: {rel}", artifact,
                    fix=f"rm '{artifact}'", safe_delete=True)
                found += 1

    if found == 0:
        ok("No compiled artifacts found alongside source")
    else:
        warn(f"{found} compiled artifacts found — safe to delete with --apply")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — Git status orphan check
# ══════════════════════════════════════════════════════════════════════════════
SAFE_UNTRACKED_PATTERNS = {
    "node_modules", ".r3-backup", ".r3-backups", "coverage", "uploads",
    ".bak", ".r3backup", ".backup", "r3backup",
}

def phase5_git_orphans():
    head("Phase 5  — GIT ORPHANS: untracked files that should be committed or deleted")

    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=ROOT, capture_output=True, text=True
    )

    untracked = []
    modified  = []
    deleted   = []

    for line in result.stdout.splitlines():
        status = line[:2].strip()
        path   = line[3:].strip().rstrip("/")
        if status == "??":
            if not any(s in path for s in SAFE_UNTRACKED_PATTERNS):
                untracked.append(path)
        elif "M" in status:
            modified.append(path)
        elif "D" in status:
            deleted.append(path)

    source_extensions = {".ts", ".tsx", ".sql", ".json", ".md", ".py"}
    junk_extensions   = {".bak", ".r3backup", ".js.map", ".d.ts.map"}

    should_track = [
        p for p in untracked
        if any(p.endswith(x) for x in source_extensions)
        and not any(s in p for s in {".bak", "backup", "r3backup", "node_modules"})
    ]

    junk = [p for p in untracked if any(p.endswith(x) for x in junk_extensions)]

    if should_track:
        warn(f"{len(should_track)} untracked source files — should these be committed?")
        for p in should_track[:20]:
            dim(f"  ?? {p}")
        if len(should_track) > 20:
            dim(f"  ... and {len(should_track)-20} more")
    else:
        ok("No untracked source files")

    for p in junk:
        add(5, "INFO", f"Junk untracked: {p}", ROOT / p, safe_delete=True)

    ok(f"{len(modified)} modified, {len(deleted)} deleted, {len(untracked)} untracked total")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6 — Schema consistency
# ══════════════════════════════════════════════════════════════════════════════
def phase6_schema():
    head("Phase 6  — SCHEMA: shared vs server/db consistency")

    # shared/schema.ts must NOT define users table
    shared_schema = ROOT / "shared" / "schema.ts"
    if shared_schema.exists():
        txt = shared_schema.read_text()
        if re.search(r'export const users\s*=\s*pgTable', txt):
            add(6, "CRITICAL",
                "shared/schema.ts defines users table — canonical is server/db/schema.ts",
                shared_schema)
            fail("shared/schema.ts has users table")
        else:
            ok("shared/schema.ts: no users table (correct)")

        if "pgEnum" in txt:
            if re.search(r"pgEnum.*from\s+['\"]drizzle-orm", txt) or \
               re.search(r"from\s+['\"]drizzle-orm/pg-core['\"].*pgEnum", txt, re.DOTALL):
                ok("shared/schema.ts: pgEnum imported")
            else:
                add(6, "WARN", "shared/schema.ts uses pgEnum but import unclear", shared_schema)
                warn("shared/schema.ts: pgEnum usage — verify import")

    # server/db/schema.ts: isAdmin only on users table
    server_schema = ROOT / "server" / "db" / "schema.ts"
    if server_schema.exists():
        txt = server_schema.read_text()
        lines = txt.splitlines()
        in_users = False
        spurious = []
        for i, line in enumerate(lines, 1):
            if 'pgTable("users"' in line:
                in_users = True
            elif "pgTable(" in line and 'pgTable("users"' not in line:
                in_users = False
            if "isAdmin" in line and not in_users:
                spurious.append(i)

        if spurious:
            add(6, "CRITICAL",
                f"isAdmin on non-users tables at lines: {spurious}",
                server_schema)
            fail(f"Spurious isAdmin columns at lines {spurious}")
        else:
            ok("server/db/schema.ts: isAdmin only on users table")

    # Tier string check: must not use "free" as tier value
    # Skip .d.ts, backup dirs, and test files
    tier_violations = []
    for p in ROOT.rglob("*.ts"):
        if "node_modules" in str(p):
            continue
        if "scripts" in str(p):
            continue
        if p.suffix == ".d.ts":
            continue  # compiled declarations — skip
        rel = str(p.relative_to(ROOT))
        if any(rel.startswith(x) for x in [".r3-", "drizzle/"]):
            continue
        try:
            txt = p.read_text(errors="ignore")
            # Only flag actual tier/plan assignments, not the word "free" in comments
            for line in txt.splitlines():
                stripped = line.strip()
                if stripped.startswith("//") or stripped.startswith("*"):
                    continue
                if re.search(r"""(?:tier|plan)\s*[=:]\s*['"]free['"]""", line):
                    tier_violations.append(f"{rel}: {stripped[:60]}")
        except Exception:
            pass

    if tier_violations:
        for v in tier_violations:
            add(6, "CRITICAL", f"Tier 'free' found: {v}")
            fail(f"free tier: {v}")
    else:
        ok("No 'free' tier strings — all using explorer/creator/pro_artist")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 7 — Import health
# ══════════════════════════════════════════════════════════════════════════════
def phase7_imports():
    head("Phase 7  — IMPORTS: banned and incorrect import paths")

    violations = 0

    for p in ROOT.rglob("*.ts"):
        if any(s in str(p) for s in {"node_modules", "scripts", ".bak", "dist"}):
            continue
        if p.suffix == ".d.ts":
            continue

        try:
            txt = p.read_text(errors="ignore")
        except Exception:
            continue

        rel = str(p.relative_to(ROOT))

        # protectedProcedure must NOT come from ../trpc
        if re.search(r"protectedProcedure.*from.*['\"]\.\.\/trpc['\"]", txt):
            add(7, "CRITICAL",
                f"protectedProcedure must import from ../base-procedures not ../trpc\n    {rel}", p)
            fail(f"{rel}: protectedProcedure from ../trpc")
            violations += 1

        # users table: only adminRouter needs it from ../db/schema
        # server/db/index.ts imports * as schema from shared/schema — this is CORRECT
        # for drizzle relational registry. Do NOT flag it.
        # daw.ts imports from shared/schema for effect types — CORRECT.
        # Only flag if it imports { users } specifically from shared/schema
        if re.search(r"import\s*\{[^}]*\busers\b[^}]*\}\s*from\s*['\"].*shared/schema['\"]", txt):
            add(7, "CRITICAL",
                f"users table imported from shared/schema — use server/db/schema\n    {rel}", p)
            fail(f"{rel}: users from shared/schema")
            violations += 1

    # appRouter must come from ./procedures not ./routers/index
    for p in [ROOT / "server" / "index.ts", ROOT / "index.ts"]:
        if not p.exists():
            continue
        txt = p.read_text()
        if re.search(r"appRouter.*from.*['\"]\.\/routers(?:\/index)?['\"]", txt):
            add(7, "CRITICAL",
                f"{p.relative_to(ROOT)}: appRouter must import from ./procedures",
                p)
            fail(f"{p.relative_to(ROOT)}: appRouter from wrong path")
            violations += 1
        else:
            ok(f"{p.relative_to(ROOT)}: appRouter import correct")

    if violations == 0:
        ok("All import paths correct")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 8 — TypeScript check
# ══════════════════════════════════════════════════════════════════════════════
def phase8_tsc():
    head("Phase 8  — TSC: pnpm tsc --noEmit")

    result = subprocess.run(
        ["pnpm", "tsc", "--noEmit"],
        cwd=ROOT, capture_output=True, text=True
    )

    errors = [l for l in (result.stdout + result.stderr).splitlines() if "error TS" in l]

    if not errors:
        ok("Zero TypeScript errors ✓")
    else:
        fail(f"{len(errors)} TypeScript errors:")
        for e in errors[:20]:
            dim(f"  {e}")
        if len(errors) > 20:
            dim(f"  ... and {len(errors)-20} more")
        for e in errors:
            add(8, "CRITICAL", f"TS error: {e}")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 9 — PRD metric deltas
# ══════════════════════════════════════════════════════════════════════════════
def phase9_prd_deltas(skip_tests: bool):
    head("Phase 9  — PRD DELTAS: stale claims vs actual codebase")

    # Test count
    if not skip_tests:
        result = subprocess.run(
            ["pnpm", "test", "--reporter=verbose", "--run"],
            cwd=ROOT, capture_output=True, text=True, timeout=120
        )
        output = result.stdout + result.stderr
        test_match = re.search(r"(\d+)\s+(?:tests?|passing)", output, re.IGNORECASE)
        if test_match:
            actual = int(test_match.group(1))
            if actual != 42:
                warn(f"Test count: PRD says 42, actual={actual} — update PRD §0/§6/§22/§25")
                add(9, "WARN", f"PRD test count stale: PRD=42, actual={actual}")
            else:
                ok(f"Test count matches PRD: {actual}")
        else:
            warn("Could not parse test count from pnpm test output")
    else:
        dim("Test count check skipped (--skip-tests)")

    # LemonSqueezy
    ls_files = []
    for p in ROOT.rglob("*.ts"):
        if "node_modules" in str(p):
            continue
        try:
            if re.search(r"lemonsqueezy", p.read_text(errors="ignore"), re.IGNORECASE):
                ls_files.append(str(p.relative_to(ROOT)))
        except Exception:
            pass
    if ls_files:
        for f in ls_files:
            add(9, "CRITICAL", f"LemonSqueezy reference: {f}")
            fail(f"LS reference: {f}")
    else:
        ok("No LemonSqueezy references in codebase")

    # ai_decision_log table
    result2 = subprocess.run(
        ["node", "-e",
         "const {Pool}=require('pg');require('dotenv/config');"
         "const pool=new Pool({connectionString:process.env.DATABASE_URL});"
         "pool.query(\"SELECT to_regclass('public.ai_decision_log')\")"
         ".then(r=>{console.log(r.rows[0].to_regclass?'EXISTS':'MISSING');pool.end()})"
         ".catch(e=>{console.log('ERROR:'+e.message);pool.end()})"],
        cwd=ROOT, capture_output=True, text=True, timeout=10
    )
    if "MISSING" in result2.stdout or "ERROR" in result2.stdout:
        warn("ai_decision_log table missing — PRD §12/§13 cite it in demo script")
        add(9, "WARN", "ai_decision_log table not in DB — PRD §12 stale")
    else:
        ok("ai_decision_log table exists")

    # Router shape
    proc = ROOT / "server" / "procedures.ts"
    if proc.exists():
        txt = proc.read_text()
        for r in ["admin", "sessionMetrics", "sessions", "subscriptions"]:
            if f"{r}:" in txt or f"{r} :" in txt:
                ok(f"Router wired: {r}")
            else:
                warn(f"Router missing: {r}")
                add(9, "WARN", f"procedures.ts missing router: {r}")

    # PRD action items
    head("  PRD ACTION ITEMS")
    prd_fixes = [
        "§0  Executive Summary: '42 Vitest test cases' → actual count",
        "§1  Identity table: remove 'LemonSqueezy' from Payments row",
        "§4  Business Model: tier names Starter/Pro/Studio → explorer/creator/pro_artist",
        "§6  Success criteria: update test case count",
        "§11 Engineering notes Zone 1: '@reduxjs/toolkit' → 'Zustand'",
        "§12 Data architecture: add admin, sessionMetrics to appRouter shape",
        "§13 API contract: add admin.checkAccess, admin.agentChat procedures",
        "§22 MVP checklist: update Vitest case count",
        "§25 Funding ask: '42 Vitest cases' → actual count",
    ]
    for f in prd_fixes:
        add(9, "WARN", f"PRD stale: {f}")
        warn(f)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 10 — Remediation
# ══════════════════════════════════════════════════════════════════════════════
def phase10_remediate(dry_run: bool):
    head("Phase 10 — REMEDIATION: delete safe artifacts")

    safe = [i for i in ISSUES if i.safe_delete and i.path and i.path.exists()]

    if not safe:
        ok("Nothing safe to auto-delete")
        return

    info(f"{len(safe)} safe artifacts to delete:")
    for issue in safe:
        dim(f"  {issue.path.relative_to(ROOT)}")

    if dry_run:
        dim(f"\n  DRY RUN — run with --apply to delete {len(safe)} artifacts")
        return

    deleted = 0
    for issue in safe:
        try:
            issue.path.unlink()
            ok(f"Deleted: {issue.path.relative_to(ROOT)}")
            deleted += 1
        except Exception as e:
            fail(f"Could not delete {issue.path.relative_to(ROOT)}: {e}")

    ok(f"Deleted {deleted} safe artifacts")

# ══════════════════════════════════════════════════════════════════════════════
# REPORT
# ══════════════════════════════════════════════════════════════════════════════
def print_report(dry_run: bool, phases_run: list):
    head("══════════════════ HYGIENE REPORT ══════════════════════════════════")

    by_sev: dict[str, list] = {"CRITICAL": [], "WARN": [], "INFO": []}
    for issue in ISSUES:
        by_sev[issue.severity].append(issue)

    print(f"\n  {C.RED}{C.BOLD}CRITICAL:{C.RESET} {len(by_sev['CRITICAL'])}")
    print(f"  {C.YELLOW}WARN:    {C.RESET} {len(by_sev['WARN'])}")
    print(f"  {C.DIM}INFO:    {C.RESET} {len(by_sev['INFO'])}")

    if by_sev["CRITICAL"]:
        print(f"\n  {C.RED}{C.BOLD}Critical Issues:{C.RESET}")
        for i in by_sev["CRITICAL"][:20]:
            print(f"  {C.RED}✗{C.RESET}  {i.message}")
        if len(by_sev["CRITICAL"]) > 20:
            print(f"  {C.DIM}... and {len(by_sev['CRITICAL'])-20} more{C.RESET}")

    # Score: each CRITICAL -2 (cap at 60 penalty), each WARN -1 (cap at 30 penalty)
    crit_penalty = min(len(by_sev["CRITICAL"]) * 2, 60)
    warn_penalty = min(len(by_sev["WARN"]), 30)
    score = max(0, 100 - crit_penalty - warn_penalty)

    grade = ("A+" if score >= 97 else "A"  if score >= 93 else "A-" if score >= 90 else
             "B+" if score >= 87 else "B"  if score >= 83 else "B-" if score >= 80 else
             "C+" if score >= 77 else "C"  if score >= 73 else "C-")

    color = C.GREEN if score >= 90 else C.YELLOW if score >= 80 else C.RED
    print(f"\n  {C.BOLD}Hygiene Score: {color}{score}/100  ({grade}){C.RESET}")
    print(f"  Phases run: {', '.join(str(p) for p in phases_run)}")
    print(f"  Mode: {'DRY RUN' if dry_run else 'APPLIED'}\n")

    if dry_run and (by_sev["CRITICAL"] or by_sev["WARN"]):
        print(f"  {C.YELLOW}After fixing critical issues:{C.RESET}")
        print(f"    python3 scripts/r3_hygiene.py --apply\n")

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="R3 v4 Hygiene Super Script")
    parser.add_argument("--apply",      action="store_true", help="Delete safe artifacts")
    parser.add_argument("--phase",      type=str,            help="e.g. --phase 0-5 or --phase 1,3")
    parser.add_argument("--skip-tests", action="store_true", help="Skip pnpm test in phase 9")
    args = parser.parse_args()

    dry_run = not args.apply

    print(f"\n{C.BOLD}{C.CYAN}  R3 v4 Hygiene Super Script{C.RESET}")
    print(f"  {C.DIM}Root: {ROOT}{C.RESET}")
    print(f"  {C.DIM}Mode: {'DRY RUN' if dry_run else 'APPLY'}{C.RESET}\n")

    all_phases = list(range(11))
    if args.phase:
        spec = args.phase
        if "-" in spec:
            lo, hi = spec.split("-", 1)
            phases_to_run = list(range(int(lo), int(hi) + 1))
        else:
            phases_to_run = [int(x.strip()) for x in spec.split(",")]
    else:
        phases_to_run = all_phases

    phases_run = []
    file_map   = {}

    try:
        if 0 in phases_to_run:
            file_map = phase0_map(); phases_run.append(0)
        if 1 in phases_to_run:
            phase1_hard_guards(); phases_run.append(1)
        if 2 in phases_to_run:
            phase2_phantom_dirs(); phases_run.append(2)
        if 3 in phases_to_run:
            phase3_bak_artifacts(file_map); phases_run.append(3)
        if 4 in phases_to_run:
            phase4_compiled_artifacts(); phases_run.append(4)
        if 5 in phases_to_run:
            phase5_git_orphans(); phases_run.append(5)
        if 6 in phases_to_run:
            phase6_schema(); phases_run.append(6)
        if 7 in phases_to_run:
            phase7_imports(); phases_run.append(7)
        if 8 in phases_to_run:
            phase8_tsc(); phases_run.append(8)
        if 9 in phases_to_run:
            phase9_prd_deltas(skip_tests=args.skip_tests); phases_run.append(9)
        if 10 in phases_to_run:
            phase10_remediate(dry_run); phases_run.append(10)

    except KeyboardInterrupt:
        print(f"\n\n  {C.YELLOW}Interrupted.{C.RESET}")
        sys.exit(130)

    print_report(dry_run, phases_run)


if __name__ == "__main__":
    main()
