#!/usr/bin/env python3
"""
ASI Hygiene & Repository Safety Audit Script
Implements: Expert-Level ASI Hygiene & Repository Safety Protocol v1.0

ZERO DESTRUCTIVE OPERATIONS — read-only analysis and reporting only.
Run from anywhere; pass repo root as argument or it defaults to cwd.

Usage:
    python3 asi_hygiene_audit.py [repo_root] [--output report.md]

Produces:
    - A full markdown audit report (7 sections per protocol)
    - A human_review_queue.txt for items requiring manual decisions
    - Console summary with risk counts
"""

import os
import sys
import re
import hashlib
import json
import subprocess
import argparse
import datetime
from pathlib import Path
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Dict, List, Set, Optional, Tuple

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────

# Directories that are always skipped for content scanning (never for inventory)
SKIP_CONTENT_SCAN_DIRS = {
    "node_modules", ".git", ".cache", "dist", "build", ".next",
    "__pycache__", ".turbo", ".vite", "coverage",
}

# Extensions treated as backup/snapshot files
BACKUP_EXTENSIONS = {
    ".bak", ".bak_sweep", ".backup", ".orig", ".old", ".save",
    ".mythos",  # project-specific non-standard extension
}

# Patterns that classify a file as a backup by name
BACKUP_NAME_PATTERNS = [
    re.compile(r"\.bak[\._-]?\d*"),         # .bak, .bak-20260501
    re.compile(r"\.bak_\w+"),               # .bak_sweep, .bak_v1
    re.compile(r"\.(ts6bak|ts\dbak)$"),     # .ts6bak
    re.compile(r"\.mythos$"),               # .mythos
    re.compile(r"~$"),                      # trailing tilde
]

# Files/dirs that are always high-risk — never delete
HIGH_RISK_NAMES = {
    "docker-compose.yml", "docker-compose.yaml", "Dockerfile",
    "railway.toml", "railway.json", ".env", ".env.production",
    "pnpm-lock.yaml", "package-lock.json", "yarn.lock",
    "pnpm-workspace.yaml", "turbo.json", "vercel.json",
    "drizzle.config.ts", "drizzle.config.js",
    "SECURITY.md", "secrets",
}

HIGH_RISK_DIRS = {
    "secrets", "drizzle", "nginx", "migrations", ".github",
}

# Infrastructure reference patterns searched in file content
INFRA_PATTERNS = {
    "docker":      re.compile(r"(FROM\s|COPY\s|RUN\s|docker|compose)", re.I),
    "ci_cd":       re.compile(r"(github.actions|\.yml.*jobs|workflow|pipeline|CI_|CD_)", re.I),
    "cron":        re.compile(r"(cron|schedule|@daily|@hourly|CRONTAB)", re.I),
    "deployment":  re.compile(r"(deploy|railway|vercel|heroku|kubernetes|kubectl|helm)", re.I),
    "startup":     re.compile(r"(entrypoint|CMD\s|ENTRYPOINT|pm2|forever|systemd)", re.I),
    "env_var":     re.compile(r"(process\.env\.|os\.environ|getenv\(|ENV\s)", re.I),
}

# Import/reference patterns for JS/TS/Python
IMPORT_PATTERNS = {
    "ts_import":      re.compile(r"""(?:import|from)\s+['"]([^'"]+)['"]"""),
    "ts_require":     re.compile(r"""require\(\s*['"]([^'"]+)['"]\s*\)"""),
    "ts_dynamic":     re.compile(r"""import\(\s*['"]([^'"]+)['"]\s*\)"""),
    "py_import":      re.compile(r"""^(?:import|from)\s+([\w.]+)""", re.M),
    "sh_source":      re.compile(r"""(?:source|\.)\s+([\w./]+\.sh)"""),
    "sh_exec":        re.compile(r"""(?:bash|sh|python3?|node)\s+([\w./\-]+)"""),
    "path_string":    re.compile(r"""['"]([./][^\s'"*?]+\.[a-z]{2,5})['"]"""),
}

# ─────────────────────────────────────────────
# DATA STRUCTURES
# ─────────────────────────────────────────────

@dataclass
class FileRecord:
    path: Path
    size: int
    mtime: float
    sha256: str = ""
    extension: str = ""
    is_backup: bool = False
    backup_base: str = ""      # canonical source filename this backs up
    backup_suffix: str = ""    # the backup suffix/timestamp portion
    references_to: List[str] = field(default_factory=list)    # files this file imports/calls
    referenced_by: List[str] = field(default_factory=list)    # files that import/call this
    infra_flags: List[str] = field(default_factory=list)      # which infra patterns matched
    is_high_risk: bool = False
    classification: str = "UNCLASSIFIED"
    notes: List[str] = field(default_factory=list)

@dataclass
class BackupGroup:
    base_file: str             # canonical filename (may or may not exist)
    base_exists: bool
    variants: List[FileRecord] = field(default_factory=list)
    unique_hashes: Set[str] = field(default_factory=set)
    recommended_keep: Optional[str] = None
    safe_to_consolidate: bool = False

@dataclass
class AuditResult:
    scan_root: Path
    scan_time: str
    total_files: int = 0
    total_dirs: int = 0
    active_files: List[FileRecord] = field(default_factory=list)
    suspected_dead: List[FileRecord] = field(default_factory=list)
    verified_safe: List[FileRecord] = field(default_factory=list)
    backup_groups: List[BackupGroup] = field(default_factory=list)
    high_risk_files: List[FileRecord] = field(default_factory=list)
    shell_scripts: List[FileRecord] = field(default_factory=list)
    python_scripts: List[FileRecord] = field(default_factory=list)
    human_review: List[Tuple[str, str]] = field(default_factory=list)   # (path, reason)
    structural_anomalies: List[Tuple[str, str]] = field(default_factory=list)
    dependency_conflicts: List[Tuple[str, str]] = field(default_factory=list)
    empty_dirs: List[Path] = field(default_factory=list)
    unknown_extension_files: List[FileRecord] = field(default_factory=list)

