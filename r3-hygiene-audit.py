#!/usr/bin/env python3
# @version r3v4.1
# @touched 2026-04-28T21:30:00Z
# @author claude
# @source Charter v1.2 §3/§4/§5, PRD v4.1 §11/§15/§18.6, SKILLS.md (22 patterns),
#         AUDIT.md (13 bugs), testing.md
"""
R3 v4 — Hygiene Audit Script
Runs against ~/Stable monorepo. All checks are read-only (no writes).

Exit code 0 = all checks pass.
Exit code 1 = one or more checks failed.

Usage:
    python3 r3_hygiene_audit.py [--root PATH] [--json] [--fail-fast]
"""

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Tuple

# ─────────────────────────────────────────────────────────────────────────────
# Constants drawn verbatim from governing documents
# ─────────────────────────────────────────────────────────────────────────────

# PRD §4, Charter §3.1
VALID_TIERS       = {"explorer", "creator", "pro_artist"}
BANNED_TIERS      = {"starter", "pro", "studio", "free", "lemonsqueezy",
                     "lemon_squeezy", "lemon squeezy"}
BANNED_PAYMENT    = {"lemonsqueezy", "lemon_squeezy", "ls_product", "ls_variant"}

# PRD §1, Charter §3.1
BANNED_ROUTERS    = {"react-router-dom"}
BANNED_STATE_LIBS = {"redux", "@reduxjs/toolkit", "react-redux", "mobx",
                     "recoil", "jotai"}

# PRD §15, Charter §3.2 — Hard Guards
BANNED_PATTERNS: List[Tuple[str, str]] = [
    # (regex, human description)
    (r'\bas\s+any\b',               "as any cast (hard guard — use typed cast)"),
    (r'@ts-nocheck',                "@ts-nocheck header (hard guard)"),
    (r'\bconsole\.log\b',           "console.log in committed code (hard guard)"),
    (r'window\.location\.href\s*=', "window.location.href= navigation (use Wouter setLocation)"),
    (r'hydrateFromToken\(\)',        "hydrateFromToken() call (must not be inside ProtectedRoute render)"),
    (r'react-router-dom',           "react-router-dom import (banned — Wouter only)"),
    (r'from ["\']redux["\']',       "redux import (banned — Zustand only)"),
    (r'@reduxjs/toolkit',           "Redux Toolkit import (banned — Zustand only)"),
    (r'LemonSqueezy|lemon_squeezy|lemonsqueezy|ls_product|ls_variant',
                                    "LemonSqueezy reference (dead — Stripe only)"),
]

# Charter §3.1 — post-login redirect must always be /instrument
POST_LOGIN_REDIRECT_PATTERN  = re.compile(r'(navigate|redirect|setLocation|push)\s*\(\s*["\']\/daw["\']')
INSTRUMENT_REDIRECT_PATTERN  = re.compile(r'(navigate|redirect|setLocation|push)\s*\(\s*["\']\/instrument["\']')

# Charter §3.1 — AudioParam safety
AUDIOPARAM_DIRECT  = re.compile(r'\.value\s*=(?!=)')   # .value = but not .value ==
AUDIOPARAM_SAFE    = re.compile(r'setTargetAtTime|setValueAtTime|linearRampToValueAtTime')

# AUDIT.md BUG-03 / BUG-04 — filter type cast
FILTER_ANY_CAST    = re.compile(r'setFilterType\s*\([^)]*as\s+any')

# SKILLS.md §3 — markdown-link corruption in source files
MARKDOWN_LINK_CORRUPTION = re.compile(r'\[[^\]]+\]\(https?://')

# Charter §3.1 — confidence gate thresholds must not be relaxed
CONFIDENCE_GATE_PATTERN = re.compile(r'(?:inputConfidence|confidence)\s*[><=]+\s*([\d.]+)')

# PRD §11 — pinned versions (check package.json only, not node_modules)
PINNED_VERSIONS = {
    "typescript":          "5.9.3",
    "drizzle-orm":         "0.39.3",
    "ws":                  "8.20.0",
    "stripe":              "20.4.1",
    "express":             "4.22.1",
    "zod":                 "3.25.76",
    "pnpm":                "10.33.0",
    "esbuild":             "0.25.12",
}

