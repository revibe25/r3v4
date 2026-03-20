#!/usr/bin/env python3
"""
r3v4-enhance.py — Enhanced comprehensive patch for R3 v4
=========================================================

Improvements over the original script
---------------------------------------
  PRE-FLIGHT VALIDATION
    Every anchor string is verified to exist in its target file before any
    file is touched. If any anchor is missing the script prints exactly which
    string is absent and exits with code 2 — no files are modified.

  ATOMIC ROLLBACK
    All backups are written to a single timestamped directory.
    If any patch step fails after files have been modified, every backed-up
    file is automatically restored and the backup directory is removed.
    The server is never left in a half-patched state.

  EXPORT-DEFAULT GUARD
    Verifies that loops.ts, loopProjects.ts, and midi.ts each contain
    "export default router" before mounting them. If a file only defines
    `const router` without exporting it, the Express mount would silently
    register nothing — no error, just 404s.

  VERCEL URL INJECTION
    Replaces the placeholder "your-backend.railway.app" in client/vercel.json
    with the real Railway domain. Reads from (in priority order):
      1. --railway-url=<domain> CLI argument
      2. RAILWAY_URL environment variable
      3. Interactive prompt (skipped in --non-interactive mode)
    Validates the domain looks like a real hostname before writing.

  DRY-RUN MODE
    python3 r3v4-enhance.py --dry-run
    Prints every change that WOULD be made without touching any file.
    Use this to audit the patch before committing to it.

  NON-INTERACTIVE MODE
    python3 r3v4-enhance.py --non-interactive
    Skips the Railway URL prompt. Use in CI pipelines.

  POST-INSTALL TYPECHECK GATE
    After pnpm install completes, runs pnpm build (tsc) and captures output.
    If tsc exits non-zero, prints the compiler errors and triggers rollback.

  IDEMPOTENCY
    Every patch checks if the NEW string is already present before applying.
    Re-running the script on an already-patched repo is safe — it reports
    "already applied" and exits cleanly.

  19-POINT VERIFICATION
    After all patches, reads every file again and asserts each expected string
    is present. Any missing string triggers rollback and reports the gap.

Changes applied
---------------
  1. index.ts  — add loopStationAuth to existing auth import destructure
  2. index.ts  — add imports: loopRoutes, loopProjectRoutes, midiRoutes,
                  loopStationLimiter, ensureDir
  3. index.ts  — ensure storage dirs inside main() before registerRoutes()
  4. index.ts  — mount loop/loopProject/midi routes at /api before 404 handler
  5. railway.toml — npx tsx → pnpm exec tsx (use local binary, not npx)
  6. package.json — fix --ignore ../client → --ignore ./client (path from root)
  7. package.json — add dev:server, dev:client, unified concurrently dev
  8. package.json — add test:coverage script
  9. package.json — add concurrently devDependency
 10. client/vercel.json — inject real Railway domain (replaces placeholder)
 11. .gitignore — add 8 missing patterns

USAGE
-----
  # Standard run (prompts for Railway URL if not set)
  python3 r3v4-enhance.py

  # Provide Railway URL upfront (no prompt)
  python3 r3v4-enhance.py --railway-url=my-app.railway.app

  # Dry run — shows all changes, touches nothing
  python3 r3v4-enhance.py --dry-run

  # CI / non-interactive (skips Railway URL prompt)
  RAILWAY_URL=my-app.railway.app python3 r3v4-enhance.py --non-interactive
"""

import os
import re
import sys
import shutil
import subprocess
import textwrap
from datetime import datetime
from pathlib import Path

# ── CLI args ──────────────────────────────────────────────────────────────────

ARGS           = sys.argv[1:]
DRY_RUN        = '--dry-run'        in ARGS
NON_INTERACTIVE= '--non-interactive' in ARGS
RAILWAY_URL_ARG= next((a.split('=',1)[1] for a in ARGS if a.startswith('--railway-url=')), None)

# ── Paths ─────────────────────────────────────────────────────────────────────

