#!/usr/bin/env python3
"""
p_final_patch.py  — Final bulk hex → CSS var sweep
Covers all remaining non-canvas violations after theme-config.ts closure.

Usage:
  python3 p_final_patch.py           # dry-run
  python3 p_final_patch.py --apply   # write files + append new tokens to theme.css
"""

import re, sys
from pathlib import Path

DRY_RUN = "--apply" not in sys.argv

SRC   = Path.home() / "Stable/client/src"
THEME = Path.home() / "Stable/client/src/styles/theme.css"

# ── New tokens to append to theme.css (only if not already present) ──────────
NEW_TOKENS = """
/* p_final_patch — bulk accent tokens */
:root {
  --accent-orange:      #ff6600;
  --accent-yellow:      #ffcc00;
  --accent-blue:        #0088ff;
  --accent-pink:        #f72585;
  --accent-neon:        #39ff14;
  --accent-neon-teal:   #06ffa5;
  --accent-neon-lime:   #d4ff40;
  --accent-blue-deep:   #003366;
  --status-ok-dim:      #3d7c00;
  --panel-void:         #000000;
}
"""

# ── Comprehensive hex → CSS var map ──────────────────────────────────────────
# Sorted longest-first at runtime to avoid short matches inside long ones.
HEX_MAP: dict[str, str] = {
    # near-blacks / panels
    "#000000": "var(--panel-void)",
    "#030803": "var(--panel-deep)",
    "#0b0b0b": "var(--panel-deep)",
    "#0e0e0e": "var(--panel-deep)",
    "#0f0f12": "var(--panel-deep)",
    "#0f0f14": "var(--panel-deep)",
    "#0f1a11": "var(--panel-deep)",
    "#131313": "var(--panel-deep)",
    "#151515": "var(--panel-deep)",
    "#181818": "var(--panel)",
    "#18181b": "var(--panel)",
    "#191919": "var(--panel)",
    "#1a0f0f": "var(--panel-deep)",
    "#1a1a22": "var(--panel-deep)",
    "#1e1e2e": "var(--panel-deep)",
    "#020617": "var(--panel-deep)",
    "#242424": "var(--panel-mid)",
    "#2e2e2e": "var(--panel-mid)",
    "#383838": "var(--panel-mid)",
    "#4a4a4a": "var(--surface)",
    "#5a5a5a": "var(--surface-mid)",
    # text / grays
    "#71717a": "var(--text-dim)",
    "#64748b": "var(--text-dim)",
    "#374151": "var(--text-dim)",
    "#bbb":    "var(--text-dim)",
    "#777":    "var(--text-muted)",
    "#777777": "var(--text-muted)",
    "#888":    "var(--text-dim)",
    "#888888": "var(--text-dim)",
    "#8b95a1": "var(--text-dim)",
    "#c5c9cc": "var(--text-secondary)",
    "#d4d4d4": "var(--text-secondary)",
    "#e2e8f0": "var(--text-primary)",
    "#eef5ee": "var(--text-primary)",
    "#f4f4f5": "var(--text-primary)",
    "#f5f5f5": "var(--text-primary)",
    "#ffffff": "var(--text)",
    # status — error
    "#be123c": "var(--status-error)",
    "#cc0000": "var(--status-error)",
    "#dc2626": "var(--status-error)",
    "#ff0033": "var(--status-error)",
    "#ff1a1a": "var(--status-error)",
    "#ff2244": "var(--status-error)",
    "#ff3366": "var(--status-error)",
    "#ff4455": "var(--status-error)",
    "#ff6670": "var(--status-error-soft)",
    "#f87171": "var(--status-error-soft)",
    # status — ok
    "#059669": "var(--status-ok)",
    "#10b981": "var(--status-ok)",
    "#22c55e": "var(--status-ok-alt)",
    "#34d399": "var(--status-ok-alt)",
    "#3d7c00": "var(--status-ok-dim)",
    "#4d6b18": "var(--status-ok-dim)",
    "#1a2a0a": "var(--status-ok-dim)",
    # status — warn
    "#d97706": "var(--status-warn)",
    "#f59e0b": "var(--status-warn)",
    "#ffbe0b": "var(--accent-yellow)",
    "#ffcc00": "var(--accent-yellow)",
    "#ffcc44": "var(--accent-yellow)",
    # accent — orange
    "#fb5607": "var(--accent-orange)",
    "#ff6600": "var(--accent-orange)",
    "#ff6644": "var(--accent-orange)",
    # accent — blue
    "#003366": "var(--accent-blue-deep)",
    "#0088ff": "var(--accent-blue)",
    "#00aaff": "var(--accent-blue)",
    "#0ea5e9": "var(--accent-blue)",
    "#38bdf8": "var(--accent-blue)",
    "#3b82f6": "var(--accent-blue)",
    "#4cc9f0": "var(--accent-blue)",
    "#60a5fa": "var(--accent-blue)",
    # accent — purple / indigo
    "#1a0066": "var(--accent-blue-deep)",
    "#4f46e5": "var(--accent-indigo)",
    "#7c3aed": "var(--accent-purple)",
    "#818cf8": "var(--accent-indigo)",
    "#8338ec": "var(--accent-purple)",
    "#8b5cf6": "var(--accent-purple)",
    "#a78bfa": "var(--accent-purple)",
    "#a855f7": "var(--accent-purple)",
    "#aa44ff": "var(--accent-purple)",
    "#e879f9": "var(--accent-fuchsia)",
    "#f15bb5": "var(--accent-pink)",
    "#f72585": "var(--accent-pink)",
    "#d946ef": "var(--accent-fuchsia)",
    # accent — neon / special
    "#06ffa5": "var(--accent-neon-teal)",
    "#39ff14": "var(--accent-neon)",
    "#d0f58a": "var(--accent-neon-lime)",
    "#d4ff40": "var(--accent-neon-lime)",
    # cyan (canonical)
    "#00f5ff": "var(--accent-cyan)",
}

