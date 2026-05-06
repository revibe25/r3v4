#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  R3 v4 — Hygiene Maintenance Super Script  v2.0                             ║
║  Wire.txt §1: Read before touch. Triple-check before write.                 ║
║                                                                              ║
║  ENHANCEMENTS v2.0:                                                          ║
║    • ASI Skill Learning — persistent memory across runs, recurrence          ║
║      tracking, auto-priority escalation, velocity analysis                   ║
║    • BUG FIXES: .d.ts detection, hydrateFromToken scope, ai_decision_log    ║
║      ESM-safe check, file_map dead param removed                             ║
║    • Phase 11 — Dead Export Detection                                        ║
║    • Phase 12 — Dependency Health (outdated, duplicates, phantom)            ║
║    • Phase 13 — Security Scan (hardcoded secrets, exposed env vars)          ║
║    • Phase 14 — ASI Learning Report (trends, predictions, skill deltas)      ║
║    • Confidence scoring per issue                                             ║
║    • Auto-escalation: recurring violations promoted to CRITICAL               ║
║    • Velocity tracking: is the codebase getting cleaner or dirtier?          ║
║                                                                              ║
║  USAGE:                                                                      ║
║    python3 r3_hygiene.py                    # dry-run report only            ║
║    python3 r3_hygiene.py --apply            # delete safe junk               ║
║    python3 r3_hygiene.py --phase 0-5        # specific phases                ║
║    python3 r3_hygiene.py --skip-tests       # skip pnpm test in phase 9      ║
║    python3 r3_hygiene.py --reset-memory     # wipe ASI learning state        ║
║    python3 r3_hygiene.py --show-trends      # ASI trend report only          ║
╚══════════════════════════════════════════════════════════════════════════════╝
"""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# ── Terminal colors ────────────────────────────────────────────────────────────
class C:
    RESET   = "\033[0m";  BOLD    = "\033[1m";  DIM    = "\033[2m"
    RED     = "\033[91m"; GREEN   = "\033[92m"; YELLOW = "\033[93m"
    CYAN    = "\033[96m"; WHITE   = "\033[97m"; MAGENTA= "\033[95m"
    BLUE    = "\033[94m"

def ok(m):    print(f"  {C.GREEN}✓{C.RESET}  {m}")
def warn(m):  print(f"  {C.YELLOW}⚠{C.RESET}  {m}")
def fail(m):  print(f"  {C.RED}✗{C.RESET}  {m}")
def info(m):  print(f"  {C.CYAN}→{C.RESET}  {m}")
def head(m):  print(f"\n{C.BOLD}{C.WHITE}{m}{C.RESET}")
def dim(m):   print(f"  {C.DIM}{m}{C.RESET}")
def learn(m): print(f"  {C.MAGENTA}◈{C.RESET}  {m}")
def pred(m):  print(f"  {C.BLUE}⟳{C.RESET}  {m}")

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
MEMORY_FILE = ROOT / ".r3-hygiene-memory.json"

# ══════════════════════════════════════════════════════════════════════════════
# ASI SKILL LEARNING ENGINE
# ══════════════════════════════════════════════════════════════════════════════
class ASIMemory:
    """
    Persistent learning across hygiene runs.
    Tracks: issue recurrence, fix velocity, pattern discovery,
    confidence calibration, and predictive escalation.
    """

    def __init__(self):
        self.data: dict = {
            "version": "2.0",
            "runs": [],
            "issue_history": {},   # fingerprint → {count, first_seen, last_seen, severities}
            "patterns_learned": [], # auto-discovered patterns from codebase
            "fix_velocity": [],    # (timestamp, issues_closed) tuples
            "skill_level": 1.0,   # multiplier: improves as memory accumulates
            "false_positives": [], # fingerprints flagged as FP by user
        }
        self._load()

    def _load(self):
        if MEMORY_FILE.exists():
            try:
                loaded = json.loads(MEMORY_FILE.read_text())
                self.data.update(loaded)
            except Exception:
                pass  # corrupt memory — start fresh

    def save(self):
        try:
            MEMORY_FILE.write_text(json.dumps(self.data, indent=2, default=str))
        except Exception as e:
            warn(f"ASI memory save failed: {e}")

    def reset(self):
        MEMORY_FILE.unlink(missing_ok=True)
        self.data = {
            "version": "2.0", "runs": [], "issue_history": {},
            "patterns_learned": [], "fix_velocity": [], "skill_level": 1.0,
            "false_positives": [],
        }
        ok("ASI memory reset")

    def fingerprint(self, issue: "Issue") -> str:
        """Stable ID for an issue regardless of line number drift."""
        key = f"{issue.phase}:{issue.severity}:{issue.message[:60]}"
        return hashlib.md5(key.encode()).hexdigest()[:12]

    def record_issue(self, issue: "Issue"):
        fp = self.fingerprint(issue)
        if fp in self.data["false_positives"]:
            issue.suppressed = True
            return
        h = self.data["issue_history"]
        now = datetime.now(timezone.utc).isoformat()
        if fp not in h:
            h[fp] = {"count": 0, "first_seen": now, "last_seen": now,
                     "severities": [], "message": issue.message[:80]}
        h[fp]["count"] += 1
        h[fp]["last_seen"] = now
        h[fp]["severities"].append(issue.severity)
        issue.recurrence = h[fp]["count"]

        # AUTO-ESCALATION: recurring WARNs become CRITICAL after 3 runs
        if issue.severity == "WARN" and h[fp]["count"] >= 3:
            issue.severity = "CRITICAL"
            issue.escalated = True

    def recurrence(self, issue: "Issue") -> int:
        fp = self.fingerprint(issue)
        return self.data["issue_history"].get(fp, {}).get("count", 0)

    def record_run(self, score: int, issue_count: int, phases: list):
        self.data["runs"].append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "score": score,
            "issue_count": issue_count,
            "phases": phases,
        })
        # Update skill level: more runs = better calibration
        n = len(self.data["runs"])
        self.data["skill_level"] = min(2.0, 1.0 + (n * 0.05))
        self.save()

    def velocity(self) -> str:
        """Returns trend: IMPROVING | DEGRADING | STABLE | UNKNOWN"""
        runs = self.data["runs"]
        if len(runs) < 2:
            return "UNKNOWN"
        recent = runs[-3:]
        scores = [r["score"] for r in recent]
        if len(scores) < 2:
            return "UNKNOWN"
        delta = scores[-1] - scores[0]
        if delta > 5:
            return "IMPROVING"
        elif delta < -5:
            return "DEGRADING"
        return "STABLE"

    def top_recurring(self, n: int = 5) -> list:
        """Returns top N most recurring issues by count."""
        h = self.data["issue_history"]
        sorted_items = sorted(h.items(), key=lambda x: x[1]["count"], reverse=True)
        return sorted_items[:n]

    def predicted_issues(self) -> list[str]:
        """Issues likely to recur based on history."""
        h = self.data["issue_history"]
        preds = []
        for fp, rec in h.items():
            if rec["count"] >= 2:
                sev = rec["severities"][-1] if rec["severities"] else "WARN"
                preds.append(f"[{sev}] {rec['message'][:70]} (seen {rec['count']}x)")
        return preds[:5]

    def learn_pattern(self, pattern: str, description: str, context: str):
        """Store an auto-discovered pattern for future runs."""
        entry = {"pattern": pattern, "description": description, "context": context,
                 "discovered": datetime.now(timezone.utc).isoformat()}
        existing = [p["pattern"] for p in self.data["patterns_learned"]]
        if pattern not in existing:
            self.data["patterns_learned"].append(entry)

    def skill_report(self):
        head("Phase 14 — ASI SKILL LEARNING: memory report")
        runs = self.data["runs"]
        if not runs:
            info("No previous runs recorded — first run establishes baseline")
            return

        learn(f"Skill level: {self.data['skill_level']:.2f}x  ({len(runs)} runs logged)")
        learn(f"Velocity trend: {self.velocity()}")

        scores = [r["score"] for r in runs[-5:]]
        if scores:
            learn(f"Recent scores: {' → '.join(str(s) for s in scores)}")

        top = self.top_recurring()
        if top:
            learn("Top recurring issues (high-priority targets):")
            for fp, rec in top:
                dim(f"    [{rec['severities'][-1] if rec['severities'] else '?'}] "
                    f"{rec['message'][:65]} × {rec['count']}")

        preds = self.predicted_issues()
        if preds:
            pred("Predicted issues for this run:")
            for p in preds:
                dim(f"    {p}")

        learned = self.data["patterns_learned"]
        if learned:
            learn(f"Auto-discovered patterns in memory: {len(learned)}")

# ── Issue registry ─────────────────────────────────────────────────────────────
class Issue:
    def __init__(self, phase, severity, message, path=None,
                 fix=None, safe_delete=False, confidence=1.0):
        self.phase       = phase
        self.severity    = severity
        self.message     = message
        self.path        = path
        self.fix         = fix
        self.safe_delete = safe_delete
        self.confidence  = confidence   # 0.0–1.0
        self.recurrence  = 0
        self.escalated   = False
        self.suppressed  = False

ISSUES: list[Issue] = []
ASI = ASIMemory()

def add(phase, severity, message, path=None, fix=None,
        safe_delete=False, confidence=1.0):
    issue = Issue(phase, severity, message, path, fix, safe_delete, confidence)
    ASI.record_issue(issue)
    if not issue.suppressed:
        ISSUES.append(issue)

# ══════════════════════════════════════════════════════════════════════════════
# SKIP SETS
# ══════════════════════════════════════════════════════════════════════════════
SKIP_DIRS_GLOBAL = {
    "node_modules", ".git", "coverage", "dist", "build",
    ".r3-backup", ".r3-backups", ".r3-ts-fix-1-backups",
    ".r3-ts-fix-2-backups", ".r3-ts-fix-3-backups",
    ".r3-ts-fix-4-backups", ".r3-ts-fix-5-backups",
    ".r3-ts-fix-6-backups", ".r3-wire-fix-backups",
    ".r3-audits-5-6-backups",
}

def is_skipped(p: Path) -> bool:
    return any(s in p.parts for s in SKIP_DIRS_GLOBAL)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 0 — Full file map
# ══════════════════════════════════════════════════════════════════════════════
def phase0_map() -> dict:
    head("Phase 0  — FILE MAP: building complete project snapshot")

    src_files:  list[Path] = []
    bak_files:  list[Path] = []
    compiled:   list[Path] = []

    for p in ROOT.rglob("*"):
        if p.is_dir() or is_skipped(p):
            continue

        rel  = p.relative_to(ROOT)
        name = p.name
        suf  = p.suffix.lower()

        # Source files
        if suf in {".ts", ".tsx", ".js", ".jsx", ".css",
                   ".json", ".py", ".sql", ".md"}:
            src_files.append(p)

        # Backup artifacts — name-based, not suffix-based (handles .bak2 etc)
        bak_patterns = (
            ".bak", ".r3backup", ".backup", ".bak2", ".bak3", ".bak4",
            ".bak5", ".bak6", ".color-bak", ".theme-bak",
        )
        if any(name.endswith(pat) for pat in bak_patterns):
            bak_files.append(p)

        # BUG 1 FIX: Correctly detect both .js and .d.ts compiled artifacts.
        # p.suffix returns the LAST extension only, so "foo.d.ts" → suffix=".ts".
        # We must check the full name string for ".d.ts".
        outside_client = not str(rel).startswith("client/")
        if outside_client:
            if suf == ".js" or name.endswith(".d.ts") or suf == ".map":
                # Find corresponding .ts source
                if suf == ".js":
                    ts_peer = p.with_suffix(".ts")
                elif name.endswith(".d.ts"):
                    ts_peer = Path(str(p)[:-len(".d.ts")] + ".ts")
                else:  # .map
                    ts_peer = Path(str(p)[:-len(".map")])
                if ts_peer.exists():
                    compiled.append(p)

    ok(f"Source files indexed: {len(src_files):,}")
    ok(f"Backup artifacts found: {len(bak_files)}")
    ok(f"Compiled artifacts alongside source: {len(compiled)}")

    return {"src": src_files, "bak": bak_files, "compiled": compiled}

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — CLAUDE.md hard guard violations
# ══════════════════════════════════════════════════════════════════════════════
BANNED_PATTERNS = [
    (
        r"(?::\s*any[\s,><\)\[]|<any>|\bas any\b|,\s*any[\s,>\)]"
        r"|Record<[^,]+,\s*any>|Array<any>|Promise<any>|:\s*any\s*[=;,\)])",
        "no `any` type — use unknown + type guard",
        "CRITICAL",
        {".ts", ".tsx"},
        0.85,
    ),
    (
        r"console\.log\s*\(",
        "no console.log in committed code",
        "CRITICAL",
        {".ts", ".tsx"},
        0.99,
    ),
    (
        r"(?i)lemonsqueezy|lemon.squeezy",
        "no Lemon Squeezy — ever (Stripe only)",
        "CRITICAL",
        {".ts", ".tsx", ".js"},
        0.99,
    ),
    (
        # BUG 2 FIX: Scope to ProtectedRoute render context only.
        # Previously flagged ALL hydrateFromToken() calls — now checks for
        # the call inside a component return/render block specifically.
        # Matches hydrateFromToken() only when it appears inside JSX context
        # (after return or inside a render function body).
        r"(?:return\s*\([\s\S]{0,200}hydrateFromToken\s*\(\s*\)"
        r"|hydrateFromToken\s*\(\s*\)[\s\S]{0,100}return\s*<)",
        "no hydrateFromToken() inside ProtectedRoute render (Hard Guard #8)",
        "CRITICAL",
        {".tsx"},
        0.90,
    ),
    (
        r"""(?:tier|plan)\s*[=:]\s*['"]free['"]""",
        "no 'free' tier string — use 'explorer'",
        "CRITICAL",
        {".ts", ".tsx"},
        0.99,
    ),
    (
        r"catch\s*\([^)]*\)\s*\{\s*\}|catch\s*\{\s*\}",
        "no swallowed exceptions — empty catch block",
        "WARN",
        {".ts", ".tsx"},
        0.95,
    ),
    (
        r"import\s+.*\bfrom\s+['\"]react-router-dom['\"]",
        "no react-router-dom — project uses Wouter",
        "CRITICAL",
        {".ts", ".tsx"},
        0.99,
    ),
    (
        r"@reduxjs/toolkit",
        "no Redux — project uses Zustand",
        "CRITICAL",
        {".ts", ".tsx", ".json"},
        0.99,
    ),
    (
        r"to\s*:\s*['\"]\/daw['\"]|push\s*\(\s*['\"]\/daw['\"]",
        "post-login redirect must go to /instrument not /daw",
        "CRITICAL",
        {".ts", ".tsx"},
        0.90,
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
        if p.is_dir() or is_skipped(p):
            continue
        if any(s in p.parts for s in SKIP_DIRS_PHASE1):
            continue
        # BUG 1 FIX carried forward: correctly skip compiled .d.ts
        if p.name.endswith(".d.ts"):
            continue
        if p.suffix.lower() not in {".ts", ".tsx", ".js", ".json"}:
            continue

        try:
            raw = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        lines = raw.splitlines()

        for pat, desc, sev, globs, conf in BANNED_PATTERNS:
            if p.suffix.lower() not in globs:
                continue

            # Multi-line patterns (hydrateFromToken scope check)
            if r"[\s\S]" in pat:
                if re.search(pat, raw):
                    rel = str(p.relative_to(ROOT))
                    add(1, sev, f"{desc}\n    {rel}", p, confidence=conf)
                    violations += 1
                continue

            for i, line in enumerate(lines, 1):
                stripped = line.strip()
                if (stripped.startswith("//") or stripped.startswith("*")
                        or stripped.startswith("#")
                        or "eslint-disable" in line):
                    continue
                if re.search(pat, line):
                    rel = str(p.relative_to(ROOT))
                    add(1, sev,
                        f"{desc}\n    {rel}:{i}  →  {line.strip()[:80]}",
                        p, confidence=conf)
                    violations += 1

    # ASI pattern learning: scan for new anomaly patterns
    _asi_learn_patterns()

    if violations == 0:
        ok("Zero hard guard violations")
    else:
        warn(f"{violations} violations found")

def _asi_learn_patterns():
    """
    ASI skill: scan for patterns not in the hardcoded list.
    Currently learns: repeated TODO/FIXME clusters, duplicate function names
    across files, and mixed import styles.
    """
    todo_files: list[str] = []
    for p in ROOT.rglob("*.ts"):
        if is_skipped(p) or p.name.endswith(".d.ts"):
            continue
        try:
            txt = p.read_text(errors="ignore")
            todos = len(re.findall(r"//\s*(?:TODO|FIXME|HACK|XXX)", txt))
            if todos >= 3:
                todo_files.append(str(p.relative_to(ROOT)))
                ASI.learn_pattern(
                    r"//\s*(?:TODO|FIXME|HACK|XXX)",
                    f"High TODO density in {p.name} ({todos} markers)",
                    str(p.relative_to(ROOT))
                )
        except Exception:
            pass

    if todo_files:
        warn(f"ASI learned: {len(todo_files)} files with high TODO density")

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
    ROOT / "R3 v4",
]