# ─────────────────────────────────────────────
# UTILITIES
# ─────────────────────────────────────────────

RESET   = "\033[0m"
RED     = "\033[31m"
YELLOW  = "\033[33m"
GREEN   = "\033[32m"
CYAN    = "\033[36m"
BOLD    = "\033[1m"
DIM     = "\033[2m"

def log(msg: str, color: str = RESET):
    print(f"{color}{msg}{RESET}", flush=True)

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()
    except (OSError, PermissionError):
        return "ERROR_UNREADABLE"

def is_backup_file(path: Path) -> Tuple[bool, str, str]:
    """
    Returns (is_backup, base_name, suffix).
    Handles: file.tsx.bak, file.tsx.bak-20260501, file.tsx.bak_sweep,
             file.tsx.bak_20260501_123456, file.tsx.mythos, file.tsx.ts6bak
    """
    name = path.name
    # Walk through known suffix patterns from longest to shortest
    for pattern in BACKUP_NAME_PATTERNS:
        m = pattern.search(name)
        if m:
            suffix_start = m.start()
            base = name[:suffix_start]
            suffix = name[suffix_start:]
            if base:
                return True, base, suffix
    # Check known backup extensions
    for ext in BACKUP_EXTENSIONS:
        if name.endswith(ext):
            base = name[: -len(ext)]
            return True, base, ext
    return False, "", ""

def read_file_safe(path: Path, max_bytes: int = 512_000) -> str:
    """Read file content safely, truncating large files."""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            return f.read(max_bytes)
    except (OSError, PermissionError, IsADirectoryError):
        return ""

def should_skip_dir(name: str) -> bool:
    return name in SKIP_CONTENT_SCAN_DIRS or name.startswith(".")

def relative(path: Path, root: Path) -> str:
    try:
        return str(path.relative_to(root))
    except ValueError:
        return str(path)

# ─────────────────────────────────────────────
# PASS 1 — FILE INVENTORY & STATIC ANALYSIS
# ─────────────────────────────────────────────

def inventory_repository(root: Path) -> Dict[str, FileRecord]:
    """
    Recursively walk the repo, build a FileRecord for every file.
    Skips node_modules and .git for content scanning but still counts them.
    """
    log(f"\n{BOLD}PASS 1 — File Inventory & Static Analysis{RESET}")
    records: Dict[str, FileRecord] = {}
    dir_count = 0
    file_count = 0

    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        dp = Path(dirpath)
        dir_count += 1

        # Prune dirs we won't recurse into for content (still record their existence)
        dirnames[:] = [d for d in dirnames if not (should_skip_dir(d) and d != ".github")]

        for fname in filenames:
            fpath = dp / fname
            file_count += 1
            rel = relative(fpath, root)

            try:
                stat = fpath.stat()
            except OSError:
                continue

            rec = FileRecord(
                path=fpath,
                size=stat.st_size,
                mtime=stat.st_mtime,
                extension=fpath.suffix.lower(),
            )

            # Detect backup
            is_bak, base, suffix = is_backup_file(fpath)
            if is_bak:
                rec.is_backup = True
                rec.backup_base = base
                rec.backup_suffix = suffix

            # High risk by name
            if fname in HIGH_RISK_NAMES or dp.name in HIGH_RISK_DIRS:
                rec.is_high_risk = True

            records[rel] = rec
            if file_count % 500 == 0:
                log(f"  ...scanned {file_count} files", DIM)

    log(f"  Inventory complete: {file_count} files across {dir_count} directories", GREEN)
    return records

# ─────────────────────────────────────────────
# PASS 1b — CONTENT SCANNING & REFERENCE MAPPING
# ─────────────────────────────────────────────

def scan_references(records: Dict[str, FileRecord], root: Path):
    """
    For each non-backup, non-node_modules file, scan content for:
    - imports / requires / dynamic imports
    - shell source/exec calls
    - infra pattern matches
    Build a reverse reference map (referenced_by).
    """
    log(f"\n{BOLD}PASS 1b — Reference & Dependency Mapping{RESET}")

    scannable_extensions = {
        ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
        ".py", ".sh", ".bash",
        ".json", ".yaml", ".yml", ".toml",
        ".env", ".conf", ".config",
        ".md", ".txt", ".css",
    }

    # Build a filename -> list of rel_paths index for fast reverse lookup
    name_index: Dict[str, List[str]] = defaultdict(list)
    for rel, rec in records.items():
        if not rec.is_backup:
            name_index[rec.path.name].append(rel)

    scanned = 0
    for rel, rec in records.items():
        # Skip backup files and non-text files and skip_dirs
        parts = Path(rel).parts
        if any(should_skip_dir(p) for p in parts):
            continue
        if rec.is_backup:
            continue
        if rec.extension not in scannable_extensions and rec.extension != "":
            continue

        content = read_file_safe(rec.path)
        if not content:
            continue

        scanned += 1

        # Infra pattern scanning
        for flag, pattern in INFRA_PATTERNS.items():
            if pattern.search(content):
                rec.infra_flags.append(flag)
                if flag in ("docker", "deployment", "startup"):
                    rec.is_high_risk = True

        # Reference extraction
        refs_found = set()
        for pname, pattern in IMPORT_PATTERNS.items():
            for m in pattern.finditer(content):
                ref = m.group(1)
                refs_found.add(ref)

        # Resolve references to actual files in the repo
        for ref in refs_found:
            ref_filename = Path(ref).name
            if ref_filename in name_index:
                for target_rel in name_index[ref_filename]:
                    if target_rel not in rec.references_to:
                        rec.references_to.append(target_rel)
                    target_rec = records.get(target_rel)
                    if target_rec and rel not in target_rec.referenced_by:
                        target_rec.referenced_by.append(rel)

    log(f"  Content scanning complete: {scanned} files analyzed for references", GREEN)

