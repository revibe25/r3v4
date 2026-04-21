#!/usr/bin/env python3
"""
llpte_ts_fix.py — Fix LLPTE TypeScript project reference errors
Root causes:
  1. rootDir too narrow in llpte-core, llpte-ai, llpte-execution
  2. Missing references entries in all three
  3. Test file not excluded in llpte-ai (10 spurious errors)
Usage:
  python3 llpte_ts_fix.py           # dry run (default)
  python3 llpte_ts_fix.py --apply   # apply fixes
"""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path
from datetime import datetime

ROOT    = Path.home() / "Stable"
DRY_RUN = "--apply" not in sys.argv
TS      = datetime.now().strftime("%Y%m%d_%H%M%S")

R = "\033[0;31m"; Y = "\033[1;33m"; G = "\033[0;32m"; N = "\033[0m"

def die(msg: str):
    print(f"{R}[ERR]{N} {msg}", file=sys.stderr)
    sys.exit(1)

def log(msg: str):  print(f"{G}[OK]{N}  {msg}")
def warn(msg: str): print(f"{Y}[DRY]{N} {msg}")
def info(msg: str): print(f"      {msg}")

# ── Guards ────────────────────────────────────────────────────────────────────
if not (ROOT / "pnpm-workspace.yaml").exists():
    die(f"{ROOT} is not the monorepo root — aborting")

# ── Helpers ───────────────────────────────────────────────────────────────────
def backup(path: Path) -> Path:
    bak = path.with_suffix(path.suffix + f".bak-ts-fix-{TS}")
    shutil.copy2(path, bak)
    info(f"Backed up → {bak.name}")
    return bak

def restore(bak: Path, original: Path):
    shutil.copy2(bak, original)
    info(f"Restored {original.name} from backup")

# FIX #5: re imported at top level (not inside function)
# FIX #7: regex uses negative lookahead to avoid stripping // inside strings
_COMMENT_RE = re.compile(
    r'"(?:[^"\\]|\\.)*"'    # match JSON strings (preserve them)
    r'|//[^\n]*'            # or line comments (strip these)
    r'|/\*.*?\*/',          # or block comments (strip these)
    re.DOTALL
)

def _comment_replacer(m: re.Match) -> str:
    s = m.group(0)
    return s if s.startswith('"') else ""  # keep strings, drop comments

def read_tsconfig(path: Path) -> dict:
    """Read tsconfig JSON, safely stripping comments without touching strings."""
    raw = path.read_text()
    stripped = _COMMENT_RE.sub(_comment_replacer, raw)
    return json.loads(stripped)

def write_tsconfig(path: Path, data: dict):
    content = json.dumps(data, indent=2) + "\n"
    if DRY_RUN:
        warn(f"Would rewrite: {path.relative_to(ROOT)}")
        print(content)
    else:
        backup(path)
        path.write_text(content)
        log(f"Wrote: {path.relative_to(ROOT)}")

# FIX #3 + FIX #4: check both stdout+stderr, always pass --project tsconfig.json
def run_tsc_check(pkg_dir: Path) -> tuple[int, list[str]]:
    """Run tsc --noEmit --project tsconfig.json, return (error_count, error_lines)."""
    result = subprocess.run(
        ["./node_modules/.bin/tsc", "--noEmit", "--project", "tsconfig.json"],
        cwd=pkg_dir, capture_output=True, text=True
    )
    combined = result.stdout + result.stderr
    errors = [l for l in combined.splitlines() if "error TS" in l]
    return len(errors), errors

