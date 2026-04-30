#!/usr/bin/env python3
"""
r3-tsc-fix-all.py — Wire.txt-compliant repair for all 11 TSC errors
Timestamp: 2026-04-30

Errors addressed:
  [A] collaborative-daw-pro.tsx:551,552  — import.meta cast (ImportMeta not overlapping Record)
  [A] collaborative-daw-pro.tsx:1250     — truncate:true is not a CSSProperties key
  [B] DAW.tsx:946,959,1639              — className prop on component without className in type
  [C] instrument.tsx:1479               — PianoKeysProps missing disabled?: boolean
  [C] instrument.tsx:1519               — TransportControlsProps missing disabled?: boolean
  [D] instrument.tsx:1526 ×2            — FXState type split-brain + onToggle contravariance
  [E] visuals.tsx:396                   — useEffect not imported from react

Protocol (Wire.txt):
  - DRY-RUN by default. Pass --run to apply.
  - Read full file before any write.
  - assert count == N for every anchor string.
  - Timestamped .bak before every file write.
  - pnpm -w run typecheck at the end (only with --run).

Usage:
  python3 r3-tsc-fix-all.py           # dry-run — safe to run anytime
  python3 r3-tsc-fix-all.py --run     # apply all fixes
"""

import sys, os, re, shutil, subprocess
from datetime import datetime, timezone

# ── Config ────────────────────────────────────────────────────────────────────
APPLY      = '--run' in sys.argv
REPO       = os.path.expanduser('~/Stable')
SRC        = os.path.join(REPO, 'client/src')
PAGES      = os.path.join(SRC, 'pages')
COMPONENTS = os.path.join(SRC, 'components')
TS         = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
BACKUP_DIR = os.path.join(REPO, '.r3_tsc_backups', TS)

# ── Helpers ───────────────────────────────────────────────────────────────────
def ok(s):   print(f'[  OK] {s}')
def info(s): print(f'[INFO] {s}')
def err(s):  print(f'[ ERR] {s}')
def warn(s): print(f'[WARN] {s}')

def sep(title):
    print(f'\n{"=" * 62}')
    print(f'  {title}')
    print(f'{"=" * 62}')

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    """Backup then write. Only runs when APPLY is True."""
    os.makedirs(BACKUP_DIR, exist_ok=True)
    bak = os.path.join(BACKUP_DIR, os.path.basename(path) + '.bak')
    shutil.copy2(path, bak)
    ok(f'Backup → {bak}')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    ok(f'Written → {path}')

def show_context(content, line_no, label, ctx=3):
    """Show ±ctx lines around line_no (1-indexed) for verification."""
    lines = content.splitlines()
    start = max(0, line_no - ctx - 1)
    end   = min(len(lines), line_no + ctx)
    info(f'Context [{label}] around line {line_no}:')
    for i, ln in enumerate(lines[start:end], start + 1):
        marker = '>>>' if i == line_no else '   '
        print(f'      {marker} {i:5d}  {ln}')

def find_component(name):
    """Search components dir for a tsx file by basename."""
    path = os.path.join(COMPONENTS, name)
    if os.path.exists(path):
        return path
    # recursive fallback
    for root, _, files in os.walk(COMPONENTS):
        if name in files:
            return os.path.join(root, name)
    return None


# ══════════════════════════════════════════════════════════════════════════════
# GROUP A — collaborative-daw-pro.tsx  (3 errors)
# ══════════════════════════════════════════════════════════════════════════════
sep('[A] collaborative-daw-pro.tsx — import.meta cast + truncate CSS (3 errors)')

COLLAB = os.path.join(PAGES, 'collaborative-daw-pro.tsx')
assert os.path.exists(COLLAB), f'File not found: {COLLAB}'

collab = read_file(COLLAB)
info(f'Read {COLLAB} — {len(collab.splitlines())} lines')

# Show context for inspection
show_context(collab, 551,  'import.meta cast L551')
show_context(collab, 552,  'import.meta cast L552')
show_context(collab, 1250, 'truncate CSS prop L1250')

# ── Fix A1: double-cast import.meta (lines 551 & 552) ────────────────────────
# Root cause: TypeScript rejects (import.meta as Record<string,unknown>) because
# ImportMeta and Record<string,unknown> do not sufficiently overlap.
# Fix: route through unknown — (import.meta as unknown as Record<string,unknown>)
A1_OLD = '(import.meta as Record<string, unknown>)'
A1_NEW = '(import.meta as unknown as Record<string, unknown>)'