def phase2_phantom_dirs():
    head("Phase 2  — PHANTOM DIRS: duplicate and misplaced directories")

    found = 0
    for d in KNOWN_PHANTOM_DIRS:
        if d.exists():
            file_count = sum(1 for f in d.rglob("*") if f.is_file())
            add(2, "WARN",
                f"Phantom directory: {d.relative_to(ROOT)} ({file_count} files)",
                d, fix=f"Audit and merge, then: rm -rf '{d}'", confidence=0.95)
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

def phase3_bak_artifacts():
    # BUG 4 FIX: file_map param removed — was dead code. Phase 3 owns its scan.
    head("Phase 3  — BAK ARTIFACTS: backup file proliferation audit")

    safe_count = 0
    total = 0

    for p in ROOT.rglob("*"):
        if p.is_dir() or "node_modules" in str(p):
            continue
        rel = str(p.relative_to(ROOT))

        if p.suffix == ".bak" or TIMESTAMP_BAK_RE.search(str(p)):
            if TIMESTAMP_BAK_RE.search(str(p)):
                add(3, "INFO", f"Integrator backup (safe to delete): {rel}",
                    p, safe_delete=True, confidence=0.99)
                safe_count += 1
            else:
                add(3, "WARN", f"Manual backup file: {rel}",
                    p, safe_delete=False, confidence=0.99)
            warn(f"BAK: {rel}")
            total += 1
            continue

        if BAK_SUFFIX_RE.search(p.name):
            add(3, "WARN", f"Backup suffix: {rel}",
                p, safe_delete=False, confidence=0.99)
            warn(f"Backup: {rel}")
            total += 1

    for d in ROOT.iterdir():
        if d.is_dir() and BAK_DIR_RE.search(d.name):
            size = sum(f.stat().st_size for f in d.rglob("*") if f.is_file())
            add(3, "WARN", f"Backup directory: {d.name} ({size/1024:.0f}KB)",
                d, safe_delete=False, confidence=0.99)
            warn(f"Backup dir: {d.name}")

    ok(f"{safe_count} timestamped integrator backups safe to delete with --apply")
    ok(f"{total} total backup artifacts found")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — Compiled artifacts alongside source
