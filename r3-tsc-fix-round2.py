#!/usr/bin/env python3
"""
r3-tsc-fix-round2.py — Round 2 Wire.txt repair for remaining TSC errors
Timestamp: 2026-04-30

Errors addressed:
  fx-panel.tsx:453,464,466,470,471,621,697,698,699,741
      — engine FXState has no index signature; importing it broke all string indexing
        in fx-panel's 780-line component body.
      Fix: ROLLBACK fx-panel.tsx from backup. Add [key:string]:boolean|undefined
           to the ENGINE's FXState in instrument-engine.ts. This makes keyof FXState
           = string, resolving both the assignment error AND the onToggle contravariance
           without touching any component internals.

  page-nav.tsx:29,30
      — Duplicate identifier 'ThemeSwitcher' at consecutive lines.
      Fix: Read file, identify both declarations, remove the duplicate.

  instrument.tsx:1479
      — PianoKeysProps disabled?: boolean still missing. The round-1 regex
        [^}]+ stopped at the '}' inside the nested keys:{...}[] type, truncating
        the captured interface and corrupting the match.
      Fix: ROLLBACK piano-keys.tsx from backup. Use brace-depth-aware parser to
           find the real closing '}' of PianoKeysProps and insert before it.

Protocol: Wire.txt
  - DRY-RUN by default. Pass --run to apply.
  - Read full file before any write.
  - assert count == N for every anchor.
  - Timestamped .bak before every write.
  - pnpm -w run typecheck at end (only with --run).

Usage:
  python3 r3-tsc-fix-round2.py        # dry-run — safe to run anytime
  python3 r3-tsc-fix-round2.py --run  # apply
"""

import sys, os, re, shutil, subprocess
from datetime import datetime, timezone

APPLY      = '--run' in sys.argv
REPO       = os.path.expanduser('~/Stable')
SRC        = os.path.join(REPO, 'client/src')
PAGES      = os.path.join(SRC, 'pages')
COMPONENTS = os.path.join(SRC, 'components')
AUDIO_CORE = os.path.join(SRC, 'audio/core')
BACKUP_R1  = os.path.join(REPO, '.r3_tsc_backups/20260430_224734')   # Round 1 backups
TS         = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
BACKUP_DIR = os.path.join(REPO, '.r3_tsc_backups', f'r2_{TS}')

def ok(s):   print(f'[  OK] {s}')
def info(s): print(f'[INFO] {s}')
def err(s):  print(f'[ ERR] {s}')
def warn(s): print(f'[WARN] {s}')

def sep(title):
    print(f'\n{"=" * 64}')
    print(f'  {title}')
    print(f'{"=" * 64}')

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    bak = os.path.join(BACKUP_DIR, os.path.basename(path) + '.bak')
    shutil.copy2(path, bak)
    ok(f'Backup → {bak}')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    ok(f'Written → {path}')

def show_context(content, line_no, label, ctx=4):
    lines = content.splitlines()
    start = max(0, line_no - ctx - 1)
    end   = min(len(lines), line_no + ctx)
    info(f'Context [{label}] around line {line_no}:')
    for i, ln in enumerate(lines[start:end], start + 1):
        marker = '>>>' if i == line_no else '   '
        print(f'      {marker} {i:5d}  {ln}')

def find_interface_bounds(content, name):
    """
    Brace-depth-aware interface locator.
    Returns (full_text, close_brace_abs_idx) where full_text is the complete
    'interface Name { ... }' string including all nested braces.
    Returns (None, None) if not found.
    """
    pat = re.compile(rf'\binterface\s+{re.escape(name)}\b')
    m = pat.search(content)
    if not m:
        return None, None
    try:
        open_idx = content.index('{', m.end())
    except ValueError:
        return None, None
    depth = 0
    for i in range(open_idx, len(content)):
        if content[i] == '{':
            depth += 1
        elif content[i] == '}':
            depth -= 1
            if depth == 0:
                return content[m.start():i + 1], i
    return None, None


# ══════════════════════════════════════════════════════════════════════════════
# FIX FX — Rollback fx-panel.tsx + add index sig to engine's FXState
# ══════════════════════════════════════════════════════════════════════════════
sep('FIX FX — Rollback fx-panel.tsx + patch instrument-engine.ts FXState')

