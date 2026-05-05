#!/usr/bin/env python3
"""
patch_stores.py — R3 v4 store TS-error fix
Fixes `const _name` declared / `name` referenced mismatches across:
  • client/src/store/fx-store.ts
  • client/src/store/meter-store.ts
  • client/src/store/index.ts

WIRE protocol:
  • Timestamped .bak before every write
  • Each substitution asserts count == 1 (exact-match guard)
  • --dry-run flag prints diffs without writing
  • Aborts on any assert failure — no partial writes
"""

import argparse
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

# ─── CLI ──────────────────────────────────────────────────────────────────────

parser = argparse.ArgumentParser(description="Patch R3 v4 store TS errors")
parser.add_argument("--dry-run", action="store_true", help="Print changes without writing")
parser.add_argument(
    "--root",
    default=str(Path.home() / "Stable/client/src/store"),
    help="Path to client/src/store (default: ~/Stable/client/src/store)",
)
args = parser.parse_args()

ROOT     = Path(args.root)
DRY_RUN  = args.dry_run
TS       = datetime.now().strftime("%Y%m%d_%H%M%S")
ERRORS   = 0

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def backup(path: Path) -> None:
    bak = path.with_suffix(f".ts.bak-{TS}")
    shutil.copy2(path, bak)
    print(f"  bak → {bak.name}")


def exact_replace(src: str, old: str, new: str, label: str) -> str:
    """Replace old→new, asserting exactly one occurrence."""
    count = src.count(old)
    assert count == 1, (
        f"ASSERT FAIL [{label}]: expected 1 occurrence, found {count}\n"
        f"  needle: {old!r}"
    )
    return src.replace(old, new, 1)


def patch_file(path: Path, ops: list[tuple[str, str, str]]) -> None:
    """
    Apply a list of (old, new, label) substitutions to path.
    Each substitution is asserted to appear exactly once.
    """
    global ERRORS
    print(f"\n{'[DRY-RUN] ' if DRY_RUN else ''}Patching {path.relative_to(ROOT.parent.parent.parent)} …")

    if not path.exists():
        print(f"  ERROR: file not found — {path}", file=sys.stderr)
        ERRORS += 1
        return

    original = path.read_text(encoding="utf-8")
    result   = original

    for old, new, label in ops:
        try:
            result = exact_replace(result, old, new, label)
            print(f"  ✓ {label}")
        except AssertionError as exc:
            print(f"  ✗ {exc}", file=sys.stderr)
            ERRORS += 1

    if ERRORS:
        print("  Aborting writes due to assertion failures.", file=sys.stderr)
        return

    if DRY_RUN:
        # Emit a minimal unified diff
        import difflib
        diff = difflib.unified_diff(
            original.splitlines(keepends=True),
            result.splitlines(keepends=True),
            fromfile=str(path),
            tofile=str(path) + " (patched)",
        )
        sys.stdout.writelines(diff)
    else:
        backup(path)
        path.write_text(result, encoding="utf-8")
        print(f"  written.")


# ═══════════════════════════════════════════════════════════════════════════════
# fx-store.ts — 13 variables, 25 reference sites
# All fixes: remove `_` prefix from the `const` declaration so the identifier
# matches every subsequent use site (which never had the underscore).
# ═══════════════════════════════════════════════════════════════════════════════

