#!/usr/bin/env python3
"""
r3_fix_store_barrel.py — WIRE Protocol
Audits store/index.ts and rewrites any re-exports that still use the _prefix
names after r3_patch_all.py has renamed the declarations in individual store files.

Run AFTER r3_patch_all.py:
  python3 tools/r3_fix_store_barrel.py

Root cause: store/index.ts re-exports like:
  export { useAudioStore, selectIsPlaying } from './audio-store';
These must match exactly what audio-store.ts now exports.
If the barrel exports the old _prefixed names (or the names were already
unprefixed in the barrel but prefixed in the source), TSC emits:
  Module has no exported member '_useAudioStore'.
This script re-reads each store file, collects its actual exports,
then rewrites the barrel to match.
"""

import re
import shutil
from datetime import datetime
from pathlib import Path

ROOT = Path.cwd()
TS = datetime.now().strftime("%Y%m%d_%H%M%S")

STORE_FILES = [
    "client/src/store/audio-store.ts",
    "client/src/store/clip-store.ts",
    "client/src/store/fx-store.ts",
    "client/src/store/meter-store.ts",
    "client/src/store/mixer-store.ts",
    "client/src/store/vst-store.ts",
    # session-metrics lives in stores/ (plural) not store/
    "client/src/stores/session-metrics.store.ts",
    "client/src/store/session-metrics.store.ts",  # fallback
    "client/src/store/auth-store.ts",
]

BARREL_CANDIDATES = [
    "client/src/store/index.ts",   # confirmed real path from .bak listing
    "client/src/stores/index.ts",
]

def extract_named_exports(path: Path) -> list[str]:
    """Extract all named export identifiers from a TypeScript source file."""
    text = path.read_text(encoding="utf-8")
    exports = []

    # Inline declarations: export const foo, export function foo, etc.
    inline_patterns = [
        r"^export\s+const\s+(\w+)",
        r"^export\s+function\s+(\w+)",
        r"^export\s+type\s+(\w+)",
        r"^export\s+class\s+(\w+)",
        r"^export\s+enum\s+(\w+)",
        r"^export\s+interface\s+(\w+)",
    ]
    for pattern in inline_patterns:
        for m in re.finditer(pattern, text, re.MULTILINE):
            exports.append(m.group(1))

    # Re-export blocks: export { foo, bar as baz }
    # Captures the local name (before any 'as alias')
    for m in re.finditer(r'^export\s*\{([^}]+)\}', text, re.MULTILINE):
        for entry in m.group(1).split(','):
            entry = entry.strip()
            if not entry:
                continue
            # "foo as Bar" → export name is "Bar"; plain "foo" → export name is "foo"
            parts = re.split(r'\s+as\s+', entry)
            export_name = parts[-1].strip()
            if export_name and re.match(r'^\w+$', export_name):
                exports.append(export_name)

    # Default export assigned to an identifier: export default useAuthStore
    for m in re.finditer(r'^export\s+default\s+(\w+)', text, re.MULTILINE):
        exports.append(m.group(1))

    return list(dict.fromkeys(exports))  # deduplicate, preserve order

def get_barrel(candidates: list[str]) -> Path | None:
    for c in candidates:
        p = ROOT / c
        if p.exists():
            return p
    return None

def main() -> None:
    print("R3v4 — Store Barrel Re-export Fixer (WIRE Protocol)")
    print(f"Root: {ROOT}")

    barrel = get_barrel(BARREL_CANDIDATES)
    if not barrel:
        print("[ABORT] store/index.ts not found. Check BARREL_CANDIDATES paths.")
        return

    print(f"\nBarrel: {barrel}")
    bak = barrel.with_suffix(f".ts.bak-{TS}")
    shutil.copy2(barrel, bak)
    print(f"Backup: {bak}")

    # Build map: relative module path → list of actual exports
    store_exports: dict[str, list[str]] = {}
    for rel in STORE_FILES:
        p = ROOT / rel
        if not p.exists():
            print(f"  [SKIP] {rel} not found")
            continue
        exports = extract_named_exports(p)
        # Compute the relative path as it would appear in an import from barrel dir
        module_name = p.stem  # e.g. 'audio-store'
        store_exports[module_name] = exports
        print(f"  {p.name}: {exports}")

    # Read existing barrel
    barrel_text = barrel.read_text(encoding="utf-8")
    barrel_lines = barrel_text.splitlines(keepends=True)

    new_lines = []
    changed = False
    for line in barrel_lines:
        # Match: export { foo, bar } from './audio-store'
        m = re.match(r'^export\s*\{([^}]+)\}\s*from\s*[\'"]\.\/([^\'"]+)[\'"]', line.strip())
        if m:
            exported_names_str = m.group(1)
            module_stem = m.group(2).split("/")[-1].rstrip(".ts")
            # Strip .ts suffix if present in import path
            module_stem = module_stem.removesuffix(".ts")

            if module_stem in store_exports:
                actual_exports = store_exports[module_stem]
                # Parse what the barrel currently tries to export
                barrel_names = [n.strip() for n in exported_names_str.split(",") if n.strip()]
                # Find mismatches
                bad = [n for n in barrel_names if n not in actual_exports]
                if bad:
                    print(f"\n  [FIX] {module_stem}: barrel exports {bad} but they don't exist")
                    # Replace bad names with the closest actual export (by stripping _)
                    new_names = []
                    for name in barrel_names:
                        if name in actual_exports:
                            new_names.append(name)
                        else:
                            # Try stripping leading underscore
                            stripped = name.lstrip("_")
                            if stripped in actual_exports:
                                print(f"         {name} → {stripped}")
                                new_names.append(stripped)
                            else:
                                print(f"         [WARN] {name} → no match in {actual_exports}")
                                new_names.append(name)  # leave as-is, TSC will flag it

                    # Reconstruct the export line preserving indentation
                    indent = line[: len(line) - len(line.lstrip())]
                    from_path = re.search(r'from\s*([\'"][^\'"]+[\'"])', line).group(1)
                    new_line = f"{indent}export {{ {', '.join(new_names)} }} from {from_path};\n"
                    new_lines.append(new_line)
                    changed = True
                    continue
        new_lines.append(line)

    if changed:
        barrel.write_text("".join(new_lines), encoding="utf-8")
        print(f"\n[WRITTEN] {barrel}")
    else:
        print("\n[OK] Barrel re-exports all match actual store exports — no changes needed.")

    print("\nVerification:")
    print("  pnpm tsc --noEmit")
    print("  grep -n 'error TS2305' /tmp/tsc_out.txt  # Module has no exported member")

if __name__ == "__main__":
    main()
