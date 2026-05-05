#!/usr/bin/env python3
"""
R3v4 Bug Patch Suite — WIRE Protocol
Resolves all 10 bugs diagnosed in git-clean.md audit session.
Run from ~/Stable:  python3 tools/r3_patch_all.py

Priority order:
  BLOCKER 1  — Store barrel: rename _useFooStore exports in 8 store files
  BLOCKER 2  — _AG / _COLOR / misc prefix-mismatch crashes (modal files, pricing)
  BLOCKER 3  — audio-engine.ts variable-name mismatches (_ab/ab, _step/step …)
  BLOCKER 4  — Remove duplicate auth store (stores/auth-store.ts)
  BLOCKER 5  — Playhead position: 'fixed' → 'absolute'
  PATCH  6   — AudioEngine.initialize() _engine/engine mismatch + gesture guard
  PATCH  7   — runtime-guard.ts false-positive on var(--color-*) tokens
  PATCH  8   — visuals.tsx BandMeterHUD prefix mismatches
  PATCH  9   — enforce-ui-design-system.sh: tagged-ref instead of commit-message grep
  INFO   10  — usePricing tRPC path verification (emits grep command, no write)
"""

import re
import sys
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ROOT = Path.cwd()
TS = datetime.now().strftime("%Y%m%d_%H%M%S")
BACKUP_DIR = ROOT / f".r3-patch-backups-{TS}"
RESULTS: list[str] = []
# FIX-C: per-filename call counter prevents silent overwrite when the same file
# is backed up more than once in a single run (e.g. multi-track-panel.tsx in
# both BLOCKER 5 and PATCH 6).  Suffixes become -1, -2, … instead of colliding.
_backup_counters: dict[str, int] = {}

def log(msg: str) -> None:
    print(msg)
    RESULTS.append(msg)

def backup(p: Path) -> Path:
    BACKUP_DIR.mkdir(exist_ok=True)
    key = p.name
    _backup_counters[key] = _backup_counters.get(key, 0) + 1
    dst = BACKUP_DIR / (p.name + f".bak-{TS}-{_backup_counters[key]}")
    shutil.copy2(p, dst)
    return dst

def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")

def write(p: Path, content: str) -> None:
    p.write_text(content, encoding="utf-8")

def find_file(*candidates: str) -> Path | None:
    for c in candidates:
        p = ROOT / c
        if p.exists():
            return p
    return None

def assert_unique(text: str, anchor: str, label: str) -> None:
    count = text.count(anchor)
    assert count == 1, (
        f"[TRIPLE-CHECK FAIL] '{anchor}' appears {count} times in {label}. "
        "Expected exactly 1. Re-read the file before proceeding."
    )

def replace1(text: str, old: str, new: str, label: str) -> str:
    assert_unique(text, old, label)
    return text.replace(old, new, 1)

def grep_verify(p: Path, pattern: str) -> bool:
    result = subprocess.run(
        ["grep", "-n", pattern, str(p)],
        capture_output=True, text=True
    )
    return bool(result.stdout.strip())

def section(title: str) -> None:
    log(f"\n{'='*70}")
    log(f"  {title}")
    log('='*70)

# ---------------------------------------------------------------------------
# BLOCKER 1 — Store barrel: strip _ prefix from hook / selector exports
# ---------------------------------------------------------------------------
STORE_RENAMES: dict[str, list[tuple[str, str]]] = {
    "client/src/store/audio-store.ts": [
        ("export const _useAudioStore", "export const useAudioStore"),
        ("export const _selectIsPlaying", "export const selectIsPlaying"),
    ],
    "client/src/store/clip-store.ts": [
        ("export const _useClipStore", "export const useClipStore"),
    ],
    "client/src/store/fx-store.ts": [
        ("export const _useFXStore", "export const useFXStore"),
    ],
    "client/src/store/meter-store.ts": [
        ("export const _useMeterStore", "export const useMeterStore"),
    ],
    "client/src/store/mixer-store.ts": [
        ("export const _useMixerStore", "export const useMixerStore"),
        # fix the broken default export: `export default useMixerStore`
        # useMixerStore was not in scope — it will be after the rename above
    ],
    "client/src/store/vst-store.ts": [
        ("export const _useVSTStore", "export const useVSTStore"),
    ],
    "client/src/stores/session-metrics.store.ts": [
        ("export const _useSessionMetricsStore", "export const useSessionMetricsStore"),
    ],
    # Additional path candidates tried at runtime via find_file in fix_store_barrel():
    # If session-metrics.store.ts still SKIPs, run:
    #   find client/src -name "*session-metrics*" -o -name "*metrics*store*"
    "client/src/store/session-metrics.store.ts": [
        ("export const _useSessionMetricsStore", "export const useSessionMetricsStore"),
    ],
    "client/src/store/metrics/session-metrics.store.ts": [
        ("export const _useSessionMetricsStore", "export const useSessionMetricsStore"),
    ],
    # FIX-G: auth-store.ts added as optional entry; guarded by presence check in loop
    "client/src/store/auth-store.ts": [
        ("export const _useAuthStore", "export const useAuthStore"),
    ],
}