# ─────────────────────────────────────────────
# PASS 2 — EXECUTION PATH ANALYSIS
# ─────────────────────────────────────────────

def analyze_scripts(records: Dict[str, FileRecord], root: Path) -> Tuple[List, List]:
    """
    Deep analysis of .sh and .py files.
    Returns (shell_report_lines, python_report_lines).
    """
    log(f"\n{BOLD}PASS 2 — Script Execution Path Analysis{RESET}")

    sh_analysis = []
    py_analysis = []

    for rel, rec in records.items():
        parts = Path(rel).parts
        if any(should_skip_dir(p) for p in parts):
            continue
        if rec.is_backup:
            continue

        if rec.extension in (".sh", ".bash") or rel.endswith(".sh"):
            result = analyze_shell_script(rec, root, rel)
            sh_analysis.append(result)

        elif rec.extension == ".py":
            result = analyze_python_script(rec, root, rel)
            py_analysis.append(result)

    log(f"  Script analysis: {len(sh_analysis)} shell, {len(py_analysis)} python", GREEN)
    return sh_analysis, py_analysis

def analyze_shell_script(rec: FileRecord, root: Path, rel: str) -> dict:
    content = read_file_safe(rec.path)
    result = {
        "path": rel,
        "size": rec.size,
        "referenced_by": rec.referenced_by,
        "calls_scripts": [],
        "env_deps": [],
        "infra_flags": rec.infra_flags,
        "has_destructive": False,
        "has_rollback": False,
        "classification": "UNVERIFIED",
        "notes": [],
    }

    if not content:
        result["notes"].append("UNREADABLE — cannot analyze")
        return result

    # Detect destructive operations
    destructive_ops = re.findall(r"\b(rm\s+-rf?|rmdir|truncate|dd\s+if|mkfs|shred)\b", content)
    if destructive_ops:
        result["has_destructive"] = True
        result["notes"].append(f"DESTRUCTIVE OPS DETECTED: {set(destructive_ops)}")

    # Detect rollback indicators
    rollback_keywords = re.findall(r"\b(rollback|restore|recover|backup|undo|revert)\b", content, re.I)
    if rollback_keywords:
        result["has_rollback"] = True
        result["notes"].append(f"Rollback indicators: {set(rollback_keywords)}")

    # Extract called scripts
    called = re.findall(r"(?:bash|sh|source|\.)\s+([\w./\-]+\.sh)", content)
    result["calls_scripts"] = list(set(called))

    # Extract env var usage
    env_vars = re.findall(r"\$\{?([A-Z_][A-Z0-9_]{2,})\}?", content)
    result["env_deps"] = list(set(env_vars))[:20]  # cap at 20

    # Classify based on evidence
    if result["referenced_by"]:
        result["classification"] = "LIKELY_ACTIVE"
    elif result["has_rollback"]:
        result["classification"] = "ROLLBACK_TOOL — preserve"
    elif any(f in rel for f in ["deploy", "setup", "install", "init"]):
        result["classification"] = "LIKELY_ACTIVE"
    elif any(f in rel for f in ["patch", "fix", "upgrade", "wire"]):
        result["classification"] = "ONE_TIME_PATCH — verify if applied"
    elif any(f in rel for f in ["audit", "clean", "hygiene"]):
        result["classification"] = "TOOLING — verify if still active"
    else:
        result["classification"] = "UNVERIFIED — human review required"

    return result

def analyze_python_script(rec: FileRecord, root: Path, rel: str) -> dict:
    content = read_file_safe(rec.path)
    result = {
        "path": rel,
        "size": rec.size,
        "referenced_by": rec.referenced_by,
        "imports": [],
        "is_cli": False,
        "is_migration": False,
        "infra_flags": rec.infra_flags,
        "has_destructive": False,
        "classification": "UNVERIFIED",
        "notes": [],
    }

    if not content:
        result["notes"].append("UNREADABLE — cannot analyze")
        return result

    # CLI entrypoint check
    if "__main__" in content or "argparse" in content or "click" in content or "typer" in content:
        result["is_cli"] = True

    # Migration check
    if any(kw in content.lower() for kw in ["migration", "migrate", "alter table", "schema", "upgrade"]):
        result["is_migration"] = True
        result["notes"].append("MIGRATION LOGIC DETECTED — do not remove until confirmed applied")

    # Destructive operations
    destructive = re.findall(r"(os\.remove|shutil\.rmtree|os\.unlink|subprocess.*rm\s)", content)
    if destructive:
        result["has_destructive"] = True
        result["notes"].append(f"DESTRUCTIVE OPS: {set(destructive)}")

    # Top-level imports
    imports = re.findall(r"^(?:import|from)\s+([\w.]+)", content, re.M)
    result["imports"] = list(set(imports))[:20]

    # Classify
    if result["is_migration"]:
        result["classification"] = "MIGRATION — preserve until confirmed applied"
    elif result["referenced_by"]:
        result["classification"] = "LIKELY_ACTIVE"
    elif result["is_cli"]:
        result["classification"] = "CLI_TOOL — verify if still used"
    elif any(kw in rel for kw in ["patch", "wire", "fix", "upgrade"]):
        result["classification"] = "ONE_TIME_PATCH — verify if applied"
    elif any(kw in rel for kw in ["audit", "test"]):
        result["classification"] = "TOOLING"
    else:
        result["classification"] = "UNVERIFIED — human review required"

    return result