# PRD §18.6 — documented any exemptions (do not re-flag these)
DOCUMENTED_ANY_EXEMPTIONS = [
    "routes/presets.ts",
    "audio-analysis.ts",
]

# LLPTE node order (Charter §6, PRD §8.5)
LLPTE_NODE_ORDER = [
    "inputRouter",
    "spectralAnalyzer",
    "aiMixEngine",
    "transitionGraph",
    "outputBus",
]

# PRD §12 — aiDecisionLog outcome literals
VALID_OUTCOMES = {"auto_applied", "accepted", "rejected", "ignored", "discarded"}

# Phantom directories (PRD §18.4, §18.6)
PHANTOM_DIRS = [
    "client/client",
    "client/hooks",
    "client/components",
    "client/stores",
    "client/src/hook",
    "client/src/context",
    "client/src/contexts",
    "client/src/store",
    "db/schema",
]

# testing.md — test files must live adjacent to source, not in a root test dir
ROOT_TEST_DIR_PATTERN = re.compile(r'^tests?/', re.IGNORECASE)

# Source file extensions to scan
SOURCE_EXTS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"}
EXCLUDED_DIRS = {"node_modules", ".git", "dist", "build", ".vite",
                 "coverage", ".turbo", "__pycache__"}


# ─────────────────────────────────────────────────────────────────────────────
# Data structures
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class Finding:
    check:    str
    severity: str   # CRITICAL | HARD_GUARD | WARNING | INFO
    file:     Optional[str]
    line:     Optional[int]
    message:  str
    source:   str   # governing doc citation

@dataclass
class CheckResult:
    name:     str
    passed:   bool
    findings: List[Finding] = field(default_factory=list)
    skipped:  bool = False
    skip_reason: str = ""


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def iter_source_files(root: Path):
    for path in root.rglob("*"):
        if path.is_file() and path.suffix in SOURCE_EXTS:
            if not any(ex in path.parts for ex in EXCLUDED_DIRS):
                if not path.name.endswith(".bak"):
                    yield path


def rel(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)


def run_cmd(cmd: List[str], cwd: Path, timeout=120) -> Tuple[int, str, str]:
    try:
        r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return -1, "", "TIMEOUT"
    except FileNotFoundError:
        return -1, "", f"Command not found: {cmd[0]}"


def read_json(path: Path) -> Optional[dict]:
    try:
        return json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Check implementations
# ─────────────────────────────────────────────────────────────────────────────

def check_tsc(root: Path) -> CheckResult:
    """PRD §15, Charter §4.3 — TSC must pass with zero errors from repo root."""
    result = CheckResult(name="TSC zero errors")
    rc, stdout, stderr = run_cmd(["pnpm", "-w", "run", "typecheck"], root)
    if rc == 0:
        result.passed = True
    else:
        result.passed = False
        output = (stdout + stderr).strip()
        # Extract first error for display
        errors = [l for l in output.splitlines() if "error TS" in l]
        for e in errors[:10]:
            result.findings.append(Finding(
                check="TSC", severity="CRITICAL",
                file=None, line=None,
                message=e.strip(),
                source="PRD §15 / Charter §4.3",
            ))
        if not errors:
            result.findings.append(Finding(
                check="TSC", severity="CRITICAL",
                file=None, line=None,
                message=f"typecheck failed (rc={rc}): {output[:200]}",
                source="PRD §15 / Charter §4.3",
            ))
    return result


def check_hard_guard_patterns(root: Path) -> CheckResult:
    """PRD §15, Charter §3.2 §5 — banned patterns in source files."""
    result = CheckResult(name="Hard guard patterns")
    compiled = [(re.compile(pat), desc) for pat, desc in BANNED_PATTERNS]

    for fpath in iter_source_files(root):
        rpath = rel(fpath, root)
        # Skip documented any exemptions for the as-any check only
        is_exempt_any = any(ex in rpath for ex in DOCUMENTED_ANY_EXEMPTIONS)

        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue

        for lineno, line in enumerate(lines, 1):
            # Skip comment-only lines for most checks
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue

            for pattern, desc in compiled:
                if pattern.search(line):
                    # Documented any exemptions
                    if "as any" in desc and is_exempt_any:
                        continue
                    # hydrateFromToken — only a hard guard inside ProtectedRoute
                    # (flag everywhere as WARNING since location matters)
                    severity = "HARD_GUARD"
                    if "hydrateFromToken" in desc:
                        severity = "WARNING"
                    result.findings.append(Finding(
                        check="hard_guard_patterns", severity=severity,
                        file=rpath, line=lineno,
                        message=f"{desc}: {line.strip()[:120]}",
                        source="PRD §15 / Charter §3.2 §5",
                    ))

    result.passed = len([f for f in result.findings
                         if f.severity in ("CRITICAL", "HARD_GUARD")]) == 0
    return result