FX_OPS: list[tuple[str, str, str]] = [
    # addFXToChannel — _hist  (extended to _fxAddedCallbacks to disambiguate)
    (
        "          const _hist = ensureHistory(state as unknown as FXState, cid);\n"
        "          pushHistory(hist, takeSnapshot(channel));\n"
        "          (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid] = [...channel.getEffects()];\n"
        "        });\n"
        "\n"
        "        get()._fxAddedCallbacks.forEach(cb => cb(channel, fx));",
        "          const hist = ensureHistory(state as unknown as FXState, cid);\n"
        "          pushHistory(hist, takeSnapshot(channel));\n"
        "          (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid] = [...channel.getEffects()];\n"
        "        });\n"
        "\n"
        "        get()._fxAddedCallbacks.forEach(cb => cb(channel, fx));",
        "addFXToChannel: _hist → hist",
    ),
    # removeFXFromChannel — _hist
    (
        "          const _hist = ensureHistory(state as unknown as FXState, cid);\n"
        "          pushHistory(hist, takeSnapshot(channel));\n"
        "          (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid] = [...channel.getEffects()];\n"
        "        });\n"
        "\n"
        "        get()._fxRemovedCallbacks",
        "          const hist = ensureHistory(state as unknown as FXState, cid);\n"
        "          pushHistory(hist, takeSnapshot(channel));\n"
        "          (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid] = [...channel.getEffects()];\n"
        "        });\n"
        "\n"
        "        get()._fxRemovedCallbacks",
        "removeFXFromChannel: _hist → hist",
    ),
    # addVSTToChannel — _key
    (
        "        const _key = vstKey(channel, vstUrl);\n"
        "\n"
        "        set(state => {\n"
        "          state.vstStatus[key]",
        "        const key = vstKey(channel, vstUrl);\n"
        "\n"
        "        set(state => {\n"
        "          state.vstStatus[key]",
        "addVSTToChannel: _key → key",
    ),
    # addVSTToChannel — _vstNode
    (
        "          const _vstNode = await channel.addVST(vstUrl, workletName);\n",
        "          const vstNode = await channel.addVST(vstUrl, workletName);\n",
        "addVSTToChannel: _vstNode → vstNode",
    ),
    # addVSTToChannel — _hist (inside try block)
    (
        "            const _hist = ensureHistory(state as unknown as FXState, cid);\n"
        "            pushHistory(hist, takeSnapshot(channel));\n"
        "            (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid]  = [...channel.getEffects()];\n"
        "            state.vstStatus[key]  = { status: \"ready\"",
        "            const hist = ensureHistory(state as unknown as FXState, cid);\n"
        "            pushHistory(hist, takeSnapshot(channel));\n"
        "            (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid]  = [...channel.getEffects()];\n"
        "            state.vstStatus[key]  = { status: \"ready\"",
        "addVSTToChannel (try): _hist → hist",
    ),
    # addVSTToChannel — _msg
    (
        "          const _msg = error instanceof Error ? error.message : String(error);\n"
        "\n"
        "          set(state => {\n"
        "            state.vstStatus[key] = { status: \"error\", url: vstUrl, error: msg };",
        "          const msg = error instanceof Error ? error.message : String(error);\n"
        "\n"
        "          set(state => {\n"
        "            state.vstStatus[key] = { status: \"error\", url: vstUrl, error: msg };",
        "addVSTToChannel (catch): _msg → msg",
    ),
    # moveFXInChannel — _hist
    (
        "          const _hist = ensureHistory(state as unknown as FXState, cid);\n"
        "          pushHistory(hist, takeSnapshot(channel));\n"
        "          (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid] = [...channel.getEffects()];\n"
        "        });\n"
        "      },\n"
        "\n"
        "      getChannelEffects",
        "          const hist = ensureHistory(state as unknown as FXState, cid);\n"
        "          pushHistory(hist, takeSnapshot(channel));\n"
        "          (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid] = [...channel.getEffects()];\n"
        "        });\n"
        "      },\n"
        "\n"
        "      getChannelEffects",
        "moveFXInChannel: _hist → hist",
    ),
    # undoChannel — _hist (outer scope)
    (
        "        const _hist = get().history[cid];\n"
        "        if (!hist || hist.past.length === 0) return;",
        "        const hist = get().history[cid];\n"
        "        if (!hist || hist.past.length === 0) return;",
        "undoChannel: _hist → hist",
    ),
    # undoChannel — _current
    (
        "          const _current = takeSnapshot(channel);\n"
        "          const prev    = h.past.pop()!;\n"
        "          h.future.push(current);",
        "          const current = takeSnapshot(channel);\n"
        "          const prev    = h.past.pop()!;\n"
        "          h.future.push(current);",
        "undoChannel: _current → current",
    ),
    # redoChannel — _hist (outer scope)
    (
        "        const _hist = get().history[cid];\n"
        "        if (!hist || hist.future.length === 0) return;",
        "        const hist = get().history[cid];\n"
        "        if (!hist || hist.future.length === 0) return;",
        "redoChannel: _hist → hist",
    ),
    # redoChannel — _next
    (
        "          const _next = h.future.pop()!;\n"
        "          h.past.push(takeSnapshot(channel));\n"
        "\n"
        "          if (typeof (channel as any).replaceEffects === \"function\") {\n"
        "            (channel as any).replaceEffects(next);",
        "          const next = h.future.pop()!;\n"
        "          h.past.push(takeSnapshot(channel));\n"
        "\n"
        "          if (typeof (channel as any).replaceEffects === \"function\") {\n"
        "            (channel as any).replaceEffects(next);",
        "redoChannel: _next → next",
    ),
    # canUndo — _hist
    (
        "        const _hist = get().history[channelKey(channel)];\n"
        "        return (hist?.past.length ?? 0) > 0;",
        "        const hist = get().history[channelKey(channel)];\n"
        "        return (hist?.past.length ?? 0) > 0;",
        "canUndo: _hist → hist",
    ),
    # canRedo — _hist
    (
        "        const _hist = get().history[channelKey(channel)];\n"
        "        return (hist?.future.length ?? 0) > 0;",
        "        const hist = get().history[channelKey(channel)];\n"
        "        return (hist?.future.length ?? 0) > 0;",
        "canRedo: _hist → hist",
    ),
    # refreshChannel — _cid
    (
        "        const _cid = channelKey(channel);\n"
        "        set(state => {\n"
        "          (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid] = [...channel.getEffects()];\n"
        "        });\n"
        "      },\n"
        "\n"
        "      // ══",
        "        const cid = channelKey(channel);\n"
        "        set(state => {\n"
        "          (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid] = [...channel.getEffects()];\n"
        "        });\n"
        "      },\n"
        "\n"
        "      // ══",
        "refreshChannel: _cid → cid",
    ),
    # loadPreset — _preset
    (
        "        const _preset = get().presets[presetId];\n"
        "        if (!preset)",
        "        const preset = get().presets[presetId];\n"
        "        if (!preset)",
        "loadPreset: _preset → preset",
    ),
    # loadPreset — _cid (inside set callback)
    (
        "          const _cid = channelKey(channel);\n"
        "          (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid] = [...channel.getEffects()];\n"
        "        });\n"
        "      },\n"
        "\n"
        "      deletePreset",
        "          const cid = channelKey(channel);\n"
        "          (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid] = [...channel.getEffects()];\n"
        "        });\n"
        "      },\n"
        "\n"
        "      deletePreset",
        "loadPreset: _cid → cid",
    ),
    # setChannelDryWet — _clamped
    (
        "        const _clamped = Math.max(0, Math.min(1, value));\n"
        "        if (typeof (channel as any).setDryWet === \"function\") (channel as any).setDryWet(clamped);\n"
        "        set(state => {\n"
        "          state.dryWet[channelKey(channel)] = clamped;",
        "        const clamped = Math.max(0, Math.min(1, value));\n"
        "        if (typeof (channel as any).setDryWet === \"function\") (channel as any).setDryWet(clamped);\n"
        "        set(state => {\n"
        "          state.dryWet[channelKey(channel)] = clamped;",
        "setChannelDryWet: _clamped → clamped",
    ),
    # importChainJSON — _data
    (
        "        const _data = JSON.parse(json);\n"
        "        if (Array.isArray(data.fxChain)",
        "        const data = JSON.parse(json);\n"
        "        if (Array.isArray(data.fxChain)",
        "importChainJSON: _data → data",
    ),
    # clearChannel — _effects
    (
        "        const _effects = [...channel.getEffects()];\n"
        "        for (const fx of effects)",
        "        const effects = [...channel.getEffects()];\n"
        "        for (const fx of effects)",
        "clearChannel: _effects → effects",
    ),
    # clearChannel — _hist (inside set callback)
    (
        "          const _hist = ensureHistory(state as unknown as FXState, cid);\n"
        "          pushHistory(hist, effects.map(fx => ({",
        "          const hist = ensureHistory(state as unknown as FXState, cid);\n"
        "          pushHistory(hist, effects.map(fx => ({",
        "clearChannel: _hist → hist",
    ),
    # duplicateFX — _fx
    (
        "        const _fx = channel.getEffects().find(f => f.id === fxId);\n"
        "        if (!fx || typeof (fx as any).clone !== \"function\") return null;",
        "        const fx = channel.getEffects().find(f => f.id === fxId);\n"
        "        if (!fx || typeof (fx as any).clone !== \"function\") return null;",
        "duplicateFX: _fx → fx",
    ),
    # duplicateFX — _clone
    (
        "        const _clone = await (fx as any).clone();\n"
        "        get().addFXToChannel(channel, clone);\n"
        "        return clone;",
        "        const clone = await (fx as any).clone();\n"
        "        get().addFXToChannel(channel, clone);\n"
        "        return clone;",
        "duplicateFX: _clone → clone",
    ),
    # bypassAllInChannel — _cid
    (
        "          const _cid = channelKey(channel);\n"
        "          if ((state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid]) {\n"
        "            (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid] = [...(state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid]];\n"
        "          }",
        "          const cid = channelKey(channel);\n"
        "          if ((state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid]) {\n"
        "            (state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid] = [...(state.channelFX as Record<string, import(\"../audio/fx/fx-nodebase\").FXNodeBase[]>)[cid]];\n"
        "          }",
        "bypassAllInChannel: _cid → cid",
    ),
    # useChannelFX hook — _cid
    (
        "  const _cid = channel ? channelKey(channel) : \"__none__\";\n"
        "  return useFXStore(s => s.channelFX[cid] ?? (channel ? channel.getEffects() : []));",
        "  const cid = channel ? channelKey(channel) : \"__none__\";\n"
        "  return useFXStore(s => s.channelFX[cid] ?? (channel ? channel.getEffects() : []));",
        "useChannelFX: _cid → cid",
    ),
    # subscribeChannelFX — _cid
    (
        "  const _cid = channelKey(channel);\n"
        "  return useFXStore.subscribe(\n"
        "    s  => s.channelFX[cid] ?? [],",
        "  const cid = channelKey(channel);\n"
        "  return useFXStore.subscribe(\n"
        "    s  => s.channelFX[cid] ?? [],",
        "subscribeChannelFX: _cid → cid",
    ),
]