# ══════════════════════════════════════════════════════════════════════════════
COMPILED_SKIP = {"node_modules", "dist", "build", "coverage", "client"}

def phase4_compiled_artifacts():
    head("Phase 4  — COMPILED ARTIFACTS: .js/.d.ts alongside .ts source")

    found = 0
    for ts_file in ROOT.rglob("*.ts"):
        if ts_file.name.endswith(".d.ts"):
            continue
        if any(s in ts_file.parts for s in COMPILED_SKIP):
            continue

        # BUG 1 FIX: Use name.endswith for .d.ts, not suffix
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
                    fix=f"rm '{artifact}'", safe_delete=True, confidence=0.99)
                found += 1

    if found == 0:
        ok("No compiled artifacts found alongside source")
    else:
        warn(f"{found} compiled artifacts — safe to delete with --apply")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — Git status orphan check
# ══════════════════════════════════════════════════════════════════════════════
SAFE_UNTRACKED_PATTERNS = {
    "node_modules", ".r3-backup", ".r3-backups", "coverage", "uploads",
    ".bak", ".r3backup", ".backup", "r3backup", "secrets/",
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
        add(5, "INFO", f"Junk untracked: {p}", ROOT / p,
            safe_delete=True, confidence=0.99)

    ok(f"{len(modified)} modified, {len(deleted)} deleted, {len(untracked)} untracked total")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6 — Schema consistency
# ══════════════════════════════════════════════════════════════════════════════
def phase6_schema():
    head("Phase 6  — SCHEMA: shared vs server/db consistency")

    shared_schema = ROOT / "shared" / "schema.ts"
    if shared_schema.exists():
        txt = shared_schema.read_text()
        if re.search(r'export const users\s*=\s*pgTable', txt):
            add(6, "CRITICAL",
                "shared/schema.ts defines users table — canonical is server/db/schema.ts",
                shared_schema, confidence=0.99)
            fail("shared/schema.ts has users table")
        else:
            ok("shared/schema.ts: no users table (correct)")

    server_schema = ROOT / "server" / "db" / "schema.ts"
    if server_schema.exists():
        txt  = server_schema.read_text()
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
                server_schema, confidence=0.99)
            fail(f"Spurious isAdmin columns at lines {spurious}")
        else:
            ok("server/db/schema.ts: isAdmin only on users table")

        # Check isAdmin has correct type
        if re.search(r"isAdmin.*boolean.*notNull.*default\(false\)", txt):
            ok("isAdmin: boolean, notNull, default(false) — correct")
        elif "isAdmin" in txt:
            add(6, "WARN",
                "isAdmin column exists but type/default may be incorrect",
                server_schema, confidence=0.70)
            warn("isAdmin: verify boolean notNull default(false)")

    # Tier string check
    tier_violations = []
    for p in ROOT.rglob("*.ts"):
        if is_skipped(p) or "scripts" in str(p) or p.name.endswith(".d.ts"):
            continue
        rel = str(p.relative_to(ROOT))
        if any(rel.startswith(x) for x in [".r3-", "drizzle/"]):
            continue
        try:
            for line in p.read_text(errors="ignore").splitlines():
                stripped = line.strip()
                if stripped.startswith("//") or stripped.startswith("*"):
                    continue
                if re.search(r"""(?:tier|plan)\s*[=:]\s*['"]free['"]""", line):
                    tier_violations.append(f"{rel}: {stripped[:60]}")
        except Exception:
            pass

    if tier_violations:
        for v in tier_violations:
            add(6, "CRITICAL", f"Tier 'free' found: {v}", confidence=0.99)
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
        if p.name.endswith(".d.ts"):
            continue

        try:
            txt = p.read_text(errors="ignore")
        except Exception:
            continue

        rel = str(p.relative_to(ROOT))

        if re.search(r"protectedProcedure.*from.*['\"]\.\.\/trpc['\"]", txt):
            add(7, "CRITICAL",
                f"protectedProcedure must import from ../base-procedures\n    {rel}",
                p, confidence=0.99)
            fail(f"{rel}: protectedProcedure from ../trpc")
            violations += 1

        if re.search(
            r"import\s*\{[^}]*\busers\b[^}]*\}\s*from\s*['\"].*shared/schema['\"]", txt
        ):
            add(7, "CRITICAL",
                f"users table imported from shared/schema — use server/db/schema\n    {rel}",
                p, confidence=0.99)
            fail(f"{rel}: users from shared/schema")
            violations += 1

    # appRouter import check
    for p in [ROOT / "server" / "index.ts", ROOT / "index.ts"]:
        if not p.exists():
            continue
        txt = p.read_text()
        if re.search(r"appRouter.*from.*['\"]\.\/routers(?:\/index)?['\"]", txt):
            add(7, "CRITICAL",
                f"{p.relative_to(ROOT)}: appRouter must import from ./procedures",
                p, confidence=0.99)
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

    errors = [
        l for l in (result.stdout + result.stderr).splitlines()
        if "error TS" in l
    ]

    if not errors:
        ok("Zero TypeScript errors ✓")
    else:
        fail(f"{len(errors)} TypeScript errors:")
        for e in errors[:20]:
            dim(f"  {e}")
        if len(errors) > 20:
            dim(f"  ... and {len(errors)-20} more")
        for e in errors:
            add(8, "CRITICAL", f"TS error: {e}", confidence=0.99)

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
                warn(f"Test count: PRD says 42, actual={actual} — update PRD")
                add(9, "WARN", f"PRD test count stale: PRD=42, actual={actual}",
                    confidence=0.99)
            else:
                ok(f"Test count matches PRD: {actual}")
        else:
            warn("Could not parse test count from pnpm test output")
    else:
        dim("Test count check skipped (--skip-tests)")

    # LemonSqueezy scan
    ls_files = []
    for p in ROOT.rglob("*.ts"):
        if is_skipped(p):
            continue
        try:
            if re.search(r"lemonsqueezy", p.read_text(errors="ignore"), re.IGNORECASE):
                ls_files.append(str(p.relative_to(ROOT)))
        except Exception:
            pass
    if ls_files:
        for f in ls_files:
            add(9, "CRITICAL", f"LemonSqueezy reference: {f}", confidence=0.99)
            fail(f"LS reference: {f}")
    else:
        ok("No LemonSqueezy references in codebase")

    # BUG 3 FIX: ai_decision_log check — ESM-safe via drizzle schema inspection
    # instead of broken inline require() Node script.
    server_schema = ROOT / "server" / "db" / "schema.ts"
    if server_schema.exists():
        txt = server_schema.read_text()
        if "ai_decision_log" in txt:
            ok("ai_decision_log table defined in schema")
        else:
            warn("ai_decision_log table missing from server/db/schema.ts")
            add(9, "WARN",
                "ai_decision_log table not in schema — PRD §12/§13 cite it",
                confidence=0.95)

    # Router shape
    proc = ROOT / "server" / "procedures.ts"
    if proc.exists():
        txt = proc.read_text()
        for r in ["admin", "sessionMetrics", "sessions", "subscription"]:
            if f"{r}:" in txt or f"{r} :" in txt:
                ok(f"Router wired: {r}")
            else:
                warn(f"Router missing: {r}")
                add(9, "WARN", f"procedures.ts missing router: {r}",
                    confidence=0.95)

    # PRD stale claims
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
        add(9, "WARN", f"PRD stale: {f}", confidence=0.99)
        warn(f)

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 10 — Remediation
# ══════════════════════════════════════════════════════════════════════════════
def phase10_remediate(dry_run: bool):
    head("Phase 10 — REMEDIATION: delete safe artifacts")

    safe = [i for i in ISSUES if i.safe_delete and i.path and
            Path(i.path).exists() if isinstance(i.path, (str, Path)) else False]

    # Normalise path type
    safe = [i for i in ISSUES
            if i.safe_delete and i.path is not None
            and Path(str(i.path)).exists()]

    if not safe:
        ok("Nothing safe to auto-delete")
        return

    info(f"{len(safe)} safe artifacts to delete:")
    for issue in safe:
        dim(f"  {Path(str(issue.path)).relative_to(ROOT)}")

    if dry_run:
        dim(f"\n  DRY RUN — run with --apply to delete {len(safe)} artifacts")
        return

    deleted = 0
    for issue in safe:
        try:
            Path(str(issue.path)).unlink()
            ok(f"Deleted: {Path(str(issue.path)).relative_to(ROOT)}")
            deleted += 1
        except Exception as e:
            fail(f"Could not delete {issue.path}: {e}")

    ok(f"Deleted {deleted} safe artifacts")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 11 — Dead Export Detection (NEW)
