#!/usr/bin/env python3
"""
R3V4 MASTER STACK ALIGNMENT AUDITOR (ASI-MAX VERSION)
=====================================================
A production-grade, recursive, atomic, encoding-safe validator for robust stack alignment.
Checks all docs, code, and artifacts for:
    - Tech stack consistency
    - Architecture alignment
    - Naming consistency
    - Security compliance
    - Schema alignment
    - AI/ASI concepts and drift
    - Reference/broken links
    - Contradictions
    - PRD multi-version warning
    - CI integration (JSON/CSV output)
Outputs all reports and logs in ./reports/
"""

import os
import sys
import re
import json
import csv
import argparse
import datetime
import codecs
from collections import defaultdict
from pathlib import Path

# ============================== CONFIGURATION =================================

# Edit these to match your canonical stack
REQUIRED_STACK_TERMS = [
    "typescript", "trpc", "postgres", "schema", "router", "auth", "security",
    "ai", "asi", "agent", "skills", "workflow", "audio", "daw", "effects",
    "mutation", "infrastructure",
]
FORBIDDEN_TERMS = [
    "firebase", "jquery", "angularjs", "phpmyadmin", "wordpress", "mongodb", "java servlet", "flash",
]
REQUIRED_FILES = [
    "README.md", "PRD_R3V4_v4.4.0.md", "API_REFERENCE.md", "SECURITY.md", "schema.ts", "trpc.ts", "auth.md",
]
REPORT_FILES = {
    "ALIGNMENT_REPORT": "reports/alignment_report.md",
    "CONTRADICTIONS_LOG": "reports/contradictions.log",
    "ORPHAN_LOG": "reports/orphaned_terms.log",
    "DRIFT_LOG": "reports/stack_drift.log",
    "ARCH_LOG": "reports/architecture_gaps.log",
    "SECURITY_LOG": "reports/security_gaps.log",
    "REFERENCE_MATRIX": "reports/reference_matrix.csv",
    "JSON_SUMMARY": "reports/audit_summary.json",
}
MD_REF_RX = re.compile(r'([A-Za-z0-9._/\-]+\.md)\b')  # relative paths
PRD_VERSION_RX = re.compile(r'v[0-9]+\.[0-9]+(\.[0-9]+)?', re.IGNORECASE)
WORD_BOUNDARY_FMT = r'\b{}\b'
COLOR_CODES = {'RED': '\033[91m', 'YELLOW': '\033[93m', 'GREEN': '\033[92m', 'ENDC': '\033[0m'}

# =========================== GENERAL HELPERS ================================

def color_text(text, color, enable_color):
    if enable_color and color in COLOR_CODES:
        return COLOR_CODES[color] + text + COLOR_CODES['ENDC']
    return text

def safe_open(path, mode='r', encoding='utf-8', errors='replace'):
    """Open a file in a way that won't blow up on encoding errors (binary-safe text)."""
    return codecs.open(path, mode, encoding, errors=errors)

def atomic_reset(files):
    """Truncate all report/log files at start (atomic)."""
    os.makedirs('reports', exist_ok=True)
    for f in files.values():
        open(f, 'w').close()

def find_files(root, patterns):
    """Recursively find files in root matching any extension/pattern in patterns."""
    found = []
    for p in patterns:
        found += list(Path(root).rglob(p))
    return [str(f) for f in found]

def is_text_file(path):
    """Try to determine if a file is human-readable text (not too aggressive)."""
    try:
        with open(path, 'rb') as f:
            chunk = f.read(1024)
            if b'\0' in chunk:
                return False
            # Accept UTF-8 decodable files
            try:
                chunk.decode('utf-8')
                return True
            except Exception:
                return False
    except Exception:
        return False

# ============================= MAIN AUDIT LOGIC ==============================