count_a1 = collab.count(A1_OLD)
assert count_a1 == 2, \
    f'[A1] Expected 2 occurrences of import.meta cast, got {count_a1}. ' \
    f'Check lines 551–552 manually.'
info(f'[A1] import.meta cast: found {count_a1} occurrences ✓')

if not APPLY:
    info(f'[A1] DRY-RUN: would replace ×{count_a1}:')
    info(f'     OLD: {A1_OLD}')
    info(f'     NEW: {A1_NEW}')
else:
    collab = collab.replace(A1_OLD, A1_NEW)
    ok('[A1] import.meta double-cast applied ×2')

# ── Fix A2: remove truncate:true from inline style (line 1250) ───────────────
# Root cause: truncate is a Tailwind CSS utility class name, not a CSSProperties key.
# overflow:'hidden' + textOverflow:'ellipsis' + whiteSpace:'nowrap' already present.
A2_OLD = 'truncate:true, '
A2_NEW = ''

count_a2 = collab.count(A2_OLD)
assert count_a2 == 1, \
    f'[A2] Expected 1 occurrence of "truncate:true, ", got {count_a2}. ' \
    f'Check line 1250 manually.'
info(f'[A2] truncate:true: found {count_a2} occurrence ✓')

if not APPLY:
    info('[A2] DRY-RUN: would remove "truncate:true, " from inline style at L1250')
else:
    collab = collab.replace(A2_OLD, A2_NEW)
    ok('[A2] truncate:true removed from inline style')

if APPLY:
    write_file(COLLAB, collab)


# ══════════════════════════════════════════════════════════════════════════════
# GROUP E — visuals.tsx  (1 error — no deps, run early)
# ══════════════════════════════════════════════════════════════════════════════
sep('[E] visuals.tsx — useEffect not imported (1 error)')

VISUALS = os.path.join(PAGES, 'visuals.tsx')
assert os.path.exists(VISUALS), f'File not found: {VISUALS}'

vis = read_file(VISUALS)
info(f'Read {VISUALS} — {len(vis.splitlines())} lines')
show_context(vis, 396, 'useEffect usage L396')

# Find the React import line (handles all common forms)
react_import_pat = re.compile(
    r"^import React(?:,\s*\{([^}]*)\})? from 'react';?$",
    re.MULTILINE
)
named_only_pat = re.compile(
    r"^import \{([^}]+)\} from 'react';?$",
    re.MULTILINE
)

e_match = react_import_pat.search(vis) or named_only_pat.search(vis)

if not e_match:
    err('[E] Cannot locate React import in visuals.tsx.')
    info('    Manual fix: add "import { useEffect } from \'react\';" near top of file.')
else:
    existing_import = e_match.group(0)
    info(f'[E] Found React import: {existing_import.strip()}')

    if 'useEffect' in existing_import:
        ok('[E] useEffect already present in import — no change needed.')
    else:
        # Build new import by injecting useEffect into named-imports group
        if '{ ' in existing_import:
            # Has named imports already — append useEffect
            new_import = re.sub(
                r'\{([^}]+)\}',
                lambda m: '{ ' + m.group(1).strip().rstrip(',') + ', useEffect }',
                existing_import, count=1
            )
        elif 'React,' in existing_import:
            # import React, { ... } — no named chunk yet (shouldn't happen but guard it)
            new_import = existing_import.replace('React,', 'React, { useEffect },')
        else:
            # Bare: import React from 'react'
            new_import = existing_import.replace(
                "import React from 'react'",
                "import React, { useEffect } from 'react'"
            ).replace(
                "import React from \"react\"",
                "import React, { useEffect } from \"react\""
            )

        info(f'[E] New import: {new_import.strip()}')
        count_e = vis.count(existing_import)
        assert count_e == 1, \
            f'[E] Expected 1 React import, found {count_e}. Check file manually.'

        if not APPLY:
            info('[E] DRY-RUN: would inject useEffect into React import')
        else:
            vis = vis.replace(existing_import, new_import)
            write_file(VISUALS, vis)
            ok('[E] visuals.tsx — useEffect added to React import')