FX_FILE    = os.path.join(COMPONENTS, 'fx-panel.tsx')
ENGINE_FILE = os.path.join(AUDIO_CORE, 'instrument-engine.ts')
FX_BACKUP  = os.path.join(BACKUP_R1, 'fx-panel.tsx.bak')

# ── Step FX-1: Verify backup exists ──────────────────────────────────────────
if not os.path.exists(FX_BACKUP):
    err(f'Round-1 backup not found: {FX_BACKUP}')
    err('Cannot rollback fx-panel.tsx. Manual rollback required.')
else:
    ok(f'Round-1 backup found: {FX_BACKUP}')
    if not APPLY:
        info('DRY-RUN: would restore fx-panel.tsx from round-1 backup')
    else:
        os.makedirs(BACKUP_DIR, exist_ok=True)
        cur_bak = os.path.join(BACKUP_DIR, 'fx-panel.tsx.bak')
        shutil.copy2(FX_FILE, cur_bak)
        ok(f'Current (broken) fx-panel.tsx backed up → {cur_bak}')
        shutil.copy2(FX_BACKUP, FX_FILE)
        ok('fx-panel.tsx rolled back to pre-round-1 state ✓')

# ── Step FX-2: Add index signature to engine's FXState ───────────────────────
# Root cause of round-1 failure: the engine's FXState has specific named keys
# but no [key: string] index signature. The component body uses fx[someKey]
# (string indexing) throughout. Importing the strict engine type broke everything.
#
# Correct fix: add [key: string]: boolean | undefined to ENGINE's FXState.
# This makes:
#   - keyof FXState = string (resolves onToggle contravariance)
#   - engine FXState assignable to component's FXState (both have index sig)
#   - All fx[someKey] accesses in the component body remain valid
#
# Safety: all named props in engine's FXState are boolean or boolean|undefined —
# both are subtypes of boolean|undefined, so the index sig is compatible.

assert os.path.exists(ENGINE_FILE), f'Engine file not found: {ENGINE_FILE}'
engine = read_file(ENGINE_FILE)
info(f'Read {ENGINE_FILE} — {len(engine.splitlines())} lines')

full_fxstate, close_idx = find_interface_bounds(engine, 'FXState')

if full_fxstate is None:
    err('FXState interface not found in instrument-engine.ts')
    info('Manual fix: add [key: string]: boolean | undefined; to FXState interface')
else:
    info('Found FXState interface in engine:')
    for ln in full_fxstate.splitlines():
        print(f'      {ln}')

    INDEX_SIG = '  [key: string]: boolean | undefined;'
    if INDEX_SIG in full_fxstate:
        ok('Engine FXState already has index signature — no change needed.')
    else:
        # Insert index signature before the closing brace
        new_fxstate = full_fxstate[:-1].rstrip() + f'\n{INDEX_SIG}\n}}'
        count_fs = engine.count(full_fxstate)
        assert count_fs == 1, \
            f'FXState interface found {count_fs} times in engine — unsafe to replace.'

        info(f'DRY-RUN' if not APPLY else 'Applying')
        info(f'  Adding to engine FXState: {INDEX_SIG}')
        info(f'  New tail: ...{new_fxstate[-80:]}')

        if not APPLY:
            info('DRY-RUN: would add index signature to engine FXState')
        else:
            engine = engine.replace(full_fxstate, new_fxstate)
            write_file(ENGINE_FILE, engine)
            ok('instrument-engine.ts — FXState index signature added ✓')


# ══════════════════════════════════════════════════════════════════════════════
# FIX NAV — page-nav.tsx duplicate ThemeSwitcher
# ══════════════════════════════════════════════════════════════════════════════
sep('FIX NAV — page-nav.tsx duplicate ThemeSwitcher (lines 29–30)')

NAV_FILE = os.path.join(COMPONENTS, 'page-nav.tsx')
assert os.path.exists(NAV_FILE), f'File not found: {NAV_FILE}'

nav = read_file(NAV_FILE)
info(f'Read {NAV_FILE} — {len(nav.splitlines())} lines')

# Show the full context around lines 25-40 and all ThemeSwitcher occurrences
show_context(nav, 29, 'ThemeSwitcher L29', ctx=6)
show_context(nav, 30, 'ThemeSwitcher L30', ctx=6)

nav_lines = nav.splitlines()
info('All lines containing ThemeSwitcher:')
ts_lines = []
for i, ln in enumerate(nav_lines, 1):
    if 'ThemeSwitcher' in ln:
        ts_lines.append((i, ln))
        print(f'      {i:5d}  {ln}')

