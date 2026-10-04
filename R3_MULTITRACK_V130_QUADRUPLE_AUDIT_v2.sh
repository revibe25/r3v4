#!/usr/bin/env bash
set -euo pipefail

ROOT="${R3_ROOT:-$HOME/Projects/r3v4}"
REF="${R3_REF:-$ROOT/r3-native-multitrack-v1.3.0-CORRECTED.html}"
OUT="${R3_AUDIT_OUT:-$ROOT/R3_MULTITRACK_V130_QUADRUPLE_AUDIT-$(date +%Y%m%d-%H%M%S).txt}"

cd "$ROOT"

exec > >(tee "$OUT") 2>&1

echo '============================================================'
echo 'R3 NATIVE MULTITRACK v1.3.0 — QUADRUPLE-CHECK INTEGRATION AUDIT'
echo 'READ ONLY — NO FILES ARE MODIFIED EXCEPT THIS REPORT'
echo '============================================================'
printf 'ROOT: %s\nREF:  %s\nOUT:  %s\n' "$ROOT" "$REF" "$OUT"

PASS=0
FAIL=0
WARN=0
ok(){ printf 'PASS: %s\n' "$*"; PASS=$((PASS+1)); }
bad(){ printf 'FAIL: %s\n' "$*"; FAIL=$((FAIL+1)); }
warn(){ printf 'WARN: %s\n' "$*"; WARN=$((WARN+1)); }

section(){ echo; echo "=== $* ==="; }

section '1. WORKTREE SAFETY'
git status --short
if git diff --quiet -- client/src/pages/multi-track-panel/index.tsx client/src/MultitrackViewWrapper.tsx client/src/pages/DAW.tsx client/src/hooks/useDAWStore.ts client/src/project/daw-project-state.ts client/src/hooks/use-midi.ts client/src/hooks/use-audio-engine.ts; then
  ok 'No unstaged diff in primary multitrack integration surfaces.'
else
  warn 'One or more primary integration surfaces already contain uncommitted changes; preserve them and patch surgically.'
fi

section '2. REFERENCE FILE INTEGRITY'
if [[ -f "$REF" ]]; then
  sha256sum "$REF"
  wc -c "$REF"
  ok 'Corrected v1.3.0 reference exists.'
else
  bad 'Reference HTML not found at REF path.'
fi

section '3. REFERENCE HTML STRUCTURAL CHECKS'
if [[ -f "$REF" ]]; then
python3 - "$REF" <<'PY'
import re, sys, html
from pathlib import Path
p=Path(sys.argv[1])
s=p.read_text(encoding='utf-8', errors='strict')
ids=re.findall(r'\bid=["\']([^"\']+)["\']', s)
from collections import Counter
c=Counter(ids)
dup={k:v for k,v in c.items() if v>1}
print('HTML bytes:', len(s.encode()))
print('Duplicate IDs:', dup)
print('script tags:', len(re.findall(r'<script\b', s, re.I)))
print('style tags:', len(re.findall(r'<style\b', s, re.I)))
print('external script src:', re.findall(r'<script[^>]+src=["\']([^"\']+)', s, re.I))
print('external stylesheet href:', re.findall(r'<link[^>]+href=["\']([^"\']+)', s, re.I))
checks = {
    'R3 NATIVE · Multitrack workstation — v1.3.0': 'R3 NATIVE · Multitrack workstation — v1.3.0' in s,
    'const DESIGN_W = 1536': re.search(r'\bconst\s+DESIGN_W\s*=\s*1536\b', s) is not None,
    'const DESIGN_H = 1024': re.search(r'\bconst\s+DESIGN_H\s*=\s*1024\b', s) is not None,
    'const CV = new Set': re.search(r'\bconst\s+CV\s*=\s*new\s+Set', s) is not None,
    'window.R3Multitrack': 'window.R3Multitrack' in s,
}
for token, present in checks.items():
    print(f'{token}:', present)
for role in ['listbox','option','menu']:
    print(f'role={role}:', len(re.findall(r'role=["\']'+role+r'["\']', s)))