# ══════════════════════════════════════════════════════════════════════════════
# GROUP B — DAW.tsx  (3 errors: className on typed component)
# ══════════════════════════════════════════════════════════════════════════════
sep('[B] DAW.tsx — className prop on component that only accepts style (3 errors)')

DAW = os.path.join(PAGES, 'DAW.tsx')
assert os.path.exists(DAW), f'File not found: {DAW}'

daw = read_file(DAW)
info(f'Read {DAW} — {len(daw.splitlines())} lines')

# Show what actually lives at each error line before any assertion
show_context(daw, 946,  'className L946')
show_context(daw, 959,  'className L959')
show_context(daw, 1639, 'className L1639')

# ── Fix B1: className="w-full text-center text-[9px]" (unique, L1639) ────────
B1_OLD = 'className="w-full text-center text-[9px]"'
B1_NEW = 'style={{ width:"100%", textAlign:"center", fontSize:9 }}'

count_b1 = daw.count(B1_OLD)
if count_b1 != 1:
    warn(f'[B1] Expected 1 occurrence of w-full className, got {count_b1}.')
    warn('     Review context for L1639 above and fix manually if needed.')
else:
    info(f'[B1] "w-full text-center text-[9px]": found {count_b1} occurrence ✓')
    if not APPLY:
        info('[B1] DRY-RUN: would replace className="w-full text-center text-[9px]"')
        info(f'     NEW: {B1_NEW}')
    else:
        daw = daw.replace(B1_OLD, B1_NEW)
        ok('[B1] w-full className → inline style applied')

# ── Fix B2: className="text-[9px]" (L946 and L959) ──────────────────────────
# After B1, any remaining className="text-[9px]" are the L946 and L959 errors.
# The count may be 2 (ideal) or higher if other occurrences exist.
B2_OLD = 'className="text-[9px]"'
B2_NEW = 'style={{ fontSize:9 }}'

count_b2 = daw.count(B2_OLD)
info(f'[B2] className="text-[9px]" remaining occurrences: {count_b2}')

if count_b2 == 0:
    info('[B2] No occurrences found — already fixed or using different string.')
elif count_b2 == 2:
    info('[B2] Exactly 2 occurrences — matches L946 + L959 ✓')
    if not APPLY:
        info('[B2] DRY-RUN: would replace both className="text-[9px]" → style={{ fontSize:9 }}')
    else:
        daw = daw.replace(B2_OLD, B2_NEW)
        ok('[B2] className="text-[9px]" → inline style applied ×2')
else:
    warn(f'[B2] Found {count_b2} occurrences (expected 2 for L946+L959).')
    warn('     Some may be on OTHER components that DO accept className.')
    warn('     Showing all occurrences for manual verification:')
    lines = daw.splitlines()
    for i, ln in enumerate(lines, 1):
        if B2_OLD in ln:
            print(f'      {i:5d}  {ln.strip()}')
    warn('     NOT applying this fix automatically — resolve manually.')

if APPLY and count_b2 in (1, 2):
    write_file(DAW, daw)
elif APPLY and count_b2 not in (1, 2):
    # Write only if B1 was applied (to not lose that fix)
    if count_b1 == 1:
        write_file(DAW, daw)
        warn('[B] DAW.tsx written with B1 fix only — B2 requires manual resolution.')


# ══════════════════════════════════════════════════════════════════════════════
# GROUP C — PianoKeys + TransportControls: disabled?: boolean  (2 errors)
# ══════════════════════════════════════════════════════════════════════════════
sep('[C] piano-keys.tsx + transport-controls.tsx — disabled?: boolean missing (2 errors)')

