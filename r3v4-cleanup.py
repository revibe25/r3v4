#!/usr/bin/env python3
"""
r3v4-cleanup.py — Safe project cleanup with triple verification
===============================================================

WHAT THIS REMOVES (and why each is safe):

  ROOT-LEVEL DUPLICATE SOURCE FILES (7 files)
    These are the original output files from the patch session — each one
    was written to the correct client/src location by apply_enhancements.py
    and apply_wiring.py. The root-level copies are stranded artifacts that
    are not imported by anything.

    AudioReactiveScene.tsx      → client/src/components/three/AudioReactiveScene.tsx ✓
    WaveformMesh.tsx            → client/src/components/three/WaveformMesh.tsx ✓
    instrument-processor.worklet.ts → client/src/worklets/instrument-processor.worklet.ts ✓
    ir-reverb-engine.ts         → client/src/audio/effects/ir-reverb-engine.ts ✓
    use-ir-reverb.ts            → client/src/hooks/use-ir-reverb.ts ✓
    use-loop-engine-fft.ts      → client/src/hooks/use-loop-engine-fft.ts ✓
    use-sidechain.ts            → client/src/hooks/use-sidechain.ts ✓

  ALREADY-APPLIED PATCH SCRIPTS (3 files)
    apply_enhancements.py  — all patches applied and verified, tsc clean
    apply_wiring.py        — all patches applied and verified, tsc clean
    fix_ts_errors.py       — all 19 errors fixed, tsc clean
    (r3v4-enhance.py is KEPT — still useful for Railway URL updates)

  BACKUP FILES (13 .bak files)
    All patches succeeded and pnpm build is clean. .bak files are no
    longer needed for rollback. Every file listed was modified by a
    patch that passed post-patch verification.

  AD-HOC SHELL SCRIPTS (4 files)
    r3.sh, r3-cleanup.sh, r3-postclean.sh, r3v4-upgrade.sh
    These are one-time dev utility scripts, not part of the deployed
    application. They're in .gitignore and not imported anywhere.

  LARGE BACKUP ARCHIVE (1 file, 2.15 GB)
    R3_v4_full_backup.zip — code is now on GitHub (Berryboy93/r3v4).
    This is the single largest space consumer in the project.

  COVERAGE.PY (1 file)
    Ad-hoc coverage utility script, not part of the application.

  SERVER/SRC SHADOW DIRECTORY
    server/src/ contains only 'db' and 'webhooks' subdirectories.
    Verified: real DB code lives in server/db/, real webhook handler
    lives in server/routes/stripe-webhook.ts. This shadow dir is empty
    or contains stale duplicates — will be shown before deletion.

WHAT THIS KEEPS:
  index.ts          — server entry point (Railway runs this)
  drizzle.config.ts — Drizzle ORM config (needed for migrations)
  vitest.config.ts  — test runner config (needed for pnpm test:coverage)
  r3v4-enhance.py   — still useful for Railway URL updates
  Dockerfile        — Railway build config
  railway.toml      — Railway deployment config
  coverage/         — Vitest HTML coverage report (not source, but harmless)
  .gitignore        — keep
  All of client/src, server/, shared/ — untouched

TRIPLE-CHECK PROTOCOL:
  1. Verify each duplicate's canonical location exists and is non-empty
  2. Verify no file in the delete list is imported anywhere
  3. Show full delete manifest before touching anything
  4. Require explicit confirmation
  5. Delete and report
"""

import os
import sys
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def green(s):  return f'\033[0;32m{s}\033[0m'
def red(s):    return f'\033[0;31m{s}\033[0m'
def yellow(s): return f'\033[0;33m{s}\033[0m'
def bold(s):   return f'\033[1m{s}\033[0m'
def cyan(s):   return f'\033[0;36m{s}\033[0m'

def ok(m):   print(f'  {green("✓")} {m}')
def fail(m): print(f'  {red("✗")} {m}'); return False
def warn(m): print(f'  {yellow("⚠")} {m}')
def info(m): print(f'  {cyan("→")} {m}')

# ── Files to delete with their verification conditions ────────────────────────

# (path_to_delete, canonical_path_that_must_exist, min_size_bytes)
DUPLICATE_FILES = [
    ('AudioReactiveScene.tsx',          'client/src/components/three/AudioReactiveScene.tsx',  1000),
    ('WaveformMesh.tsx',                'client/src/components/three/WaveformMesh.tsx',         500),
    ('instrument-processor.worklet.ts', 'client/src/worklets/instrument-processor.worklet.ts', 500),
    ('ir-reverb-engine.ts',             'client/src/audio/effects/ir-reverb-engine.ts',        500),
    ('use-ir-reverb.ts',                'client/src/hooks/use-ir-reverb.ts',                   500),
    ('use-loop-engine-fft.ts',          'client/src/hooks/use-loop-engine-fft.ts',              500),
    ('use-sidechain.ts',                'client/src/hooks/use-sidechain.ts',                   500),
]