def check_markdown_corruption(root: Path) -> CheckResult:
    """SKILLS.md §3 §19 / AUDIT.md — markdown-link corruption in source files."""
    result = CheckResult(name="Markdown-link corruption in source")

    for fpath in iter_source_files(root):
        rpath = rel(fpath, root)
        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue

        for lineno, line in enumerate(lines, 1):
            if MARKDOWN_LINK_CORRUPTION.search(line):
                result.findings.append(Finding(
                    check="markdown_corruption", severity="CRITICAL",
                    file=rpath, line=lineno,
                    message=f"Markdown hyperlink in source: {line.strip()[:120]}",
                    source="SKILLS.md §3 §19 / AUDIT.md BUG-01–BUG-10",
                ))

    result.passed = len(result.findings) == 0
    return result


def check_post_login_redirect(root: Path) -> CheckResult:
    """Charter §3.1, PRD §9 §15 — post-login redirect must be /instrument, never /daw."""
    result = CheckResult(name="Post-login redirect")

    for fpath in iter_source_files(root):
        rpath = rel(fpath, root)
        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue

        for lineno, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            if POST_LOGIN_REDIRECT_PATTERN.search(line):
                result.findings.append(Finding(
                    check="post_login_redirect", severity="CRITICAL",
                    file=rpath, line=lineno,
                    message=f"Navigation to /daw (must be /instrument): {stripped[:120]}",
                    source="PRD §9 §15 / Charter §3.1",
                ))

    result.passed = len(result.findings) == 0
    return result


def check_audioparam_safety(root: Path) -> CheckResult:
    """Charter §3.1, PRD §16 R5 — AudioParam.value= is banned; use setTargetAtTime."""
    result = CheckResult(name="AudioParam mutation safety")
    audio_files = [f for f in iter_source_files(root)
                   if "audio" in f.name.lower() or "engine" in f.name.lower()
                   or "loop" in f.name.lower() or "daw" in f.name.lower()]

    for fpath in audio_files:
        rpath = rel(fpath, root)
        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue

        for lineno, line in enumerate(lines, 1):
            if AUDIOPARAM_DIRECT.search(line) and ".value =" in line:
                # Exclude object property assignments (not AudioParam)
                if re.search(r'\b(gain|frequency|detune|Q|pan)\s*\.value\s*=', line):
                    if not AUDIOPARAM_SAFE.search(line):
                        result.findings.append(Finding(
                            check="audioparam_safety", severity="HARD_GUARD",
                            file=rpath, line=lineno,
                            message=f"Direct .value= on AudioParam (use setTargetAtTime): {line.strip()[:120]}",
                            source="PRD §16 R5 / Charter §3.1",
                        ))

    result.passed = len(result.findings) == 0
    return result


def check_tier_strings(root: Path) -> CheckResult:
    """PRD §4, Charter §3.1 §5 — only explorer/creator/pro_artist tier literals."""
    result = CheckResult(name="Subscription tier strings")

    banned_pattern = re.compile(
        r'["\'](' + '|'.join(re.escape(t) for t in BANNED_TIERS) + r')["\']',
        re.IGNORECASE
    )

    for fpath in iter_source_files(root):
        rpath = rel(fpath, root)
        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue

        for lineno, line in enumerate(lines, 1):
            if banned_pattern.search(line):
                # Exclude comments and test fixtures that mention wrong names for documentation
                stripped = line.strip()
                if stripped.startswith("//") or stripped.startswith("*"):
                    continue
                result.findings.append(Finding(
                    check="tier_strings", severity="HARD_GUARD",
                    file=rpath, line=lineno,
                    message=f"Banned tier literal: {stripped[:120]}",
                    source="PRD §4 / Charter §3.1 §5",
                ))

    result.passed = len(result.findings) == 0
    return result


