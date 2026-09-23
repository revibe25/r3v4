#!/usr/bin/env python3
"""
R3/NATIVE Auth Integration Patch — WIRE.txt Protocol Compliant
================================================================

Applies 5 verified fixes to integrate the R3/NATIVE auth page with R3 v4:

  Fix 1: Add GET /api/health endpoint to server/routes/auth.ts
  Fix 2: Rename authStore.login() param: email → credential (2 sites)
  Fix 3: Ensure vite.config.ts has /api proxy → :3000
  Fix 4: Create .env.local with VITE_API_URL=http://localhost:3000
  Fix 5: Add .env.local to .gitignore (if missing)

Design Principles (WIRE.txt §Read-before-Write):
  - Anchor-verified: every mutation asserts the anchor exists exactly once
  - Idempotent: re-runs are safe; already-patched files are skipped
  - Atomic: writes to .tmp then renames (POSIX atomic on same fs)
  - Backup-first: timestamped .bak of every touched file
  - Dry-run default: prints intended changes; --apply required to write
  - Rollback: --rollback restores from most recent .bak
  - TSC gate: refuses to succeed if `tsc --noEmit` fails post-patch
  - Explicit failure: exits non-zero with reason, never silently

Zero-Guess Evidence Anchors (verified against actual source):
  server/routes/auth.ts     : "export default router;"          (unique, line 40+)
  client/src/hooks/authStore.ts:
      Anchor A (signature)  : "login: async (email, password) => {"
      Anchor B (usage)      : "{ credential: email.trim().toLowerCase(), password },"
      Note: 'register' also uses `email` param — NOT touched (different semantics)

Usage:
    python3 apply-auth-integration.py                 # dry-run (default)
    python3 apply-auth-integration.py --apply         # write changes
    python3 apply-auth-integration.py --verify        # check current state
    python3 apply-auth-integration.py --rollback      # restore latest .bak
    python3 apply-auth-integration.py --apply --skip-tsc  # skip TSC gate
    python3 apply-auth-integration.py --apply --repo /path/to/r3v4

Exit codes:
    0  : success (or dry-run completed)
    1  : anchor not found (source differs from expected)
    2  : anchor found multiple times (ambiguous — bailout)
    3  : TSC gate failed
    4  : rollback failed
    5  : environment/prereq failed
    6  : partial apply — some fixes done, some skipped, review needed
"""
from __future__ import annotations

import argparse
import hashlib
import os
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# ─── Constants ────────────────────────────────────────────────────────────────

DEFAULT_REPO = Path("/home/cloud/Projects/r3v4")
STAMP = datetime.now().strftime("%Y%m%d-%H%M%S")
BACKUP_SUFFIX = f".bak-{STAMP}"

# Colors (ANSI) — auto-disabled if not TTY
class C:
    R = "\033[0;31m"  # red
    G = "\033[0;32m"  # green
    Y = "\033[0;33m"  # yellow
    B = "\033[0;34m"  # blue
    M = "\033[0;35m"  # magenta
    CY = "\033[0;36m"  # cyan
    W = "\033[1;37m"  # bright white
    Z = "\033[0m"  # reset

    @classmethod
    def disable(cls) -> None:
        for k in ("R", "G", "Y", "B", "M", "CY", "W", "Z"):
            setattr(cls, k, "")


if not sys.stdout.isatty():
    C.disable()


def log(msg: str, level: str = "INFO") -> None:
    icons = {"INFO": f"{C.B}[·]{C.Z}", "OK": f"{C.G}[✓]{C.Z}",
             "WARN": f"{C.Y}[!]{C.Z}", "ERR": f"{C.R}[✗]{C.Z}",
             "STEP": f"{C.M}[▸]{C.Z}", "SKIP": f"{C.CY}[○]{C.Z}"}
    print(f"{icons.get(level, '[?]')} {msg}", flush=True)


def hr(char: str = "─", width: int = 72) -> None:
    print(f"{C.B}{char * width}{C.Z}")


# ─── Patch results tracking ───────────────────────────────────────────────────

@dataclass
class PatchResult:
    name: str
    file: Path
    applied: bool = False
    skipped: bool = False
    reason: str = ""
    backup: Optional[Path] = None
    sha_before: str = ""
    sha_after: str = ""


