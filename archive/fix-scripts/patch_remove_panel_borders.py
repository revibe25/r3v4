#!/usr/bin/env python3
"""
patch_remove_panel_borders.py  (v2 — bug-fixed)
───────────────────────────────────────────────
Removes the white outer borders from CollapsibleFXPanel containers on the
Instrument page by inserting a single, scoped CSS override.

Scope (surgical):
  - Targets `.ag-panel > *:not(.ag-panel-ghost)` only — the CollapsibleFXPanel
    root element, never its descendants.
  - DOES NOT touch:
      * .ag-panel's own border-bottom (#1c1c1c divider)
      * button[aria-expanded] header bottom-border
      * button[aria-expanded="true"] left lime accent (3px var(--ag-acid))
      * [data-testid^="pad-"] pad button borders
      * .ag-guide reference panel (its dark borders are intentional)
      * any internal element borders inside panels

v2 fixes vs v1:
  1. Comment no longer contains backticks (would have terminated the
     JS template literal `const STYLES = ` ... ` ` early — compile error).
  2. Idempotency check fingerprints the CSS rule (stable across edits to
     the comment) rather than the full INSERTION block, so re-running a
     newer version of this script after an older one cannot duplicate.

Usage:
  python3 patch_remove_panel_borders.py            # dry-run (default)
  python3 patch_remove_panel_borders.py --apply    # write changes + .bak
"""
from __future__ import annotations
import sys
import shutil
import datetime as _dt
from pathlib import Path

TARGET = Path.home() / "Stable" / "client" / "src" / "pages" / "instrument.tsx"

# Anchor must be unique in the file. Verified against the uploaded copy.
ANCHOR = """.ag-frame .bg-card\\/50, .ag-frame .bg-card\\/30 {
  background: var(--ag-panel) !important; border: none !important;
}"""

# Inserted directly after the anchor. Single new rule, scoped to panel roots.
# IMPORTANT: contains NO backticks (the surrounding `const STYLES = \`...\``
# template literal would otherwise terminate at the first backtick).
INSERTION = """
/* Remove outer panel border on each CollapsibleFXPanel root.
   The selector matches the panel root element only — it never matches
   descendants, so the header bottom-border, the expanded-state lime
   left accent, and all internal element borders are preserved. */
.ag-frame .ag-panel > *:not(.ag-panel-ghost) {
  border: none !important;
}"""

# Fingerprint for idempotency: the CSS rule itself, which is stable
# across cosmetic edits to the surrounding comment.
RULE_FINGERPRINT = ".ag-frame .ag-panel > *:not(.ag-panel-ghost) {"

REPLACEMENT = ANCHOR + INSERTION


def main() -> int:
    apply = "--apply" in sys.argv

    if not TARGET.exists():
        print(f"FATAL: target not found: {TARGET}", file=sys.stderr)
        return 2

    src = TARGET.read_text(encoding="utf-8")

    # Idempotency: detect ANY prior insertion attempt (this script or older).
    if RULE_FINGERPRINT in src:
        print("NOOP: rule already present in file. Nothing to do.")
        return 0

    count = src.count(ANCHOR)
    assert count == 1, (
        f"anchor guard failed: expected exactly 1 occurrence of ANCHOR, "
        f"found {count}. Aborting (no write performed)."
    )

    # Sanity guard: insertion must contain no backticks (would break the
    # surrounding JS template literal). Fail loud if this regresses.
    assert "`" not in INSERTION, (
        "INSERTION contains a backtick — this would terminate the "
        "`const STYLES = \\`...\\`` template literal. Aborting."
    )

    out = src.replace(ANCHOR, REPLACEMENT, 1)
    assert out != src, "post-replace sanity: file unchanged"
    assert out.count(REPLACEMENT) == 1, "post-replace sanity: replacement not unique"
    assert out.count(RULE_FINGERPRINT) == 1, (
        "post-replace sanity: rule fingerprint count != 1"
    )

    print("=" * 70)
    print(f"TARGET : {TARGET}")
    print(f"MODE   : {'APPLY (writing changes)' if apply else 'DRY-RUN (no write)'}")
    print(f"DELTA  : +{len(INSERTION.splitlines()) - 1} lines  "
          f"(+{len(out) - len(src)} bytes)")
    print("=" * 70)
    print("INSERTING after anchor:")
    print(INSERTION)
    print("=" * 70)

    if not apply:
        print("Dry-run complete. Re-run with --apply to write.")
        return 0

    ts = _dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup = TARGET.with_suffix(f".tsx.bak.{ts}")
    shutil.copy2(TARGET, backup)
    print(f"BACKUP : {backup}")

    TARGET.write_text(out, encoding="utf-8")
    print(f"WROTE  : {TARGET}")
    print("Next : pnpm tsc --noEmit")
    return 0


if __name__ == "__main__":
    sys.exit(main())