def check_swallowed_exceptions(root: Path) -> CheckResult:
    """PRD §15, AUDIT.md BUG-05 — no catch blocks with no error handling."""
    result = CheckResult(name="Swallowed exceptions")
    # Match: catch { } or catch (e) { } with only whitespace/comments inside
    catch_block = re.compile(r'catch\s*(?:\([^)]*\))?\s*\{\s*(?:/\*[^*]*\*/|//[^\n]*)?\s*\}')

    for fpath in iter_source_files(root):
        rpath = rel(fpath, root)
        try:
            content = fpath.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        for m in catch_block.finditer(content):
            lineno = content[:m.start()].count('\n') + 1
            result.findings.append(Finding(
                check="swallowed_exceptions", severity="HARD_GUARD",
                file=rpath, line=lineno,
                message=f"Empty/swallowed catch block: {m.group().strip()[:100]}",
                source="PRD §15 / AUDIT.md BUG-05",
            ))

    result.passed = len(result.findings) == 0
    return result


def check_pinned_versions(root: Path) -> CheckResult:
    """PRD §11, Charter §3.1, SKILLS.md §14 — pinned dep versions."""
    result = CheckResult(name="Pinned dependency versions")

    pkg_files = list(root.rglob("package.json"))
    pkg_files = [p for p in pkg_files
                 if not any(ex in p.parts for ex in EXCLUDED_DIRS)]

    for pkg_path in pkg_files:
        data = read_json(pkg_path)
        if not data:
            continue
        rpath = rel(pkg_path, root)
        all_deps = {}
        for key in ("dependencies", "devDependencies", "peerDependencies"):
            all_deps.update(data.get(key, {}))

        for pkg, expected in PINNED_VERSIONS.items():
            if pkg in all_deps:
                actual = all_deps[pkg].lstrip("^~>=<")
                if actual != expected:
                    result.findings.append(Finding(
                        check="pinned_versions", severity="WARNING",
                        file=rpath, line=None,
                        message=f"{pkg}: expected {expected}, found {all_deps[pkg]}",
                        source="PRD §11 / Charter §3.1 / SKILLS.md §14",
                    ))

    result.passed = len([f for f in result.findings if f.severity == "CRITICAL"]) == 0
    return result


def check_phantom_directories(root: Path) -> CheckResult:
    """PRD §18.4 §18.6 — phantom directories outside client/src/ canonical locations."""
    result = CheckResult(name="Phantom directories")

    for phantom in PHANTOM_DIRS:
        ppath = root / phantom
        if ppath.exists() and ppath.is_dir():
            # Extra weight if it has active imports (client/src/store is flagged as LIVE)
            severity = "CRITICAL" if phantom == "client/src/store" else "WARNING"
            result.findings.append(Finding(
                check="phantom_dirs", severity=severity,
                file=phantom, line=None,
                message=f"Phantom directory exists: {phantom}",
                source="PRD §18.4 §18.6 / SKILLS.md §4",
            ))

    result.passed = len([f for f in result.findings if f.severity == "CRITICAL"]) == 0
    return result


def check_llpte_node_order(root: Path) -> CheckResult:
    """Charter §6, PRD §8.5 — LLPTE node order is immutable."""
    result = CheckResult(name="LLPTE node order")

    # Look for pipeline orchestration files
    pipeline_files = []
    for fpath in iter_source_files(root):
        if "llpte" in str(fpath).lower() or "pipeline" in fpath.name.lower():
            pipeline_files.append(fpath)

    for fpath in pipeline_files:
        rpath = rel(fpath, root)
        try:
            content = fpath.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        # Find positions of all node names
        positions = []
        for node in LLPTE_NODE_ORDER:
            m = re.search(re.escape(node), content)
            if m:
                positions.append((m.start(), node))

        if len(positions) >= 2:
            positions.sort(key=lambda x: x[0])
            found_order = [p[1] for p in positions]
            # Check if found nodes are in correct relative order
            expected_indices = {n: i for i, n in enumerate(LLPTE_NODE_ORDER)}
            expected_subseq = [expected_indices[n] for n in found_order
                               if n in expected_indices]
            if expected_subseq != sorted(expected_subseq):
                result.findings.append(Finding(
                    check="llpte_node_order", severity="CRITICAL",
                    file=rpath, line=None,
                    message=f"LLPTE nodes out of order: {found_order} (expected {LLPTE_NODE_ORDER})",
                    source="Charter §6 / PRD §8.5",
                ))

    result.passed = len(result.findings) == 0
    return result