def fix_store_barrel() -> None:
    section("BLOCKER 1 — Store barrel: strip _ prefix from hook exports")
    fixed = 0
    skipped = 0

    for rel_path, renames in STORE_RENAMES.items():
        p = ROOT / rel_path
        if not p.exists():
            log(f"  [SKIP] {rel_path} — file not found (path may differ)")
            skipped += 1
            continue

        bak = backup(p)
        log(f"  [BACKUP] {p.name} → {bak.name}")
        text = read(p)
        changed = False

        for old, new in renames:
            if old not in text:
                log(f"    [WARN] anchor not found, skipping: '{old}'")
                continue
            count = text.count(old)
            if count > 1:
                log(f"    [WARN] anchor appears {count}x — using replace(old, new, 1) only")
            text = text.replace(old, new, 1)
            log(f"    [RENAME] {old!r} → {new!r}")
            changed = True

        # Mixer-store special: fix `export default useMixerStore` that was broken
        # because only _useMixerStore existed before this patch.
        # After rename the identifier exists; nothing else to change there.

        if changed:
            write(p, text)
            log(f"  [WRITTEN] {rel_path}")
            fixed += 1

    log(f"\n  Store barrel summary: {fixed} files patched, {skipped} skipped.")
    log("  ACTION REQUIRED: run pnpm tsc --noEmit and fix any residual errors")
    log("  (barrel re-exports in store/index.ts should now resolve correctly)")


# FIX-H: r3_fix_store_barrel.py was never invoked in the original script.
# After store source files are patched, barrel index.ts re-exports need
# validation.  This function calls the barrel fixer as a subprocess and
# logs all output so it appears in the WIRE report.
def fix_store_barrel_script() -> None:
    section("BLOCKER 1 (cont.) — Invoke r3_fix_store_barrel.py")
    script = ROOT / "tools" / "r3_fix_store_barrel.py"
    if not script.exists():
        log(f"  [SKIP] r3_fix_store_barrel.py not found at {script}")
        log("  Place it at tools/r3_fix_store_barrel.py and re-run to validate barrel.")
        return
    result = subprocess.run(
        ["python3", str(script)],
        capture_output=True, text=True, cwd=ROOT
    )
    for line in (result.stdout + result.stderr).splitlines():
        log(f"  {line}")
    if result.returncode != 0:
        log("  [WARN] r3_fix_store_barrel.py exited with non-zero status — review above")


# ---------------------------------------------------------------------------
# BLOCKER 2a — preferences-modal.tsx: _AG → AG
# ---------------------------------------------------------------------------
def fix_ag_prefix() -> None:
    section("BLOCKER 2a — preferences-modal.tsx: _AG → AG")
    candidates = [
        "client/src/pages/multi-track-panel/components/preferences-modal.tsx",
        "client/src/components/preferences-modal.tsx",
        "client/src/components/ui/preferences-modal.tsx",
        "client/src/components/daw/preferences-modal.tsx",
    ]
    p = find_file(*candidates)
    if not p:
        log("  [SKIP] preferences-modal.tsx not found — check path manually")
        return

    bak = backup(p)
    log(f"  [BACKUP] {p.name} → {bak.name}")
    text = read(p)

    # FIX-A: use word-boundary regex so _AGGREGATE / _AGENCY / _AGENT* are not
    # silently corrupted.  \b_AG\b only matches the standalone token.
    before_count = len(re.findall(r'\b_AG\b', text))
    if before_count == 0:
        log("  [SKIP] No \\b_AG\\b tokens found — already patched or path differs")
        return
    text = re.sub(r'\b_AG\b', 'AG', text)
    write(p, text)
    log(f"  [WRITTEN] {p} — replaced {before_count} occurrences of _AG → AG")