ROOT    = Path(__file__).resolve().parent
TS      = datetime.now().strftime('%Y%m%d_%H%M%S')
BAK_DIR = ROOT / f'.patch-backup-{TS}'
_backed: set[Path] = set()
_rollback_needed   = False

# ── Colour helpers ────────────────────────────────────────────────────────────

def green(s):  return f'\033[0;32m{s}\033[0m'
def red(s):    return f'\033[0;31m{s}\033[0m'
def yellow(s): return f'\033[0;33m{s}\033[0m'
def cyan(s):   return f'\033[0;36m{s}\033[0m'
def bold(s):   return f'\033[1m{s}\033[0m'

def ok(msg):   print(f'  {green("✓")} {msg}')
def skip(msg): print(f'  {cyan("↷")} {msg}')
def warn(msg): print(f'  {yellow("⚠")} {msg}')
def fail(msg):
    print(f'  {red("✗")} {msg}', file=sys.stderr)

# ── File I/O ──────────────────────────────────────────────────────────────────

def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding='utf-8')

def write(rel: str, content: str) -> None:
    if DRY_RUN:
        ok(f'[dry-run] would write {rel}')
        return
    (ROOT / rel).write_text(content, encoding='utf-8')

def backup_file(rel: str) -> None:
    src = ROOT / rel
    if src in _backed or DRY_RUN:
        return
    BAK_DIR.mkdir(exist_ok=True)
    dst = BAK_DIR / rel.replace('/', '__')
    shutil.copy2(src, dst)
    _backed.add(src)

def rollback() -> None:
    if DRY_RUN or not _backed:
        return
    print(f'\n{red("Rolling back all changes...")}')
    for src in _backed:
        rel  = str(src.relative_to(ROOT)).replace('/', '__')
        bak  = BAK_DIR / rel
        if bak.exists():
            shutil.copy2(bak, src)
            print(f'  restored {src.relative_to(ROOT)}')
    if BAK_DIR.exists():
        shutil.rmtree(BAK_DIR)
    print(red('Rollback complete — no net change to your project.'))

# ── Patch engine ──────────────────────────────────────────────────────────────

def apply_patch(rel: str, old: str, new: str, label: str) -> bool:
    """
    Replace exactly one occurrence of `old` with `new` in `rel`.
    Returns True if changed, False if already applied.
    Exits with code 1 (triggering rollback) if anchor not found.
    """
    content = read(rel)

    if new in content:
        skip(f'{label} — already applied')
        return False

    if old not in content:
        fail(f'{label} — anchor not found in {rel}')
        fail(f'  Expected: {repr(old[:100])}')
        rollback()
        sys.exit(1)

    count = content.count(old)
    if count > 1:
        fail(f'{label} — anchor is not unique ({count} occurrences) in {rel}')
        rollback()
        sys.exit(1)

    if DRY_RUN:
        ok(f'[dry-run] {label}')
        return True

    backup_file(rel)
    updated = content.replace(old, new, 1)
    write(rel, updated)

    # Post-write verify
    if new not in read(rel):
        fail(f'{label} — post-write verification failed')
        rollback()
        sys.exit(1)

    ok(label)
    return True

def append_if_absent(rel: str, text: str, sentinel: str, label: str) -> None:
    content = read(rel)
    if sentinel in content:
        skip(f'{label} — already present')
        return
    if DRY_RUN:
        ok(f'[dry-run] {label}')
        return
    backup_file(rel)
    write(rel, content.rstrip('\n') + '\n' + text)
    ok(label)

# ═══════════════════════════════════════════════════════════════════════════════
# PRE-FLIGHT VALIDATION
# ═══════════════════════════════════════════════════════════════════════════════

# All anchor strings that MUST exist before we touch anything.
# Keyed by (relative_path, anchor_snippet, human_label).
def _either(a: str, b: str) -> tuple:
    """Return (string, label_suffix) for whichever of old/new is present."""
    return (a, b)