def check_confidence_gate(root: Path) -> CheckResult:
    """Charter §3.1, PRD §8.1 — confidence gate thresholds 0.65/0.40/<0.40 must not drift."""
    result = CheckResult(name="Confidence gate thresholds")
    EXPECTED = {0.65, 0.40}

    for fpath in iter_source_files(root):
        if not any(x in str(fpath).lower() for x in ["llpte", "ai", "engine", "mix"]):
            continue
        rpath = rel(fpath, root)
        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue

        for lineno, line in enumerate(lines, 1):
            for m in CONFIDENCE_GATE_PATTERN.finditer(line):
                val = float(m.group(1))
                if 0.0 < val < 1.0 and val not in EXPECTED:
                    result.findings.append(Finding(
                        check="confidence_gate", severity="WARNING",
                        file=rpath, line=lineno,
                        message=f"Unexpected confidence threshold {val} (expected 0.65 or 0.40): {line.strip()[:100]}",
                        source="PRD §8.1 / Charter §3.1",
                    ))

    result.passed = True  # Warnings only — don't fail the gate check on warnings
    return result


def check_auth_import_path(root: Path) -> CheckResult:
    """Charter §3.1 — hooks/authStore is the only valid auth import path."""
    result = CheckResult(name="Auth import path")

    # Any import that looks like it's pulling auth state from somewhere other than hooks/authStore
    bad_auth_import = re.compile(
        r'from\s+["\'](?!.*hooks/authStore)(?!.*hooks/useDAWStore).*(?:auth|Auth)(?:Store|State|Context)["\']'
    )

    for fpath in iter_source_files(root):
        rpath = rel(fpath, root)
        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue

        for lineno, line in enumerate(lines, 1):
            if bad_auth_import.search(line):
                result.findings.append(Finding(
                    check="auth_import_path", severity="WARNING",
                    file=rpath, line=lineno,
                    message=f"Non-canonical auth import (use hooks/authStore): {line.strip()[:120]}",
                    source="Charter §3.1",
                ))

    result.passed = True  # Warnings — canonical path enforcement is informational here
    return result


def check_test_file_locations(root: Path) -> CheckResult:
    """testing.md — tests must live in __tests__/ adjacent to source, not root-level tests/."""
    result = CheckResult(name="Test file locations")
    client_src = root / "client" / "src"

    for fpath in root.rglob("*.test.ts"):
        if any(ex in fpath.parts for ex in EXCLUDED_DIRS):
            continue
        rpath = rel(fpath, root)
        # Root-level tests/ directory is banned
        if ROOT_TEST_DIR_PATTERN.match(rpath):
            result.findings.append(Finding(
                check="test_file_locations", severity="WARNING",
                file=rpath, line=None,
                message=f"Test in root-level tests/ (must be in __tests__/ adjacent to source)",
                source="testing.md — File Location rule",
            ))

    for fpath in root.rglob("*.spec.ts"):
        if any(ex in fpath.parts for ex in EXCLUDED_DIRS):
            continue
        rpath = rel(fpath, root)
        if ROOT_TEST_DIR_PATTERN.match(rpath):
            result.findings.append(Finding(
                check="test_file_locations", severity="WARNING",
                file=rpath, line=None,
                message=f"Test in root-level tests/ (must be in __tests__/ adjacent to source)",
                source="testing.md — File Location rule",
            ))

    result.passed = len(result.findings) == 0
    return result


