#!/usr/bin/env python3
"""
r3-lint-cleanup.py — Targeted lint debt reducer for R3 v4
==========================================================
Parses ESLint JSON output and applies SAFE fixes only:
  1. Removes unused import specifiers (entire line if solo import)
  2. Prefixes unused function args/catch vars with _
  3. Skips `any` types, config issues, and ambiguous cases

WIRE.txt Protocol:
  - Dry-run by default (--apply to execute)
  - Timestamped backups before writes
  - pnpm tsc --noEmit gate after all changes
  - Never modifies a file without reading it first

Usage:
    python3 r3-lint-cleanup.py                    # dry-run
    python3 r3-lint-cleanup.py --apply            # execute
    python3 r3-lint-cleanup.py --apply --verbose  # detailed

Reads: ESLint JSON output (generated internally)
"""

import json
import os
import re
import shutil
import subprocess
import sys
import datetime
from pathlib import Path
from collections import defaultdict
from typing import Dict, List, Tuple, Optional

REPO_ROOT = Path.cwd()
APPLY = "--apply" in sys.argv
VERBOSE = "--verbose" in sys.argv
TIMESTAMP = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
BACKUP_DIR = REPO_ROOT / f".lint-cleanup-backups-{TIMESTAMP}"

# ─── Terminal colors ───
R = "\033[0m"; G = "\033[32m"; Y = "\033[33m"; RD = "\033[31m"
C = "\033[36m"; B = "\033[1m"; D = "\033[2m"

def log(msg, color=R): print(f"{color}{msg}{R}", flush=True)
def ok(msg): log(f"  ✅ {msg}", G)
def warn(msg): log(f"  ⚠️  {msg}", Y)
def err(msg): log(f"  ❌ {msg}", RD)
def step(n, t): print(f"\n{B}{C}[STEP {n}] {t}{R}")

# ─── STEP 0: Get ESLint JSON output ───

def get_eslint_json() -> list:
    """Run ESLint with JSON formatter and parse output."""
    step(0, "Running ESLint (JSON format)")
    result = subprocess.run(
        ["pnpm", "eslint", "client/src", "-f", "json", "--max-warnings", "9999"],
        cwd=REPO_ROOT, capture_output=True, text=True
    )
    try:
        data = json.loads(result.stdout)
        total_errors = sum(f.get("errorCount", 0) for f in data)
        total_warnings = sum(f.get("warningCount", 0) for f in data)
        ok(f"Parsed {len(data)} files, {total_errors} errors, {total_warnings} warnings")
        return data
    except json.JSONDecodeError:
        err("Failed to parse ESLint JSON output")
        if VERBOSE:
            print(result.stdout[:500])
            print(result.stderr[:500])
        sys.exit(1)

# ─── STEP 1: Categorize fixable errors ───

def categorize_errors(eslint_data: list) -> Dict[str, List[dict]]:
    """
    Group errors by file. Only include SAFE-to-fix categories:
      - no-unused-vars where it's an import → REMOVE import specifier
      - no-unused-vars where it's a function arg → PREFIX with _
      - no-unused-vars where it's a catch var → PREFIX with _
    Skip:
      - no-explicit-any (needs human typing)
      - consistent-type-imports (config issue)
      - react-hooks/* (config issue)
    """
    step(1, "Categorizing fixable errors")

    by_file: Dict[str, List[dict]] = defaultdict(list)
    skipped = {"any": 0, "config": 0, "other": 0}
    fixable = {"import": 0, "arg": 0, "var": 0}

    for file_entry in eslint_data:
        filepath = file_entry.get("filePath", "")
        for msg in file_entry.get("messages", []):
            rule = msg.get("ruleId", "")
            text = msg.get("message", "")
            line = msg.get("line", 0)
            col = msg.get("column", 0)

            if rule == "@typescript-eslint/no-unused-vars":
                entry = {
                    "line": line, "column": col, "message": text,
                    "rule": rule, "file": filepath
                }
                # Classify: is this an import, arg, or var?
                if "is defined but never used" in text:
                    # Extract the variable name
                    m = re.match(r"'(\w+)' is defined but never used", text)
                    if m:
                        entry["varName"] = m.group(1)
                        entry["fixType"] = "remove_or_prefix"
                        by_file[filepath].append(entry)
                        fixable["import"] += 1
                elif "is assigned a value but never used" in text:
                    m = re.match(r"'(\w+)' is assigned a value but never used", text)
                    if m:
                        entry["varName"] = m.group(1)
                        entry["fixType"] = "prefix_var"
                        by_file[filepath].append(entry)
                        fixable["var"] += 1
                else:
                    skipped["other"] += 1

            elif rule == "@typescript-eslint/no-explicit-any":
                skipped["any"] += 1
            elif rule in ("@typescript-eslint/consistent-type-imports",
                          "react-hooks/exhaustive-deps"):
                skipped["config"] += 1
            elif "react-hooks" in (rule or ""):
                skipped["config"] += 1
            else:
                skipped["other"] += 1

    total_fixable = sum(fixable.values())
    total_skipped = sum(skipped.values())
    ok(f"Fixable: {total_fixable} (imports: {fixable['import']}, "
       f"args: {fixable['arg']}, vars: {fixable['var']})")
    ok(f"Skipped: {total_skipped} (any: {skipped['any']}, "
       f"config: {skipped['config']}, other: {skipped['other']})")

    return dict(by_file)