def add_disabled_prop(component_path, interface_name):
    """Read interface, add disabled?: boolean, write back."""
    if not os.path.exists(component_path):
        err(f'File not found: {component_path}')
        return
    src = read_file(component_path)
    info(f'Read {component_path} — {len(src.splitlines())} lines')

    # Match the interface block (single brace depth — handles most cases)
    pat = re.compile(
        rf'(interface {re.escape(interface_name)}\s*\{{[^}}]+\}})',
        re.DOTALL
    )
    m = pat.search(src)
    if not m:
        err(f'  Interface "{interface_name}" not found in {os.path.basename(component_path)}.')
        err('  Check the actual interface name and fix manually.')
        return

    iface_block = m.group(1)
    info(f'  Found {interface_name}:')
    for ln in iface_block.splitlines():
        print(f'      {ln}')

    if 'disabled' in iface_block:
        ok(f'  disabled prop already present in {interface_name} — no change needed.')
        return

    # Insert before the closing brace
    new_iface = iface_block.rstrip('}').rstrip() + '\n  disabled?: boolean;\n}'
    count_iface = src.count(iface_block)
    assert count_iface == 1, \
        f'  Interface block appears {count_iface} times — unsafe to replace automatically.'

    if not APPLY:
        info(f'  DRY-RUN: would add "disabled?: boolean;" to {interface_name}')
        info(f'  New block tail: ...{new_iface[-60:]}')
    else:
        src = src.replace(iface_block, new_iface)
        write_file(component_path, src)
        ok(f'  {os.path.basename(component_path)} — disabled?: boolean added to {interface_name}')

PIANO = find_component('piano-keys.tsx')
TC    = find_component('transport-controls.tsx')

if PIANO:
    info(f'Found piano-keys.tsx at: {PIANO}')
    add_disabled_prop(PIANO, 'PianoKeysProps')
else:
    err('piano-keys.tsx not found under client/src/components/')
    info('Expected: client/src/components/piano-keys.tsx')
    info('Manual fix: add  disabled?: boolean;  to PianoKeysProps interface')

if TC:
    info(f'Found transport-controls.tsx at: {TC}')
    add_disabled_prop(TC, 'TransportControlsProps')
else:
    err('transport-controls.tsx not found under client/src/components/')
    info('Expected: client/src/components/transport-controls.tsx')
    info('Manual fix: add  disabled?: boolean;  to TransportControlsProps interface')


# ══════════════════════════════════════════════════════════════════════════════
# GROUP D — fx-panel.tsx: FXState split-brain + onToggle contravariance (2 errors)
# ══════════════════════════════════════════════════════════════════════════════
sep('[D] fx-panel.tsx — FXState type mismatch + onToggle contravariance (2 errors)')

# Root cause:
#   fx-panel.tsx defines a LOCAL FXState with an index signature [key: string]: X,
#   but the engine's FXState (instrument-engine.ts) has specific named keys and no
#   index signature. TypeScript won't assign engine FXState to the component's type.
#   Also: onToggle?: (fx: string) => void is incompatible with the engine's
#   (fx: keyof FXState) => void due to parameter contravariance (keyof FXState
#   is a specific union, string is wider — assigning narrower input to wider fails).
#
# Fix strategy:
#   Import FXState TYPE from the engine in fx-panel.tsx. This makes both fx and
#   onToggle use the same type, eliminating both errors without touching the engine.
#   Engine path: client/src/audio/core/instrument-engine.ts
#   Relative from components/: '../audio/core/instrument-engine'

ENGINE_REL = "'../audio/core/instrument-engine'"  # relative from components/

FX = find_component('fx-panel.tsx')
if not FX:
    err('fx-panel.tsx not found under client/src/components/')
    info('Manual fix steps:')
    info('  1. Add: import type { FXState } from "../audio/core/instrument-engine";')
    info('  2. Remove local FXState type/interface definition')
    info('  3. Change: onToggle?: (fx: string) → onToggle?: (fx: keyof FXState)')