def check_non_timestamped_backups(root: Path) -> CheckResult:
    """Charter §4.1, SKILLS.md §12/AUDIT.md BUG-12 — .bak files must have timestamps."""
    result = CheckResult(name="Backup file timestamps")

    plain_bak = re.compile(r'\.bak$')
    ts_bak    = re.compile(r'\.bak\.\d{8}-\d{6}$')

    for fpath in root.rglob("*.bak*"):
        if any(ex in fpath.parts for ex in EXCLUDED_DIRS):
            continue
        name = fpath.name
        if plain_bak.search(name) and not ts_bak.search(name):
            result.findings.append(Finding(
                check="backup_timestamps", severity="WARNING",
                file=rel(fpath, root), line=None,
                message=f"Non-timestamped backup: {name} (use file.ext.bak.YYYYMMDD-HHMMSS)",
                source="Charter §4.1 §4.4 / AUDIT.md BUG-12",
            ))

    result.passed = len(result.findings) == 0
    return result


def check_console_log_server(root: Path) -> CheckResult:
    """PRD §18.6 — 5 known console.log violations in server/index.ts:300-308 pending fix."""
    result = CheckResult(name="console.log violations (server)")
    server_dir = root / "server"
    if not server_dir.exists():
        result.skipped = True
        result.skip_reason = "server/ directory not found"
        result.passed = True
        return result

    for fpath in server_dir.rglob("*.ts"):
        if any(ex in fpath.parts for ex in EXCLUDED_DIRS):
            continue
        rpath = rel(fpath, root)
        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue

        for lineno, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//"):
                continue
            if re.search(r'\bconsole\.log\b', line):
                severity = "HARD_GUARD"
                result.findings.append(Finding(
                    check="console_log_server", severity=severity,
                    file=rpath, line=lineno,
                    message=f"console.log in server code: {stripped[:100]}",
                    source="PRD §15 §18.6 / Charter §3.2",
                ))

    result.passed = len(result.findings) == 0
    return result


def check_migration_pending(root: Path) -> CheckResult:
    """PRD §18.6 — migration 0005 Railway apply pending; flag any unapplied migrations."""
    result = CheckResult(name="Pending migrations flag")

    migrations_dir = root / "server" / "db" / "migrations"
    if not migrations_dir.exists():
        migrations_dir = root / "drizzle"
    if not migrations_dir.exists():
        result.skipped = True
        result.skip_reason = "migrations directory not found"
        result.passed = True
        return result

    migration_files = sorted(migrations_dir.glob("*.sql"))
    if migration_files:
        result.findings.append(Finding(
            check="migration_pending", severity="INFO",
            file=str(migrations_dir.relative_to(root)), line=None,
            message=f"{len(migration_files)} migration file(s) found — verify Railway production has applied all. "
                    f"Latest: {migration_files[-1].name}. Use SKILLS.md §5 column-count query to verify.",
            source="PRD §18.6 / SKILLS.md §5",
        ))

    result.passed = True  # Info only — can't know Railway state from local scan
    return result


def check_filter_type_cast(root: Path) -> CheckResult:
    """AUDIT.md BUG-04 — setFilterType(e.target.value as any) is a hard guard violation."""
    result = CheckResult(name="Filter type cast (AUDIT BUG-04)")

    for fpath in iter_source_files(root):
        rpath = rel(fpath, root)
        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue

        for lineno, line in enumerate(lines, 1):
            if FILTER_ANY_CAST.search(line):
                result.findings.append(Finding(
                    check="filter_type_cast", severity="HARD_GUARD",
                    file=rpath, line=lineno,
                    message=f"setFilterType with `as any` — use typed cast 'lowpass'|'highpass'|'bandpass': {line.strip()[:120]}",
                    source="AUDIT.md BUG-04 / PRD §15",
                ))

    result.passed = len(result.findings) == 0
    return result


def check_missing_exports(root: Path) -> CheckResult:
    """Structural check — .tsx/.ts files with no export at all (AUDIT.md pattern)."""
    result = CheckResult(name="Missing exports")

    for fpath in iter_source_files(root):
        if fpath.suffix not in (".ts", ".tsx"):
            continue
        rpath = rel(fpath, root)
        # Skip type-only files, index files with re-exports, and test files
        if fpath.name.startswith("index") or "test" in fpath.name or "spec" in fpath.name:
            continue
        if any(ex in rpath for ex in DOCUMENTED_ANY_EXEMPTIONS):
            continue

        try:
            content = fpath.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        # Skip files that are clearly declaration/config/script files
        if len(content.strip()) < 50:
            continue

        if not re.search(r'\bexport\b', content):
            result.findings.append(Finding(
                check="missing_exports", severity="WARNING",
                file=rpath, line=None,
                message=f"Source file has no export — module consumers will get TS2306",
                source="AUDIT.md (multi-track-panel.tsx pattern)",
            ))

    result.passed = True  # Warnings only
    return result