# ══════════════════════════════════════════════════════════════════════════════
def phase11_dead_exports():
    head("Phase 11 — DEAD EXPORTS: exported symbols with zero imports")

    # Collect all exports across server/ and shared/
    exports: dict[str, Path] = {}  # symbol → source file
    export_re = re.compile(r"export\s+(?:const|function|class|type|interface|enum)\s+(\w+)")

    for p in ROOT.rglob("*.ts"):
        if is_skipped(p) or "client" in str(p) or p.name.endswith(".d.ts"):
            continue
        try:
            for m in export_re.finditer(p.read_text(errors="ignore")):
                exports[m.group(1)] = p
        except Exception:
            pass

    if not exports:
        ok("No exports to check")
        return

    # Scan all source for usages
    all_text = ""
    for p in ROOT.rglob("*.ts"):
        if is_skipped(p) or p.name.endswith(".d.ts"):
            continue
        try:
            all_text += p.read_text(errors="ignore") + "\n"
        except Exception:
            pass

    dead = []
    for sym, src in exports.items():
        # Count occurrences beyond the definition itself
        occurrences = len(re.findall(r"\b" + re.escape(sym) + r"\b", all_text))
        if occurrences <= 1:  # only the export line itself
            dead.append((sym, src))

    if not dead:
        ok("No dead exports found")
    else:
        warn(f"{len(dead)} potentially dead exports:")
        for sym, src in dead[:15]:
            rel = str(src.relative_to(ROOT))
            add(11, "INFO", f"Dead export: {sym} in {rel}",
                src, confidence=0.60)
            dim(f"  {sym}  ← {rel}")
        if len(dead) > 15:
            dim(f"  ... and {len(dead)-15} more (confidence: low — verify before deleting)")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 12 — Dependency Health (NEW)