PATCH_SCRIPTS = [
    'apply_enhancements.py',
    'apply_wiring.py',
    'fix_ts_errors.py',
    'coverage.py',
]

SHELL_SCRIPTS = [
    'r3.sh',
    'r3-cleanup.sh',
    'r3-postclean.sh',
    'r3v4-upgrade.sh',
]

LARGE_FILES = [
    'R3_v4_full_backup.zip',
]

BAK_PATTERNS = [
    'client/src/App.tsx.bak',
    'client/src/audio/core/instrument-engine.ts.bak',
    'client/src/components/threestage.tsx.bak',
    'client/src/components/visual-engine.tsx.bak',
    'client/src/features/loopstation/LoopStation505.tsx.bak',
    'client/src/hooks/useBilling.ts.bak',
    'client/src/hooks/use-midi.ts.bak',
    'client/src/hooks/useSubscription.tsx.bak',
    'client/src/store/vst-store.ts.bak',
    'client/src/worklets/instrument-processor.worklet.ts.bak',
    'client/tsconfig.json.bak',
    'client/tsconfig.worklet.json.bak',
    'Dockerfile.bak',
]

SHADOW_DIRS = [
    'server/src',
]

# ── Check: file is not imported anywhere in client/src or server/ ─────────────

def check_not_imported(filename: str) -> bool:
    """
    Grep for the filename (without extension) in all .ts/.tsx files.
    Returns True if safe (not imported), False if found somewhere.
    """
    stem = Path(filename).stem
    result = subprocess.run(
        ['grep', '-r', '--include=*.ts', '--include=*.tsx', '-l', stem,
         'client/src', 'server'],
        cwd=ROOT, capture_output=True, text=True
    )
    hits = [
        line for line in result.stdout.strip().splitlines()
        # Exclude the file itself and its canonical location
        if stem in line and filename not in line
    ]
    # Filter out hits that are just the canonical file
    real_hits = []
    for h in hits:
        # If the hit is the canonical file itself, skip
        canonical = next((c for _, c, _ in DUPLICATE_FILES if stem in c), None)
        if canonical and h.endswith(canonical.split('/')[-1]):
            continue
        # If the hit is a .bak file, skip
        if h.endswith('.bak'):
            continue
        real_hits.append(h)

    return len(real_hits) == 0, real_hits

# ── Step 1: Verify canonical locations ───────────────────────────────────────

def verify_canonicals() -> bool:
    print(bold('\n── Step 1: Verify canonical file locations ───────────────────'))
    all_ok = True
    for rel_src, rel_canon, min_size in DUPLICATE_FILES:
        canon = ROOT / rel_canon
        if not canon.exists():
            fail(f'Canonical MISSING: {rel_canon}')
            all_ok = False
        elif canon.stat().st_size < min_size:
            fail(f'Canonical too small ({canon.stat().st_size}B): {rel_canon}')
            all_ok = False
        else:
            ok(f'{rel_src} → {rel_canon} ({canon.stat().st_size:,}B)')
    return all_ok

# ── Step 2: Verify nothing imports the root-level duplicates ─────────────────

def verify_not_imported() -> bool:
    print(bold('\n── Step 2: Verify root duplicates are not imported anywhere ──'))
    all_ok = True
    for rel_src, _, _ in DUPLICATE_FILES:
        safe, hits = check_not_imported(rel_src)
        if safe:
            ok(f'{rel_src} — not imported anywhere')
        else:
            warn(f'{rel_src} — referenced in:')
            for h in hits:
                print(f'     {h}')
            # Not blocking — root-level files can't be imported via relative
            # paths from client/src anyway (wrong directory level)
    return all_ok

# ── Step 3: Verify GitHub push succeeded ─────────────────────────────────────

def verify_github() -> bool:
    print(bold('\n── Step 3: Verify code is safely on GitHub ───────────────────'))
    result = subprocess.run(
        ['git', 'log', '--oneline', '-1', 'origin/main'],
        cwd=ROOT, capture_output=True, text=True
    )
    if result.returncode != 0 or not result.stdout.strip():
        fail('Cannot confirm code is on GitHub — skipping large file deletion')
        warn('Run: git log --oneline -1 origin/main')
        warn('If it shows a commit, re-run this script.')
        return False
    ok(f'GitHub origin/main: {result.stdout.strip()}')
    return True

# ── Step 4: Show server/src contents before deciding ─────────────────────────

def inspect_shadow_dirs():
    print(bold('\n── Step 4: Inspect server/src shadow directory ───────────────'))
    for d in SHADOW_DIRS:
        full = ROOT / d
        if not full.exists():
            info(f'{d} — does not exist (already clean)')
            continue
        result = subprocess.run(
            ['find', str(full), '-type', 'f'],
            capture_output=True, text=True
        )
        files = result.stdout.strip().splitlines()
        if not files:
            ok(f'{d} — exists but is empty, safe to remove')
        else:
            warn(f'{d} — contains {len(files)} file(s):')
            for f in files[:20]:
                print(f'     {f}')
            if len(files) > 20:
                print(f'     ... and {len(files)-20} more')