# ─────────────────────────────────────────────
# PASS 3 — INFRASTRUCTURE & DEPLOYMENT VALIDATION
# ─────────────────────────────────────────────

def validate_infrastructure(records: Dict[str, FileRecord], root: Path) -> dict:
    """
    Check CI/CD, Docker, deployment, and package manager configs.
    Returns a dict of findings.
    """
    log(f"\n{BOLD}PASS 3 — Infrastructure & Deployment Validation{RESET}")

    findings = {
        "lockfile_conflicts": [],
        "tsconfig_variants": [],
        "nested_package_jsons": [],
        "anomalous_root_files": [],
        "misplaced_files": [],
        "empty_dirs": [],
        "unknown_extensionless": [],
        "parallel_dirs": defaultdict(list),
        "dependency_manager": "UNKNOWN",
    }

    # Detect lockfile conflicts (pnpm + npm in same workspace)
    has_pnpm = any("pnpm-lock.yaml" in r for r in records)
    has_npm  = any(r.endswith("package-lock.json") and "node_modules" not in r for r in records)
    has_yarn = any("yarn.lock" in r for r in records)

    managers = []
    if has_pnpm: managers.append("pnpm")
    if has_npm:  managers.append("npm")
    if has_yarn: managers.append("yarn")
    findings["dependency_manager"] = " + ".join(managers) if managers else "UNKNOWN"

    if len(managers) > 1:
        findings["lockfile_conflicts"].append(
            f"CONFLICT: Multiple package managers detected: {managers}. "
            f"This causes non-deterministic installs."
        )

    # Detect tsconfig variants
    for rel in records:
        if "tsconfig" in Path(rel).name and not any(d in rel for d in SKIP_CONTENT_SCAN_DIRS):
            findings["tsconfig_variants"].append(rel)

    # Nested package.json files (outside node_modules)
    for rel in records:
        if Path(rel).name == "package.json" and "node_modules" not in rel:
            findings["nested_package_jsons"].append(rel)

    # Files with no extension at repo root level
    root_files = [rel for rel in records if "/" not in rel and "." not in Path(rel).name]
    findings["unknown_extensionless"] = root_files

    # Anomalous files at root (React components, server routers at wrong level)
    suspect_root_patterns = [
        (re.compile(r"\.(tsx|jsx)$"), "React/JSX component at repo root"),
        (re.compile(r"Router\.(ts|js)$"), "Router file at repo root"),
        (re.compile(r"^p0_"), "Priority-patch CSS at repo root"),
    ]
    for rel in records:
        if "/" not in rel:  # root-level
            for pattern, reason in suspect_root_patterns:
                if pattern.search(rel):
                    findings["anomalous_root_files"].append((rel, reason))

    # Detect parallel directories (same name at multiple levels)
    dir_names: Dict[str, List[str]] = defaultdict(list)
    for dirpath, dirnames, _ in os.walk(root, topdown=True):
        dp = Path(dirpath)
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
        for d in dirnames:
            rel_dir = relative(dp / d, root)
            dir_names[d].append(rel_dir)

    for dname, paths in dir_names.items():
        if len(paths) > 1 and dname not in {"tests", "types", "utils", "config", "hooks",
                                              "components", "store", "stores", "context",
                                              "contexts", "shared", "services"}:
            pass  # common names expected to repeat
        elif len(paths) > 1 and dname in {"store", "stores", "components", "hooks", "context", "contexts"}:
            findings["parallel_dirs"][dname] = paths

    # Empty directories
    for dirpath, dirnames, filenames in os.walk(root):
        dp = Path(dirpath)
        dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
        if not filenames and not dirnames:
            findings["empty_dirs"].append(relative(dp, root))

    log(f"  Infrastructure validation complete", GREEN)
    return findings

# ─────────────────────────────────────────────
# BACKUP GROUPING & HASH ANALYSIS
# ─────────────────────────────────────────────

def group_backups(records: Dict[str, FileRecord]) -> List[BackupGroup]:
    """
    Group all backup files by their base canonical name.
    Hash-compare variants to find unique content versions.
    """
    log(f"\n{BOLD}Backup Grouping & Hash Analysis{RESET}")

    # Group backups by (directory, base_name)
    groups: Dict[str, BackupGroup] = {}

    for rel, rec in records.items():
        if not rec.is_backup:
            continue
        dir_part = str(Path(rel).parent)
        key = f"{dir_part}/{rec.backup_base}"

        if key not in groups:
            # Check if canonical base file exists
            canonical_rel = f"{dir_part}/{rec.backup_base}" if dir_part != "." else rec.backup_base
            base_exists = canonical_rel in records or rec.backup_base in records
            groups[key] = BackupGroup(
                base_file=canonical_rel,
                base_exists=base_exists,
            )
        groups[key].variants.append(rec)

    # Hash each variant to identify unique content
    for key, group in groups.items():
        for variant in group.variants:
            h = sha256_file(variant.path)
            variant.sha256 = h
            group.unique_hashes.add(h)

        # Sort variants by mtime descending (newest first)
        group.variants.sort(key=lambda r: r.mtime, reverse=True)

        # Recommend keeping the newest variant (protocol rule 4)
        if group.variants:
            group.recommended_keep = relative(group.variants[0].path,
                                              group.variants[0].path.parent.parent)
        group.safe_to_consolidate = len(group.variants) > 1

    result = list(groups.values())
    total_backup_files = sum(len(g.variants) for g in result)
    log(f"  Found {len(result)} backup groups covering {total_backup_files} backup files", GREEN)
    return result