if len(ts_lines) < 2:
    info('Fewer than 2 ThemeSwitcher occurrences — may already be fixed.')
elif len(ts_lines) >= 2:
    # Determine which is the duplicate to remove.
    # Strategy: keep the import from the canonical component file.
    # Remove anything that is a re-declaration (const, function, or duplicate import).

    # Classify each occurrence
    import_lines = [(i, ln) for i, ln in ts_lines if ln.strip().startswith('import')]
    local_lines  = [(i, ln) for i, ln in ts_lines
                    if not ln.strip().startswith('import')
                    and 'ThemeSwitcher' in ln]

    info(f'  Import declarations: {len(import_lines)}')
    info(f'  Other declarations: {len(local_lines)}')

    if len(import_lines) == 2:
        # Two import statements — remove the second (lower line number = primary)
        line_to_remove_num, line_to_remove = import_lines[1]
        info(f'  Two import statements — will remove duplicate at line {line_to_remove_num}:')
        info(f'    {line_to_remove.strip()}')
    elif len(import_lines) == 1 and len(local_lines) >= 1:
        # One import + one local — find a local const/function declaration to remove
        local_decl = None
        for i, ln in local_lines:
            stripped = ln.strip()
            if (stripped.startswith('const ThemeSwitcher') or
                stripped.startswith('function ThemeSwitcher') or
                stripped.startswith('export const ThemeSwitcher') or
                stripped.startswith('export function ThemeSwitcher')):
                local_decl = (i, ln)
                break
        if local_decl:
            line_to_remove_num, line_to_remove = local_decl
            info(f'  Will remove local declaration at line {line_to_remove_num}:')
            info(f'    {line_to_remove.strip()}')
        else:
            line_to_remove_num, line_to_remove = None, None
            warn('  Cannot determine which ThemeSwitcher to remove automatically.')
            warn('  Review lines above and remove the duplicate manually.')
    else:
        line_to_remove_num, line_to_remove = None, None
        warn('  Unexpected ThemeSwitcher pattern — manual fix required.')

    if 'line_to_remove_num' in dir() and line_to_remove_num is not None:
        # For a local multi-line component (const ThemeSwitcher = () => {...}),
        # we need to remove the whole declaration, not just one line.
        # Detect if it's a multi-line component definition.
        stripped_removal = line_to_remove.strip()

        if stripped_removal.startswith('import '):
            # Single-line import — safe to remove just the line
            OLD_LINE = line_to_remove + '\n'
            if OLD_LINE not in nav:
                OLD_LINE = line_to_remove  # no trailing newline
            count_n = nav.count(OLD_LINE)
            info(f'  Remove anchor count: {count_n}')

            if not APPLY:
                info(f'  DRY-RUN: would remove import line at {line_to_remove_num}')
            else:
                assert count_n >= 1, f'Duplicate import not found in nav file'
                nav = nav.replace(OLD_LINE, '', 1)
                write_file(NAV_FILE, nav)
                ok(f'page-nav.tsx — duplicate ThemeSwitcher import removed ✓')
        else:
            # Multi-line local component — find its extent using brace depth
            info('  Local component detected — finding full declaration bounds...')
            # Find the declaration in the content
            decl_start = nav.find(line_to_remove.lstrip())
            if decl_start == -1:
                warn('  Could not locate declaration in file content — manual fix required.')
            else:
                # Find the closing brace of this component
                open_brace = nav.find('{', decl_start)
                if open_brace == -1:
                    warn('  No opening brace found — single line? Remove it:')
                    info(f'    {line_to_remove.strip()}')
                else:
                    depth = 0
                    close_brace = -1
                    for i in range(open_brace, len(nav)):
                        if nav[i] == '{': depth += 1
                        elif nav[i] == '}':
                            depth -= 1
                            if depth == 0:
                                close_brace = i
                                break
                    if close_brace == -1:
                        warn('  Could not find closing brace — manual fix required.')
                    else:
                        # Include trailing newline
                        end = close_brace + 1
                        if end < len(nav) and nav[end] == '\n':
                            end += 1
                        full_decl = nav[decl_start:end]
                        info('  Full declaration to remove:')
                        for ln in full_decl.splitlines()[:5]:
                            print(f'      {ln}')
                        if len(full_decl.splitlines()) > 5:
                            print(f'      ... ({len(full_decl.splitlines())} lines total)')

                        if not APPLY:
                            info('  DRY-RUN: would remove full local ThemeSwitcher declaration')
                        else:
                            nav_new = nav[:decl_start].rstrip('\n') + '\n' + nav[end:]
                            write_file(NAV_FILE, nav_new)
                            ok('page-nav.tsx — local ThemeSwitcher declaration removed ✓')


