#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
#  patch-collab-daw.sh  —  R3 v4  collaborative-daw-pro.tsx  patcher
#  Applies 5 targeted patches. Exact-string match, no guessing.
#
#  Usage:
#    ./patch-collab-daw.sh              # apply all patches
#    ./patch-collab-daw.sh --dry-run   # verify matches, write nothing
#    ./patch-collab-daw.sh --restore   # roll back to most-recent backup
#
#  Patches:
#    P1  Fix _h undefined reference  (clip selection crash)
#    P2  Canvas resize guard + idempotent setTransform  (flicker)
#    P3  Peak detection in VU interval  (peakedTracks wired but dead)
#    P4a _tickTs state declaration  (activity timestamp freshness)
#    P4b Timestamp ticker useEffect
#    P5  Remove dead _CollabDAWPro alias
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DRY_RUN=false
RESTORE=false

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true  ;;
    --restore) RESTORE=true  ;;
    *) printf 'ERROR: Unknown flag: %s\n' "$arg" >&2; exit 1 ;;
  esac
done

RELPATH="client/src/pages/collaborative-daw-pro.tsx"

# ── Locate file ───────────────────────────────────────────────────────────────
if   [[ -f "$RELPATH" ]];                   then FILE="$RELPATH"
elif [[ -f "$HOME/Stable/$RELPATH" ]];      then FILE="$HOME/Stable/$RELPATH"
elif [[ -f "Stable/$RELPATH" ]];            then FILE="Stable/$RELPATH"
else
  printf 'ERROR: Cannot locate %s\n' "$RELPATH" >&2
  printf '       Run from ~/Stable or the monorepo root.\n'  >&2
  exit 1
fi

# ── Restore mode ──────────────────────────────────────────────────────────────
if $RESTORE; then
  # shellcheck disable=SC2012
  LATEST=$(ls -t "${FILE}.bak."* 2>/dev/null | head -1 || true)
  if [[ -z "$LATEST" ]]; then
    printf 'ERROR: No backup found for %s\n' "$FILE" >&2
    exit 1
  fi
  cp "$LATEST" "$FILE"
  printf 'RESTORED  %s\n' "$FILE"
  printf 'FROM      %s\n' "$LATEST"
  exit 0
fi

# ── Backup ────────────────────────────────────────────────────────────────────
BACKUP="${FILE}.bak.$(date +%Y%m%d_%H%M%S)"
cp "$FILE" "$BACKUP"
printf 'BACKUP    %s\n' "$BACKUP"

# ── Python patcher ────────────────────────────────────────────────────────────
# Pass values via env — heredoc uses single-quoted delimiter so no bash expansion
export R3_FILE="$FILE"
export R3_BACKUP="$BACKUP"
export R3_DRY="$DRY_RUN"

python3 - << 'PYEOF'
import os, sys, shutil

path   = os.environ['R3_FILE']
backup = os.environ['R3_BACKUP']
dry    = os.environ['R3_DRY'] == 'true'

with open(path, 'r') as fh:
    src = fh.read()

original = src
applied  = []
failed   = []

# ── Patch engine ──────────────────────────────────────────────────────────────
def patch(label, old, new):
    global src
    n = src.count(old)
    if n == 0:
        failed.append(f'  FAIL  {label}  — pattern not found')
        return
    if n > 1:
        failed.append(f'  FAIL  {label}  — ambiguous ({n} matches)')
        return
    src = src.replace(old, new, 1)
    applied.append(f'  OK    {label}')

# ── P1: Fix _h undefined reference in handleCanvasClick ──────────────────────
# _h is never declared; should be h (the const capturing hit above)
patch(
    'P1  clip selection  _h → h',
    (
        '      e.metaKey||e.ctrlKey\n'
        '        ? setSelectedClipIds(p => p.includes(_h) ? p.filter(x=>x!==_h) : [...p,_h])\n'
        '        : !selectedClipIds.includes(_h) && setSelectedClipIds([_h]);'
    ),
    (
        '      e.metaKey||e.ctrlKey\n'
        '        ? setSelectedClipIds(p => p.includes(h) ? p.filter(x=>x!==h) : [...p,h])\n'
        '        : !selectedClipIds.includes(h) && setSelectedClipIds([h]);'
    ),
)

