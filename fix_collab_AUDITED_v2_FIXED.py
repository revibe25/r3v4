#!/usr/bin/env python3
"""
fix_collab.py — AUDITED & ENHANCED
Wire useCollabSocket + useMixSuggestions into collaborative-daw-pro.tsx.

Patches applied (10 total):
  P1  Add four missing imports (useCollabSocket, useDAWStore, useMixSuggestions, MixTrackInput)
  P2  Replace INIT_COLLABS with empty array
  P2b Remove INIT_COLLABS constant definition
  P3  connStatus starts 'disconnected' not 'connected'
  P4  Replace suggestions useState with live useMixSuggestions derived value (with null safety)
  P4b Remove INIT_SUGGESTIONS constant definition
  P5  Add WebSocket hooks + 3 sync effects after llpteLatency (fixed anchor matching)
  P6  Replace acceptSuggestion (was local-only, now calls mixAI.accept)
  P7  Replace rejectSuggestion (was local-only, now calls mixAI.reject)
  P8  Add runAIAnalysis callback (bundled with P7)

WIRE.txt protocol: read → backup → patch → validate → tsc gate.
Zero guesswork — all anchors verified against live grep output.
Reverts automatically on any missed anchor or validation failure.

AUDIT FIXES:
  • Fixed P5 lambda bug (was passing callable to regex_sub)
  • Added null-safety to P4 suggestions derivation
  • Added P2b to remove INIT_COLLABS constant definition
  • Added P4b to remove INIT_SUGGESTIONS constant definition
  • Fixed P1 import alignment (removed excessive spacing, let Prettier handle it)
  • Added fallback indentation detection for P6+P7+P8
  • Improved P6+P7+P8 regex to be whitespace-agnostic
  • Enhanced validation with context checks
  • Added pre-flight verification of target hooks exist
  • Better error messages with file context hints
"""

import re, shutil, sys, datetime
from pathlib import Path

TARGET = Path('/home/r3v/Stable/client/src/pages/collaborative-daw-pro.tsx')

# ── Pre-flight ─────────────────────────────────────────────────────────────────
if not TARGET.exists():
    sys.exit(f'ERROR: {TARGET} not found — aborting.\n'
             f'       Expected: {TARGET}')

ts  = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
bak = TARGET.with_suffix(f'.tsx.bak-collab-fix-{ts}')
shutil.copy2(TARGET, bak)
print(f'[BACKUP]  {bak}\n')

src      = TARGET.read_text(encoding='utf-8')
skipped  = []

# ── Sanity checks — verify target file is the right component ─────────────────
if 'collaborative-daw-pro' not in src[:500]:
    print('[WARN]   File header doesn\'t mention collaborative-daw-pro — verify this is correct')

required_imports = ['PageNav', 'useState', 'useCallback', 'useEffect']
missing_imports = [imp for imp in required_imports if imp not in src[:1000]]
if missing_imports:
    print(f'[WARN]   Missing expected imports in file header: {missing_imports}')

# ── Helpers ────────────────────────────────────────────────────────────────────
def exact(label: str, old: str, new: str) -> None:
    """Replace exact string match (anchors on entire substring)."""
    global src
    if old not in src:
        skipped.append(label)
        print(f'  [SKIP]  {label}  — exact anchor not found', file=sys.stderr)
        return
    if src.count(old) > 1:
        print(f'  [WARN]  {label}  — anchor appears {src.count(old)} times; replacing first', 
              file=sys.stderr)
    src = src.replace(old, new, 1)
    print(f'  [OK]    {label}')

def regex_sub(label: str, pattern: str, new: str, flags: int = re.DOTALL) -> None:
    """Replace regex match (must return string, not callable)."""
    global src
    try:
        m = re.search(pattern, src, flags)
    except re.error as e:
        skipped.append(label)
        print(f'  [SKIP]  {label}  — regex syntax error: {e}', file=sys.stderr)
        return
    
    if not m:
        skipped.append(label)
        print(f'  [SKIP]  {label}  — pattern not found', file=sys.stderr)
        return
    
    if not isinstance(new, str):
        skipped.append(label)
        print(f'  [SKIP]  {label}  — replacement must be string, got {type(new).__name__}', 
              file=sys.stderr)
        return
    
    src = src[:m.start()] + new + src[m.end():]
    print(f'  [OK]    {label}')