# Each entry: (file, old_anchor, new_anchor, label)
# Pre-flight passes if EITHER old OR new is present — supports both fresh and already-patched repos.
REQUIRED_ANCHORS = [
    ('index.ts',
     "import { trpcAuth } from './server/middleware/auth';",
     "import { trpcAuth, loopStationAuth } from './server/middleware/auth';",
     'trpcAuth/loopStationAuth import in index.ts'),

    ('index.ts',
     "import { registerRoutes } from './server/routes';",
     "import { registerRoutes }      from './server/routes';",
     'registerRoutes import in index.ts'),

    ('index.ts',
     "  // Register all REST route handlers.\n"
     "  // registerRoutes() appends to app — must complete before 404/error handlers.\n"
     "  await registerRoutes(httpServer, app);",
     "  await registerRoutes(httpServer, app);",
     'registerRoutes() call in main()'),

    ('index.ts',
     "  // 404 — registered after all routes so it only fires for unmatched paths\n"
     "  app.use((_req, res) => {",
     "  // 404 — registered after all routes so it only fires for unmatched paths\n"
     "  app.use((_req, res) => {",
     '404 handler anchor in main()'),

    ('railway.toml',
     'startCommand = "npx tsx index.ts"',
     'startCommand = "pnpm exec tsx index.ts"',
     'startCommand in railway.toml'),

    ('package.json',
     '"dev": "tsx watch --ignore ../client --ignore ../node_modules index.ts",',
     '"dev:server": "tsx watch --ignore ./client --ignore ./node_modules index.ts",',
     'dev/dev:server script in package.json'),

    ('package.json',
     '"typecheck": "tsc --noEmit"\n  },',
     '"typecheck": "tsc --noEmit",',
     'typecheck script in package.json'),

    ('package.json',
     '    "drizzle-kit": "^0.31.10",',
     '    "drizzle-kit": "^0.31.10",',
     'drizzle-kit in devDependencies'),
]

# Route files must export default router — otherwise Express mount is a no-op
EXPORT_DEFAULT_CHECKS = [
    ('server/routes/loops.ts',        'loops router'),
    ('server/routes/loopProjects.ts', 'loopProjects router'),
    ('server/routes/midi.ts',         'midi router'),
]

def preflight() -> None:
    print(bold('\n── Pre-flight validation ─────────────────────────────────────'))
    errors = 0

    for rel, old_anchor, new_anchor, label in REQUIRED_ANCHORS:
        full = ROOT / rel
        if not full.exists():
            fail(f'File not found: {rel}  ({label})')
            errors += 1
            continue
        text = full.read_text(encoding='utf-8')
        if old_anchor in text or new_anchor in text:
            ok(f'Anchor OK: {label}')
        else:
            fail(f'Anchor missing: {label}')
            fail(f'  File   : {rel}')
            fail(f'  Expected (old): {repr(old_anchor[:80])}')
            fail(f'  Expected (new): {repr(new_anchor[:80])}')
            errors += 1

    for rel, label in EXPORT_DEFAULT_CHECKS:
        full = ROOT / rel
        if not full.exists():
            fail(f'Route file not found: {rel}')
            errors += 1
            continue
        content = full.read_text(encoding='utf-8')
        if 'export default router' not in content:
            fail(f'{rel} is missing "export default router" — Express mount would be a no-op')
            fail(f'  Add "export default router;" at the bottom of {rel}')
            errors += 1
        else:
            ok(f'export default router: {label}')

    if errors:
        print(f'\n{red(f"Pre-flight failed — {errors} issue(s) found. No files modified.")}')
        sys.exit(2)

    print(green('  All pre-flight checks passed.\n'))

# ═══════════════════════════════════════════════════════════════════════════════
# PATCHES
# ═══════════════════════════════════════════════════════════════════════════════

# 1. loopStationAuth added to existing trpcAuth destructure
def patch_auth_import() -> None:
    apply_patch(
        'index.ts',
        "import { trpcAuth } from './server/middleware/auth';",
        "import { trpcAuth, loopStationAuth } from './server/middleware/auth';",
        'add loopStationAuth to auth import',
    )