# ── P2: Canvas resize guard + idempotent ctx.setTransform ────────────────────
# Unconditional canvas.width= destroys the GPU backing store every frame.
# Guard the resize; replace accumulating ctx.scale with idempotent setTransform.
patch(
    'P2  canvas resize guard',
    (
        '    const dpr  = window.devicePixelRatio || 1;\n'
        '    const rect = canvas.getBoundingClientRect();\n'
        '    canvas.width  = rect.width  * dpr;\n'
        '    canvas.height = rect.height * dpr;\n'
        '    ctx.scale(dpr, dpr);'
    ),
    (
        '    const dpr  = window.devicePixelRatio || 1;\n'
        '    const rect = canvas.getBoundingClientRect();\n'
        '    const nw   = Math.round(rect.width  * dpr);\n'
        '    const nh   = Math.round(rect.height * dpr);\n'
        '    if (canvas.width !== nw || canvas.height !== nh) {\n'
        '      canvas.width  = nw;\n'
        '      canvas.height = nh;\n'
        '    }\n'
        '    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);'
    ),
)

# ── P3: Peak detection in the VU setInterval ─────────────────────────────────
# peakedTracks is threaded through every VUMeter but setPeakedTracks is
# never called. Wire it up: flag tracks above 0.93 and auto-clear after 1.5 s.
patch(
    'P3  peak detection in VU interval',
    (
        '          levels[t.id] = clamp((Math.random()*0.7 + 0.2) * t.volume, 0, 1);\n'
        '        });\n'
        '        setVuLevels(levels);\n'
        '      } else {'
    ),
    (
        '          levels[t.id] = clamp((Math.random()*0.7 + 0.2) * t.volume, 0, 1);\n'
        '        });\n'
        '        setVuLevels(levels);\n'
        '        const peaked = new Set<string>(\n'
        '          project.tracks\n'
        '            .filter(t => !t.muted && (levels[t.id] ?? 0) > 0.93)\n'
        '            .map(t => t.id)\n'
        '        );\n'
        '        if (peaked.size) {\n'
        '          setPeakedTracks(prev => new Set([...prev, ...peaked]));\n'
        '          setTimeout(() => setPeakedTracks(new Set()), 1500);\n'
        '        }\n'
        '      } else {'
    ),
)

# ── P4a: _tickTs state declaration ───────────────────────────────────────────
# Dummy state whose sole job is forcing re-renders so relative timestamps
# ("3s ago", "2m ago") in the activity feed stay live.
patch(
    'P4a _tickTs state',
    (
        '  const [showSettings, setShowSettings]             = useState(false);\n'
        '\n'
        '  const canvasRef'
    ),
    (
        '  const [showSettings, setShowSettings]             = useState(false);\n'
        '  const [, _tickTs]                                  = useState(0);\n'
        '\n'
        '  const canvasRef'
    ),
)

# ── P4b: Timestamp ticker useEffect ──────────────────────────────────────────
# Fires every 8 s — enough resolution for "Xs / Xm ago" display.
# Anchored after the collab simulation interval (}, [addActivity])) which
# is the only useEffect in this file with that exact dep array.
patch(
    'P4b timestamp ticker useEffect',
    (
        '    return () => clearInterval(interval);\n'
        '  }, [addActivity]);\n'
        '\n'
        '  // ── History'
    ),
    (
        '    return () => clearInterval(interval);\n'
        '  }, [addActivity]);\n'
        '\n'
        '  // ── Timestamp ticker ──────────────────────────────────────────────────────\n'
        '  useEffect(() => {\n'
        '    const id = setInterval(() => _tickTs(n => n + 1), 8000);\n'
        '    return () => clearInterval(id);\n'
        '  }, []);\n'
        '\n'
        '  // ── History'
    ),
)

# ── P5: Remove dead _CollabDAWPro alias ───────────────────────────────────────
# Assigned but never read. Holds a live ref preventing tree-shaking.
patch(
    'P5  remove dead _CollabDAWPro alias',
    (
        'const _CollabDAWPro = CollabDAWProInner;\n'
        '\n'
        'export default function CollabDAWPro() {'
    ),
    'export default function CollabDAWPro() {',
)

# ── Report ────────────────────────────────────────────────────────────────────
print()
for msg in applied: print(msg)
for msg in failed:  print(msg)
print()

if failed:
    shutil.copy2(backup, path)
    print(f'ABORTED   {len(failed)} patch(es) failed — backup restored')
    sys.exit(1)

if src == original:
    print('WARNING   Source unchanged — patches already applied?')
    sys.exit(0)

if dry:
    net = len(src.splitlines()) - len(original.splitlines())
    print(f'DRY RUN   {len(applied)} patch(es) verified  ({net:+d} lines net)')
    print('          Remove --dry-run to write.')
    sys.exit(0)

with open(path, 'w') as fh:
    fh.write(src)

net = len(src.splitlines()) - len(original.splitlines())
print(f'WRITTEN   {path}')
print(f'          {len(applied)} patches applied  ({net:+d} lines net)')
PYEOF