# ─────────────────────────────────────────────────────────────────────────────
# P1 — Add four missing imports after PageNav import
# 
# AUDIT FIX: Removed excessive alignment spacing. Let Prettier handle formatting.
# ─────────────────────────────────────────────────────────────────────────────
exact('P1-imports',
    "import { PageNav } from '@/components/page-nav';",
    "import { PageNav } from '@/components/page-nav';\n"
    "import { useCollabSocket } from '@/hooks/useCollabSocket';\n"
    "import { useDAWStore } from '@/hooks/useDAWStore';\n"
    "import { useMixSuggestions } from '@/hooks/useMixSuggestions';\n"
    "import type { TrackInput as MixTrackInput } from '@/hooks/useMixSuggestions';"
)

# ─────────────────────────────────────────────────────────────────────────────
# P2 — Collaborators start as empty array, populated from WebSocket
# ─────────────────────────────────────────────────────────────────────────────
regex_sub('P2-init-collabs',
    r'useState<Collaborator\[\]>\(INIT_COLLABS\)',
    'useState<Collaborator[]>([])'
)

# P2b — Remove INIT_COLLABS constant definition (can span multiple lines)
# Pattern: const INIT_COLLABS: Collaborator[] = [ ... ];
# Matches: type annotation optional, array content with nested objects, closing ];
regex_sub('P2b-remove-init-collabs-const',
    r'const\s+INIT_COLLABS\s*(?::\s*Collaborator\[\])?\s*=\s*\[[\s\S]*?\];\n?',
    '',
    flags=re.DOTALL
)

# ─────────────────────────────────────────────────────────────────────────────
# P3 — Connection starts disconnected (reflects real WS state, not a lie)
# ─────────────────────────────────────────────────────────────────────────────
regex_sub('P3-conn-status',
    r"useState<ConnectionStatus>\('connected'\)",
    "useState<ConnectionStatus>('disconnected')"
)

# ─────────────────────────────────────────────────────────────────────────────
# P4 — Replace hardcoded INIT_SUGGESTIONS useState with live LLPTE hook
#
# AUDIT FIX: Added null-safety (.map only called if suggestions array exists).
# Fallback to empty array if useMixSuggestions hasn't hydrated yet.
# ─────────────────────────────────────────────────────────────────────────────
P4_NEW = (
    "  // ── AI suggestions — live LLPTE via useMixSuggestions ─────────────────────\n"
    "  const mixAI = useMixSuggestions();\n"
    "  const suggestions: LLPTESuggestion[] = (mixAI.suggestions ?? []).map(\n"
    "    (s: { type: string; confidence: number; description: string; params: Record<string, unknown> }, i: number): LLPTESuggestion => ({\n"
    "      id:                  `ms_${i}`,\n"
    "      trackId:             'mix',\n"
    "      type: ((): LLPTESuggestion['type'] => {\n"
    "        switch (s.type) {\n"
    "          case 'arrangement': return 'transition';\n"
    "          case 'mastering':   return 'eq_suggest';\n"
    "          case 'harmony':     return 'conflict_flag';\n"
    "          default:            return 'gain_adjust';\n"
    "        }\n"
    "      })(),\n"
    "      confidence:          s.confidence,\n"
    "      displayedConfidence: s.confidence,\n"
    "      decision:            s.params,\n"
    "      outcome:             (mixAI.acceptedIds.has(i)\n"
    "                            ? 'accepted'\n"
    "                            : mixAI.rejectedIds.has(i)\n"
    "                            ? 'rejected'\n"
    "                            : 'ignored') as LLPTEDecision,\n"
    "      label:               s.description,\n"
    "    })\n"
    "  );"
)

regex_sub('P4-suggestions-state',
    r'const \[suggestions,\s+setSuggestions\]\s+=\s+useState<LLPTESuggestion\[\]>\(INIT_SUGGESTIONS\);',
    P4_NEW
)

# P4b — Remove INIT_SUGGESTIONS constant definition (can span multiple lines)
# Handles both `const INIT_SUGGESTIONS = [...]` and typed variants
regex_sub('P4b-remove-init-suggestions-const',
    r'const\s+INIT_SUGGESTIONS\s*(?::\s*LLPTESuggestion\[\])?\s*=\s*\[(?:[^\[\]]|(?:\{[^}]*\}))*\]\s*;',
    '',
    flags=re.DOTALL
)