print('panel IDs present:', all(f'id="{x}"' in s for x in ['side','arr','routing','takes','padsP','pianoP','mixer','dsp','ana']))
if dup:
    raise SystemExit(2)
PY

  JS_TMP="$(mktemp --suffix=.js)"
  trap 'rm -f "$JS_TMP"' EXIT
  python3 - "$REF" "$JS_TMP" <<'PY'
import re,sys
from pathlib import Path
s=Path(sys.argv[1]).read_text(encoding='utf-8')
js='\n'.join(re.findall(r'<script[^>]*>(.*?)</script>',s,re.I|re.S))
Path(sys.argv[2]).write_text(js,encoding='utf-8')
PY
  if node --check "$JS_TMP"; then ok 'Embedded JavaScript passes node --check.'; else bad 'Embedded JavaScript fails node --check.'; fi
fi

section '4. CANONICAL CANDIDATE FILES'
FILES=(
  client/src/pages/multi-track-panel/index.tsx
  client/src/MultitrackViewWrapper.tsx
  client/src/pages/DAW.tsx
  client/src/hooks/useDAWStore.ts
  client/src/project/daw-project-state.ts
  client/src/hooks/use-midi.ts
  client/src/hooks/use-audio-engine.ts
  client/src/pages/instrument.tsx
)
for f in "${FILES[@]}"; do
  if [[ -f "$f" ]]; then printf 'FOUND  %s\n' "$f"; else printf 'MISS   %s\n' "$f"; fi
done

section '5. ROUTE / IMPORT / WRAPPER OWNERSHIP'
grep -RInE --exclude-dir=node_modules --exclude-dir=dist --exclude='*.map' \
  "path=[\"']/multitrack|path=[\"']/daw|MultiTrackPanel|MultitrackViewWrapper" \
  client/src/App.tsx client/src/pages client/src 2>/dev/null | head -300 || true

echo
echo 'Primary candidate heuristic:'
if [[ -f client/src/pages/multi-track-panel/index.tsx ]]; then
  ok 'Dedicated multi-track page exists: this is the primary replacement target.'
else
  bad 'Dedicated multi-track page is missing.'
fi
if [[ -f client/src/pages/DAW.tsx ]]; then
  warn 'DAW.tsx exists; treat it as orchestration/integration source, not as a visual replacement for v1.3.0.'
fi

section '6. ARCHITECTURE / NO-PARALLEL-ENGINE CHECK'
for pat in 'new AudioContext' 'new OfflineAudioContext' 'requestMIDIAccess' 'onmidimessage'; do
  echo "--- $pat ---"
  rg -n --glob '!node_modules/**' --glob '!dist/**' --glob '!*.map' "$pat" client/src | head -200 || true
done

echo
echo 'Duplicate singleton-risk names:'
rg -n --glob '!node_modules/**' --glob '!dist/**' 'new AudioContext|new OfflineAudioContext' client/src | wc -l | awk '{print "AudioContext constructors:",$1}'
rg -n --glob '!node_modules/**' --glob '!dist/**' 'requestMIDIAccess' client/src | wc -l | awk '{print "requestMIDIAccess call sites:",$1}'