# 2. New import lines for loop routers + middleware + util
def patch_loop_imports() -> None:
    apply_patch(
        'index.ts',
        "import { registerRoutes } from './server/routes';",
        "import { registerRoutes }      from './server/routes';\n"
        "import loopRoutes              from './server/routes/loops';\n"
        "import loopProjectRoutes       from './server/routes/loopProjects';\n"
        "import midiRoutes              from './server/routes/midi';\n"
        "import { loopStationLimiter }  from './server/middleware/rateLimit';\n"
        "import { ensureDir }           from './server/utils/fileUtils';",
        'add loop routers + rateLimit + ensureDir imports',
    )

# 3. Storage dir init inside main() before registerRoutes
def patch_storage_init() -> None:
    apply_patch(
        'index.ts',
        "  // Register all REST route handlers.\n"
        "  // registerRoutes() appends to app — must complete before 404/error handlers.\n"
        "  await registerRoutes(httpServer, app);",

        "  // ── Loop storage dirs ─────────────────────────────────────────────────────\n"
        "  // Ensure directories exist before route handlers mount.\n"
        "  // safeResolve() in fileUtils.ts resolves relative to LOOP_STORAGE_BASE.\n"
        "  // Warnings are non-fatal — routes fall back to on-demand mkdir per request.\n"
        "  const _storageBase = process.env.LOOP_STORAGE_BASE ?? './server/storage';\n"
        "  await Promise.all([\n"
        "    ensureDir(`${_storageBase}/loops`),\n"
        "    ensureDir(`${_storageBase}/projects`),\n"
        "  ]).catch((e) =>\n"
        "    logger.warn('Loop storage init warning', { error: String(e) }),\n"
        "  );\n"
        "\n"
        "  // Register all REST route handlers.\n"
        "  // registerRoutes() appends to app — must complete before 404/error handlers.\n"
        "  await registerRoutes(httpServer, app);",

        'add storage dir init before registerRoutes()',
    )

# 4. Mount loop/loopProject/midi routes before the 404 handler
def patch_mount_routes() -> None:
    apply_patch(
        'index.ts',
        "  // 404 — registered after all routes so it only fires for unmatched paths\n"
        "  app.use((_req, res) => {",

        "  // ── LoopStation REST routes ────────────────────────────────────────────────\n"
        "  // Rate-limited (loopStationLimiter) + auth-gated (loopStationAuth).\n"
        "  // Mounted at /api — each router defines its own sub-paths:\n"
        "  //   loops.ts        → /save-loop  /loops  /loops/:id\n"
        "  //   loopProjects.ts → /loopproject/save  /loopproject/:id  /loopprojects\n"
        "  //   midi.ts         → /midi/mappings\n"
        "  app.use('/api', loopStationLimiter, loopStationAuth, loopRoutes);\n"
        "  app.use('/api', loopStationLimiter, loopStationAuth, loopProjectRoutes);\n"
        "  app.use('/api', loopStationLimiter, loopStationAuth, midiRoutes);\n"
        "\n"
        "  // 404 — registered after all routes so it only fires for unmatched paths\n"
        "  app.use((_req, res) => {",

        'mount loop/loopProject/midi routes at /api',
    )

# 5. railway.toml — use local binary
def patch_railway() -> None:
    apply_patch(
        'railway.toml',
        'startCommand = "npx tsx index.ts"',
        'startCommand = "pnpm exec tsx index.ts"',
        'railway.toml: npx tsx → pnpm exec tsx',
    )

# 6. package.json — fix wrong --ignore path
def patch_dev_ignore() -> None:
    apply_patch(
        'package.json',
        '"dev": "tsx watch --ignore ../client --ignore ../node_modules index.ts",',
        '"dev": "concurrently --kill-others-on-fail -n server,client -c blue,green '
        '\\"pnpm dev:server\\" \\"pnpm dev:client\\"",\n'
        '    "dev:server": "tsx watch --ignore ./client --ignore ./node_modules index.ts",\n'
        '    "dev:client": "pnpm --filter @r3vibe/client dev",',
        'package.json: add dev:server + dev:client + unified concurrently dev, fix --ignore path',
    )