# FIX #1 (GAP #1): build a package and return success bool + rollback on failure
def build_pkg(pkg_dir: Path, tsconfig_bak: Path | None = None) -> bool:
    """Run tsc --project tsconfig.json (emit). Returns True on success."""
    result = subprocess.run(
        ["./node_modules/.bin/tsc", "--project", "tsconfig.json"],
        cwd=pkg_dir, capture_output=True, text=True
    )
    if result.returncode != 0:
        combined = result.stdout + result.stderr
        print(f"{R}[FAIL]{N} Build failed for {pkg_dir.name}:")
        for line in combined.splitlines():
            print(f"  {line}")
        # FIX GAP #2: auto-restore tsconfig backup on build failure
        if tsconfig_bak is not None:
            tsconfig_path = pkg_dir / "tsconfig.json"
            restore(tsconfig_bak, tsconfig_path)
        return False
    log(f"{pkg_dir.name} built → dist/")
    return True

def check_rootdir(cfg: dict, pkg: str) -> bool:
    """
    Returns True if the fix needs to be applied, False if already applied.
    Dies if the tsconfig is in an unexpected state requiring manual review.
    FIX #2: proper guard (not assert — assert is stripped by python -O).
    Idempotent: safely re-runnable after partial application.
    """
    rootdir = cfg.get("compilerOptions", {}).get("rootDir")
    if rootdir is None:
        if "references" in cfg:
            info(f"{pkg}: already fixed (rootDir absent, references present) — skipping")
            return False
        die(f"{pkg}: rootDir absent but references missing — manual review needed")
    if rootdir != "./src":
        die(f"{pkg}: unexpected rootDir value '{rootdir}' — manual review needed")
    if "include" not in cfg or "src/**/*" not in cfg["include"]:
        die(f"{pkg}: unexpected include pattern — manual review needed")
    return True  # fix needed

# ── Pre-flight: shared must be built ─────────────────────────────────────────
shared_dist = ROOT / "shared" / "dist" / "auto-level.types.d.ts"
if not shared_dist.exists():
    if DRY_RUN:
        warn("shared/dist missing — would build shared first")
    else:
        print("\n── Building shared ──────────────────────────────────")
        ok = build_pkg(ROOT / "shared")
        if not ok:
            die("shared build failed — cannot continue")
else:
    log("shared/dist exists ✓")

# ── Pre-flight: llpte-signal must be built ────────────────────────────────────
signal_dist = ROOT / "packages" / "llpte-signal" / "dist" / "index.d.ts"
if not signal_dist.exists():
    if DRY_RUN:
        warn("llpte-signal/dist missing — would build llpte-signal first")
    else:
        print("\n── Building llpte-signal ────────────────────────────")
        ok = build_pkg(ROOT / "packages" / "llpte-signal")
        if not ok:
            die("llpte-signal build failed — cannot continue")
else:
    log("llpte-signal/dist exists ✓")

# ═══════════════════════════════════════════════════════════════════════════
# FIX 1 — llpte-execution/tsconfig.json
# Remove rootDir, add references → shared
# Build so llpte-core can reference its declarations
# ═══════════════════════════════════════════════════════════════════════════
print("\n── Fix 1: llpte-execution ──────────────────────────────")
exec_dir  = ROOT / "packages" / "llpte-execution"
exec_path = exec_dir / "tsconfig.json"
if not exec_path.exists():
    die(f"{exec_path} not found")

exec_cfg = read_tsconfig(exec_path)
if check_rootdir(exec_cfg, "llpte-execution"):
    exec_cfg["compilerOptions"].pop("rootDir", None)
    exec_cfg["references"] = [{"path": "../../shared"}]
    write_tsconfig(exec_path, exec_cfg)

# Build so llpte-core can reference its declarations (run even if tsconfig skipped)
exec_dist = exec_dir / "dist" / "index.d.ts"
if not DRY_RUN and not exec_dist.exists():
    exec_bak = exec_dir / f"tsconfig.json.bak-ts-fix-{TS}"
    print("\n── Building llpte-execution ─────────────────────────")
    ok = build_pkg(exec_dir, tsconfig_bak=exec_bak if exec_bak.exists() else None)
    if not ok:
        die("llpte-execution build failed after tsconfig fix")
elif not DRY_RUN:
    log("llpte-execution/dist exists ✓")