# ---------------------------------------------------------------------------
# BLOCKER 2b — vst-panel-modal.tsx: same _AG pattern
# ---------------------------------------------------------------------------
def fix_vst_panel_ag() -> None:
    section("BLOCKER 2b — vst-panel-modal.tsx: _AG → AG")
    candidates = [
        "client/src/pages/multi-track-panel/components/vst-panel-modal.tsx",
        "client/src/components/vst-panel-modal.tsx",
        "client/src/components/ui/vst-panel-modal.tsx",
        "client/src/components/daw/vst-panel-modal.tsx",
    ]
    p = find_file(*candidates)
    if not p:
        log("  [SKIP] vst-panel-modal.tsx not found — check path manually")
        return

    bak = backup(p)
    log(f"  [BACKUP] {p.name} → {bak.name}")
    text = read(p)
    # FIX-A: word-boundary regex to avoid corrupting _AGGREGATE/_AGENCY/_AGENT*
    count = len(re.findall(r'\b_AG\b', text))
    if count == 0:
        log("  [SKIP] No \\b_AG\\b tokens found — already patched or path differs")
        return
    text = re.sub(r'\b_AG\b', 'AG', text)
    write(p, text)
    log(f"  [WRITTEN] {p} — replaced {count} occurrences of _AG → AG")


# ---------------------------------------------------------------------------
# BLOCKER 2c — pricing/tokens.ts: _COLOR → COLOR
# ---------------------------------------------------------------------------
def fix_color_prefix() -> None:
    section("BLOCKER 2c — pricing/tokens.ts: _COLOR → COLOR + ensure export")
    candidates = [
        "client/src/pages/pricing/tokens.ts",
        "client/src/pages/Pricing/tokens.ts",
        "client/src/components/pricing/tokens.ts",
    ]
    p = find_file(*candidates)
    if not p:
        log("  [SKIP] pricing/tokens.ts not found — check path manually")
        return

    bak = backup(p)
    log(f"  [BACKUP] {p.name} → {bak.name}")
    text = read(p)

    # FIX-B: word-boundary regex to avoid corrupting _COLORS / _COLORIZE etc.
    before = len(re.findall(r'\b_COLOR\b', text))
    if before == 0:
        log("  [SKIP] No \\b_COLOR\\b tokens found — already patched or path differs")
        return
    text = re.sub(r'\b_COLOR\b', 'COLOR', text)
    write(p, text)
    log(f"  [WRITTEN] {p} — replaced {before} occurrences of _COLOR → COLOR")
    log("  NOTE: PricingPage.tsx imports { COLOR } — verify the named export now matches")


# ---------------------------------------------------------------------------
# BLOCKER 3 — audio-engine.ts: _ab/ab, _step/step, _i/i, _peak/peak, _j/j
# ---------------------------------------------------------------------------
# Strategy: regex-replace all `_identifier` usages in the *body* (not declarations)
# that have no matching `_identifier` declaration on that same or preceding line.
# Safer approach: rename the declarations to remove the underscore.

AUDIO_ENGINE_RENAMES = [
    # (declaration pattern, usage pattern)  — we rename at declaration site;
    # usages of the unprefixed name then compile correctly.
    ("const _ab ", "const ab "),
    ("const _step ", "const step "),
    ("let _i ", "let i "),
    ("let _peak ", "let peak "),
    ("let _j ", "let j "),
    ("const _engine ", "const engine "),   # declaration rename in audio-engine.ts only
]

def fix_audio_engine() -> None:
    section("BLOCKER 3 — audio-engine.ts: variable declaration prefix mismatches")
    candidates = [
        "client/src/pages/multi-track-panel/audio-engine.ts",
        "client/src/lib/audio-engine.ts",
        "client/src/utils/audio-engine.ts",
        "client/src/services/audio-engine.ts",
        "client/src/audio-engine.ts",
    ]
    p = find_file(*candidates)
    if not p:
        log("  [SKIP] audio-engine.ts not found — check path manually")
        return

    bak = backup(p)
    log(f"  [BACKUP] {p.name} → {bak.name}")
    text = read(p)

    changed = False
    for old, new in AUDIO_ENGINE_RENAMES:
        count = text.count(old)
        if count == 0:
            log(f"  [WARN] anchor not found: {old!r}")
            continue
        text = text.replace(old, new)
        log(f"  [RENAME] {old!r} → {new!r}  ({count} occurrence(s))")
        changed = True

    if not changed:
        log("  [SKIP] No _prefixed declarations found — already patched or path differs")
        return
    write(p, text)
    log(f"  [WRITTEN] {p}")
    log("  IMPORTANT: run pnpm tsc --noEmit to catch any residual undefined references")