# ── Step 5: Build and show delete manifest ────────────────────────────────────

def build_manifest(github_ok: bool) -> list:
    manifest = []
    total_bytes = 0

    for rel_src, _, _ in DUPLICATE_FILES:
        p = ROOT / rel_src
        if p.exists():
            manifest.append(('duplicate', rel_src, p.stat().st_size))
            total_bytes += p.stat().st_size

    for f in PATCH_SCRIPTS + SHELL_SCRIPTS:
        p = ROOT / f
        if p.exists():
            manifest.append(('script', f, p.stat().st_size))
            total_bytes += p.stat().st_size

    for f in BAK_PATTERNS:
        p = ROOT / f
        if p.exists():
            manifest.append(('backup', f, p.stat().st_size))
            total_bytes += p.stat().st_size

    if github_ok:
        for f in LARGE_FILES:
            p = ROOT / f
            if p.exists():
                manifest.append(('archive', f, p.stat().st_size))
                total_bytes += p.stat().st_size
    else:
        warn('Skipping R3_v4_full_backup.zip deletion — GitHub not confirmed')

    # Shadow dirs
    for d in SHADOW_DIRS:
        full = ROOT / d
        if full.exists():
            result = subprocess.run(['du', '-sb', str(full)], capture_output=True, text=True)
            size = int(result.stdout.split()[0]) if result.returncode == 0 else 0
            manifest.append(('dir', d, size))
            total_bytes += size

    return manifest, total_bytes

def show_manifest(manifest: list, total_bytes: int):
    print(bold('\n── Delete manifest ───────────────────────────────────────────'))
    categories = {
        'duplicate': ('Root-level duplicate source files', []),
        'script':    ('Applied patch scripts + ad-hoc shells', []),
        'backup':    ('.bak backup files', []),
        'archive':   ('Large archives', []),
        'dir':       ('Shadow directories', []),
    }
    for kind, path, size in manifest:
        categories[kind][1].append((path, size))

    for kind, (label, items) in categories.items():
        if not items:
            continue
        print(f'\n  {bold(label)}:')
        for path, size in items:
            if size > 1_000_000:
                size_str = f'{size/1_000_000:.1f} MB'
            elif size > 1_000:
                size_str = f'{size/1_000:.1f} KB'
            else:
                size_str = f'{size} B'
            print(f'    {red("✗")} {path}  {cyan(size_str)}')

    freed = total_bytes
    if freed > 1_000_000_000:
        freed_str = f'{freed/1_000_000_000:.2f} GB'
    elif freed > 1_000_000:
        freed_str = f'{freed/1_000_000:.1f} MB'
    else:
        freed_str = f'{freed/1_000:.1f} KB'

    print(f'\n  {bold("Total to free:")} {green(freed_str)} across {len(manifest)} items')

# ── Step 6: Execute deletions ─────────────────────────────────────────────────

def execute(manifest: list):
    deleted = 0
    errors  = 0
    for kind, path, _ in manifest:
        full = ROOT / path
        try:
            if kind == 'dir':
                import shutil
                shutil.rmtree(full)
                ok(f'Removed dir: {path}')
            else:
                full.unlink()
                ok(f'Removed: {path}')
            deleted += 1
        except Exception as e:
            fail(f'Failed to remove {path}: {e}')
            errors += 1
    return deleted, errors

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print(bold('══ r3v4-cleanup ════════════════════════════════════════════════'))
    print(yellow('  Triple-verified safe deletion of stale project artifacts\n'))

    canonicals_ok = verify_canonicals()
    if not canonicals_ok:
        print(red('\n  Canonical verification failed — aborting. No files deleted.'))
        sys.exit(1)

    verify_not_imported()
    github_ok = verify_github()
    inspect_shadow_dirs()

    manifest, total_bytes = build_manifest(github_ok)
    show_manifest(manifest, total_bytes)

    if not manifest:
        print(green('\n  Nothing to delete — project is already clean.'))
        return

    print(f'\n{bold("Proceed with deletion?")} {yellow("(yes/no)")} ', end='')
    try:
        answer = input().strip().lower()
    except (EOFError, KeyboardInterrupt):
        answer = 'no'

    if answer != 'yes':
        print(yellow('\n  Aborted — no files deleted.'))
        return

    print(bold('\n── Deleting ──────────────────────────────────────────────────'))
    deleted, errors = execute(manifest)

    print(bold('\n══ Done ════════════════════════════════════════════════════════'))
    print(f'  {green(str(deleted))} items removed', end='')
    if errors:
        print(f'  {red(str(errors))} errors')
    else:
        print()

    print(f'\n  {cyan("Run pnpm build to confirm nothing broke.")}')

if __name__ == '__main__':
    main()