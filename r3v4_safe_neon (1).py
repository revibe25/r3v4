#!/usr/bin/env python3
"""
r3v4_safe_neon.py — Surgical neon token patch for R3 v4
────────────────────────────────────────────────────────
Adds CSS custom properties, Tailwind extend tokens, and neon utility
classes to the R3 v4 client. Detect-only for ThemeProvider / Switcher.

Canonical color: #a3e635 (acid green — SKILLS.md §7 — verified 2026-04-12)
NOT #b8ff00, NOT #bfff00.

Usage:
  python3 r3v4_safe_neon.py              # dry-run (default — safe to run)
  python3 r3v4_safe_neon.py --run        # apply changes
  python3 r3v4_safe_neon.py --rollback   # restore latest backup
  python3 r3v4_safe_neon.py --status     # show what would change, exit

Wire.txt protocol: every patch reads before writing. No write without read.
"""

import argparse
import datetime
import enum
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional

# ── Repo root detection ───────────────────────────────────────────────────────

def find_repo_root() -> Path:
    cwd = Path.cwd()
    for p in [cwd, *cwd.parents]:
        if (p / "pnpm-workspace.yaml").exists() or (p / "package.json").exists():
            if (p / "client").is_dir() and (p / "server").is_dir():
                return p
    # fallback: assume ~/Stable
    fallback = Path.home() / "Stable"
    if fallback.is_dir():
        return fallback
    raise RuntimeError(
        "Cannot locate repo root. Run from inside the R3 v4 monorepo, "
        "or cd ~/Stable first."
    )

try:
    REPO = find_repo_root()
except RuntimeError:
    REPO = Path.home() / "Stable"  # will be validated in preflight()

CLIENT    = REPO / "client"
SRC       = CLIENT / "src"
BACKUP_DIR = REPO / ".r3_neon_backups"

# ── Canonical design tokens (SKILLS.md §7 — 2026-04-12) ──────────────────────

ACCENT          = "#a3e635"
ACCENT_DIM      = "rgba(163,230,53,0.12)"
ACCENT_GLOW_MD  = "rgba(163,230,53,0.40)"
ACCENT_GLOW_LG  = "rgba(163,230,53,0.60)"
BG              = "#0a0a0a"
SURFACE         = "#0d0d0d"
BORDER          = "#1c1c1c"
BORDER2         = "#2a2a2a"
TEXT            = "#e5e5e5"
DIM             = "#555555"

# CSS custom properties block — injected into :root
CSS_TOKEN_BLOCK = f"""\
  /* ── r3v4 neon tokens (r3v4_safe_neon.py — {datetime.date.today()}) ── */
  --neon-lime:        {ACCENT};
  --neon-lime-dim:    {ACCENT_DIM};
  --neon-glow-md:     {ACCENT_GLOW_MD};
  --neon-glow-lg:     {ACCENT_GLOW_LG};
  --r3-bg:            {BG};
  --r3-surface:       {SURFACE};
  --r3-border:        {BORDER};
  --r3-border-2:      {BORDER2};
  --r3-text:          {TEXT};
  --r3-dim:           {DIM};
  /* ── end r3v4 neon tokens ── */"""

# Neon utility classes — additive, append to existing stylesheet
NEON_UTILITIES = f"""
/* ── r3v4 neon utility classes (r3v4_safe_neon.py — {datetime.date.today()}) ── */
.neon-panel {{
  background: var(--r3-surface, {SURFACE});
  border: 1px solid var(--r3-border, {BORDER});
}}

.neon-lift {{
  border: 1px solid var(--neon-lime-dim, {ACCENT_DIM});
  box-shadow: 0 0 8px var(--neon-lime-dim, {ACCENT_DIM});
}}

.neon-edge {{
  border-left: 2px solid var(--neon-lime, {ACCENT});
}}

.neon-pulse {{
  animation: r3-neon-pulse 2s ease-in-out infinite;
}}

@keyframes r3-neon-pulse {{
  0%, 100% {{ box-shadow: 0 0 4px var(--neon-glow-md, {ACCENT_GLOW_MD}); }}
  50%        {{ box-shadow: 0 0 14px var(--neon-glow-lg, {ACCENT_GLOW_LG}); }}
}}
/* ── end neon utilities ── */
"""