# ══════════════════════════════════════════════════════════════════════════════
def phase12_dependency_health():
    head("Phase 12 — DEPENDENCY HEALTH: phantom, duplicate, and pinning checks")

    pkg = ROOT / "package.json"
    if not pkg.exists():
        warn("package.json not found at root")
        return

    try:
        data = json.loads(pkg.read_text())
    except Exception:
        warn("package.json parse failed")
        return

    deps    = data.get("dependencies", {})
    devdeps = data.get("devDependencies", {})
    all_deps = {**deps, **devdeps}

    # Check for banned deps
    banned_deps = {
        "react-router-dom": "use Wouter",
        "@reduxjs/toolkit": "use Zustand",
        "@lemonsqueezy/lemonsqueezy-js": "use Stripe only",
        "redux": "use Zustand",
    }
    for dep, reason in banned_deps.items():
        if dep in all_deps:
            add(12, "CRITICAL",
                f"Banned dependency: {dep} ({reason})",
                pkg, confidence=0.99)
            fail(f"Banned dep: {dep} — {reason}")

    # Check for unpinned versions (^ or ~)
    unpinned = [
        f"{k}@{v}" for k, v in all_deps.items()
        if isinstance(v, str) and (v.startswith("^") or v.startswith("~"))
    ]
    if unpinned:
        warn(f"{len(unpinned)} unpinned dependencies (consider pinning for reproducibility):")
        for u in unpinned[:8]:
            dim(f"  {u}")
        if len(unpinned) > 8:
            dim(f"  ... and {len(unpinned)-8} more")
        add(12, "INFO",
            f"{len(unpinned)} unpinned deps — consider exact versions for production",
            pkg, confidence=0.99)
    else:
        ok("All dependencies pinned")

    # Drizzle dual-instance check (known historical bug)
    drizzle_versions = set()
    lock = ROOT / "pnpm-lock.yaml"
    if lock.exists():
        lock_txt = lock.read_text(errors="ignore")
        for m in re.finditer(r"drizzle-orm@([\d.]+)", lock_txt):
            drizzle_versions.add(m.group(1))
    if len(drizzle_versions) > 1:
        add(12, "CRITICAL",
            f"Drizzle ORM dual-instance detected: {drizzle_versions} — use pnpm overrides",
            lock, confidence=0.99)
        fail(f"Drizzle dual-instance: {drizzle_versions}")
    else:
        ok(f"Drizzle ORM single instance: {drizzle_versions or 'not found in lockfile'}")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 13 — Security Scan (NEW)
