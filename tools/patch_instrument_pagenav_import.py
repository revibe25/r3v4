#!/usr/bin/env python3
"""
tools/patch_instrument_pagenav_import.py  (v2)

Adds missing `PageNav` import to client/src/pages/instrument.tsx.
Cause: import dropped during PRD v4.1 / ASI v2 sweep; runtime ReferenceError
at instrument.tsx:1378 ('<PageNav />').

Wire.txt compliant:
  - read-before-write (verified via grep)
  - assert count == 1 anchor guard
  - dry-run default, --apply to commit
  - timestamped .bak alongside source
  - explicit utf-8 (file header contains box-drawing chars)
  - idempotent against any reformatted prior import of the same module

Changes vs v1:
  - encoding="utf-8" on read and write (header has U+2500 box chars)
  - idempotency now checks for the import PATH, not the literal line,
    so reformatted prior additions (e.g. double quotes) are not duplicated
"""
import argparse
import shutil
import sys
from datetime import datetime
from pathlib import Path

TARGET = Path.home() / "Stable/client/src/pages/instrument.tsx"

ANCHOR = "import { CollapsibleFXPanel } from '@/components/collapsible-fx-panel';\n"
INSERT = "import { PageNav } from '@/components/page-nav';\n"

# Idempotency: any import from this module path, regardless of formatting.
IDEMPOTENT_NEEDLE = "from '@/components/page-nav'"
IDEMPOTENT_NEEDLE_DQ = 'from "@/components/page-nav"'


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="Write changes (default: dry-run)")
    args = ap.parse_args()

    if not TARGET.exists():
        sys.exit(f"FATAL: target not found: {TARGET}")

    src = TARGET.read_text(encoding="utf-8")

    # Idempotency guard — any pre-existing import from this path
    if IDEMPOTENT_NEEDLE in src or IDEMPOTENT_NEEDLE_DQ in src:
        print("NO-OP: an import from '@/components/page-nav' is already present.")
        return

    # Wire.txt: assert count == 1
    count = src.count(ANCHOR)
    assert count == 1, f"Anchor count != 1 (got {count}). Refusing to patch."

    new_src = src.replace(ANCHOR, ANCHOR + INSERT, 1)

    print(f"--- {TARGET}")
    print(f"+++ {TARGET} (patched)")
    print(f"  {ANCHOR.rstrip()}")
    print(f"+ {INSERT.rstrip()}")
    print()

    if not args.apply:
        print("DRY-RUN. Re-run with --apply to commit.")
        return

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    bak = TARGET.with_suffix(TARGET.suffix + f".bak-{ts}")
    shutil.copy2(TARGET, bak)
    TARGET.write_text(new_src, encoding="utf-8")
    print(f"WROTE:  {TARGET}")
    print(f"BACKUP: {bak}")


if __name__ == "__main__":
    main()