else:
    info(f'Found fx-panel.tsx at: {FX}')
    fx = read_file(FX)
    info(f'  Read — {len(fx.splitlines())} lines')

    # Show the FXPanelProps area (around lines 25-35 per error output)
    show_context(fx, 29, 'FXPanelProps L29', ctx=8)

    # ── Step D1: Verify engine file exists ───────────────────────────────────
    ENGINE_ABS = os.path.join(SRC, 'audio/core/instrument-engine.ts')
    if not os.path.exists(ENGINE_ABS):
        err(f'Engine file not found: {ENGINE_ABS}')
        info('Adjust ENGINE_REL variable at top of this section if path differs.')
    else:
        ok(f'Engine file confirmed: {ENGINE_ABS}')

    # ── Step D2: Check if FXState already imported from engine ───────────────
    already_imported = (
        "from '../audio/core/instrument-engine'" in fx and
        'FXState' in fx.split("from '../audio/core/instrument-engine'")[0].split('\n')[-1]
    )
    if already_imported:
        ok('[D] FXState already imported from engine — checking interface alignment.')
    else:
        info('[D] FXState not yet imported from engine.')

    # ── Step D3: Find local FXState definition ───────────────────────────────
    local_fxstate_pat = re.compile(
        r'(?:interface|type)\s+FXState\s*(?:=\s*)?[\{][^}]+\}',
        re.DOTALL
    )
    local_m = local_fxstate_pat.search(fx)
    if local_m:
        info(f'[D] Local FXState definition found:')
        for ln in local_m.group(0).splitlines():
            print(f'      {ln}')
    else:
        info('[D] No local FXState definition found (may already be imported).')

    # ── Step D4: Find onToggle prop ───────────────────────────────────────────
    toggle_old_pat = re.compile(r"onToggle\?\s*:\s*\(fx\s*:\s*string\)\s*=>\s*void")
    toggle_m = toggle_old_pat.search(fx)
    if toggle_m:
        info(f'[D] Found onToggle with string param: {toggle_m.group(0)}')
    else:
        info('[D] onToggle with string param not found (may already use keyof FXState).')

    if not APPLY:
        info('[D] DRY-RUN: would apply the following to fx-panel.tsx:')
        if not already_imported:
            info('    1. Inject: import type { FXState } from "../audio/core/instrument-engine";')
        if local_m:
            info('    2. Remove local FXState definition')
        if toggle_m:
            info('    3. Update onToggle?: (fx: string) → onToggle?: (fx: keyof FXState)')
    else:
        changed = False

        # Step 1: Inject import if not present
        if not already_imported:
            # Find last import line to insert after
            last_imp = list(re.finditer(r'^import .+$', fx, re.MULTILINE))
            if last_imp:
                pos = last_imp[-1].end()
                new_line = f"\nimport type {{ FXState }} from {ENGINE_REL};"
                fx = fx[:pos] + new_line + fx[pos:]
                ok('[D1] import type { FXState } injected after last import')
                changed = True
            else:
                err('[D1] Could not find import block — inject FXState import manually.')

        # Step 2: Remove local FXState definition (re-search after possible edit)
        local_m2 = local_fxstate_pat.search(fx)
        if local_m2:
            count_local = fx.count(local_m2.group(0))
            if count_local == 1:
                fx = fx.replace(local_m2.group(0), '')
                ok('[D2] Local FXState definition removed')
                changed = True
            else:
                warn(f'[D2] Local FXState appears {count_local} times — not removing automatically.')
        else:
            info('[D2] No local FXState to remove.')

        # Step 3: Update onToggle param type
        toggle_m2 = toggle_old_pat.search(fx)
        if toggle_m2:
            OLD_TOGGLE = toggle_m2.group(0)
            NEW_TOGGLE = OLD_TOGGLE.replace('(fx: string)', '(fx: keyof FXState)')
            count_t = fx.count(OLD_TOGGLE)
            assert count_t == 1, f'[D3] onToggle string: expected 1, got {count_t}'
            fx = fx.replace(OLD_TOGGLE, NEW_TOGGLE)
            ok('[D3] onToggle param updated: string → keyof FXState')
            changed = True
        else:
            info('[D3] onToggle string param not found — may already be correct.')

        if changed:
            write_file(FX, fx)
        else:
            info('[D] No changes made to fx-panel.tsx.')


# ══════════════════════════════════════════════════════════════════════════════
# Final TSC verify
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
        err('TSC errors remain after patch:')
        combined = (result.stdout + result.stderr)[-4000:]
        print(combined)
        info('Review errors above. Backups available at:')
        info(f'  {BACKUP_DIR}')
        info('Rollback command:')
        for f in os.listdir(BACKUP_DIR):
            src_path = f.replace('.bak', '')
            # guess location
            for base in [PAGES, COMPONENTS]:
                candidate = os.path.join(base, src_path)
                if os.path.exists(candidate):
                    print(f'  cp {os.path.join(BACKUP_DIR, f)} {candidate}')
else:
    print()
    print('  ╔══════════════════════════════════════════════════════════╗')
    print('  ║  DRY-RUN complete — no files written.                   ║')
    print('  ║                                                          ║')
    print('  ║  Review context output above, then:                     ║')
    print('  ║    python3 r3-tsc-fix-all.py --run                      ║')
    print('  ╚══════════════════════════════════════════════════════════╝')
    print()