# ── Files to skip entirely (canvas-confirmed) ─────────────────────────────────
SKIP_RELPATHS = {
    "components/audio-visualizer.tsx",
    "components/three/AudioReactiveScene.tsx",
    "components/three/WaveformMesh.tsx",
    "components/threestage.tsx",
}

# ── Lines containing these strings are skipped (WebGL / canvas draw calls) ───
SKIP_LINE_MARKERS = [
    "THREE.Color", "meshStandardMaterial", "ctx.fillStyle",
    "ctx.strokeStyle", "ctx.shadowColor", "fog attach",
    "new THREE", "<color attach", "<fog ", "groundColor",
    "createLinearGradient", "addColorStop",
]

HEX_RE = re.compile(r'(?<![0-9a-fA-F])(#[0-9a-fA-F]{3,6})(?![0-9a-fA-F])', re.IGNORECASE)

sorted_map = sorted(HEX_MAP.items(), key=lambda x: -len(x[0]))

def replace_line(line: str) -> str:
    if any(m in line for m in SKIP_LINE_MARKERS):
        return line
    result = line
    for hex_val, css_var in sorted_map:
        pat = re.compile(
            r'(?<![0-9a-fA-F])' + re.escape(hex_val) + r'(?![0-9a-fA-F])',
            re.IGNORECASE
        )
        result = pat.sub(css_var, result)
    return result

def process_file(fpath: Path):
    src = fpath.read_text(encoding="utf-8")
    lines = src.splitlines(keepends=True)
    new_lines = [replace_line(l) for l in lines]
    changed = [(i+1, o.rstrip(), n.rstrip())
               for i, (o, n) in enumerate(zip(lines, new_lines)) if o != n]
    return "".join(new_lines), changed