# ═══════════════════════════════════════════════════════════════════════════════
# meter-store.ts — _copy → copy
# ═══════════════════════════════════════════════════════════════════════════════

METER_OPS: list[tuple[str, str, str]] = [
    (
        "      const _copy = { ...s.meters };\n"
        "      delete copy[id];\n"
        "      return { meters: copy };",
        "      const copy = { ...s.meters };\n"
        "      delete copy[id];\n"
        "      return { meters: copy };",
        "clearMeter: _copy → copy",
    ),
]

# ═══════════════════════════════════════════════════════════════════════════════
# index.ts — alias _-prefixed selector exports so public API is unchanged
# ═══════════════════════════════════════════════════════════════════════════════

INDEX_OPS: list[tuple[str, str, str]] = [
    # audio-store: selectChannelCount + selectHasSoloChannels
    (
        "  selectChannelCount,\n"
        "  selectHasSoloChannels,\n"
        "} from './audio-store';",
        "  _selectChannelCount as selectChannelCount,\n"
        "  _selectHasSoloChannels as selectHasSoloChannels,\n"
        "} from './audio-store';",
        "audio-store: alias _selectChannelCount / _selectHasSoloChannels",
    ),
    # vst-store: four selectors
    (
        "  selectCPUUsage,\n"
        "  selectMemoryUsage,\n"
        "  selectLatency,\n"
        "  selectHasAlerts,\n"
        "} from './vst-store';",
        "  _selectCPUUsage as selectCPUUsage,\n"
        "  _selectMemoryUsage as selectMemoryUsage,\n"
        "  _selectLatency as selectLatency,\n"
        "  _selectHasAlerts as selectHasAlerts,\n"
        "} from './vst-store';",
        "vst-store: alias _select* → select*",
    ),
]

# ─── RUN ──────────────────────────────────────────────────────────────────────

patch_file(ROOT / "fx-store.ts",    FX_OPS)
patch_file(ROOT / "meter-store.ts", METER_OPS)
patch_file(ROOT / "index.ts",       INDEX_OPS)

print()
if ERRORS:
    print(f"FAILED — {ERRORS} assertion error(s). No files were written.", file=sys.stderr)
    sys.exit(1)
elif DRY_RUN:
    print("Dry-run complete. Review diffs above before running without --dry-run.")
else:
    print("Done. Run: pnpm --filter client tsc --noEmit")