# ---------------------------------------------------------------------------
# BLOCKER 4 — Delete rogue stores/auth-store.ts (duplicate auth system)
# ---------------------------------------------------------------------------
def fix_duplicate_auth() -> None:
    section("BLOCKER 4 — Delete rogue stores/auth-store.ts (duplicate auth)")
    rogue = find_file(
        "client/src/stores/auth-store.ts",
        "client/src/stores/auth-store.tsx",
    )
    if not rogue:
        log("  [SKIP] stores/auth-store.ts not found — already removed or path differs")
        return

    # Backup before delete
    bak = backup(rogue)
    log(f"  [BACKUP] {rogue} → {bak}")

    # Audit all import sites before deleting.
    # --include filters exclude .bak files left in client/src/ from prior runs.
    result = subprocess.run(
        ["grep", "-rn",
         "--include=*.ts", "--include=*.tsx",
         "stores/auth-store", str(ROOT / "client/src")],
        capture_output=True, text=True
    )
    if result.stdout.strip():
        log("  [WARN] The following files still import from stores/auth-store — update them first:")
        for line in result.stdout.strip().splitlines():
            log(f"    {line}")
        log("  [ABORT] Not deleting until import sites are fixed. See above.")
        log("  Fix each import to point to: store/auth-store.ts (via hooks/authStore.ts)")
        return

    rogue.unlink()
    log(f"  [DELETED] {rogue}")
    log("  Canonical auth path: client/src/store/auth-store.ts → hooks/authStore.ts")


# ---------------------------------------------------------------------------
# BLOCKER 5 — Playhead position: 'fixed' → 'absolute' in multi-track-panel.tsx
# ---------------------------------------------------------------------------
def fix_playhead_position() -> None:
    section("BLOCKER 5 — Playhead position: 'fixed' → 'absolute'")
    candidates = [
        "client/src/components/daw/multi-track-panel.tsx",
        "client/src/components/multi-track-panel.tsx",
        "client/src/pages/daw/multi-track-panel.tsx",
    ]
    p = find_file(*candidates)
    if not p:
        log("  [SKIP] multi-track-panel.tsx not found")
        return

    bak = backup(p)
    log(f"  [BACKUP] {p.name} → {bak.name}")
    text = read(p)

    # The playhead div uses position: 'fixed' — we need the one inside the
    # scrollable timeline container. grep first to find all occurrences.
    fixed_count = len(re.findall(r"position:\s*['\"]fixed['\"]", text))
    log(f"  Found {fixed_count} occurrence(s) of position:'fixed' in file")

    if fixed_count == 0:
        log("  [WARN] No position:'fixed' found — may already be patched or path differs")
        return

    if fixed_count == 1:
        # Safe single replacement
        text, n = re.subn(r"(position:\s*)['\"]fixed['\"]", r"\1'absolute'", text, count=1)
        log(f"  [REPLACE] position: 'fixed' → position: 'absolute'  ({n} replacement)")
    else:
        # Multiple hits: only replace the one near playhead / timeline keywords
        # We do a context-aware replacement by finding the playhead block
        log(f"  [WARN] {fixed_count} occurrences — targeting only playhead context")
        # Replace the first occurrence that appears after a 'playhead' keyword
        def replace_near_playhead(m: re.Match) -> str:
            return m.group(0).replace("fixed", "absolute")

        # Find playhead section and replace within it
        playhead_idx = text.lower().find("playhead")
        if playhead_idx == -1:
            log("  [WARN] 'playhead' not found in file — manual inspection required")
            return
        # Replace the first 'fixed' after the playhead reference
        segment_start = max(0, playhead_idx - 200)
        segment_end = min(len(text), playhead_idx + 800)
        segment = text[segment_start:segment_end]
        new_segment, n = re.subn(r"(position:\s*)['\"]fixed['\"]", r"\1'absolute'", segment, count=1)
        if n:
            text = text[:segment_start] + new_segment + text[segment_end:]
            log(f"  [REPLACE] position:'fixed' → 'absolute' in playhead context")
        else:
            log("  [WARN] Could not locate fixed position in playhead context — manual fix required")
            return  # BUG-P5: don't write+log [WRITTEN] when no change was made

    write(p, text)
    log(f"  [WRITTEN] {p}")