def still_has_violations(fpath: Path) -> list[str]:
    """Return any hex values remaining after replacement that aren't on the allowlist."""
    ALLOWLIST_RE = re.compile(
        r'#(00F5FF|8B5CF6|F59E0B|10B981|A3E635|EF4444|0A0A0A|0D0D0D'
        r'|1C1C1C|2A2A2A|E5E5E5|BFFF00|FF3B3B|555|888'
        r'|b87333|d4af37|cd7f32|4f46e5|d946ef'
        r'|ffd700|806000|fde68a|e8eaed|6c757d|5d6875|2d3339'
        r'|f4c2a0|5f3317|d4af87|6b3410|064e3b|022c22|fb7185|7c2d12)',
        re.IGNORECASE
    )
    hits = []
    for m in HEX_RE.finditer(fpath.read_text(encoding="utf-8")):
        if not ALLOWLIST_RE.match(m.group(1)):
            hits.append(m.group(1))
    return hits

# ── Gather targets ─────────────────────────────────────────────────────────────
all_files = sorted(SRC.rglob("*.tsx")) + sorted(SRC.rglob("*.ts"))
targets = [
    f for f in all_files
    if str(f.relative_to(SRC)) not in SKIP_RELPATHS
]

results = []
for fpath in targets:
    new_src, changed = process_file(fpath)
    if changed:
        results.append((fpath, new_src, changed))

results.sort(key=lambda x: -len(x[2]))

total = sum(len(r[2]) for r in results)
print(f"\n  p_final_patch — {'DRY RUN' if DRY_RUN else 'APPLYING'} — {total} line changes across {len(results)} files\n")
print(f"  {'File':<65} {'Lines':>5}")
print(f"  {'─'*65} {'─'*5}")
for fpath, _, changed in results:
    rel = str(fpath.relative_to(SRC))
    print(f"  {rel:<65} {len(changed):>5}")
    for lineno, old, new in changed:
        print(f"    L{lineno:>4}  - {old[:80]}")
        print(f"          + {new[:80]}")

if not DRY_RUN:
    for fpath, new_src, _ in results:
        fpath.write_text(new_src, encoding="utf-8")

    # Append new tokens if not already present
    css = THEME.read_text(encoding="utf-8")
    if "--accent-orange" not in css:
        THEME.write_text(css + NEW_TOKENS, encoding="utf-8")
        print(f"\n  [WRITTEN] new accent tokens → theme.css")
    else:
        print(f"\n  [SKIP] accent tokens already in theme.css")

    # RFC comment for audio-visualizer.tsx
    av = SRC / "components/audio-visualizer.tsx"
    if av.exists():
        src = av.read_text(encoding="utf-8")
        if "P4-EXEMPT" not in src:
            block = (
                "// ─────────────────────────────────────────────────────────────────────────\n"
                "// P4-EXEMPT: canvas drawing component — ctx.fillStyle / ctx.strokeStyle\n"
                "// calls require raw hex; CSS variables cannot be resolved at runtime here.\n"
                "// Exempted: p_final_patch remediation pass.\n"
                "// ─────────────────────────────────────────────────────────────────────────\n"
            )
            av.write_text(block + src, encoding="utf-8")
            print(f"  [WRITTEN] P4-EXEMPT comment → audio-visualizer.tsx")

    print(f"\n  Run: cd ~/Stable && pnpm tsc --noEmit")

    # Post-apply residual check
    print(f"\n  {'─'*68}")
    print(f"  POST-APPLY RESIDUAL CHECK")
    print(f"  {'─'*68}")
    any_residual = False
    for fpath, _, _ in results:
        residual = still_has_violations(fpath)
        if residual:
            any_residual = True
            rel = str(fpath.relative_to(SRC))
            print(f"  ⚠  {rel}")
            for h in sorted(set(residual)):
                print(f"       {h}")
    if not any_residual:
        print(f"  ✓  No residual violations in patched files.")
else:
    print(f"\n  Re-run with --apply to write.")