def check_node_version(root: Path) -> CheckResult:
    """Charter §3.1, SKILLS.md §4 §8 — Node 22.x required; 18.x will fail esbuild."""
    result = CheckResult(name="Node version")

    # Check .nvmrc or .node-version if present
    for fname in (".nvmrc", ".node-version"):
        fpath = root / fname
        if fpath.exists():
            val = fpath.read_text().strip()
            if not val.startswith("22"):
                result.findings.append(Finding(
                    check="node_version", severity="WARNING",
                    file=fname, line=None,
                    message=f"{fname} specifies Node {val} — must be 22.x",
                    source="Charter §3.1 / SKILLS.md §4 §8",
                ))

    # Check engines field in root package.json
    root_pkg = read_json(root / "package.json")
    if root_pkg:
        engines = root_pkg.get("engines", {})
        node_req = engines.get("node", "")
        if node_req and not re.search(r'22', node_req):
            result.findings.append(Finding(
                check="node_version", severity="WARNING",
                file="package.json", line=None,
                message=f"engines.node is {node_req!r} — should specify 22.x",
                source="PRD §11 / Charter §3.1",
            ))

    result.passed = len(result.findings) == 0
    return result


def check_any_violations(root: Path) -> CheckResult:
    """PRD §15, Charter §3.1 — zero new `any` violations; 5 documented exemptions only."""
    result = CheckResult(name="TypeScript any violations")

    any_pattern = re.compile(r':\s*any\b|<any>|as\s+any\b|Array<any>|Promise<any>')

    for fpath in iter_source_files(root):
        if fpath.suffix not in (".ts", ".tsx"):
            continue
        rpath = rel(fpath, root)
        is_exempt = any(ex in rpath for ex in DOCUMENTED_ANY_EXEMPTIONS)

        try:
            lines = fpath.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue

        for lineno, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith("//") or stripped.startswith("*"):
                continue
            if any_pattern.search(line):
                severity = "INFO" if is_exempt else "HARD_GUARD"
                note = " (documented exemption)" if is_exempt else ""
                result.findings.append(Finding(
                    check="any_violations", severity=severity,
                    file=rpath, line=lineno,
                    message=f"any type usage{note}: {stripped[:120]}",
                    source="PRD §15 / Charter §3.1 §3.2",
                ))

    non_exempt = [f for f in result.findings if f.severity != "INFO"]
    result.passed = len(non_exempt) == 0
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Runner
# ─────────────────────────────────────────────────────────────────────────────

ALL_CHECKS = [
    check_tsc,
    check_hard_guard_patterns,
    check_any_violations,
    check_markdown_corruption,
    check_post_login_redirect,
    check_swallowed_exceptions,
    check_filter_type_cast,
    check_tier_strings,
    check_audioparam_safety,
    check_confidence_gate,
    check_llpte_node_order,
    check_pinned_versions,
    check_phantom_directories,
    check_non_timestamped_backups,
    check_test_file_locations,
    check_auth_import_path,
    check_missing_exports,
    check_console_log_server,
    check_migration_pending,
    check_node_version,
]

SEVERITY_ORDER = {"CRITICAL": 0, "HARD_GUARD": 1, "WARNING": 2, "INFO": 3}
SEVERITY_COLOR = {
    "CRITICAL":  "\033[91m",   # bright red
    "HARD_GUARD":"\033[93m",   # yellow
    "WARNING":   "\033[94m",   # blue
    "INFO":      "\033[90m",   # dark grey
}
RESET = "\033[0m"
BOLD  = "\033[1m"
GREEN = "\033[92m"
RED   = "\033[91m"


def severity_label(s: str, color: bool) -> str:
    if not color:
        return f"[{s}]"
    c = SEVERITY_COLOR.get(s, "")
    return f"{c}[{s}]{RESET}"