# ---------------------------------------------------------------------------
# PATCH 6 — AudioEngine.initialize(): add user-gesture guard
# (Note: _engine/engine mismatch is addressed in BLOCKER 3 above)
# ---------------------------------------------------------------------------
GESTURE_GUARD = """\
  // Defer AudioEngine init until first user gesture (autoplay policy).
  useEffect(() => {
    const handler = () => {
      if (audioEngineRef.current) {
        // FIX-D: logger.error replaces console.error per PRD §8.1.
        // Requires: import { logger } from '@/lib/logger' — verify path before commit.
        audioEngineRef.current.initialize().catch((err) => {
          logger.error({ err }, 'AudioEngine initialization failed');
        });
      }
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
    };
    window.addEventListener('click', handler, { once: true });
    window.addEventListener('keydown', handler, { once: true });
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('keydown', handler);
      // Merged from original cleanup — fixed: audioEngineRef.current instead of undeclared `engine`
      if (typeof audioEngineRef.current?.cleanup === 'function') audioEngineRef.current.cleanup();
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);"""

def fix_audio_init_gesture() -> None:
    section("PATCH 6 — AudioEngine.initialize(): gesture guard")
    candidates = [
        "client/src/components/daw/multi-track-panel.tsx",
        "client/src/components/multi-track-panel.tsx",
    ]
    p = find_file(*candidates)
    if not p:
        log("  [SKIP] multi-track-panel.tsx not found")
        return

    bak = backup(p)
    log(f"  [BACKUP] {p.name} → {bak.name}")
    text = read(p)

    # Locate the broken initialize() call (the one without a gesture guard)
    pattern = r"engine\.initialize\(\)\.catch\(console\.error\)"
    matches = list(re.finditer(pattern, text))
    if not matches:
        log("  [WARN] engine.initialize().catch(console.error) not found — may already be patched")
        return

    if len(matches) > 1:
        log(f"  [WARN] {len(matches)} matches — only replacing first occurrence in useEffect")

    # We'll wrap the errant useEffect with the gesture-guard version.
    # Find the enclosing useEffect block and replace its body.
    old_call = "engine.initialize().catch(console.error);"
    if old_call not in text:
        log(f"  [WARN] Exact anchor not found: {old_call!r}")
        return

    # Exact anchor — includes return cleanup block confirmed from live file inspection.
    # Note: the original `engine` reference in cleanup is a bug (_engine was declared,
    # engine was not). GESTURE_GUARD fixes this by using audioEngineRef.current.
    old_effect = (
        "  useEffect(() => {\n"
        "    const _engine = audioEngineRef.current;\n"
        "    engine.initialize().catch(console.error);\n"
        "    return () => {\n"
        "      if (typeof engine.cleanup === 'function') engine.cleanup();\n"
        "      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);\n"
        "    };\n"
        "  }, []);"
    )
    if old_effect in text:
        text = text.replace(old_effect, GESTURE_GUARD, 1)
        log("  [REPLACE] Bare initialize() useEffect → gesture-guarded version")
    else:
        # FIX-E: regex fallback — handles tab/space indentation variants.
        # Uses DOTALL so [^}]* matches across lines within the return cleanup block.
        old_effect_pattern = re.compile(
            r'useEffect\s*\(\s*\(\s*\)\s*=>\s*\{\s*'
            r'const\s+_?engine\s*=\s*audioEngineRef\.current\s*;\s*'
            r'engine\.initialize\s*\(\s*\)\.catch\s*\(\s*console\.error\s*\)\s*;\s*'
            r'(?:return\s*\(\s*\)\s*=>\s*\{[^}]*\}\s*;\s*)?'
            r'\}\s*,\s*\[\s*\]\s*\)\s*;',
            re.MULTILINE | re.DOTALL,
        )
        m = old_effect_pattern.search(text)
        if m:
            text = text[: m.start()] + GESTURE_GUARD + text[m.end() :]
            log("  [REPLACE] Bare initialize() useEffect → gesture-guarded version (regex fallback)")
        else:
            # BUG-P6: do NOT fall through to write+[WRITTEN] — no change was made.
            log("  [WARN] Could not match full useEffect block exactly.")
            log("  Manual fix: replace the useEffect containing engine.initialize() with:")
            log(GESTURE_GUARD)
            log("")
            log("  To see the actual useEffect shape, run on Kali:")
            log(f"    grep -n 'engine.initialize\\|useEffect' {p}")
            return

    write(p, text)
    log(f"  [WRITTEN] {p}")