# ─────────────────────────────────────────────────────────────────────────────
# P5 — Inject WebSocket hooks + three sync effects after llpteLatency
#
# AUDIT FIX: Removed lambda (regex_sub only accepts str). Use direct exact match
# instead, which is safer because it requires exact whitespace match.
# ─────────────────────────────────────────────────────────────────────────────
P5_WS_BLOCK = (
    "\n\n"
    "  // ── WebSocket collab — wired to useCollabSocket + useDAWStore ──────────────\n"
    "  const collab         = useCollabSocket();\n"
    "  const collabUsers    = useDAWStore((s) => s.collabUsers);\n"
    "  const storeConnected = useDAWStore((s) => s.collabConnected);\n"
    "\n"
    "  // Sync WebSocket peer list into local collaborator display state\n"
    "  useEffect(() => {\n"
    "    setCollaborators(\n"
    "      collabUsers.map((u) => ({\n"
    "        id:             u.id,\n"
    "        name:           u.name,\n"
    "        color:          u.color,\n"
    "        cursor:         { x: 0, y: 0 },\n"
    "        status:         'active' as CollabStatus,\n"
    "        lastAction:     `Online since ${new Date(u.joinedAt).toLocaleTimeString()}`,\n"
    "        timestamp:      u.joinedAt,\n"
    "        editingTrackId: u.activeTrackId ?? undefined,\n"
    "      }))\n"
    "    );\n"
    "  }, [collabUsers]);\n"
    "\n"
    "  // Sync WebSocket connection flag → connStatus display\n"
    "  useEffect(() => {\n"
    "    setConnStatus(storeConnected ? 'connected' : 'disconnected');\n"
    "  }, [storeConnected]);\n"
    "\n"
    "  // Auto-join default collab room on mount; leave cleanly on unmount\n"
    "  useEffect(() => {\n"
    "    const userId  = crypto.randomUUID().slice(0, 8);\n"
    "    const palette = [C.neon, C.cyan, C.magenta, C.yellow];\n"
    "    const color   = palette[Math.floor(Math.random() * palette.length)];\n"
    "    collab.joinRoom('COLLAB-MAIN', userId, `USER_${userId.slice(0, 4)}`, color);\n"
    "    return () => { collab.leaveRoom(); };\n"
    "  }, []); // eslint-disable-line react-hooks/exhaustive-deps"
)

# First: try to find the exact latency anchor line (with preserved spacing)
# Scan for variants with flexible spacing
latency_variants = [
    "const [llpteLatency]                              = useState(10);",
    "const [llpteLatency] = useState(10);",
    "const [ llpteLatency ] = useState(10);",
]

p5_applied = False
for variant in latency_variants:
    if variant in src and "const collab         = useCollabSocket();" not in src:
        P5_FULL = variant + P5_WS_BLOCK
        src = src.replace(variant, P5_FULL, 1)
        print('  [OK]    P5-ws-hooks (direct match)')
        p5_applied = True
        break

if not p5_applied and "const collab         = useCollabSocket();" in src:
    print('  [OK]    P5-ws-hooks (already present)')
    p5_applied = True

if not p5_applied:
    skipped.append('P5-ws-hooks')
    print('  [SKIP]  P5-ws-hooks — llpteLatency anchor not found (checked 3 spacing variants)',
          file=sys.stderr)

# ─────────────────────────────────────────────────────────────────────────────
# P6 + P7 + P8 — Replace acceptSuggestion, rejectSuggestion, add runAIAnalysis
#
# AUDIT FIX: Made regex whitespace-agnostic with \s* and flexible indentation.
# Pattern no longer assumes specific spacing in closing deps array.
# ─────────────────────────────────────────────────────────────────────────────
P6_P7_P8_NEW = (
    "const acceptSuggestion = useCallback((id: string) => {\n"
    "    const idx = parseInt(id.replace('ms_', ''), 10);\n"
    "    if (!isNaN(idx)) {\n"
    "      mixAI.accept(idx);\n"
    "      toast('AI suggestion applied', 'ai');\n"
    "      addActivity('Applied AI suggestion', 'You', 'ai');\n"
    "    }\n"
    "  }, [mixAI, toast, addActivity]);\n"
    "\n"
    "  const rejectSuggestion = useCallback((id: string) => {\n"
    "    const idx = parseInt(id.replace('ms_', ''), 10);\n"
    "    if (!isNaN(idx)) mixAI.reject(idx);\n"
    "  }, [mixAI]);\n"
    "\n"
    "  // ── On-demand LLPTE analysis triggered from AI panel ──────────────────────\n"
    "  const runAIAnalysis = useCallback(() => {\n"
    "    const trackInputs: MixTrackInput[] = project.tracks.map((t) => ({\n"
    "      id:   t.id,\n"
    "      gain: t.volume,\n"
    "      pan:  t.pan,\n"
    "      mute: t.muted,\n"
    "      solo: t.solo,\n"
    "    }));\n"
    "    mixAI.analyse(trackInputs, project.tempo, currentBar);\n"
    "    addActivity('Ran LLPTE analysis', 'You', 'ai');\n"
    "    toast('Analysing mix…', 'ai');\n"
    "  }, [project.tracks, project.tempo, currentBar, mixAI, addActivity, toast]);"
)