# ─── STEP 2: Apply fixes ───

def is_import_line(line_text: str) -> bool:
    """Check if this line is an import statement."""
    stripped = line_text.strip()
    return stripped.startswith("import ") or stripped.startswith("import{")

def is_type_import_line(line_text: str) -> bool:
    """Check if this line imports a type."""
    stripped = line_text.strip()
    return "import type" in stripped or "type {" in stripped

def remove_specifier_from_import(line_text: str, var_name: str) -> Optional[str]:
    """
    Remove a single named specifier from an import line.
    If it's the only specifier, return None (delete the whole line).
    If it's one of many, remove just that specifier.
    """
    # Pattern: import { A, B, C } from '...'
    # Or: import A from '...'
    # Or: import { type A } from '...'

    stripped = line_text.strip()

    # Default import: import PageNav from '...'
    default_match = re.match(
        rf"^import\s+{re.escape(var_name)}\s+from\s+", stripped
    )
    if default_match:
        return None  # Delete entire line

    # Named import with braces
    brace_match = re.search(r'\{([^}]+)\}', stripped)
    if brace_match:
        specifiers_str = brace_match.group(1)
        specifiers = [s.strip() for s in specifiers_str.split(",") if s.strip()]

        # Find and remove the target specifier
        new_specs = []
        removed = False
        for spec in specifiers:
            # Handle "type Foo" or just "Foo"
            clean_name = spec.replace("type ", "").strip()
            if clean_name == var_name and not removed:
                removed = True
                continue
            new_specs.append(spec)

        if not removed:
            return line_text  # Couldn't find it, don't touch

        if not new_specs:
            return None  # No specifiers left, delete whole line

        # Rebuild the import line
        new_spec_str = ", ".join(new_specs)
        new_line = re.sub(r'\{[^}]+\}', f"{{ {new_spec_str} }}", stripped)

        # Preserve original indentation
        indent = len(line_text) - len(line_text.lstrip())
        return " " * indent + new_line

    return line_text  # Couldn't parse, don't touch

def apply_fixes(by_file: Dict[str, List[dict]]) -> Tuple[int, int, int]:
    """Apply fixes to files. Returns (files_modified, lines_removed, vars_prefixed)."""
    step(2, "Applying fixes" if APPLY else "Analyzing fixes (dry-run)")

    files_modified = 0
    lines_removed = 0
    vars_prefixed = 0

    for filepath, errors in sorted(by_file.items()):
        rel = os.path.relpath(filepath, REPO_ROOT)

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                lines = f.readlines()
        except (OSError, UnicodeDecodeError) as e:
            err(f"Cannot read {rel}: {e}")
            continue

        # Sort errors by line number (descending) so we can modify from bottom up
        errors_sorted = sorted(errors, key=lambda e: e["line"], reverse=True)

        modified = False
        for error in errors_sorted:
            line_idx = error["line"] - 1  # 0-indexed
            if line_idx < 0 or line_idx >= len(lines):
                continue

            var_name = error.get("varName", "")
            fix_type = error.get("fixType", "")
            line_text = lines[line_idx]

            if fix_type == "remove_or_prefix":
                if is_import_line(line_text):
                    # Try to remove this specifier from the import
                    result = remove_specifier_from_import(line_text, var_name)
                    if result is None:
                        # Delete entire line
                        if VERBOSE:
                            ok(f"  DELETE import: {rel}:{error['line']} ({var_name})")
                        lines[line_idx] = ""  # Mark for removal
                        lines_removed += 1
                        modified = True
                    elif result != line_text:
                        # Modified the import (removed one specifier)
                        if VERBOSE:
                            ok(f"  TRIM import: {rel}:{error['line']} ({var_name})")
                        lines[line_idx] = result + "\n"
                        lines_removed += 1
                        modified = True
                    # else: couldn't parse, skip
                else:
                    # Not an import — it's a function arg or destructured var
                    # Check if it's a catch variable or function param
                    if var_name and not var_name.startswith("_"):
                        # Prefix with _ (safe for args)
                        new_line = line_text.replace(var_name, f"_{var_name}", 1)
                        if new_line != line_text:
                            if VERBOSE:
                                ok(f"  PREFIX: {rel}:{error['line']} {var_name} → _{var_name}")
                            lines[line_idx] = new_line
                            vars_prefixed += 1
                            modified = True

            elif fix_type == "prefix_var":
                # Assigned but never used — prefix with _
                if var_name and not var_name.startswith("_"):
                    new_line = line_text.replace(var_name, f"_{var_name}", 1)
                    if new_line != line_text:
                        if VERBOSE:
                            ok(f"  PREFIX: {rel}:{error['line']} {var_name} → _{var_name}")
                        lines[line_idx] = new_line
                        vars_prefixed += 1
                        modified = True

        if modified:
            files_modified += 1
            if APPLY:
                # Backup
                BACKUP_DIR.mkdir(parents=True, exist_ok=True)
                backup_path = BACKUP_DIR / rel.replace("/", "__")
                shutil.copy2(filepath, backup_path)

                # Write modified file (filter out empty lines from deletions)
                with open(filepath, "w", encoding="utf-8") as f:
                    f.writelines(line for line in lines if line != "")
                ok(f"FIXED: {rel}")
            else:
                ok(f"[DRY-RUN] Would fix: {rel}")

    return files_modified, lines_removed, vars_prefixed