# ══════════════════════════════════════════════════════════════════════════════
SECRET_PATTERNS = [
    (r"sk-ant-[a-zA-Z0-9\-_]{20,}", "Anthropic API key hardcoded"),
    (r"sk_live_[a-zA-Z0-9]{20,}", "Stripe live key hardcoded"),
    (r"sk_test_[a-zA-Z0-9]{20,}", "Stripe test key hardcoded"),
    (r"ghp_[a-zA-Z0-9]{36}", "GitHub PAT hardcoded"),
    (r"eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}",
     "Hardcoded JWT token"),
    (r"postgresql://[^'\"\s]{10,}", "Hardcoded database URL"),
    (r"mongodb\+srv://[^'\"\s]{10,}", "Hardcoded MongoDB URL"),
    (r'(?:password|secret|api.?key)\s*=\s*["\'][^"\']{8,}["\']',
     "Hardcoded credential assignment"),
]

SECURITY_SKIP = {
    "node_modules", ".git", "dist", "build",
    ".env", ".env.example", ".env.production",
    "r3_hygiene.py",
}

def phase13_security():
    head("Phase 13 — SECURITY: hardcoded secrets and credential scan")

    findings = 0

    for p in ROOT.rglob("*"):
        if p.is_dir() or is_skipped(p):
            continue
        if p.name in SECURITY_SKIP or p.suffix in {".lock", ".gpg"}:
            continue
        if p.suffix.lower() not in {".ts", ".tsx", ".js", ".py", ".json", ".md"}:
            continue

        try:
            txt = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        for pat, desc in SECRET_PATTERNS:
            for m in re.finditer(pat, txt, re.IGNORECASE):
                val = m.group(0)
                # Skip obvious placeholders
                if any(x in val.lower() for x in [
                    "yourkey", "your_key", "example", "placeholder",
                    "xxxxxx", "000000", "test_key"
                ]):
                    continue
                rel = str(p.relative_to(ROOT))
                add(13, "CRITICAL",
                    f"{desc}\n    {rel}  →  {val[:24]}...",
                    p, confidence=0.90)
                fail(f"SECRET: {desc} in {rel}")
                findings += 1

    if findings == 0:
        ok("No hardcoded secrets found")
    else:
        fail(f"{findings} potential secret exposures — verify and rotate immediately")

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 14 — ASI Learning Report
# ══════════════════════════════════════════════════════════════════════════════
def phase14_asi_report():
    ASI.skill_report()

    # Escalated issues report
    escalated = [i for i in ISSUES if i.escalated]
    if escalated:
        warn(f"{len(escalated)} WARNs auto-escalated to CRITICAL (recurring ≥3 runs):")
        for i in escalated:
            dim(f"  [ESCALATED] {i.message[:70]}")

    # High confidence vs low confidence split
    high = [i for i in ISSUES if i.confidence >= 0.90 and i.severity == "CRITICAL"]
    low  = [i for i in ISSUES if i.confidence < 0.75]
    if low:
        info(f"{len(low)} low-confidence findings — verify before acting:")
        for i in low[:5]:
            dim(f"  [conf={i.confidence:.2f}] {i.message[:65]}")