section '7. SHARED STATE / MODEL SURFACES'
for pat in 'type: .audio. .midi. .bus. .instrument.' 'tracks' 'automation' 'bpm' 'loop' 'snap' 'sends' 'master' 'dsp'; do
  echo "--- $pat ---"
  rg -n --glob '!node_modules/**' --glob '!dist/**' "$pat" \
    client/src/hooks/useDAWStore.ts \
    client/src/project/daw-project-state.ts \
    shared/types/*.ts 2>/dev/null | head -120 || true
done

section '8. V1.3.0 FEATURE PRESERVATION MATRIX'
FEATURES=(
  'header transport/clock/tempo/modes/engine/settings'
  'File/Edit/View/Options/Help menus'
  '7-track arrangement + timeline'
  'automation lane add/move/delete with anchored endpoints'
  'routing + buses + sends'
  'take lane + audition'
  'pad controller'
  'piano / MIDI / octave'
  '7-channel mixer + master'
  'DSP insert list + editor + master/vox targets'
  'master analyzer + LUFS/dBTP/RMS/phase/stereo/GR'
  'master output meter on initial render'
  'panel collapse / expand / maximize / restore'
  'per-panel 2D↔3D rendering mode'
  'collapse-all empty state'
  'keyboard menu roving focus + focus return'
  'Space transport while range input is focused'
  'MIDI 0x80 and 0x90 velocity-zero release'
  'undo / redo'
  'project load / sanitize / invalid-project rejection'
  'viewport fit: scale=min(W/1536,H/1024), logical stage expansion'
  'live canvas Set + detached cleanup'
  'spectrum cache keyed by sample rate + width'
)
for x in "${FEATURES[@]}"; do printf 'REQUIRED  %s\n' "$x"; done

section '9. GLOBAL-SCOPE CSS / DOM COLLISION CHECK'
for f in client/src/pages/multi-track-panel/index.tsx client/src/MultitrackViewWrapper.tsx client/src/pages/DAW.tsx; do
  [[ -f "$f" ]] || continue
  echo "--- $f ---"
  rg -n '(^|[^A-Za-z0-9_-])(html|body|button|input|select|canvas|#stage|#arr|#mixer|#dsp|#ana)\b' "$f" | head -120 || true
done

section '10. PACKAGE STACK CHECK'
node - <<'NODE'
const fs=require('fs');
const roots=['package.json','client/package.json'];
for(const f of roots){
  if(!fs.existsSync(f)) continue;
  const p=JSON.parse(fs.readFileSync(f,'utf8'));
  const all={...(p.dependencies||{}),...(p.devDependencies||{}),...(p.peerDependencies||{})};
  console.log('\n'+f);
  for(const k of ['react','react-dom','typescript','vite','zustand','tone','three','webmidi','@playwright/test','eslint']) if(all[k]) console.log(k,all[k]);
}
NODE

section '11. TYPECHECK / LINT (READ ONLY)'
if pnpm exec tsc --noEmit --pretty false; then ok 'TypeScript noEmit passed.'; else bad 'TypeScript noEmit failed; preserve current failure set and repair only integration deltas.'; fi
for f in client/src/pages/multi-track-panel/index.tsx client/src/MultitrackViewWrapper.tsx client/src/pages/DAW.tsx client/src/hooks/useDAWStore.ts client/src/project/daw-project-state.ts client/src/hooks/use-midi.ts client/src/hooks/use-audio-engine.ts; do
  [[ -f "$f" ]] || continue
  if pnpm exec eslint "$f"; then ok "ESLint passed: $f"; else bad "ESLint failed: $f"; fi
done

section '12. FINAL DISPOSITION'
printf 'PASS=%s FAIL=%s WARN=%s\n' "$PASS" "$FAIL" "$WARN"
cat <<'TXT'

Engineering interpretation:
- Primary visual replacement target: client/src/pages/multi-track-panel/index.tsx
- Route/shell adapter: client/src/MultitrackViewWrapper.tsx
- DAW.tsx: preserve as broader orchestration/persistence source; do not replace it with the standalone HTML.
- Canonical state: useDAWStore + daw-project-state / existing domain types.
- Canonical audio: existing audio/engine singleton(s); do not instantiate a competing playback graph from the page.
- Canonical MIDI: existing MIDI hook/service; repair release semantics at the shared boundary if needed.
- Canonical DSP: adapt UI controls to the existing DSP modules instead of duplicating DSP implementation in JSX.
- Canonical rendering: feature-scoped canvas/render modules; preserve v1.3.0 pointer geometry, fit math, and panel behavior.
- CSS: scope all v1.3.0 styles beneath a multitrack root; never copy global html/body/button selectors from the standalone file.
- Persistence: project state belongs to the app store/cloud layer; panel UI state may remain feature-scoped.
- Rollout: retain the current multitrack implementation behind a reversible feature switch until parity tests pass.
TXT