@dataclass
class RunReport:
    dry_run: bool
    results: list[PatchResult] = field(default_factory=list)

    def summary(self) -> tuple[int, int, int]:
        applied = sum(1 for r in self.results if r.applied)
        skipped = sum(1 for r in self.results if r.skipped)
        failed = sum(1 for r in self.results if not r.applied and not r.skipped)
        return applied, skipped, failed


# ─── Anchor helpers ───────────────────────────────────────────────────────────

def sha256_of(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def find_unique_anchor(content: str, anchor: str, context: str) -> int:
    """Return line index (0-based) of unique anchor. Exit non-zero if missing/ambiguous."""
    count = content.count(anchor)
    if count == 0:
        log(f"Anchor NOT FOUND in {context}", "ERR")
        log(f"  Expected: {anchor!r}", "ERR")
        sys.exit(1)
    if count > 1:
        log(f"Anchor AMBIGUOUS ({count} matches) in {context}", "ERR")
        log(f"  Widen the anchor with more surrounding context.", "ERR")
        sys.exit(2)
    # Convert byte index to line number for reporting
    idx = content.index(anchor)
    return content[:idx].count("\n")


# ─── Atomic write with backup ─────────────────────────────────────────────────

def atomic_write(path: Path, new_content: str, dry_run: bool) -> Optional[Path]:
    """Backup + atomic replace. Returns backup path (or None if dry-run)."""
    if dry_run:
        return None
    if not path.exists():
        raise FileNotFoundError(path)
    backup = path.with_suffix(path.suffix + BACKUP_SUFFIX)
    shutil.copy2(path, backup)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(new_content, encoding="utf-8")
    os.replace(tmp, path)  # POSIX atomic on same filesystem
    return backup


def show_diff_preview(before: str, after: str, path: Path, max_lines: int = 20) -> None:
    """Show a compact unified-diff preview for user review."""
    import difflib
    diff = list(difflib.unified_diff(
        before.splitlines(keepends=False),
        after.splitlines(keepends=False),
        fromfile=f"a/{path.name}",
        tofile=f"b/{path.name}",
        lineterm="",
        n=2,
    ))
    if not diff:
        log("  (no textual change)", "SKIP")
        return
    for line in diff[:max_lines]:
        if line.startswith("+++") or line.startswith("---"):
            print(f"  {C.W}{line}{C.Z}")
        elif line.startswith("+"):
            print(f"  {C.G}{line}{C.Z}")
        elif line.startswith("-"):
            print(f"  {C.R}{line}{C.Z}")
        elif line.startswith("@@"):
            print(f"  {C.CY}{line}{C.Z}")
        else:
            print(f"  {line}")
    if len(diff) > max_lines:
        print(f"  {C.B}... ({len(diff) - max_lines} more diff lines){C.Z}")


# ─── FIX 1: /api/health endpoint ──────────────────────────────────────────────

HEALTH_ENDPOINT = '''\
// ── GET /api/health ────────────────────────────────────────────────────────
// Simple health check for client-side status monitoring.
// Used by R3/NATIVE auth page to show ONLINE/OFFLINE/DEGRADED status.
// Response: { status: 'ok' | 'degraded', timestamp: number }
//
// NOTE: Mounted under /api/auth (matches this router's mount prefix).
// If your Express app mounts this router at /api/auth, the URL becomes
// /api/auth/health — update the HTML page's healthUrl config accordingly
// OR mount a separate health router at /api/health in server/index.ts.

router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
  });
});

'''

HEALTH_ANCHOR = "export default router;"
HEALTH_SENTINEL = "// ── GET /api/health ─"


def fix_1_health_endpoint(repo: Path, dry_run: bool) -> PatchResult:
    r = PatchResult(name="Fix 1: Add /api/health endpoint",
                    file=repo / "server/routes/auth.ts")
    if not r.file.exists():
        r.reason = f"File not found: {r.file}"
        log(r.reason, "ERR")
        return r

    content = r.file.read_text(encoding="utf-8")
    r.sha_before = sha256_of(content)

    if HEALTH_SENTINEL in content:
        r.skipped = True
        r.reason = "Health endpoint already present (sentinel found)"
        log(r.reason, "SKIP")
        return r

    line_num = find_unique_anchor(content, HEALTH_ANCHOR, str(r.file))
    log(f"  Anchor found at line {line_num + 1}", "OK")

    new_content = content.replace(HEALTH_ANCHOR, HEALTH_ENDPOINT + HEALTH_ANCHOR, 1)
    r.sha_after = sha256_of(new_content)

    if dry_run:
        show_diff_preview(content, new_content, r.file)
        r.applied = True
        r.reason = "Would insert /health endpoint before 'export default router;'"
        return r

    r.backup = atomic_write(r.file, new_content, dry_run)
    r.applied = True
    r.reason = f"Inserted /health endpoint; backup: {r.backup.name if r.backup else '-'}"
    log(r.reason, "OK")
    return r


# ─── FIX 2: authStore.login() email → credential ──────────────────────────────

LOGIN_SIG_OLD = "login: async (email, password) => {"
LOGIN_SIG_NEW = "login: async (credential, password) => {"

LOGIN_BODY_OLD = "{ credential: email.trim().toLowerCase(), password },"
LOGIN_BODY_NEW = "{ credential: credential.trim().toLowerCase(), password },"

LOGIN_INTERFACE_OLD = "login:       (email: string, password: string) => Promise<void>;"
LOGIN_INTERFACE_NEW = "login:       (credential: string, password: string) => Promise<void>;"


def fix_2_rename_login_param(repo: Path, dry_run: bool) -> PatchResult:
    r = PatchResult(name="Fix 2: Rename authStore.login() param email → credential",
                    file=repo / "client/src/hooks/authStore.ts")
    if not r.file.exists():
        r.reason = f"File not found: {r.file}"
        log(r.reason, "ERR")
        return r

    content = r.file.read_text(encoding="utf-8")
    r.sha_before = sha256_of(content)

    # Idempotency check: already patched?
    already_sig  = LOGIN_SIG_NEW in content and LOGIN_SIG_OLD not in content
    already_body = LOGIN_BODY_NEW in content and LOGIN_BODY_OLD not in content
    if already_sig and already_body:
        r.skipped = True
        r.reason = "Both anchors already renamed"
        log(r.reason, "SKIP")
        return r

    # Verify anchors present exactly once (if not already patched)
    changes = 0
    new_content = content

    if not already_sig:
        find_unique_anchor(new_content, LOGIN_SIG_OLD, "authStore.ts (signature)")
        new_content = new_content.replace(LOGIN_SIG_OLD, LOGIN_SIG_NEW, 1)
        changes += 1
        log("  Signature anchor patched", "OK")

    if not already_body:
        find_unique_anchor(new_content, LOGIN_BODY_OLD, "authStore.ts (body)")
        new_content = new_content.replace(LOGIN_BODY_OLD, LOGIN_BODY_NEW, 1)
        changes += 1
        log("  Body anchor patched", "OK")

    # Also update interface declaration (optional but good hygiene)
    if LOGIN_INTERFACE_OLD in new_content:
        new_content = new_content.replace(LOGIN_INTERFACE_OLD, LOGIN_INTERFACE_NEW, 1)
        changes += 1
        log("  Interface signature patched", "OK")

    r.sha_after = sha256_of(new_content)

    if dry_run:
        show_diff_preview(content, new_content, r.file)
        r.applied = True
        r.reason = f"Would patch {changes} anchor(s)"
        return r

    r.backup = atomic_write(r.file, new_content, dry_run)
    r.applied = True
    r.reason = f"Patched {changes} anchor(s); backup: {r.backup.name if r.backup else '-'}"
    log(r.reason, "OK")
    return r


# ─── FIX 3: vite.config.ts /api proxy ─────────────────────────────────────────

VITE_PROXY_SNIPPET = '''\
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
'''


def fix_3_vite_proxy(repo: Path, dry_run: bool) -> PatchResult:
    r = PatchResult(name="Fix 3: Verify vite.config.ts /api proxy",
                    file=repo / "vite.config.ts")

    # vite.config may live at repo root OR client/
    if not r.file.exists():
        alt = repo / "client/vite.config.ts"
        if alt.exists():
            r.file = alt

    if not r.file.exists():
        r.reason = "vite.config.ts not found at repo root or client/ — MANUAL ACTION"
        log(r.reason, "WARN")
        log("  Add proxy config manually. Snippet:", "WARN")
        for line in VITE_PROXY_SNIPPET.strip().splitlines():
            print(f"    {C.Y}{line}{C.Z}")
        r.skipped = True
        return r

    content = r.file.read_text(encoding="utf-8")
    r.sha_before = sha256_of(content)

    # Detect existing proxy config
    has_proxy = re.search(r"proxy\s*:\s*\{", content) is not None
    has_api = "'/api'" in content or '"/api"' in content

    if has_proxy and has_api:
        r.skipped = True
        r.reason = "Proxy config already present for /api"
        log(r.reason, "OK")
        return r

    r.skipped = True
    r.reason = "vite.config.ts exists but /api proxy missing — MANUAL EDIT REQUIRED"
    log(r.reason, "WARN")
    log("  Add this block inside defineConfig({...}):", "WARN")
    for line in VITE_PROXY_SNIPPET.strip().splitlines():
        print(f"    {C.Y}{line}{C.Z}")
    log("  (Not auto-patched — vite.config structure varies too much for a safe anchor.)",
        "WARN")
    return r


# ─── FIX 4: .env.local ────────────────────────────────────────────────────────

ENV_LOCAL_CONTENT = """\
# Auto-generated by apply-auth-integration.py
# Backend API URL for authStore.ts and R3/NATIVE auth page (dev)
VITE_API_URL=http://localhost:3000
"""


def fix_4_env_local(repo: Path, dry_run: bool) -> PatchResult:
    r = PatchResult(name="Fix 4: Create .env.local (dev environment)",
                    file=repo / ".env.local")

    if r.file.exists():
        existing = r.file.read_text(encoding="utf-8")
        if "VITE_API_URL" in existing:
            r.skipped = True
            r.reason = ".env.local already sets VITE_API_URL"
            log(r.reason, "SKIP")
            return r
        # Append instead of overwrite
        if dry_run:
            log("  Would append VITE_API_URL to existing .env.local", "INFO")
            r.applied = True
            r.reason = "Would append (dry-run)"
            return r
        with r.file.open("a", encoding="utf-8") as f:
            f.write("\n" + ENV_LOCAL_CONTENT)
        r.applied = True
        r.reason = "Appended VITE_API_URL to existing .env.local"
        log(r.reason, "OK")
        return r

    if dry_run:
        log(f"  Would create {r.file} with VITE_API_URL=http://localhost:3000", "INFO")
        r.applied = True
        r.reason = "Would create (dry-run)"
        return r

    r.file.write_text(ENV_LOCAL_CONTENT, encoding="utf-8")
    r.applied = True
    r.reason = f"Created {r.file.name}"
    log(r.reason, "OK")
    return r


# ─── FIX 5: .gitignore includes .env.local ────────────────────────────────────

def fix_5_gitignore(repo: Path, dry_run: bool) -> PatchResult:
    r = PatchResult(name="Fix 5: Add .env.local to .gitignore",
                    file=repo / ".gitignore")

    if not r.file.exists():
        if dry_run:
            log(f"  Would create {r.file} with .env.local entry", "INFO")
            r.applied = True
            r.reason = "Would create (dry-run)"
            return r
        r.file.write_text(".env.local\n", encoding="utf-8")
        r.applied = True
        r.reason = "Created .gitignore with .env.local entry"
        log(r.reason, "OK")
        return r

    content = r.file.read_text(encoding="utf-8")
    r.sha_before = sha256_of(content)

    # Check if .env.local is already gitignored (exact match on a line)
    lines = content.splitlines()
    if any(line.strip() == ".env.local" or line.strip() == "/.env.local" or
           line.strip() == "*.local" for line in lines):
        r.skipped = True
        r.reason = ".env.local already ignored"
        log(r.reason, "SKIP")
        return r

    new_content = content.rstrip("\n") + "\n\n# R3/NATIVE auth integration\n.env.local\n"
    r.sha_after = sha256_of(new_content)

    if dry_run:
        log("  Would append '.env.local' to .gitignore", "INFO")
        r.applied = True
        r.reason = "Would append (dry-run)"
        return r

    r.backup = atomic_write(r.file, new_content, dry_run)
    r.applied = True
    r.reason = f"Appended .env.local; backup: {r.backup.name if r.backup else '-'}"
    log(r.reason, "OK")
    return r


# ─── Verify mode: check current state without changing anything ───────────────

def verify_state(repo: Path) -> int:
    """Return count of remaining issues (0 == fully integrated)."""
    log("Verifying current integration state...", "STEP")
    issues = 0

    # Fix 1
    auth_ts = repo / "server/routes/auth.ts"
    if auth_ts.exists():
        c = auth_ts.read_text()
        if HEALTH_SENTINEL in c:
            log("Fix 1: /api/health endpoint present", "OK")
        else:
            log("Fix 1: /api/health endpoint MISSING", "ERR")
            issues += 1
    else:
        log(f"Fix 1: {auth_ts} not found", "ERR"); issues += 1

    # Fix 2
    store_ts = repo / "client/src/hooks/authStore.ts"
    if store_ts.exists():
        c = store_ts.read_text()
        sig_ok  = LOGIN_SIG_NEW in c and LOGIN_SIG_OLD not in c
        body_ok = LOGIN_BODY_NEW in c and LOGIN_BODY_OLD not in c
        if sig_ok and body_ok:
            log("Fix 2: authStore.login() uses `credential` param", "OK")
        else:
            log(f"Fix 2: authStore.login() param NOT renamed (sig={sig_ok}, body={body_ok})",
                "ERR"); issues += 1
    else:
        log(f"Fix 2: {store_ts} not found", "ERR"); issues += 1

    # Fix 3
    vite = repo / "vite.config.ts"
    if not vite.exists():
        vite = repo / "client/vite.config.ts"
    if vite.exists():
        c = vite.read_text()
        if re.search(r"proxy\s*:\s*\{", c) and ("'/api'" in c or '"/api"' in c):
            log("Fix 3: vite.config.ts has /api proxy", "OK")
        else:
            log("Fix 3: vite.config.ts missing /api proxy — MANUAL", "WARN")
            issues += 1
    else:
        log("Fix 3: vite.config.ts not found — MANUAL", "WARN"); issues += 1

    # Fix 4
    env = repo / ".env.local"
    if env.exists() and "VITE_API_URL" in env.read_text():
        log("Fix 4: .env.local sets VITE_API_URL", "OK")
    else:
        log("Fix 4: .env.local missing VITE_API_URL", "ERR"); issues += 1

    # Fix 5
    gi = repo / ".gitignore"
    if gi.exists():
        lines = gi.read_text().splitlines()
        if any(l.strip() in (".env.local", "/.env.local", "*.local") for l in lines):
            log("Fix 5: .env.local is gitignored", "OK")
        else:
            log("Fix 5: .env.local NOT in .gitignore", "WARN"); issues += 1
    else:
        log("Fix 5: .gitignore missing", "WARN"); issues += 1

    hr()
    if issues == 0:
        log("Integration state: FULLY PATCHED ✓", "OK")
    else:
        log(f"Integration state: {issues} issue(s) remaining", "WARN")
    return issues


# ─── Rollback: restore latest .bak files ──────────────────────────────────────

def rollback_all(repo: Path) -> int:
    """Restore every file with a .bak-* sibling to the most recent backup."""
    log("Scanning for backup files...", "STEP")
    targets = list(repo.rglob("*.bak-*"))
    if not targets:
        log("No backup files found — nothing to rollback", "WARN")
        return 4

    # Group by original path (strip .bak-TIMESTAMP)
    from collections import defaultdict
    groups: dict[Path, list[Path]] = defaultdict(list)
    pattern = re.compile(r"\.bak-\d{8}-\d{6}$")
    for bak in targets:
        m = pattern.search(str(bak))
        if not m:
            continue
        original = Path(str(bak)[:m.start()])
        groups[original].append(bak)

    restored = 0
    for original, baks in groups.items():
        # Pick most recent by timestamp in filename
        latest = max(baks, key=lambda p: p.name)
        log(f"Restoring {original.name} from {latest.name}", "INFO")
        shutil.copy2(latest, original)
        restored += 1

    log(f"Rolled back {restored} file(s)", "OK")
    return 0


# ─── TSC gate ─────────────────────────────────────────────────────────────────

def run_tsc_gate(repo: Path) -> bool:
    """Return True if TSC passes (or is skipped due to no tsconfig)."""
    tsconfig = repo / "tsconfig.json"
    if not tsconfig.exists():
        log("No tsconfig.json — skipping TSC gate", "SKIP")
        return True

    log("Running TSC gate (tsc --noEmit)...", "STEP")
    for cmd in (["pnpm", "exec", "tsc", "--noEmit"],
                ["npx", "tsc", "--noEmit"],
                ["tsc", "--noEmit"]):
        try:
            result = subprocess.run(cmd, cwd=repo, capture_output=True,
                                    text=True, timeout=120)
            if result.returncode == 0:
                log("TSC gate PASSED", "OK")
                return True
            log(f"TSC gate FAILED (via {cmd[0]}):", "ERR")
            print(result.stdout[-2000:])
            print(result.stderr[-2000:])
            return False
        except FileNotFoundError:
            continue
        except subprocess.TimeoutExpired:
            log(f"TSC gate TIMEOUT (via {cmd[0]}) after 120s", "ERR")
            return False

    log("No TSC runner found (pnpm/npx/tsc) — skipping gate", "WARN")
    return True


# ─── Main ─────────────────────────────────────────────────────────────────────

def print_report(report: RunReport) -> None:
    hr("═")
    applied, skipped, failed = report.summary()
    mode = "DRY-RUN" if report.dry_run else "APPLIED"
    log(f"RUN REPORT ({mode}): {applied} applied, {skipped} skipped, {failed} failed",
        "STEP")
    hr()
    for r in report.results:
        status = "OK" if r.applied else ("SKIP" if r.skipped else "ERR")
        log(f"{r.name}", status)
        log(f"  → {r.reason}", "INFO")
        if r.backup:
            log(f"  → backup: {r.backup}", "INFO")
    hr("═")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="R3/NATIVE Auth Integration Patch",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--repo", type=Path, default=DEFAULT_REPO,
                        help=f"Repo root (default: {DEFAULT_REPO})")
    parser.add_argument("--apply", action="store_true",
                        help="Actually write changes (default: dry-run)")
    parser.add_argument("--verify", action="store_true",
                        help="Check current state, no changes")
    parser.add_argument("--rollback", action="store_true",
                        help="Restore latest backups")
    parser.add_argument("--skip-tsc", action="store_true",
                        help="Skip TSC gate after apply")
    args = parser.parse_args()

    repo: Path = args.repo.resolve()

    hr("═")
    log(f"R3/NATIVE Auth Integration Patch — {STAMP}", "STEP")
    log(f"Repo: {repo}", "INFO")
    if not repo.exists():
        log(f"Repo not found: {repo}", "ERR")
        return 5
    hr("═")

    # Rollback mode
    if args.rollback:
        return rollback_all(repo)

    # Verify mode
    if args.verify:
        return 0 if verify_state(repo) == 0 else 6

    # Dry-run vs apply
    dry_run = not args.apply
    if dry_run:
        log("DRY-RUN mode — no files will be changed. Pass --apply to write.", "WARN")
    else:
        log("APPLY mode — files WILL be changed. Backups will be created.", "WARN")

    hr()
    report = RunReport(dry_run=dry_run)

    for fixer in (fix_1_health_endpoint, fix_2_rename_login_param,
                  fix_3_vite_proxy, fix_4_env_local, fix_5_gitignore):
        log(f"Running: {fixer.__name__}", "STEP")
        try:
            report.results.append(fixer(repo, dry_run))
        except SystemExit:
            raise
        except Exception as e:
            log(f"Unexpected error in {fixer.__name__}: {e}", "ERR")
            r = PatchResult(name=fixer.__name__, file=Path("?"))
            r.reason = f"exception: {e}"
            report.results.append(r)
        print()

    print_report(report)

    # TSC gate (only if we actually applied, and touched a .ts file)
    touched_ts = any(r.applied and r.file.suffix in (".ts", ".tsx")
                     for r in report.results if not r.skipped)
    if not dry_run and touched_ts and not args.skip_tsc:
        if not run_tsc_gate(repo):
            log("TSC gate failed — consider --rollback", "ERR")
            return 3

    applied, skipped, failed = report.summary()
    if failed > 0:
        return 6
    hr("═")
    if dry_run:
        log("Dry-run complete. Re-run with --apply to write changes.", "OK")
    else:
        log(f"Integration complete: {applied} applied, {skipped} skipped.", "OK")
        log("Next: verify server + client boot, test login end-to-end.", "INFO")
    hr("═")
    return 0


if __name__ == "__main__":
    sys.exit(main())
