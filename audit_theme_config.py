#!/usr/bin/env python3
"""
audit_theme_config.py
Audits ~/Stable/client/src/lib/theme-config.ts and classifies every hex occurrence.
Produces:
  - Console report (grouped by disposition)
  - theme_config_patch.py  — rewrite script for in-place replacements
  - theme_config_rfc.txt   — RFC exemption candidates to add to preflight grep

Usage:
  python3 audit_theme_config.py          # dry-run, prints report only
  python3 audit_theme_config.py --apply  # writes theme_config_patch.py and rfc file
"""

import re
import sys
from pathlib import Path
from collections import defaultdict

DRY_RUN = "--apply" not in sys.argv

TARGET = Path.home() / "Stable/client/src/lib/theme-config.ts"

# ── Canonical CSS var map (extend as needed) ──────────────────────────────────
HEX_TO_VAR: dict[str, str] = {
    # near-blacks / panels
    "#020617": "var(--panel-deep)",
    "#0a0a0a": "var(--panel-deep)",
    "#0c0c0c": "var(--panel-deep)",
    "#0d0d0d": "var(--panel-deep)",
    "#131313": "var(--panel-deep)",
    "#181818": "var(--panel)",
    "#18181b": "var(--panel)",
    "#191919": "var(--panel)",
    "#1c1c1c": "var(--panel)",
    "#2a2a2a": "var(--panel-mid)",
    "#2e2e2e": "var(--panel-mid)",
    # surfaces / borders
    "#222":    "var(--border)",
    "#222222": "var(--border)",
    "#333":    "var(--border)",
    "#333333": "var(--border)",
    "#444":    "var(--surface)",
    "#444444": "var(--surface)",
    "#555":    "var(--surface-mid)",
    "#555555": "var(--surface-mid)",
    # text / grays
    "#777":    "var(--text-muted)",
    "#777777": "var(--text-muted)",
    "#888":    "var(--text-dim)",
    "#888888": "var(--text-dim)",
    "#8b95a1": "var(--text-dim)",
    "#c5c9cc": "var(--text-secondary)",
    "#d4d4d4": "var(--text-secondary)",
    "#e5e5e5": "var(--text-primary)",
    "#f4f4f5": "var(--text-primary)",
    "#ffffff": "var(--text)",
    # status / accents
    "#ef4444": "var(--status-error)",
    "#cc0000": "var(--status-error)",
    "#ff0033": "var(--status-error)",
    "#ff1a1a": "var(--status-error)",
    "#ff2244": "var(--status-error)",
    "#f87171": "var(--status-error-soft)",
    "#10b981": "var(--status-ok)",
    "#a3e635": "var(--status-ok-alt)",
    "#bfff00": "var(--status-ok-alt)",
    "#32cd32": "var(--status-ok-alt)",
    "#f5d000": "var(--status-warn)",
    "#f59e0b": "var(--status-warn)",
    "#00f5ff": "var(--accent-cyan)",
    "#8b5cf6": "var(--accent-purple)",
    "#7c3aed": "var(--accent-purple)",
    "#818cf8": "var(--accent-indigo)",
    "#8338ec": "var(--accent-purple)",
    "#60a5fa": "var(--accent-blue)",
    "#64748b": "var(--text-dim)",
    "#ff3b3b": "var(--status-error)",
    "#39ff14": "var(--accent-neon)",
    # deep scene purples — RFC candidates
    "#1a0066": "var(--scene-deep-purple)",
}

RFC_CANDIDATES = {
    "#d4af37",  # gold
    "#cd7f32",  # bronze
    "#b87333",  # copper
    "#4d6b18",  # dark olive (rank/badge?)
    "#39ff14",  # neon green (canvas)
    "#32cd32",  # lime (canvas)
    "#1a0066",  # deep purple (Three.js scene)
}

HEX_RE = re.compile(r'(?<![0-9a-fA-F])(#[0-9a-fA-F]{3,6})(?![0-9a-fA-F])', re.IGNORECASE)

def classify(hex_val: str):
    lo = hex_val.lower()
    if lo in HEX_TO_VAR:
        return "REPLACE", HEX_TO_VAR[lo]
    if lo in RFC_CANDIDATES:
        return "RFC", None
    return "UNKNOWN", None