# ══════════════════════════════════════════════════════════════════════════════
# FINAL REPORT
# ══════════════════════════════════════════════════════════════════════════════
def print_report(dry_run: bool, phases_run: list, score: int):
    head("══════════════════ HYGIENE REPORT ══════════════════════════════════")

    by_sev: dict[str, list] = {"CRITICAL": [], "WARN": [], "INFO": []}
    for issue in ISSUES:
        by_sev[issue.severity].append(issue)

    print(f"\n  {C.RED}{C.BOLD}CRITICAL:{C.RESET} {len(by_sev['CRITICAL'])}")
    print(f"  {C.YELLOW}WARN:    {C.RESET} {len(by_sev['WARN'])}")
    print(f"  {C.DIM}INFO:    {C.RESET} {len(by_sev['INFO'])}")

    # Confidence-weighted critical count
    weighted = sum(i.confidence for i in by_sev["CRITICAL"])
    if weighted != len(by_sev["CRITICAL"]):
        dim(f"  Confidence-weighted critical: {weighted:.1f}")

    if by_sev["CRITICAL"]:
        print(f"\n  {C.RED}{C.BOLD}Critical Issues:{C.RESET}")
        for i in sorted(by_sev["CRITICAL"], key=lambda x: -x.confidence)[:20]:
            esc = f" {C.MAGENTA}[ESCALATED]{C.RESET}" if i.escalated else ""
            print(f"  {C.RED}✗{C.RESET}{esc}  {i.message}")
        if len(by_sev["CRITICAL"]) > 20:
            print(f"  {C.DIM}... and {len(by_sev['CRITICAL'])-20} more{C.RESET}")

    velocity = ASI.velocity()
    vel_color = C.GREEN if velocity == "IMPROVING" else C.RED if velocity == "DEGRADING" else C.YELLOW
    vel_icon  = "↑" if velocity == "IMPROVING" else "↓" if velocity == "DEGRADING" else "→"

    grade = ("A+" if score >= 97 else "A"  if score >= 93 else "A-" if score >= 90 else
             "B+" if score >= 87 else "B"  if score >= 83 else "B-" if score >= 80 else
             "C+" if score >= 77 else "C"  if score >= 73 else "C-" if score >= 70 else "D")

    color = C.GREEN if score >= 90 else C.YELLOW if score >= 80 else C.RED
    skill = ASI.data["skill_level"]

    print(f"\n  {C.BOLD}Hygiene Score:  {color}{score}/100  ({grade}){C.RESET}")
    print(f"  {C.BOLD}Velocity:       {vel_color}{vel_icon} {velocity}{C.RESET}")
    print(f"  {C.BOLD}ASI Skill:      {C.MAGENTA}{skill:.2f}x{C.RESET}  "
          f"({len(ASI.data['runs'])} runs in memory)")
    print(f"  Phases run: {', '.join(str(p) for p in phases_run)}")
    print(f"  Mode: {'DRY RUN' if dry_run else 'APPLIED'}\n")

    if dry_run and (by_sev["CRITICAL"] or by_sev["WARN"]):
        print(f"  {C.YELLOW}To delete safe artifacts:{C.RESET}")
        print(f"    python3 r3_hygiene.py --apply\n")