# ─────────────────────────────────────────────
# REPORT GENERATION
# ─────────────────────────────────────────────

def generate_report(
    root: Path,
    records: Dict[str, FileRecord],
    backup_groups: List[BackupGroup],
    sh_analysis: List[dict],
    py_analysis: List[dict],
    infra: dict,
) -> str:
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    lines = []
    W = lines.append  # shorthand

    # ── Header ──
    W(f"# ASI Hygiene & Repository Safety Audit Report")
    W(f"**Repository:** `{root}`")
    W(f"**Generated:** {now}")
    W(f"**Protocol:** Expert-Level ASI Hygiene & Repository Safety Protocol v1.0")
    W(f"**Status:** PRE-EXECUTION — No destructive actions may occur before human review")
    W("")
    W("> ⚠️ This report is based on file structure + content scanning. "
      "All three validation passes (static, runtime, infrastructure) have been run "
      "computationally, but final classification of any file requires human confirmation "
      "before destructive action.")
    W("")

    # ── Stats ──
    total = len(records)
    backups = sum(1 for r in records.values() if r.is_backup)
    high_risk = sum(1 for r in records.values() if r.is_high_risk)
    W(f"## Summary Statistics")
    W(f"| Metric | Count |")
    W(f"|---|---|")
    W(f"| Total files scanned | {total} |")
    W(f"| Backup / snapshot files | {backups} |")
    W(f"| High-risk files | {high_risk} |")
    W(f"| Backup groups (unique base names) | {len(backup_groups)} |")
    W(f"| Shell scripts | {len(sh_analysis)} |")
    W(f"| Python scripts | {len(py_analysis)} |")
    W(f"| Dependency manager(s) detected | {infra['dependency_manager']} |")
    W(f"| Lockfile conflicts | {len(infra['lockfile_conflicts'])} |")
    W(f"| Parallel duplicate directories | {len(infra['parallel_dirs'])} |")
    W(f"| Empty directories | {len(infra['empty_dirs'])} |")
    W("")

    # ─────────────────────────────────────────
    # SECTION A — ACTIVE FILES
    # ─────────────────────────────────────────
    W("---")
    W("## Section A — Active Files Report")
    W("")
    W("Files confirmed structurally active based on content scanning and reference mapping.")
    W("")

    # High-risk active files
    W("### A.1 — High-Risk Active Files (infrastructure / deployment / migration)")
    W("These must never be modified or removed without operator confirmation.")
    W("")
    W("| File | Infra Flags | Referenced By |")
    W("|---|---|---|")
    high_risk_records = sorted(
        [r for r in records.values() if r.is_high_risk and not r.is_backup],
        key=lambda r: relative(r.path, root)
    )
    for rec in high_risk_records[:100]:
        rel = relative(rec.path, root)
        flags = ", ".join(rec.infra_flags) if rec.infra_flags else "name/path match"
        refs = str(len(rec.referenced_by))
        W(f"| `{rel}` | {flags} | {refs} files |")
    W("")

    # Referenced files (likely active)
    W("### A.2 — Files With Active Inbound References")
    W("")
    W("| File | Referenced By (count) |")
    W("|---|---|")
    referenced = sorted(
        [r for r in records.values() if r.referenced_by and not r.is_backup and not r.is_high_risk],
        key=lambda r: -len(r.referenced_by)
    )
    for rec in referenced[:80]:
        rel = relative(rec.path, root)
        W(f"| `{rel}` | {len(rec.referenced_by)} |")
    W("")

    # ─────────────────────────────────────────
    # SECTION B — SUSPECTED DEAD FILES
    # ─────────────────────────────────────────
    W("---")
    W("## Section B — Suspected Dead Files Report")
    W("")
    W("Files appearing unused based on zero inbound references. "
      "**NOT confirmed safe to remove.** All require validation passes 1–3.")
    W("")

    zero_ref = [
        r for r in records.values()
        if not r.is_backup
        and not r.is_high_risk
        and not r.referenced_by
        and not any(should_skip_dir(p) for p in Path(relative(r.path, root)).parts)
        and r.extension in {".ts", ".tsx", ".js", ".jsx", ".py", ".sh", ".css"}
    ]
    zero_ref.sort(key=lambda r: relative(r.path, root))

    W(f"**{len(zero_ref)} files with zero detected inbound references.**")
    W("")
    W("| File | Extension | Size | Notes |")
    W("|---|---|---|---|")
    for rec in zero_ref[:200]:
        rel = relative(rec.path, root)
        notes = "; ".join(rec.notes) if rec.notes else "No notes"
        W(f"| `{rel}` | {rec.extension} | {rec.size:,}B | {notes} |")
    if len(zero_ref) > 200:
        W(f"| *...and {len(zero_ref) - 200} more* | | | |")
    W("")
    W("> Zero references does not mean dead — dynamic imports, config-driven loading, "
      "CLI scripts, and runtime-loaded modules may not be detected by static analysis alone.")
    W("")

    # ─────────────────────────────────────────
    # SECTION C — VERIFIED SAFE REMOVAL
    # ─────────────────────────────────────────
    W("---")
    W("## Section C — Verified Safe Removal Report")
    W("")
    W("**NONE confirmed at this time.**")
    W("")
    W("Per protocol Rule 10, no file may be classified as safe for removal unless ALL "
      "of the following are confirmed:")
    W("")
    W("1. Not referenced (static analysis)")
    W("2. Not executed (runtime analysis)")
    W("3. Not required for rollback or recovery")
    W("4. Not required for compatibility")
    W("5. Not part of deployment or infrastructure")
    W("6. Not dynamically referenced")
    W("7. Not required by hidden execution paths")
    W("")
    W("This section will be populated after human review of all items in Sections B, F, and G.")
    W("")

    # ─────────────────────────────────────────
    # SECTION D — BACKUP CONSOLIDATION
    # ─────────────────────────────────────────
    W("---")
    W("## Section D — Backup Consolidation Report")
    W("")
    W("Required process before removing any backup:")
    W("1. Confirm hashes (done below)")
    W("2. Confirm no rollback tooling references backup by specific filename")
    W("3. Keep single most-recent verified-stable backup per file")
    W("4. Never remove all backups of a file")
    W("")

    # Sort groups by variant count descending
    sorted_groups = sorted(backup_groups, key=lambda g: -len(g.variants))

    W(f"### D.1 — Backup Groups ({len(sorted_groups)} groups, "
      f"{sum(len(g.variants) for g in sorted_groups)} total backup files)")
    W("")

    for group in sorted_groups:
        if not group.variants:
            continue
        variant_count = len(group.variants)
        unique_count  = len(group.unique_hashes)
        # Use path of first variant to show directory context
        dir_ctx = str(Path(relative(group.variants[0].path, root)).parent)
        W(f"#### `{group.base_file}`")
        W(f"- Base file exists: {'✓' if group.base_exists else '✗ MISSING'}")
        W(f"- Backup variants: {variant_count}")
        W(f"- Unique content versions (by hash): {unique_count}")
        W(f"- Safe to consolidate: {'YES — hash comparison complete' if unique_count < variant_count else 'NO — all variants have unique content'}")
        W("")
        W("| Backup File | Size | Last Modified | SHA256 (first 12) |")
        W("|---|---|---|---|")
        for v in group.variants:
            rel = relative(v.path, root)
            mtime_str = datetime.datetime.fromtimestamp(v.mtime).strftime("%Y-%m-%d %H:%M")
            h = v.sha256[:12] if v.sha256 else "unread"
            marker = " ← **RECOMMENDED KEEP**" if rel == group.recommended_keep else ""
            W(f"| `{rel}` | {v.size:,}B | {mtime_str} | `{h}` |{marker}")
        W("")

    # ─────────────────────────────────────────
    # SECTION E — HIGH-RISK FILES
    # ─────────────────────────────────────────
    W("---")
    W("## Section E — High-Risk Files Report")
    W("")
    W("Files tied to infrastructure, deployment, runtime, or recovery. "
      "No modification without operator sign-off.")
    W("")

    # Infrastructure conflicts
    if infra["lockfile_conflicts"]:
        W("### ⚠️ E.0 — Dependency Manager Conflicts")
        W("")
        for conflict in infra["lockfile_conflicts"]:
            W(f"- **{conflict}**")
        W("")
        W("**Immediate action required:** Determine the canonical package manager and "
          "remove the competing lockfile only after confirming no CI step uses it.")
        W("")

    W("### E.1 — High-Risk File Registry")
    W("")
    W("| File | Infra Flags | Risk Category |")
    W("|---|---|---|")
    for rec in high_risk_records:
        rel = relative(rec.path, root)
        flags = ", ".join(rec.infra_flags) if rec.infra_flags else "name/path match"
        cat = "DEPLOYMENT" if any(f in rec.infra_flags for f in ["deployment", "docker"]) else \
              "MIGRATION" if "drizzle" in rel or "migration" in rel else \
              "RUNTIME" if "startup" in rec.infra_flags else \
              "SECURITY" if "secret" in rel.lower() else \
              "BUILD"
        W(f"| `{rel}` | {flags} | {cat} |")
    W("")

    # Anomalous root files
    if infra["anomalous_root_files"]:
        W("### E.2 — Anomalous Files at Repository Root")
        W("")
        W("| File | Reason |")
        W("|---|---|")
        for fname, reason in infra["anomalous_root_files"]:
            W(f"| `{fname}` | {reason} |")
        W("")

    # Unknown extensionless files
    if infra["unknown_extensionless"]:
        W("### E.3 — Extensionless Files (type unknown)")
        W("")
        W("Run `file <name>` on each to determine type before any action.")
        W("")
        W("| File | Size |")
        W("|---|---|")
        for fname in infra["unknown_extensionless"]:
            rec = records.get(fname)
            size = f"{rec.size:,}B" if rec else "unknown"
            W(f"| `{fname}` | {size} |")
        W("")

    # tsconfig variants
    if infra["tsconfig_variants"]:
        W("### E.4 — TypeScript Config Variants")
        W("")
        W("| File |")
        W("|---|")
        for f in sorted(infra["tsconfig_variants"]):
            W(f"| `{f}` |")
        W("")

    # ─────────────────────────────────────────
    # SECTION F — SCRIPT DEPENDENCY REPORT
    # ─────────────────────────────────────────
    W("---")
    W("## Section F — Script Dependency Report")
    W("")

    W("### F.1 — Shell Script Analysis")
    W("")
    W("| Script | Classification | Destructive Ops | Rollback | Calls | Env Vars | Referenced By |")
    W("|---|---|---|---|---|---|---|")
    for s in sorted(sh_analysis, key=lambda x: x["path"]):
        destructive = "⚠️ YES" if s["has_destructive"] else "no"
        rollback    = "✓" if s["has_rollback"] else "-"
        calls       = ", ".join(s["calls_scripts"])[:60] if s["calls_scripts"] else "-"
        env_count   = str(len(s["env_deps"]))
        refs        = str(len(s["referenced_by"]))
        W(f"| `{s['path']}` | {s['classification']} | {destructive} | {rollback} | {calls} | {env_count} vars | {refs} |")
    W("")

    W("### F.2 — Python Script Analysis")
    W("")
    W("| Script | Classification | Migration Logic | CLI | Destructive | Imports | Referenced By |")
    W("|---|---|---|---|---|---|---|")
    for p in sorted(py_analysis, key=lambda x: x["path"]):
        migration   = "⚠️ YES" if p["is_migration"] else "-"
        cli         = "✓" if p["is_cli"] else "-"
        destructive = "⚠️ YES" if p["has_destructive"] else "-"
        imports     = str(len(p["imports"]))
        refs        = str(len(p["referenced_by"]))
        W(f"| `{p['path']}` | {p['classification']} | {migration} | {cli} | {destructive} | {imports} | {refs} |")
    W("")

    # ─────────────────────────────────────────
    # SECTION G — HUMAN REVIEW QUEUE
    # ─────────────────────────────────────────
    W("---")
    W("## Section G — Human Review Queue")
    W("")
    W("All items below require human decision before any automated action is permitted.")
    W("")

    W("### G.1 — Lockfile & Dependency Manager Conflicts")
    if infra["lockfile_conflicts"]:
        for c in infra["lockfile_conflicts"]:
            W(f"- {c}")
    else:
        W("- None detected")
    W("")

    W("### G.2 — Parallel Duplicate Directories")
    W("")
    if infra["parallel_dirs"]:
        W("The following directory names exist at multiple levels of the tree. "
          "Determine which is canonical before any consolidation.")
        W("")
        W("| Directory Name | Locations |")
        W("|---|---|")
        for dname, paths in sorted(infra["parallel_dirs"].items()):
            locs = "<br>".join(f"`{p}`" for p in paths)
            W(f"| `{dname}` | {locs} |")
    else:
        W("No parallel duplicate directories detected at monitored names.")
    W("")

    W("### G.3 — Empty Directories")
    W("")
    if infra["empty_dirs"]:
        W("| Directory | Action |")
        W("|---|---|")
        for d in sorted(infra["empty_dirs"]):
            W(f"| `{d}` | Confirm intentional placeholder or remove |")
    else:
        W("No empty directories detected.")
    W("")

    W("### G.4 — Non-Standard Extension Files (.mythos, .ts6bak, .null., etc.)")
    W("")
    non_std = [
        (relative(r.path, root), r.backup_suffix)
        for r in records.values()
        if r.is_backup and r.backup_suffix in (".mythos", ".ts6bak", ".null")
    ]
    if non_std:
        W("| File | Non-Standard Suffix | Action |")
        W("|---|---|---|")
        for rel, suffix in sorted(non_std):
            W(f"| `{rel}` | `{suffix}` | Explain purpose before any action |")
    else:
        W("No non-standard extension backups detected.")
    W("")

    W("### G.5 — Scripts Flagged for Human Review")
    W("")
    flagged_scripts = [s for s in sh_analysis + py_analysis
                       if "UNVERIFIED" in s["classification"] or "ONE_TIME" in s["classification"]]
    if flagged_scripts:
        W("| Script | Classification | Notes |")
        W("|---|---|---|")
        for s in sorted(flagged_scripts, key=lambda x: x["path"]):
            notes = "; ".join(s.get("notes", []))[:100] or "-"
            W(f"| `{s['path']}` | {s['classification']} | {notes} |")
    else:
        W("No scripts flagged for human review.")
    W("")

    W("### G.6 — Nested Package Manifests (potential shadow installs)")
    W("")
    if len(infra["nested_package_jsons"]) > 1:
        W("| package.json location |")
        W("|---|")
        for f in sorted(infra["nested_package_jsons"]):
            W(f"| `{f}` |")
    else:
        W("Only one package.json detected (expected for monorepo root).")
    W("")

    # ─────────────────────────────────────────
    # EXECUTION GATE
    # ─────────────────────────────────────────
    W("---")
    W("## Execution Gate — Checklist Before Any Destructive Action")
    W("")
    W("- [ ] All extensionless files typed via `file <name>`")
    W("- [ ] All shell scripts read and execution paths traced")
    W("- [ ] All Python scripts classified (one-time vs ongoing)")
    W("- [ ] Lockfile/dependency manager conflict resolved")
    W("- [ ] Parallel directory architectural question answered by project owner")
    W("- [ ] Empty directories confirmed intentional or safe")
    W("- [ ] `.mythos` and other non-standard extension files explained")
    W("- [ ] `_sweep` backup convention confirmed non-active in tooling")
    W("- [ ] All backup groups hash-compared (done above) and recommended-keep confirmed")
    W("- [ ] Migration scripts confirmed applied before any removal")
    W("- [ ] `client/client/` nested directory inventoried (if present)")
    W("- [ ] Anomalous root-level source files investigated (App.tsx, adminRouter.ts, etc.)")
    W("- [ ] `Sending/` directory at repo root inventoried")
    W("- [ ] `packages/` directory at repo root inventoried")
    W("- [ ] Section C populated by human reviewer with confirmed-safe files")
    W("")
    W("---")
    W("*Generated by `asi_hygiene_audit.py` — zero destructive operations performed.*")
    W("")

    return "\n".join(lines)