def audit():
    if not TARGET.exists():
        print(f"[ERROR] {TARGET} not found")
        sys.exit(1)

    lines = TARGET.read_text(encoding="utf-8").splitlines()
    by_class: dict[str, list] = defaultdict(list)

    for i, line in enumerate(lines, 1):
        for m in HEX_RE.finditer(line):
            hex_val = m.group(1)
            kind, replacement = classify(hex_val)
            by_class[kind].append((i, hex_val, replacement, line.strip()))

    # ── Report ────────────────────────────────────────────────────────────────
    print(f"\n{'═'*68}")
    print(f"  theme-config.ts audit — {sum(len(v) for v in by_class.values())} hex occurrences")
    print(f"{'═'*68}\n")

    for kind in ("REPLACE", "RFC", "UNKNOWN"):
        items = by_class.get(kind, [])
        if not items:
            continue
        label = {"REPLACE": "✓ Replaceable", "RFC": "⚠ RFC-exempt candidate", "UNKNOWN": "✗ Unknown — needs manual triage"}[kind]
        print(f"  {label} ({len(items)})")
        print(f"  {'─'*64}")
        for lineno, hex_val, replacement, snippet in items:
            rep_str = f" → {replacement}" if replacement else ""
            print(f"  L{lineno:>4}  {hex_val:<10}{rep_str}")
            print(f"         {snippet[:72]}")
        print()

    return by_class, lines

def write_patch(by_class, lines):
    replacements = {}  # hex_lower → css_var
    for lineno, hex_val, replacement, _ in by_class.get("REPLACE", []):
        replacements[hex_val.lower()] = replacement

    if not replacements:
        print("  [INFO] Nothing to replace.")
        return

    patch_path = Path("theme_config_patch.py")
    entries = "\n".join(f'    "{k}": "{v}",' for k, v in sorted(replacements.items()))
    script = f'''\
#!/usr/bin/env python3
"""Auto-generated by audit_theme_config.py — do not edit manually."""
import re, sys
from pathlib import Path

DRY_RUN = "--apply" not in sys.argv
TARGET = Path.home() / "Stable/client/src/lib/theme-config.ts"

HEX_MAP = {{
{entries}
}}

HEX_RE = re.compile(r\'(?<![0-9a-fA-F])(#[0-9a-fA-F]{{3,6}})(?![0-9a-fA-F])\', re.IGNORECASE)

def replace(line):
    def sub(m):
        return HEX_MAP.get(m.group(1).lower(), m.group(1))
    return HEX_RE.sub(sub, line)

src = TARGET.read_text(encoding="utf-8")
lines = src.splitlines(keepends=True)
new_lines = [replace(l) for l in lines]
changed = [(i+1, o, n) for i, (o, n) in enumerate(zip(lines, new_lines)) if o != n]

print(f"  theme_config_patch — {{\'DRY RUN\' if DRY_RUN else \'APPLYING\'}} — {{len(changed)}} lines")
for lineno, old, new in changed:
    print(f"  L{{lineno:>4}} - {{old.rstrip()}}")
    print(f"       + {{new.rstrip()}}")

if not DRY_RUN:
    TARGET.write_text("".join(new_lines), encoding="utf-8")
    print("  [WRITTEN]")
else:
    print("  Re-run with --apply to write.")
'''
    patch_path.write_text(script, encoding="utf-8")
    print(f"  [WRITTEN] {patch_path}")

    rfc_items = by_class.get("RFC", [])
    if rfc_items:
        rfc_path = Path("theme_config_rfc.txt")
        unique = sorted({hex_val.lower() for _, hex_val, _, _ in rfc_items})
        rfc_path.write_text(
            "# Add these to the preflight grep -iv allowlist if intentional:\n" +
            "\n".join(f'  -e "{h}"' for h in unique) + "\n"
        )
        print(f"  [WRITTEN] {rfc_path}")

    unknown = by_class.get("UNKNOWN", [])
    if unknown:
        print(f"\n  [WARN] {len(unknown)} unknown hex values need manual decision:")
        for _, hex_val, _, snippet in unknown:
            print(f"    {hex_val}  →  {snippet[:60]}")

if __name__ == "__main__":
    by_class, lines = audit()
    if not DRY_RUN:
        write_patch(by_class, lines)
    else:
        print("  Run with --apply to generate theme_config_patch.py + theme_config_rfc.txt")