# Tailwind extend block — merged into theme.extend.colors
TAILWIND_COLORS = f"""
        neonLime: "{ACCENT}",
        neonLimeDim: "{ACCENT_DIM}",
        r3Bg: "{BG}",
        r3Surface: "{SURFACE}",
        r3Border: "{BORDER}",
        r3Text: "{TEXT}",
        r3Dim: "{DIM}","""

TAILWIND_SENTINEL = "/* r3-neon-tokens */"

# ── Status enum ───────────────────────────────────────────────────────────────

class PatchStatus(enum.Enum):
    APPLIED          = "applied"           # changes were written
    ALREADY_APPLIED  = "already_applied"   # sentinel detected — no-op
    NOT_FOUND        = "not_found"         # target file missing
    DRY_RUN          = "dry_run"           # would apply, but --run not set

# ── Helpers ───────────────────────────────────────────────────────────────────

def _read(path: Path) -> Optional[str]:
    try:
        return path.read_text(encoding="utf-8")
    except (FileNotFoundError, PermissionError):
        return None

def _write(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")

def _log(prefix: str, msg: str, color: str = "") -> None:
    RESET = "\033[0m"
    colors = {"green": "\033[32m", "yellow": "\033[33m",
              "red": "\033[31m", "cyan": "\033[36m", "dim": "\033[2m"}
    c = colors.get(color, "")
    print(f"{c}[{prefix}]{RESET} {msg}")

def ok(msg):  _log("  OK", msg, "green")
def skip(msg):_log("SKIP", msg, "dim")
def warn(msg):_log("WARN", msg, "yellow")
def err(msg): _log(" ERR", msg, "red")
def info(msg):_log("INFO", msg, "cyan")

# ── Backup ────────────────────────────────────────────────────────────────────

def create_backup(files_to_backup: list[Path]) -> Path:
    """Snapshot only the files that will actually change."""
    stamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    snap = BACKUP_DIR / stamp
    snap.mkdir(parents=True, exist_ok=True)
    manifest = []
    for src in files_to_backup:
        if src.exists():
            rel = src.relative_to(REPO)
            dest = snap / str(rel).replace("/", "_")
            shutil.copy2(src, dest)
            manifest.append({"src": str(src), "dest": str(dest)})
    (snap / "manifest.json").write_text(
        json.dumps(manifest, indent=2), encoding="utf-8"
    )
    return snap

def rollback_latest() -> None:
    if not BACKUP_DIR.exists() or not any(BACKUP_DIR.iterdir()):
        err("No backups found in .r3_neon_backups/")
        sys.exit(1)
    latest = sorted(BACKUP_DIR.iterdir())[-1]
    manifest_path = latest / "manifest.json"
    if not manifest_path.exists():
        err(f"Backup manifest missing in {latest}")
        sys.exit(1)
    manifest = json.loads(manifest_path.read_text())
    if not manifest:
        warn("Manifest is empty — nothing to restore.")
        return
    for entry in manifest:
        shutil.copy2(entry["dest"], entry["src"])
        ok(f"Restored {entry['src']}")
    info(f"Rollback complete from snapshot: {latest.name}")

# ── Patch functions ───────────────────────────────────────────────────────────

SENTINEL_CSS = "r3v4 neon tokens"

def patch_theme_css(dry_run: bool) -> tuple[PatchStatus, Optional[Path]]:
    """
    Inject CSS custom properties into the first :root {} block found.
    Searches common locations; returns (status, path_modified).
    """
    candidates = [
        SRC / "styles" / "globals.css",
        SRC / "styles" / "theme.css",
        SRC / "index.css",
        CLIENT / "src" / "globals.css",
        CLIENT / "globals.css",
    ]
    target: Optional[Path] = None
    for c in candidates:
        if c.exists():
            target = c
            break

    if target is None:
        warn("No CSS file found in expected locations — skipping CSS token patch.")
        warn("Expected one of: src/styles/globals.css, src/styles/theme.css, src/index.css")
        return PatchStatus.NOT_FOUND, None

    content = _read(target)
    if content is None:
        return PatchStatus.NOT_FOUND, None

    # Idempotency check
    if SENTINEL_CSS in content:
        skip(f"CSS tokens already present in {target.relative_to(REPO)}")
        return PatchStatus.ALREADY_APPLIED, target

    # Find :root { ... } block and inject before closing brace
    root_pattern = re.compile(r"(:root\s*\{)([^}]*?)(\})", re.DOTALL)
    match = root_pattern.search(content)

    if match:
        # Inject inside existing :root block
        new_block = match.group(1) + "\n" + CSS_TOKEN_BLOCK + "\n" + match.group(2) + match.group(3)
        patched = content[:match.start()] + new_block + content[match.end():]
    else:
        # Prepend a new :root block
        patched = f":root {{\n{CSS_TOKEN_BLOCK}\n}}\n\n" + content

    if dry_run:
        info(f"DRY-RUN: Would inject CSS tokens into {target.relative_to(REPO)}")
        return PatchStatus.DRY_RUN, target

    _write(target, patched)
    ok(f"CSS tokens injected → {target.relative_to(REPO)}")
    return PatchStatus.APPLIED, target


def patch_neon_utilities(dry_run: bool) -> tuple[PatchStatus, Optional[Path]]:
    """
    Append neon utility classes to the CSS file that received the token injection,
    or to a dedicated neon-utils.css if globals.css is already patched.
    """
    candidates = [
        SRC / "styles" / "globals.css",
        SRC / "styles" / "theme.css",
        SRC / "index.css",
        CLIENT / "src" / "globals.css",
    ]
    target: Optional[Path] = None
    for c in candidates:
        if c.exists():
            target = c
            break

    # Fallback: create neon-utils.css alongside globals
    if target is None:
        styles_dir = SRC / "styles"
        styles_dir.mkdir(parents=True, exist_ok=True)
        target = styles_dir / "neon-utils.css"

    content = _read(target) or ""

    SENTINEL_UTIL = "r3v4 neon utility classes"
    if SENTINEL_UTIL in content:
        skip(f"Neon utilities already present in {target.relative_to(REPO)}")
        return PatchStatus.ALREADY_APPLIED, target

    if dry_run:
        info(f"DRY-RUN: Would append neon utilities to {target.relative_to(REPO)}")
        return PatchStatus.DRY_RUN, target

    _write(target, content + NEON_UTILITIES)
    ok(f"Neon utilities appended → {target.relative_to(REPO)}")
    return PatchStatus.APPLIED, target


def patch_tailwind_config(dry_run: bool) -> tuple[PatchStatus, Optional[Path]]:
    """
    Extend tailwind.config.ts theme.extend.colors with neon tokens.
    Strategy: locate 'colors:' inside 'extend:' and inject if sentinel absent.
    """
    candidates = [
        CLIENT / "tailwind.config.ts",
        CLIENT / "tailwind.config.js",
        REPO / "tailwind.config.ts",
        REPO / "tailwind.config.js",
    ]
    target: Optional[Path] = None
    for c in candidates:
        if c.exists():
            target = c
            break

    if target is None:
        warn("tailwind.config.ts not found — skipping Tailwind token patch.")
        return PatchStatus.NOT_FOUND, None

    content = _read(target)
    if content is None:
        return PatchStatus.NOT_FOUND, None

    # Idempotency
    if TAILWIND_SENTINEL in content or "neonLime" in content:
        skip(f"Tailwind neon tokens already present in {target.relative_to(REPO)}")
        return PatchStatus.ALREADY_APPLIED, target

    # Strategy A: find colors: { inside extend: { and inject
    # Matches: colors: { (with optional existing content before closing })
    extend_colors_pattern = re.compile(
        r"(extend\s*:\s*\{[^}]*colors\s*:\s*\{)([^}]*?)(\})",
        re.DOTALL
    )
    match = extend_colors_pattern.search(content)

    if match:
        patched = (
            content[:match.start(1)]
            + match.group(1)
            + "\n" + TAILWIND_SENTINEL
            + TAILWIND_COLORS
            + match.group(2)
            + match.group(3)
            + content[match.end(3):]
        )
    else:
        # Strategy B: find extend: { and inject a colors block
        extend_pattern = re.compile(r"(extend\s*:\s*\{)", re.DOTALL)
        match_b = extend_pattern.search(content)
        if match_b:
            injection = (
                f"\n      colors: {{\n        {TAILWIND_SENTINEL}\n"
                + TAILWIND_COLORS
                + "\n      }},"
            )
            patched = (
                content[:match_b.end()]
                + injection
                + content[match_b.end():]
            )
        else:
            warn(
                "Cannot locate 'extend:' in tailwind config — manual addition required.\n"
                f"  Add to theme.extend.colors:\n{TAILWIND_COLORS}"
            )
            return PatchStatus.NOT_FOUND, target

    if dry_run:
        info(f"DRY-RUN: Would extend Tailwind colors in {target.relative_to(REPO)}")
        return PatchStatus.DRY_RUN, target

    _write(target, patched)
    ok(f"Tailwind tokens extended → {target.relative_to(REPO)}")
    return PatchStatus.APPLIED, target


# ── Detect-only: ThemeProvider + ThemeSwitcher ───────────────────────────────

def detect_theme_provider() -> None:
    """
    Verify the ThemeProvider fix is present (documentElement.classList pattern).
    Never modifies. Emit WARN if the pattern is absent — manual review needed.
    """
    theme_files = list(SRC.rglob("*[Tt]heme[Pp]rovider*")) + \
                  list(SRC.rglob("*[Tt]heme[Cc]ontext*"))

    if not theme_files:
        warn("No ThemeProvider file found — confirm location manually.")
        return

    PATTERNS = [
        r"documentElement\.classList",
        r"document\.documentElement\s*;[\s\S]{0,60}\.classList",
        r"root\.classList\.(add|remove|toggle)",
    ]
    found_in = []
    for f in theme_files:
        text = _read(f) or ""
        if any(re.search(p, text) for p in PATTERNS):
            found_in.append(f)

    if found_in:
        for f in found_in:
            ok(f"ThemeProvider fix confirmed → {f.relative_to(REPO)}")
    else:
        warn("ThemeProvider does NOT contain documentElement.classList pattern.")
        warn("  This may regress the ThemeProvider crash fixed in early April.")
        warn("  Files checked: " + ", ".join(str(f.relative_to(REPO)) for f in theme_files))
        warn("  Required pattern: root = document.documentElement; root.classList.remove/add(theme)")


def detect_theme_switcher() -> None:
    """
    Detect ThemeSwitcher component. Report whether it uses the correct DOM-class
    effect or still relies on Tailwind 'dark:' classes only.
    """
    switcher_files = list(SRC.rglob("*[Tt]heme[Ss]witcher*"))
    if not switcher_files:
        skip("No ThemeSwitcher file found — skipping switcher detection.")
        return

    for f in switcher_files:
        text = _read(f) or ""
        if "documentElement" in text or "classList" in text:
            ok(f"ThemeSwitcher uses DOM-class effect → {f.relative_to(REPO)}")
        else:
            warn(f"ThemeSwitcher may rely on Tailwind-only dark: classes → {f.relative_to(REPO)}")
            warn("  Ensure it calls: document.documentElement.classList.add/remove(theme)")


# ── TSC verification ──────────────────────────────────────────────────────────

def run_tsc() -> bool:
    info("Running pnpm tsc --noEmit …")
    result = subprocess.run(
        ["pnpm", "tsc", "--noEmit"],
        cwd=REPO,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        ok("TSC: 0 errors ✅")
        return True
    else:
        err("TSC errors detected after patch:")
        print(result.stdout[-2000:] if len(result.stdout) > 2000 else result.stdout)
        return False


# ── Preflight ─────────────────────────────────────────────────────────────────

def preflight() -> bool:
    info(f"Repo root: {REPO}")
    info(f"Client:    {CLIENT}")

    if not CLIENT.is_dir():
        err(f"client/ directory not found at {CLIENT}")
        return False

    # Verify SRC exists
    if not SRC.is_dir():
        err(f"client/src/ not found at {SRC}")
        return False

    ok("Repo structure verified")

    # Git status — warn if dirty but don't block
    git_result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=REPO, capture_output=True, text=True
    )
    if git_result.returncode == 0:
        dirty = [l for l in git_result.stdout.splitlines()
                 if not l.strip().startswith("??")]
        if dirty:
            warn(f"{len(dirty)} uncommitted change(s) in working tree — proceed with care.")
        else:
            ok("Working tree clean")
    else:
        warn("git status check failed — not a git repo or git unavailable.")

    return True


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="r3v4_safe_neon.py — Surgical neon token patch"
    )
    parser.add_argument(
        "--run", action="store_true",
        help="Apply patches (default is dry-run)"
    )
    parser.add_argument(
        "--rollback", action="store_true",
        help="Restore files from latest backup snapshot"
    )
    parser.add_argument(
        "--status", action="store_true",
        help="Show what would change and exit (alias for dry-run)"
    )
    parser.add_argument(
        "--skip-tsc", action="store_true",
        help="Skip post-patch TSC verification (faster, less safe)"
    )
    args = parser.parse_args()

    # ── Rollback branch ───────────────────────────────────────────────────────
    if args.rollback:
        rollback_latest()
        return

    dry_run = not args.run  # default is dry-run

    print()
    print("══════════════════════════════════════════════════════")
    print("  r3v4_safe_neon.py — R3 v4 Neon Token Patch")
    print(f"  Mode: {'DRY-RUN (pass --run to apply)' if dry_run else 'APPLY'}")
    print(f"  Accent: {ACCENT} (SKILLS.md §7 canonical)")
    print("══════════════════════════════════════════════════════")
    print()

    # ── Preflight ─────────────────────────────────────────────────────────────
    if not preflight():
        sys.exit(1)
    print()

    # ── Phase 0: Pre-scan — detect what will change (always dry) ─────────────
    info("Pre-scan: detecting pending changes …")
    pre_css,  pre_css_path  = patch_theme_css(dry_run=True)
    pre_util, pre_util_path = patch_neon_utilities(dry_run=True)
    pre_tw,   pre_tw_path   = patch_tailwind_config(dry_run=True)

    pending_paths: list[Path] = list({
        p for s, p in [
            (pre_css, pre_css_path),
            (pre_util, pre_util_path),
            (pre_tw, pre_tw_path),
        ]
        if s == PatchStatus.DRY_RUN and p is not None
    })

    # ── Backup BEFORE any writes — only if changes are pending ───────────────
    if not dry_run and pending_paths:
        snap = create_backup(pending_paths)
        ok(f"Pre-apply backup → {snap.relative_to(REPO)}")
        ok(f"Rollback: python3 r3v4_safe_neon.py --rollback")
        print()

    # ── Apply (or dry-run report) ─────────────────────────────────────────────
    info("Phase 1 — CSS custom properties")
    css_status, css_path = patch_theme_css(dry_run)

    print()
    info("Phase 2 — Neon utility classes")
    util_status, util_path = patch_neon_utilities(dry_run)

    print()
    info("Phase 3 — Tailwind extend tokens")
    tw_status, tw_path = patch_tailwind_config(dry_run)

    print()
    info("Phase 4 — ThemeProvider / Switcher detection (read-only)")
    detect_theme_provider()
    detect_theme_switcher()

    # ── TSC verification (only on actual apply) ────────────────────────────────
    applied = [s for s in [css_status, util_status, tw_status]
               if s == PatchStatus.APPLIED]
    if not dry_run and applied and not args.skip_tsc:
        print()
        tsc_ok = run_tsc()
        if not tsc_ok:
            err("TSC failed after patch — rolling back automatically.")
            rollback_latest()
            sys.exit(1)

    # ── Summary ───────────────────────────────────────────────────────────────
    print()
    print("══════════════════════════════════════════════════════")
    status_map = {
        PatchStatus.APPLIED:         "✅ applied",
        PatchStatus.ALREADY_APPLIED: "⏭  already applied (no-op)",
        PatchStatus.NOT_FOUND:       "⚠️  file not found",
        PatchStatus.DRY_RUN:         "📋 would apply (dry-run)",
    }
    print(f"  CSS tokens:       {status_map[css_status]}")
    print(f"  Neon utilities:   {status_map[util_status]}")
    print(f"  Tailwind extend:  {status_map[tw_status]}")
    print()
    if dry_run:
        print("  Pass --run to apply changes.")
    elif not applied:
        print("  All patches already applied — repo is up to date.")
    else:
        print("  Patch complete. Commit with:")
        print("    git add -p && git commit -m 'feat: add neon CSS tokens + utilities'")
    print("══════════════════════════════════════════════════════")
    print()


if __name__ == "__main__":
    main()