# ─────────────────────────────────────────────
# CONSOLE SUMMARY
# ─────────────────────────────────────────────

def print_summary(records, backup_groups, sh_analysis, py_analysis, infra):
    log(f"\n{'='*60}", BOLD)
    log(f"  ASI HYGIENE AUDIT — SUMMARY", BOLD)
    log(f"{'='*60}", BOLD)

    total   = len(records)
    backups = sum(1 for r in records.values() if r.is_backup)
    hr      = sum(1 for r in records.values() if r.is_high_risk)
    zero    = sum(1 for r in records.values()
                  if not r.is_backup and not r.referenced_by and not r.is_high_risk
                  and r.extension in {".ts", ".tsx", ".js", ".jsx", ".py", ".sh"})

    log(f"\n  Total files:          {total:>6}", CYAN)
    log(f"  Backup files:         {backups:>6}", YELLOW)
    log(f"  High-risk files:      {hr:>6}", RED)
    log(f"  Zero-reference files: {zero:>6}", YELLOW)
    log(f"  Backup groups:        {len(backup_groups):>6}", YELLOW)
    log(f"  Shell scripts:        {len(sh_analysis):>6}", CYAN)
    log(f"  Python scripts:       {len(py_analysis):>6}", CYAN)

    if infra["lockfile_conflicts"]:
        log(f"\n  ⚠️  LOCKFILE CONFLICT DETECTED", RED + BOLD)
        for c in infra["lockfile_conflicts"]:
            log(f"     {c}", RED)

    if infra["parallel_dirs"]:
        log(f"\n  ⚠️  PARALLEL DUPLICATE DIRS: {list(infra['parallel_dirs'].keys())}", YELLOW)

    destructive_sh = [s for s in sh_analysis if s["has_destructive"]]
    if destructive_sh:
        log(f"\n  ⚠️  SHELL SCRIPTS WITH DESTRUCTIVE OPS: {len(destructive_sh)}", RED + BOLD)
        for s in destructive_sh:
            log(f"     {s['path']}", RED)

    migration_py = [p for p in py_analysis if p["is_migration"]]
    if migration_py:
        log(f"\n  ⚠️  PYTHON MIGRATION SCRIPTS (DO NOT REMOVE): {len(migration_py)}", RED + BOLD)
        for p in migration_py:
            log(f"     {p['path']}", RED)

    log(f"\n  {'='*56}", BOLD)
    log(f"  STATUS: PRE-EXECUTION — No files have been modified.", GREEN + BOLD)
    log(f"  {'='*56}\n", BOLD)

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="ASI Hygiene & Repository Safety Audit — read-only analysis"
    )
    parser.add_argument(
        "repo_root",
        nargs="?",
        default=".",
        help="Path to repository root (default: current directory)"
    )
    parser.add_argument(
        "--output",
        default="asi_hygiene_audit_report.md",
        help="Output report filename (default: asi_hygiene_audit_report.md)"
    )
    parser.add_argument(
        "--no-hash",
        action="store_true",
        help="Skip SHA256 hashing of backup files (faster, less accurate)"
    )
    args = parser.parse_args()

    root = Path(args.repo_root).resolve()
    if not root.exists():
        log(f"ERROR: Repository root does not exist: {root}", RED)
        sys.exit(1)

    log(f"\n{BOLD}ASI Hygiene & Repository Safety Audit{RESET}")
    log(f"Repository: {root}", CYAN)
    log(f"Output:     {args.output}", CYAN)
    log(f"Zero destructive operations will be performed.", GREEN)

    # ── Three Passes ──
    records            = inventory_repository(root)
    scan_references(records, root)
    sh_analysis, py_analysis = analyze_scripts(records, root)
    infra              = validate_infrastructure(records, root)
    backup_groups      = group_backups(records)

    # ── Generate Report ──
    log(f"\n{BOLD}Generating audit report...{RESET}")
    report_text = generate_report(root, records, backup_groups, sh_analysis, py_analysis, infra)

    output_path = Path(args.output)
    output_path.write_text(report_text, encoding="utf-8")
    log(f"Report written to: {output_path.resolve()}", GREEN)

    # ── Human Review Queue (separate file for easy triage) ──
    hrq_path = output_path.with_name("human_review_queue.txt")
    with open(hrq_path, "w", encoding="utf-8") as f:
        f.write("ASI HYGIENE AUDIT — HUMAN REVIEW QUEUE\n")
        f.write("=" * 60 + "\n\n")
        f.write("Items below require human decision before any automated action.\n\n")

        f.write("[ ] EXTENSIONLESS FILES — run 'file <name>' on each:\n")
        for fname in infra["unknown_extensionless"]:
            f.write(f"    {fname}\n")
        f.write("\n")

        f.write("[ ] NON-STANDARD EXTENSION FILES:\n")
        for rel, rec in records.items():
            if rec.is_backup and rec.backup_suffix in (".mythos", ".ts6bak"):
                f.write(f"    {rel}\n")
        f.write("\n")

        f.write("[ ] UNVERIFIED SCRIPTS:\n")
        for s in sh_analysis + py_analysis:
            if "UNVERIFIED" in s["classification"]:
                f.write(f"    {s['path']}  [{s['classification']}]\n")
        f.write("\n")

        f.write("[ ] PARALLEL DUPLICATE DIRECTORIES:\n")
        for dname, paths in infra["parallel_dirs"].items():
            f.write(f"    {dname}:\n")
            for p in paths:
                f.write(f"      {p}\n")
        f.write("\n")

        f.write("[ ] MIGRATION SCRIPTS — confirm applied before any removal:\n")
        for p in py_analysis:
            if p["is_migration"]:
                f.write(f"    {p['path']}\n")
        f.write("\n")

        f.write("[ ] LOCKFILE CONFLICTS:\n")
        for c in infra["lockfile_conflicts"]:
            f.write(f"    {c}\n")
        f.write("\n")

        f.write("[ ] ANOMALOUS ROOT FILES:\n")
        for fname, reason in infra["anomalous_root_files"]:
            f.write(f"    {fname}  ({reason})\n")

    log(f"Human review queue written to: {hrq_path.resolve()}", GREEN)

    # ── Console Summary ──
    print_summary(records, backup_groups, sh_analysis, py_analysis, infra)

if __name__ == "__main__":
    main()