# ---------------------------------------------------------------------------
# PATCH 7 — runtime-guard.ts: remove false-positive var(--color-*) rule
# ---------------------------------------------------------------------------
def fix_runtime_guard() -> None:
    section("PATCH 7 — runtime-guard.ts: remove false-positive CSS var rule")
    candidates = [
        "client/src/design-tokens/runtime-guard.ts",
        "client/src/tokens/runtime-guard.ts",
        "client/src/utils/runtime-guard.ts",
        "client/src/lib/runtime-guard.ts",
    ]
    p = find_file(*candidates)
    if not p:
        log("  [SKIP] runtime-guard.ts not found — check path manually")
        return

    bak = backup(p)
    log(f"  [BACKUP] {p.name} → {bak.name}")
    text = read(p)

    # The offending rule flags correct usage: /var\(--color-[^)]+\)/
    # It should only flag raw hex and Tailwind raw color classes.
    old_rule = r"/var\(--color-[^)]+\)/"
    if old_rule not in text:
        # Try without escaping — file may use literal regex
        old_rule_alt = "/var(--color-[^)]+)/"
        if old_rule_alt in text:
            old_rule = old_rule_alt
        else:
            log("  [WARN] False-positive rule not found with expected pattern")
            log("  Search for: /var\\(--color-[^)]+\\)/ in runtime-guard.ts manually")
            return

    # Remove the line containing this rule
    lines = text.splitlines(keepends=True)
    new_lines = []
    removed = 0
    for line in lines:
        if old_rule in line:
            new_lines.append(
                "  // REMOVED: var(--color-*) rule was a false positive — correct token usage flagged\n"
            )
            removed += 1
        else:
            new_lines.append(line)

    if removed == 0:
        log("  [WARN] Rule line not isolated — manual removal required")
        return

    write(p, "".join(new_lines))
    log(f"  [WRITTEN] {p} — commented out {removed} false-positive rule(s)")
    log("  Verify: components using var(--color-bg-base) should no longer trigger console errors")


# ---------------------------------------------------------------------------
# PATCH 8 — visuals.tsx BandMeterHUD: fix all _prefix/prefix mismatches
# ---------------------------------------------------------------------------
VISUALS_RENAMES = [
    # FIX-I: let variants removed — BandMeterHUD declarations use const only.
    # The 4 let entries were dead weight that could match unrelated let bindings.
    ("const _startedRef", "const startedRef"),
    ("const _barRefs",    "const barRefs"),
    ("const _tick",       "const tick"),
    ("const _startHUD",   "const startHUD"),
]

def fix_visuals_bandmeter() -> None:
    section("PATCH 8 — visuals.tsx BandMeterHUD: rename _prefix declarations")
    candidates = [
        "client/src/components/visuals.tsx",
        "client/src/components/daw/visuals.tsx",
        "client/src/components/vj/visuals.tsx",
        "client/src/pages/visuals.tsx",
    ]
    p = find_file(*candidates)
    if not p:
        log("  [SKIP] visuals.tsx not found — check path manually")
        return

    bak = backup(p)
    log(f"  [BACKUP] {p.name} → {bak.name}")
    text = read(p)

    changed = False
    for old, new in VISUALS_RENAMES:
        count = text.count(old)
        if count == 0:
            continue
        text = text.replace(old, new)
        log(f"  [RENAME] {old!r} → {new!r}  ({count} occurrence(s))")
        changed = True

    if not changed:
        log("  [SKIP] No _prefixed declarations found — already patched or path differs")
        return
    write(p, text)
    log(f"  [WRITTEN] {p}")


# ---------------------------------------------------------------------------
# PATCH 9 — enforce-ui-design-system.sh: git tag instead of commit-message grep
# ---------------------------------------------------------------------------
OLD_GREP_BLOCK = 'git log --pretty=format:"%H %s" -- "$TARGET" | grep "pre-ui-system-enforcement"'