# 7 + 8. package.json — test:coverage + concurrently dep
def patch_test_coverage() -> None:
    apply_patch(
        'package.json',
        '    "typecheck": "tsc --noEmit"\n  },',
        '    "typecheck": "tsc --noEmit",\n'
        '    "test:coverage": "vitest run --coverage"\n'
        '  },',
        'package.json: add test:coverage script',
    )

def patch_concurrently() -> None:
    apply_patch(
        'package.json',
        '    "drizzle-kit": "^0.31.10",',
        '    "concurrently": "^9.1.2",\n'
        '    "drizzle-kit": "^0.31.10",',
        'package.json: add concurrently devDependency',
    )

# 10. vercel.json — inject Railway URL
def patch_vercel_url(railway_domain: str) -> None:
    """
    Replaces the placeholder Railway domain in client/vercel.json.
    Validates the domain looks like a real hostname before writing.
    """
    placeholder = 'your-backend.railway.app'
    rel = 'client/vercel.json'
    content = read(rel)

    if railway_domain in content:
        skip(f'vercel.json Railway URL — already set to {railway_domain}')
        return

    if placeholder not in content:
        warn(f'vercel.json: placeholder "{placeholder}" not found — may already be customised')
        return

    # Basic hostname validation — must contain at least one dot and no spaces
    if '.' not in railway_domain or ' ' in railway_domain or '/' in railway_domain:
        fail(f'Invalid Railway domain: {repr(railway_domain)}')
        fail('  Expected format: my-app.railway.app  (no https://, no trailing slash)')
        rollback()
        sys.exit(1)

    if DRY_RUN:
        ok(f'[dry-run] vercel.json: would replace {placeholder} → {railway_domain}')
        return

    backup_file(rel)
    updated = content.replace(placeholder, railway_domain)
    write(rel, updated)
    ok(f'vercel.json: Railway URL → {railway_domain}')

# 11. .gitignore
def patch_gitignore() -> None:
    additions = textwrap.dedent("""\

        # ── Coverage output ──────────────────────────────────────────────────────────
        coverage/
        lcov.info

        # ── Backup artifacts ─────────────────────────────────────────────────────────
        *.ls-new
        *.landscape-bak
        *.pricing-backup
        R3_v4_full_backup.zip
        .patch-backup-*/
        .upgrade-backup-*/
        .upgrade-backup-followup-*/

        # ── Ad-hoc utilities (not deployable) ───────────────────────────────────────
        r3.sh
        r3-cleanup.sh
        r3-postclean.sh
        r3v4-upgrade.sh
        coverage.py

        # ── Shadow server src ────────────────────────────────────────────────────────
        server/src/
    """)
    append_if_absent('.gitignore', additions, 'coverage/', 'add missing .gitignore patterns')

# ═══════════════════════════════════════════════════════════════════════════════
# RAILWAY URL RESOLUTION
# ═══════════════════════════════════════════════════════════════════════════════

def resolve_railway_url() -> str | None:
    """
    Returns the Railway domain to inject, or None to skip vercel.json patching.
    Priority: CLI arg → env var → interactive prompt → skip.
    """
    if RAILWAY_URL_ARG:
        domain = RAILWAY_URL_ARG.strip().lstrip('https://').rstrip('/')
        print(f'  {cyan("→")} Railway URL from CLI arg: {domain}')
        return domain

    env_url = os.environ.get('RAILWAY_URL', '').strip()
    if env_url:
        domain = env_url.lstrip('https://').rstrip('/')
        print(f'  {cyan("→")} Railway URL from env: {domain}')
        return domain

    if NON_INTERACTIVE or DRY_RUN:
        warn('No Railway URL provided — skipping vercel.json patch')
        warn('  Pass --railway-url=<domain> or set RAILWAY_URL env var to inject it.')
        return None

    print(f'\n  {cyan("vercel.json Railway URL injection")}')
    print(f'  client/vercel.json still has the placeholder: your-backend.railway.app')
    print(f'  Enter your Railway domain (or press Enter to skip):')
    print(f'  Example: my-app-production.up.railway.app')
    try:
        raw = input('  > ').strip()
    except (EOFError, KeyboardInterrupt):
        raw = ''
    if not raw:
        warn('Skipped — remember to update client/vercel.json before deploying to Vercel.')
        return None
    return raw.lstrip('https://').rstrip('/')