# ─── STEP 3: Verify ───

def verify_tsc() -> bool:
    step(3, "TypeScript Gate (pnpm tsc --noEmit)")
    result = subprocess.run(
        ["pnpm", "tsc", "--noEmit"], cwd=REPO_ROOT,
        capture_output=True, text=True
    )
    if result.returncode == 0:
        ok("pnpm tsc --noEmit: PASS (0 errors)")
        return True
    else:
        err("pnpm tsc --noEmit: FAIL — changes may have broken types")
        print(result.stdout[:1000])
        print(result.stderr[:500])
        return False

def recount_lint() -> Tuple[int, int]:
    """Re-run lint and count remaining problems."""
    step("4", "Re-counting lint problems")
    result = subprocess.run(
        ["pnpm", "eslint", "client/src", "-f", "json", "--max-warnings", "9999"],
        cwd=REPO_ROOT, capture_output=True, text=True
    )
    try:
        data = json.loads(result.stdout)
        errors = sum(f.get("errorCount", 0) for f in data)
        warnings = sum(f.get("warningCount", 0) for f in data)
        return errors, warnings
    except json.JSONDecodeError:
        return -1, -1

# ─── MAIN ───

def main():
    print(f"\n{B}{C}R3 v4 Lint Cleanup — WIRE.txt Protocol{R}")
    print(f"Mode: {'APPLY' if APPLY else 'DRY-RUN'}\n")

    # Step 0: Get lint data
    eslint_data = get_eslint_json()

    # Step 1: Categorize
    by_file = categorize_errors(eslint_data)

    if not by_file:
        ok("No fixable errors found")
        return

    # Step 2: Apply (or dry-run)
    files_mod, lines_rm, vars_pf = apply_fixes(by_file)

    # Step 3: Verify TSC (only if we actually changed files)
    if APPLY and files_mod > 0:
        tsc_ok = verify_tsc()
        if not tsc_ok:
            err("TSC failed after lint cleanup!")
            err(f"Backups are in: {BACKUP_DIR}")
            err("Restore with: cp .lint-cleanup-backups-*/* back to original paths")
            sys.exit(1)

        # Step 4: Recount
        new_errors, new_warnings = recount_lint()
        if new_errors >= 0:
            ok(f"Remaining: {new_errors} errors, {new_warnings} warnings")
            ok(f"Reduction: {261 - new_errors} errors fixed")

    # Summary
    step("SUMMARY", "Results")
    print(f"\n  Files modified:      {files_mod}")
    print(f"  Import lines removed: {lines_rm}")
    print(f"  Vars prefixed with _: {vars_pf}")

    if APPLY:
        print(f"\n  Backups: {BACKUP_DIR}")
        print(f"\n{B}{G}✅ Lint cleanup complete!{R}")
        print(f"\n  Next: git add -A && git commit -m 'chore: reduce lint debt (unused imports/vars)'")
    else:
        print(f"\n{B}{Y}Dry-run complete. Run with --apply to execute.{R}")
        print(f"  python3 r3-lint-cleanup.py --apply")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        err("\nInterrupted")
        sys.exit(130)
    except Exception as e:
        err(f"\nUnexpected error: {e}")
        import traceback; traceback.print_exc()
        sys.exit(1)