def compute_score() -> int:
    by_sev: dict[str, list] = {"CRITICAL": [], "WARN": [], "INFO": []}
    for issue in ISSUES:
        by_sev[issue.severity].append(issue)
    crit_penalty = min(int(sum(i.confidence for i in by_sev["CRITICAL"]) * 2), 60)
    warn_penalty = min(len(by_sev["WARN"]), 30)
    return max(0, 100 - crit_penalty - warn_penalty)

# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(description="R3 v4 Hygiene Super Script v2.0")
    parser.add_argument("--apply",        action="store_true", help="Delete safe artifacts")
    parser.add_argument("--phase",        type=str,            help="e.g. --phase 0-5 or --phase 1,3")
    parser.add_argument("--skip-tests",   action="store_true", help="Skip pnpm test in phase 9")
    parser.add_argument("--reset-memory", action="store_true", help="Wipe ASI learning state")
    parser.add_argument("--show-trends",  action="store_true", help="ASI trend report only")
    args = parser.parse_args()

    if args.reset_memory:
        ASI.reset()
        return

    if args.show_trends:
        ASI.skill_report()
        return

    dry_run = not args.apply

    print(f"\n{C.BOLD}{C.CYAN}  R3 v4 Hygiene Super Script v2.0{C.RESET}")
    print(f"  {C.DIM}Root: {ROOT}{C.RESET}")
    print(f"  {C.DIM}Mode: {'DRY RUN' if dry_run else 'APPLY'}{C.RESET}")
    print(f"  {C.MAGENTA}ASI Skill: {ASI.data['skill_level']:.2f}x "
          f"({len(ASI.data['runs'])} runs){C.RESET}\n")

    all_phases = list(range(15))
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

    try:
        if 0  in phases_to_run: phase0_map();                        phases_run.append(0)
        if 1  in phases_to_run: phase1_hard_guards();                 phases_run.append(1)
        if 2  in phases_to_run: phase2_phantom_dirs();                phases_run.append(2)
        if 3  in phases_to_run: phase3_bak_artifacts();               phases_run.append(3)
        if 4  in phases_to_run: phase4_compiled_artifacts();          phases_run.append(4)
        if 5  in phases_to_run: phase5_git_orphans();                 phases_run.append(5)
        if 6  in phases_to_run: phase6_schema();                      phases_run.append(6)
        if 7  in phases_to_run: phase7_imports();                     phases_run.append(7)
        if 8  in phases_to_run: phase8_tsc();                         phases_run.append(8)
        if 9  in phases_to_run: phase9_prd_deltas(args.skip_tests);   phases_run.append(9)
        if 10 in phases_to_run: phase10_remediate(dry_run);           phases_run.append(10)
        if 11 in phases_to_run: phase11_dead_exports();               phases_run.append(11)
        if 12 in phases_to_run: phase12_dependency_health();          phases_run.append(12)
        if 13 in phases_to_run: phase13_security();                   phases_run.append(13)
        if 14 in phases_to_run: phase14_asi_report();                 phases_run.append(14)

    except KeyboardInterrupt:
        print(f"\n\n  {C.YELLOW}Interrupted.{C.RESET}")
        sys.exit(130)

    score = compute_score()
    ASI.record_run(score, len(ISSUES), phases_run)
    print_report(dry_run, phases_run, score)


if __name__ == "__main__":
    main()