# ═══════════════════════════════════════════════════════════════════════════════
# POST-PATCH VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════════

VERIFY_CHECKS = [
    ('index.ts', "import { trpcAuth, loopStationAuth } from './server/middleware/auth';",
     'loopStationAuth in auth import'),
    ('index.ts', "import loopRoutes",              'loopRoutes import'),
    ('index.ts', "import loopProjectRoutes",        'loopProjectRoutes import'),
    ('index.ts', "import midiRoutes",               'midiRoutes import'),
    ('index.ts', "import { loopStationLimiter }",   'loopStationLimiter import'),
    ('index.ts', "import { ensureDir }",            'ensureDir import'),
    ('index.ts', "ensureDir(`${_storageBase}/loops`)",  'loops ensureDir call'),
    ('index.ts', "ensureDir(`${_storageBase}/projects`)", 'projects ensureDir call'),
    ('index.ts', "app.use('/api', loopStationLimiter, loopStationAuth, loopRoutes);",
     'loopRoutes mounted'),
    ('index.ts', "app.use('/api', loopStationLimiter, loopStationAuth, loopProjectRoutes);",
     'loopProjectRoutes mounted'),
    ('index.ts', "app.use('/api', loopStationLimiter, loopStationAuth, midiRoutes);",
     'midiRoutes mounted'),
    ('railway.toml', 'pnpm exec tsx index.ts',      'railway pnpm exec tsx'),
    ('package.json', '"dev:server"',                'dev:server script'),
    ('package.json', '"dev:client"',                'dev:client script'),
    ('package.json', 'concurrently --kill-others-on-fail', 'unified concurrently dev'),
    ('package.json', '"test:coverage"',             'test:coverage script'),
    ('package.json', '"concurrently": "^9.1.2"',   'concurrently devDep'),
    ('.gitignore', 'coverage/',                     '.gitignore coverage/'),
    ('.gitignore', 'R3_v4_full_backup.zip',         '.gitignore backup zip'),
]

def verify() -> None:
    print(bold('\n── Post-patch verification ───────────────────────────────────'))
    failures = 0
    for rel, needle, label in VERIFY_CHECKS:
        if DRY_RUN:
            ok(f'[dry-run] {label}')
            continue
        found = needle in read(rel)
        if found:
            ok(label)
        else:
            fail(label)
            failures += 1

    if failures:
        fail(f'{failures} verification check(s) failed')
        rollback()
        sys.exit(1)

    if not DRY_RUN:
        print(green(f'  All {len(VERIFY_CHECKS)} checks passed.'))

# ═══════════════════════════════════════════════════════════════════════════════
# INSTALL + TYPECHECK
# ═══════════════════════════════════════════════════════════════════════════════