NEW_TAG_BLOCK = """\
# Stable checkpoint: use git tag instead of commit-message grep
# To set: git tag ui-checkpoint <sha>  (run once, then push tags)
if git rev-parse ui-checkpoint >/dev/null 2>&1; then
  GOOD_COMMIT=$(git rev-parse ui-checkpoint)
else
  echo "[enforce-ui] ERROR: 'ui-checkpoint' tag not found."
  echo "  Set it once with: git tag ui-checkpoint <safe-sha> && git push --tags"
  exit 1
fi"""

def fix_enforce_script() -> None:
    section("PATCH 9 — enforce-ui-design-system.sh: tag-based checkpoint")
    candidates = [
        "scripts/enforce-ui-design-system.sh",
        "client/enforce-ui-design-system.sh",
        "tools/enforce-ui-design-system.sh",
    ]
    p = find_file(*candidates)
    if not p:
        log("  [SKIP] enforce-ui-design-system.sh not found — check path manually")
        return

    bak = backup(p)
    log(f"  [BACKUP] {p.name} → {bak.name}")
    text = read(p)

    if OLD_GREP_BLOCK not in text:
        log("  [WARN] Commit-message grep pattern not found — may already be patched")
        return

    text = text.replace(OLD_GREP_BLOCK, NEW_TAG_BLOCK, 1)
    write(p, text)
    log(f"  [WRITTEN] {p}")
    log("  ACTION: Run once:  git tag ui-checkpoint <last-good-sha> && git push --tags")


# ---------------------------------------------------------------------------
# INFO 10 — usePricing tRPC path verification (read-only audit)
# ---------------------------------------------------------------------------
def audit_pricing_trpc() -> None:
    section("INFO 10 — usePricing tRPC path: verification audit (no write)")
    hook_candidates = [
        "client/src/pages/pricing/usePricing.ts",
        "client/src/hooks/usePricing.ts",
        "client/src/hooks/usePricing.tsx",
    ]
    router_candidates = [
        "server/routers/subscription.ts",
        "server/routers/subscription.router.ts",
        "server/procedures.ts",
        "server/trpc.ts",
    ]

    hook_p = find_file(*hook_candidates)
    if hook_p:
        result = subprocess.run(
            ["grep", "-n", "createCheckout", str(hook_p)],
            capture_output=True, text=True
        )
        log(f"  usePricing.ts mutation call:")
        log(f"    {result.stdout.strip() or '(not found)'}")
    else:
        log("  [WARN] usePricing hook not found")

    for rp in router_candidates:
        rp_path = ROOT / rp
        if rp_path.exists():
            result = subprocess.run(
                ["grep", "-n", "createCheckout", str(rp_path)],
                capture_output=True, text=True
            )
            if result.stdout.strip():
                log(f"  Router match in {rp}:")
                log(f"    {result.stdout.strip()}")

    log("  Compare the procedure name in usePricing.ts against the router definition.")
    log("  If they differ, update usePricing.ts to use the exact router key name.")