# ══════════════════════════════════════════════════════════════════════════════
# FIX PIANO — Rollback piano-keys.tsx + brace-depth-aware disabled insertion
# ══════════════════════════════════════════════════════════════════════════════
sep('FIX PIANO — Rollback piano-keys.tsx + brace-depth-aware PianoKeysProps fix')

PIANO_FILE   = os.path.join(COMPONENTS, 'piano-keys.tsx')
PIANO_BACKUP = os.path.join(BACKUP_R1, 'piano-keys.tsx.bak')

# ── Step P-1: Rollback ────────────────────────────────────────────────────────
if not os.path.exists(PIANO_BACKUP):
    err(f'Round-1 backup not found: {PIANO_BACKUP}')
    err('Cannot rollback piano-keys.tsx automatically.')
else:
    ok(f'Round-1 backup found: {PIANO_BACKUP}')
    if not APPLY:
        info('DRY-RUN: would restore piano-keys.tsx from round-1 backup')
    else:
        cur_bak = os.path.join(BACKUP_DIR, 'piano-keys.tsx.bak')
        shutil.copy2(PIANO_FILE, cur_bak)
        ok(f'Current piano-keys.tsx backed up → {cur_bak}')
        shutil.copy2(PIANO_BACKUP, PIANO_FILE)
        ok('piano-keys.tsx rolled back to pre-round-1 state ✓')

# ── Step P-2: Read (post-rollback) and insert disabled ───────────────────────
piano = read_file(PIANO_FILE)
info(f'Read piano-keys.tsx — {len(piano.splitlines())} lines (post-rollback state)')

full_props, close_idx = find_interface_bounds(piano, 'PianoKeysProps')

if full_props is None:
    err('PianoKeysProps interface not found.')
    info('Manual fix: add  disabled?: boolean;  to PianoKeysProps interface')
else:
    info('PianoKeysProps found (brace-depth parser):')
    lines_p = full_props.splitlines()
    for ln in lines_p[:6]:
        print(f'      {ln}')
    if len(lines_p) > 6:
        print(f'      ...')
        print(f'      {lines_p[-1]}')

    if 'disabled' in full_props:
        ok('disabled already present in PianoKeysProps — no change needed.')
    else:
        # Insert disabled?: boolean before the closing brace
        new_props = full_props[:-1].rstrip() + '\n  disabled?: boolean;\n}'
        count_pp = piano.count(full_props)
        assert count_pp == 1, \
            f'PianoKeysProps block found {count_pp} times — unsafe to replace automatically.'
        info(f'  Insertion point verified (count=={count_pp}) ✓')
        info(f'  New interface tail: ...{new_props[-60:]}')

        if not APPLY:
            info('DRY-RUN: would add disabled?: boolean to PianoKeysProps (brace-depth parser)')
        else:
            piano = piano.replace(full_props, new_props)
            write_file(PIANO_FILE, piano)
            ok('piano-keys.tsx — disabled?: boolean added to PianoKeysProps ✓')


# ══════════════════════════════════════════════════════════════════════════════
# TSC verify
# ══════════════════════════════════════════════════════════════════════════════
sep('TSC VERIFY')

if APPLY:
    info('Running: pnpm -w run typecheck ...')
    result = subprocess.run(
        ['pnpm', '-w', 'run', 'typecheck'],
        cwd=REPO, capture_output=True, text=True
    )
    if result.returncode == 0:
        ok('TSC: 0 errors ✅')
    else:
        err('TSC errors remain:')
        print((result.stdout + result.stderr)[-4000:])
        info(f'Round-2 backups at: {BACKUP_DIR}')
        info('Round-1 backups at: ' + BACKUP_R1)
else:
    print()
    print('  ╔══════════════════════════════════════════════════════════════╗')
    print('  ║  DRY-RUN complete — no files written.                       ║')
    print('  ║                                                              ║')
    print('  ║  Review context output above, then:                         ║')
    print('  ║    python3 r3-tsc-fix-round2.py --run                       ║')
    print('  ╚══════════════════════════════════════════════════════════════╝')
    print()