def install_and_typecheck() -> None:
    if DRY_RUN:
        ok('[dry-run] would run pnpm install')
        ok('[dry-run] would run pnpm build (typecheck)')
        return

    print(bold('\n── pnpm install ──────────────────────────────────────────────'))
    r = subprocess.run(['pnpm', 'install'], cwd=ROOT)
    if r.returncode != 0:
        fail('pnpm install failed')
        rollback()
        sys.exit(r.returncode)
    ok('pnpm install complete')

    print(bold('\n── pnpm build (typecheck gate) ───────────────────────────────'))
    r = subprocess.run(['pnpm', 'build'], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        fail('tsc found type errors after patching:')
        print(r.stdout[-3000:] if r.stdout else '')
        print(r.stderr[-2000:] if r.stderr else '')
        fail('Rolling back to prevent a broken state.')
        rollback()
        sys.exit(r.returncode)
    ok('pnpm build (tsc) clean')

# ═══════════════════════════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print(bold('══ r3v4-enhance ════════════════════════════════════════════════'))
    if DRY_RUN:
        print(yellow('  DRY RUN — no files will be modified\n'))

    # ── Pre-flight: validate all anchors exist before touching anything ────────
    preflight()

    # ── Railway URL: resolve before patches so we can bail early if invalid ───
    railway_domain = resolve_railway_url()

    # ── Apply all patches ──────────────────────────────────────────────────────
    print(bold('\n── index.ts ──────────────────────────────────────────────────'))
    patch_auth_import()
    patch_loop_imports()
    patch_storage_init()
    patch_mount_routes()

    print(bold('\n── railway.toml ──────────────────────────────────────────────'))
    patch_railway()

    print(bold('\n── package.json ──────────────────────────────────────────────'))
    patch_dev_ignore()
    patch_test_coverage()
    patch_concurrently()

    print(bold('\n── client/vercel.json ────────────────────────────────────────'))
    if railway_domain:
        patch_vercel_url(railway_domain)
    else:
        skip('vercel.json Railway URL — no domain provided')

    print(bold('\n── .gitignore ────────────────────────────────────────────────'))
    patch_gitignore()

    # ── Verification ──────────────────────────────────────────────────────────
    verify()

    # ── Install + typecheck ───────────────────────────────────────────────────
    install_and_typecheck()

    # ── Clean up backup dir if everything succeeded ───────────────────────────
    if not DRY_RUN and BAK_DIR.exists():
        shutil.rmtree(BAK_DIR)
        ok(f'Backup dir removed (all checks passed)')

    # ── Summary ───────────────────────────────────────────────────────────────
    print(bold('\n══ Done ════════════════════════════════════════════════════════'))

    if DRY_RUN:
        print(yellow('\n  This was a dry run. Re-run without --dry-run to apply.'))
        return

    print(textwrap.dedent(f"""
  {green("All patches applied, verified, and typechecked.")}

  ┌─ New dev workflow ─────────────────────────────────────────────────────┐
  │                                                                        │
  │   pnpm dev              → starts server + client concurrently         │
  │   pnpm dev:server       → server only (tsx watch)                     │
  │   pnpm dev:client       → client only (vite)                          │
  │   pnpm test:coverage    → vitest with V8 coverage                     │
  │                                                                        │
  ├─ New API endpoints ────────────────────────────────────────────────────┤
  │                                                                        │
  │   POST /api/save-loop           upload loop audio                     │
  │   GET  /api/loops               list all loops                        │
  │   GET  /api/loops/:id           fetch loop                            │
  │   DELETE /api/loops/:id         delete loop                           │
  │   POST /api/loopproject/save    save project JSON                     │
  │   GET  /api/loopproject/:id     load project                          │
  │   GET  /api/loopprojects        list projects                         │
  │   POST /api/midi/mappings       save MIDI map                         │
  │   GET  /api/midi/mappings       load MIDI map                         │
  │                                                                        │
  ├─ Environment variables ────────────────────────────────────────────────┤
  │                                                                        │
  │   LOOP_STORAGE_BASE    file storage root (default: ./server/storage)  │
  │   MAX_LOOP_SIZE_MB     max upload size (default: 10)                  │
  │                                                                        │
  {"└─ Vercel URL ─────────────────────────────────────────────────────────────┘" if not railway_domain else ""}
  {"  client/vercel.json still has the placeholder Railway URL." if not railway_domain else ""}
  {"  Deploy to Railway first, then re-run:" if not railway_domain else ""}
  {"    python3 r3v4-enhance.py --railway-url=<your>.railway.app" if not railway_domain else ""}
    """))


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print(f'\n{yellow("Interrupted.")}')
        rollback()
        sys.exit(130)
    except SystemExit:
        raise
    except Exception as e:
        fail(f'Unexpected error: {e}')
        import traceback; traceback.print_exc()
        rollback()
        sys.exit(1)