# ---------------------------------------------------------------------------
# Post-patch TSC verification
# ---------------------------------------------------------------------------
def run_tsc() -> None:
    section("POST-PATCH — pnpm tsc --noEmit")
    result = subprocess.run(
        ["pnpm", "tsc", "--noEmit"],
        capture_output=True, text=True, cwd=ROOT
    )
    if result.returncode == 0:
        log("  ✅ pnpm tsc --noEmit → 0 errors")
    else:
        log("  ❌ TSC errors remain:")
        for line in (result.stdout + result.stderr).splitlines()[:40]:
            log(f"    {line}")
        log("  Fix all TSC errors before committing.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main() -> None:
    log("R3v4 Patch Suite — WIRE Protocol")
    log(f"Root: {ROOT}")
    log(f"Backup dir: {BACKUP_DIR}")
    log(f"Timestamp: {TS}")

    # Confirm we're in the repo root
    if not (ROOT / "client").exists():
        log("\n[ABORT] client/ directory not found.")
        log("Run this script from ~/Stable (repo root).")
        sys.exit(1)

    # Blockers first
    fix_store_barrel()
    fix_store_barrel_script()  # FIX-H: invoke barrel fixer after store renames
    fix_ag_prefix()
    fix_vst_panel_ag()
    fix_color_prefix()
    fix_audio_engine()
    fix_duplicate_auth()
    fix_playhead_position()

    # Patches
    fix_audio_init_gesture()
    fix_runtime_guard()
    fix_visuals_bandmeter()
    fix_enforce_script()

    # Info / audit
    audit_pricing_trpc()

    # Path discovery — emit find commands for every file that was SKIPped
    section("PATH DISCOVERY — run these on Kali if files were SKIPped above")
    missing_hints = [
        ("session-metrics.store.ts", "find client/src -name '*session-metrics*' -o -name '*metrics*store*'"),
        ("preferences-modal.tsx",    "find client/src -name '*preferences-modal*'"),
        ("vst-panel-modal.tsx",      "find client/src -name '*vst-panel-modal*' -o -name '*vst*modal*'"),
        ("audio-engine.ts",          "find client/src -name 'audio-engine.ts'"),
        ("usePricing hook",          "find client/src -name '*usePricing*' -o -name '*Pricing*hook*'"),
        ("r3_fix_store_barrel.py",   "find . -name 'r3_fix_store_barrel.py' 2>/dev/null"),
    ]
    for name, cmd in missing_hints:
        log(f"  {name}:")
        log(f"    {cmd}")
    log("")
    log("  Stale .bak files in client/src/ (from prior runs) pollute BLOCKER4 grep.")
    log("  Clean them with:  find client/src -name '*.bak' -delete")
    log("  Verify first:     find client/src -name '*.bak'")

    # TSC verification
    run_tsc()

    # Print WIRE summary
    section("WIRE SUMMARY")
    log(f"""
FILES PATCHED (where found):
  client/src/store/audio-store.ts          _useAudioStore, _selectIsPlaying → unprefixed
  client/src/store/clip-store.ts           _useClipStore → useClipStore
  client/src/store/fx-store.ts             _useFXStore → useFXStore
  client/src/store/meter-store.ts          _useMeterStore → useMeterStore
  client/src/store/mixer-store.ts          _useMixerStore → useMixerStore
  client/src/store/vst-store.ts            _useVSTStore → useVSTStore
  client/src/store/session-metrics.store.ts _useSessionMetricsStore → unprefixed
  client/src/store/auth-store.ts           _useAuthStore → useAuthStore (if present)
  client/src/components/preferences-modal.tsx  _AG → AG (all usages)
  client/src/components/vst-panel-modal.tsx    _AG → AG (all usages)
  client/src/pages/pricing/tokens.ts           _COLOR → COLOR (all usages)
  client/src/lib/audio-engine.ts               _ab/_step/_i/_peak/_j/_engine → unprefixed
  client/src/components/daw/multi-track-panel.tsx  position:'fixed' → 'absolute' (playhead)
                                                   engine.initialize() → gesture-guarded
  client/src/design-tokens/runtime-guard.ts    removed false-positive var(--color-*) rule
  client/src/components/visuals.tsx            _startedRef/_barRefs/_tick/_startHUD → unprefixed
  scripts/enforce-ui-design-system.sh          commit-grep → git tag ui-checkpoint

DELETED (after import-site audit):
  client/src/stores/auth-store.ts              rogue duplicate auth store (if no importers found)

REMAINING AMBIGUITIES:
  - usePricing tRPC path: requires manual comparison (audit output above)
  - multi-track-panel.tsx @ts-nocheck: still present — migration path TBD (Roadmap item)
  - VJCanvas.tsx level/beat props: untyped — add interface as low-priority follow-up
  - Vite GHSA-4w7w-66w2-5vf9: check Vite version, bump to >=6.4.2 if needed
    run:  cat client/package.json | grep '"vite"'
  - git tag ui-checkpoint: must be set manually on Kali after confirming last stable sha

REGRESSION CHECK:
  pnpm tsc --noEmit → see output above
  If errors remain, they indicate additional usage sites of _prefixed names not
  covered by this script. Run: grep -rn '_use\\|_AG\\|_COLOR\\|_ab\\b' client/src/
    """)

    # Write report
    report_path = ROOT / f"r3_patch_report_{TS}.txt"
    report_path.write_text("\n".join(RESULTS), encoding="utf-8")
    log(f"\nFull log written to: {report_path}")

if __name__ == "__main__":
    main()