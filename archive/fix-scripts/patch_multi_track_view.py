#!/usr/bin/env python3
"""
patch_multi_track_view.py
Patches: client/src/components/multi-track-view.tsx
Patches: 2 (track-row styling, FX chip styling)
Anchors: verified against live file grep output 2026-05-30
Protocol: WIRE — backup before write, assert count==1, TSC after
"""
import pathlib, shutil, time, sys

DRY_RUN = '--apply' not in sys.argv

p = pathlib.Path('/home/r3v/Stable/client/src/components/multi-track-view.tsx')
assert p.exists(), f"File not found: {p}"

bak = p.with_suffix(f'.tsx.bak.{int(time.time())}')
shutil.copy2(p, bak)
print(f"Backup: {bak}")

src = p.read_text()

def patch(src, old, new, name):
    count = src.count(old)
    assert count == 1, f"ANCHOR FAIL '{name}': found {count}"
    print(f"  ✓ anchor '{name}' found 1")
    if DRY_RUN:
        return src
    return src.replace(old, new)

# ── P1: track-row — replace Tailwind className + style with inline style object ──
# Anchor: lines 407-414 (20-space indent, confirmed unique via h-20 border-zinc-800)
src = patch(src,
    '''                    className={`flex items-center h-20 border-b border-zinc-800 transition-colors ${
                      track.locked ? 'opacity-60 cursor-not-allowed' : 'cursor-move'
                    } ${
                        dragState.trackId === track.id
                          ? 'bg-muted/50'
                          : 'hover:bg-muted/50'
                    } ${track.color ? `border-l-4 ${track.color}` : 'border-border'}`}
                    style={{ paddingLeft: isGroup ? '2rem' : undefined }}''',
    '''                    className={`flex items-center border-b transition-all ${
                      track.locked ? 'opacity-60 cursor-not-allowed' : 'cursor-move'
                    } ${
                        dragState.trackId === track.id
                          ? 'bg-zinc-800/80'
                          : 'hover:bg-zinc-900/60'
                    }`}
                    style={{
                      paddingLeft: isGroup ? '2rem' : undefined,
                      height: 72,
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      borderLeft: track.color ? `3px solid ${track.color}` : '3px solid rgba(163,230,53,0.15)',
                      background: dragState.trackId === track.id ? 'rgba(163,230,53,0.04)' : undefined,
                      position: 'relative',
                    }}''',
    'track-row'
)

# ── P2: FX chip — replace Tailwind gradient pill with IBM Plex Mono badge ──
# Anchor: line 520, confirmed unique via from-purple-600 to-purple-700 count=1
src = patch(src,
    '                          className="px-2.5 py-1 text-xs font-medium bg-gradient-to-br from-purple-600 to-purple-700 rounded cursor-move hover:from-purple-500 hover:to-purple-600 transition-all group flex items-center gap-1"',
    '''                          className="group flex items-center"
                          style={{
                            padding: '3px 8px',
                            fontSize: 8,
                            fontWeight: 700,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase' as const,
                            fontFamily: '"IBM Plex Mono", monospace',
                            background: 'rgba(139,92,246,0.15)',
                            border: '1px solid rgba(139,92,246,0.35)',
                            borderRadius: 3,
                            color: 'rgba(196,181,253,0.9)',
                            cursor: 'move',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'all 0.1s',
                          }}''',
    'fx-chip'
)

if DRY_RUN:
    print("\nDRY RUN complete — no files written. Re-run with --apply to write.")
else:
    p.write_text(src)
    print(f"\nWrote {p}")
    print("Next: pnpm tsc --noEmit (must stay at 0 errors)")