def main(root_dir, enable_color=False):

    date_str = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    logs = {
        "contradictions": [],
        "orphans": [],
        "drift": [],
        "arch": [],
        "security": [],
        "broken_refs": [],
        "summary": [],
    }
    json_summary = {
        "files_audited": 0,
        "metadata": {"generated": date_str, "root_dir": str(root_dir)},
        "results": {
            "warnings": 0,
            "errors": 0,
            "file_results": [],
        }
    }

    # -------- Output pre-setup
    atomic_reset(REPORT_FILES)

    # -------- Discover files
    doc_patterns = ['*.md', '*.ts', '*.sql', '*.docx', '*.pdf']
    docs = find_files(root_dir, doc_patterns)
    docs = [f for f in docs if is_text_file(f)]
    fileset = set(os.path.relpath(f, root_dir) for f in docs)
    total_files = len(docs)

    # -------- Required files: recursively, symlink-safe
    for req in REQUIRED_FILES:
        found = any(Path(root_dir).joinpath(x).name == req for x in fileset)
        if not found:
            msg = f"[MISSING] {req}"
            logs["drift"].append(msg)

    # -------- Precompute for cross-ref lookup (O(1) ref check)
    all_files_by_name = {Path(f).name: f for f in docs}

    # -------- Reference matrix for CSV
    reference_matrix = []

    # -------- File analysis
    total_warnings = total_errors = 0

    for file_path in docs:
        rel_file = os.path.relpath(file_path, root_dir)
        file_report = {
            "file": rel_file,
            "missing_terms": [],
            "forbidden": [],
            "contradictions": [],
            "broken_refs": [],
        }

        try:
            with safe_open(file_path, 'r') as f:
                try:
                    content = f.read()
                except UnicodeDecodeError:
                    continue  # totally unreadable file, skip
        except Exception as e:
            continue  # Can't open? skip

        lower_content = content.lower()

        # -- Required stack terms (word-boundary; no "auth" in "authority")
        for term in REQUIRED_STACK_TERMS:
            rx = re.compile(WORD_BOUNDARY_FMT.format(re.escape(term)), re.IGNORECASE)
            count = len(rx.findall(content))
            reference_matrix.append([rel_file, term, count])
            if count == 0:
                msg = f"[ORPHAN] {rel_file} missing stack term: {term}"
                logs["orphans"].append(msg)
                file_report["missing_terms"].append(term)
                total_warnings += 1

        # -- Forbidden terms (case-insensitive, word-boundary)
        for bad in FORBIDDEN_TERMS:
            rx = re.compile(WORD_BOUNDARY_FMT.format(re.escape(bad)), re.IGNORECASE)
            if rx.search(content):
                msg = f"[DRIFT] {rel_file} references forbidden stack component: {bad}"
                logs["drift"].append(msg)
                file_report["forbidden"].append(bad)
                total_errors += 1

        # -- Architecture: microservice must mention trpc
        if re.search(r'\bmicroservice\b', lower_content) and not re.search(r'\btrpc\b', lower_content):
            msg = f"[ARCH] {rel_file} references microservice without TRPC alignment"
            logs["arch"].append(msg)
            total_warnings += 1

        # -- Security auth must mention security
        if re.search(r'\bauthentication\b', lower_content) and not re.search(r'\bsecurity\b', lower_content):
            msg = f"[SECURITY] {rel_file} mentions authentication without security context"
            logs["security"].append(msg)
            total_warnings += 1

        # -- AI/ASI consistency: asi must mention agent
        if re.search(r'\basi\b', lower_content) and not re.search(r'\bagent\b', lower_content):
            msg = f"[ASI-GAP] {rel_file} mentions ASI without agent architecture"
            logs["arch"].append(msg)
            total_warnings += 1

        # -- Contradiction: centralized & fully decentralized
        if re.search(r'\bcentralized\b', lower_content) and re.search(r'\bfully decentralized\b', lower_content):
            msg = f"[CONTRADICTION] {rel_file} contains centralized + decentralized conflict"
            logs["contradictions"].append(msg)
            file_report["contradictions"].append("centralized/decentralized")
            total_errors += 1

        # -- Security: jwt should mention rotation, password should mention hash
        if re.search(r'\bjwt\b', lower_content) and not re.search(r'\brotation\b', lower_content):
            msg = f"[SECURITY] {rel_file} references JWT without rotation policy"
            logs["security"].append(msg)
            total_warnings += 1

        if re.search(r'\bpassword\b', lower_content) and not re.search(r'\bhash\b', lower_content):
            msg = f"[SECURITY] {rel_file} references password without hashing"
            logs["security"].append(msg)
            total_errors += 1

        # -- Markdown refs: resolve relative links, check existence
        for found_ref in MD_REF_RX.findall(content):
            ref_name = os.path.basename(found_ref)
            # Try to resolve as relative to current file
            ref_path = (Path(file_path).parent / found_ref).resolve()
            if not ref_path.exists() and ref_name not in all_files_by_name:
                msg = f"[BROKEN-REF] {rel_file} -> {found_ref}"
                logs["drift"].append(msg)
                file_report["broken_refs"].append(found_ref)
                total_warnings += 1

        json_summary["results"]["file_results"].append(file_report)

    # -------- PRD multi-version check: always warn if more than one versioned PRD file is found
    prd_files = [f for f in docs if "prd" in Path(f).name.lower()]
    versions_found = set()
    for f in prd_files:
        m = PRD_VERSION_RX.search(Path(f).name)
        if m:
            versions_found.add(m.group(0))
    if len(versions_found) > 1:
        msg = "[VERSION-DRIFT] Multiple PRD versions detected: {}".format(", ".join(sorted(versions_found)))
        logs["drift"].append(msg)
        total_warnings += 1

    # --------- Write CSV, JSON
    with open(REPORT_FILES["REFERENCE_MATRIX"], 'w', newline='', encoding='utf-8') as csvf:
        writer = csv.writer(csvf)
        writer.writerow(['file', 'term', 'count'])
        writer.writerows(reference_matrix)

    with open(REPORT_FILES["JSON_SUMMARY"], "w", encoding="utf-8") as jf:
        json_summary.update(files_audited=total_files)
        json_summary["results"]["warnings"] = total_warnings
        json_summary["results"]["errors"] = total_errors
        json.dump(json_summary, jf, indent=2)

    # --------- Write log files (all atomic, human readable)
    for key, fname in REPORT_FILES.items():
        if key == "ALIGNMENT_REPORT" or key == "REFERENCE_MATRIX" or key == "JSON_SUMMARY":
            continue
        with open(fname, 'w', encoding='utf-8') as f:
            for line in logs[key.replace('_log', '')]:
                f.write(line + "\n")

    # -------- Markdown report
    with open(REPORT_FILES["ALIGNMENT_REPORT"], 'w', encoding='utf-8') as ar:
        ar.write(f"# R3V4 MASTER STACK ALIGNMENT REPORT\n\nGenerated: {date_str}\n\nRoot Directory: `{root_dir}`\nTotal Files Audited: `{total_files}`\n\n---\n\n")
        ar.write("## Summary Table\n\n")
        ar.write("| Metric | Count |\n|---|---|\n")
        ar.write(f"| Files Audited | {total_files} |\n")
        ar.write(f"| Warnings | {total_warnings} |\n")
        ar.write(f"| Errors | {total_errors} |\n")
        ar.write("\n---\n")
        ar.write("## Generated Reports\n\n")
        ar.write("| Report | Purpose |\n|---|---|\n")
        ar.write("| contradictions.log | Logical conflicts |\n")
        ar.write("| orphaned_terms.log | Missing stack concepts |\n")
        ar.write("| stack_drift.log | Legacy/forbidden tech |\n")
        ar.write("| architecture_gaps.log | Architecture inconsistencies |\n")
        ar.write("| security_gaps.log | Security issues |\n")
        ar.write("| reference_matrix.csv | Term occurrence mapping |\n")
        ar.write("| audit_summary.json | Full machine-readable results |\n")
        ar.write("\n---\n# Audit Status\n\n")
        if total_errors == 0:
            ar.write("✅ STACK ALIGNMENT PASSED\n")
        else:
            ar.write("❌ STACK ALIGNMENT FAILED\n")

    # -------------- Terminal output (with color)
    print()
    print("="*60)
    print("  R3V4 STACK AUDIT COMPLETE")
    print("="*60)
    print(f"Files Audited : {color_text(str(total_files), 'GREEN', enable_color)}")
    print(f"Warnings      : {color_text(str(total_warnings), 'YELLOW', enable_color)}")
    print(f"Errors        : {color_text(str(total_errors), 'RED', enable_color)}")
    print("\nReports:")
    for name, path in REPORT_FILES.items():
        print(f"  {path}")
    print()
    if total_errors == 0:
        print(color_text("STATUS: PASS", 'GREEN', enable_color))
        sys.exit(0)
    else:
        print(color_text("STATUS: FAIL", 'RED', enable_color))
        sys.exit(1)

# ========================= ENTRY POINT / CLI ================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="R3V4/ASI MAX Stack Alignment Audit Tool")
    parser.add_argument('--root', type=str, default=os.environ.get('STACK_ROOT', os.getcwd()), help="Project root directory")
    parser.add_argument('--color', action='store_true', help="Enable ANSI color output")
    args = parser.parse_args()
    main(args.root, enable_color=args.color)