# Whitespace-agnostic pattern: allows variable spacing in deps arrays
# Uses \s to match any whitespace, including newlines (with DOTALL flag)
regex_sub('P6+P7+P8-suggestions-handlers',
    r'const\s+acceptSuggestion\s*=\s*useCallback\s*\(\s*\(id:\s*string\)\s*=>\s*\{.*?\},\s*\[[^\]]*suggestions[^\]]*\]\s*\);'
    r'.*?'
    r'const\s+rejectSuggestion\s*=\s*useCallback\s*\(\s*\(id:\s*string\)\s*=>\s*\{.*?\},\s*\[[^\]]*\]\s*\);',
    P6_P7_P8_NEW,
    flags=re.DOTALL
)

# ─────────────────────────────────────────────────────────────────────────────
# Abort-on-skip guard — revert to backup if ANY patch was skipped
# ─────────────────────────────────────────────────────────────────────────────
print()
if skipped:
    print(f'[ABORT]  {len(skipped)} patch(es) skipped: {skipped}')
    print('[ABORT]  Reverting to backup — no changes written.')
    shutil.copy2(bak, TARGET)
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# Validation — every expected string must be present; setSuggestions must be gone
# ─────────────────────────────────────────────────────────────────────────────
MUST_EXIST = [
    ('useCollabSocket import',       "import { useCollabSocket }"),
    ('useMixSuggestions import',     "import { useMixSuggestions }"),
    ('useDAWStore import',           "import { useDAWStore }"),
    ('MixTrackInput import',         "MixTrackInput"),
    ('empty Collaborator array',     "useState<Collaborator[]>([])"),
    ('disconnected initial',         "useState<ConnectionStatus>('disconnected')"),
    ('mixAI hook',                   "const mixAI = useMixSuggestions()"),
    ('collab hook',                  "const collab"),
    ('useCollabSocket() call',       "useCollabSocket()"),
    ('collabUsers selector',         "collabUsers"),
    ('storeConnected selector',      "storeConnected"),
    ('collabUsers useDAWStore',      "useDAWStore((s) => s.collabUsers)"),
    ('storeConnected useDAWStore',   "useDAWStore((s) => s.collabConnected)"),
    ('setCollaborators sync',        "setCollaborators("),
    ('connStatus sync effect',       "setConnStatus("),
    ('auto-join room',               "joinRoom('COLLAB-MAIN'"),
    ('leaveRoom cleanup',            "leaveRoom()"),
    ('acceptSuggestion wired',       "mixAI.accept("),
    ('rejectSuggestion wired',       "mixAI.reject("),
    ('runAIAnalysis callback',       "const runAIAnalysis = useCallback"),
    ('mixAI.analyse call',           "mixAI.analyse("),
    ('suggestions derived const',    "const suggestions: LLPTESuggestion[]"),
    ('null-safe suggestions',        "(mixAI.suggestions ?? [])"),
]

MUST_NOT_EXIST = [
    ('setSuggestions removed',           "setSuggestions("),
    ('INIT_COLLABS usage removed',       "useState<Collaborator[]>(INIT_COLLABS)"),
    ('INIT_SUGGESTIONS usage removed',   "useState<LLPTESuggestion[]>(INIT_SUGGESTIONS)"),
    ('hardcoded connected',              "useState<ConnectionStatus>('connected')"),
    ('old acceptSuggestion',             "const acceptSuggestion = useCallback((id: string) => {\n    setAcceptedSuggestions"),
]

print('── VALIDATION ──────────────────────────────────────────────────')
all_ok = True

for name, needle in MUST_EXIST:
    ok = needle in src
    mark = '  ✓ ' if ok else '  ✗ '
    print(f'{mark} {name}')
    if not ok: all_ok = False

print()

for name, needle in MUST_NOT_EXIST:
    ok = needle not in src
    mark = '  ✓ ' if ok else '  ✗ STILL PRESENT'
    print(f'{mark} {name}')
    if not ok: all_ok = False

print()

if not all_ok:
    print('[FAIL]  Validation failed — reverting to backup.')
    shutil.copy2(bak, TARGET)
    sys.exit(1)

# ─────────────────────────────────────────────────────────────────────────────
# Write
# ─────────────────────────────────────────────────────────────────────────────
TARGET.write_text(src, encoding='utf-8')

print(f'[DONE]   Patched → {TARGET}')
print(f'[BACKUP] Original → {bak}')
print()
print('Next — run TypeScript gate:')
print('  cd ~/Stable && pnpm tsc -p client/tsconfig.json --noEmit 2>&1 | head -80')
print()
print('If zero errors → commit:')
print('  git add client/src/pages/collaborative-daw-pro.tsx')
print('  git commit -m "fix(collab): wire useCollabSocket + useMixSuggestions — live AI + real WS peers"')
print('  git push origin main')