# ═══════════════════════════════════════════════════════════════════════════
# FIX 2 — llpte-ai/tsconfig.json
# Remove rootDir, add references → shared + llpte-signal
# Exclude src/**/*.test.ts (vitest handles test types separately)
# Build so llpte-core can reference its declarations
# ═══════════════════════════════════════════════════════════════════════════
print("\n── Fix 2: llpte-ai ─────────────────────────────────────")
ai_dir  = ROOT / "packages" / "llpte-ai"
ai_path = ai_dir / "tsconfig.json"
if not ai_path.exists():
    die(f"{ai_path} not found")

ai_cfg = read_tsconfig(ai_path)
if check_rootdir(ai_cfg, "llpte-ai"):
    ai_cfg["compilerOptions"].pop("rootDir", None)
    ai_cfg["references"] = [
        {"path": "../../shared"},
        {"path": "../llpte-signal"},
    ]
    if "exclude" not in ai_cfg:
        ai_cfg["exclude"] = []
    if "src/**/*.test.ts" not in ai_cfg["exclude"]:
        ai_cfg["exclude"].append("src/**/*.test.ts")
        info("Added src/**/*.test.ts to exclude (10 test-file errors suppressed; vitest still runs them)")
    write_tsconfig(ai_path, ai_cfg)

# Build so llpte-core can reference its declarations (run even if tsconfig skipped)
ai_dist = ai_dir / "dist" / "index.d.ts"
if not DRY_RUN and not ai_dist.exists():
    ai_bak = ai_dir / f"tsconfig.json.bak-ts-fix-{TS}"
    print("\n── Building llpte-ai ────────────────────────────────")
    ok = build_pkg(ai_dir, tsconfig_bak=ai_bak if ai_bak.exists() else None)
    if not ok:
        die("llpte-ai build failed after tsconfig fix")
elif not DRY_RUN:
    log("llpte-ai/dist exists ✓")

# ═══════════════════════════════════════════════════════════════════════════
# FIX 3 — llpte-core/tsconfig.json
# Remove rootDir, add references → signal + ai + execution
# (No build needed — llpte-core exports from src/ directly via package.json)
# ═══════════════════════════════════════════════════════════════════════════
print("\n── Fix 3: llpte-core ───────────────────────────────────")
core_dir  = ROOT / "packages" / "llpte-core"
core_path = core_dir / "tsconfig.json"
if not core_path.exists():
    die(f"{core_path} not found")

core_cfg = read_tsconfig(core_path)
if check_rootdir(core_cfg, "llpte-core"):
    core_cfg["compilerOptions"].pop("rootDir", None)
    core_cfg["references"] = [
        {"path": "../llpte-signal"},
        {"path": "../llpte-ai"},
        {"path": "../llpte-execution"},
    ]
    write_tsconfig(core_path, core_cfg)

# ── Verification — all 6 packages ────────────────────────────────────────────
# FIX GAP #3: verify all packages, not just the 3 modified
print("\n══════════════════════════════════════════════════════")
if DRY_RUN:
    warn("DRY RUN complete — no files written")
    print("  Run with --apply to execute fixes")
else:
    print("── Final error counts (all 6 packages) ─────────────")
    all_pkgs = [
        "llpte-signal",
        "llpte-adapters",
        "llpte-transition-graph",
        "llpte-execution",
        "llpte-ai",
        "llpte-core",
    ]
    total = 0
    for pkg in all_pkgs:
        pkg_dir = ROOT / "packages" / pkg
        count, errors = run_tsc_check(pkg_dir)
        total += count
        status = f"{G}✓ 0{N}" if count == 0 else f"{R}✗ {count}{N}"
        print(f"  {pkg:<30} {status} errors")
        if errors:
            for line in errors[:5]:
                print(f"    {line}")
            if len(errors) > 5:
                print(f"    ... and {len(errors) - 5} more")

    print()
    if total == 0:
        print(f"  {G}All 6 packages clean — 0 errors total ✓{N}")
    else:
        print(f"  {R}{total} errors remain across all packages{N}")
print("══════════════════════════════════════════════════════\n")