def run_audit(root: Path, json_output: bool, fail_fast: bool, color: bool) -> int:
    results: List[CheckResult] = []
    overall_pass = True

    if not json_output:
        print(f"\n{BOLD}R3 v4 — Hygiene Audit{RESET}")
        print(f"Root: {root}")
        print(f"Checks: {len(ALL_CHECKS)}")
        print("─" * 70)

    for check_fn in ALL_CHECKS:
        r = check_fn(root)
        results.append(r)

        if r.skipped:
            if not json_output:
                print(f"  SKIP  {r.name} — {r.skip_reason}")
            continue

        if not r.passed:
            overall_pass = False

        if not json_output:
            icon = f"{GREEN}✓{RESET}" if r.passed else f"{RED}✗{RESET}"
            print(f"\n  {icon}  {BOLD}{r.name}{RESET}")

            findings = sorted(r.findings, key=lambda f: SEVERITY_ORDER.get(f.severity, 99))
            for f in findings:
                loc = f"{f.file}:{f.line}" if f.line else (f.file or "")
                label = severity_label(f.severity, color)
                print(f"       {label} {loc}")
                print(f"            {f.message}")
                print(f"            {SEVERITY_COLOR.get('INFO','')}{f.source}{RESET}")

        if fail_fast and not r.passed:
            break

    if json_output:
        out = {
            "root": str(root),
            "passed": overall_pass,
            "checks": [
                {
                    "name": r.name,
                    "passed": r.passed,
                    "skipped": r.skipped,
                    "findings": [
                        {
                            "severity": f.severity,
                            "file": f.file,
                            "line": f.line,
                            "message": f.message,
                            "source": f.source,
                        }
                        for f in r.findings
                    ],
                }
                for r in results
            ],
        }
        print(json.dumps(out, indent=2))
        return 0 if overall_pass else 1

    # Summary
    passed = sum(1 for r in results if r.passed and not r.skipped)
    failed = sum(1 for r in results if not r.passed and not r.skipped)
    skipped = sum(1 for r in results if r.skipped)
    total_findings = sum(len(r.findings) for r in results)
    critical = sum(1 for r in results for f in r.findings if f.severity == "CRITICAL")
    hard_guard = sum(1 for r in results for f in r.findings if f.severity == "HARD_GUARD")
    warnings = sum(1 for r in results for f in r.findings if f.severity == "WARNING")

    print("\n" + "─" * 70)
    print(f"{BOLD}Summary{RESET}")
    print(f"  Checks:    {passed} passed / {failed} failed / {skipped} skipped")
    print(f"  Findings:  {total_findings} total  "
          f"({RED}{critical} CRITICAL{RESET}  "
          f"{SEVERITY_COLOR['HARD_GUARD']}{hard_guard} HARD_GUARD{RESET}  "
          f"{SEVERITY_COLOR['WARNING']}{warnings} WARNING{RESET})")
    print()

    if overall_pass:
        print(f"  {GREEN}{BOLD}PASS — hygiene gate cleared.{RESET}")
    else:
        print(f"  {RED}{BOLD}FAIL — fix CRITICAL and HARD_GUARD findings before commit.{RESET}")
    print()

    return 0 if overall_pass else 1


def main():
    parser = argparse.ArgumentParser(
        description="R3 v4 hygiene audit — Charter v1.2 / PRD v4.1 / SKILLS.md"
    )
    parser.add_argument(
        "--root", default=os.path.expanduser("~/Stable"),
        help="Monorepo root (default: ~/Stable)"
    )
    parser.add_argument(
        "--json", action="store_true",
        help="Output results as JSON"
    )
    parser.add_argument(
        "--fail-fast", action="store_true",
        help="Stop after first failing check"
    )
    parser.add_argument(
        "--no-color", action="store_true",
        help="Disable ANSI color output"
    )
    args = parser.parse_args()

    root = Path(args.root).expanduser().resolve()
    if not root.exists():
        print(f"ERROR: Root not found: {root}", file=sys.stderr)
        sys.exit(2)

    color = not args.no_color and sys.stdout.isatty()
    sys.exit(run_audit(root, args.json, args.fail_fast, color))


if __name__ == "__main__":
    main()
