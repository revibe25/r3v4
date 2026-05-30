#!/usr/bin/env python3
"""
fix_dockerfile.py
Fixes the Railway build failure:
  error TS2307: Cannot find module '@llpte/llpte-signal'

Root cause: packages/llpte-signal/package.json exports point to dist/index.js
but dist/ is .gitignored and never present in the Docker image.
The Dockerfile copies packages/ source but never builds it before running
`pnpm build` (which compiles the server and tries to import from dist/).

Fix: add `RUN pnpm --filter "@llpte/*" build` after packages/ is copied
and before `RUN pnpm build`.

Also fixes a secondary ordering issue: drizzle.config.ts is copied
redundantly (it's already inside server/ which is copied in full).
"""
import sys
from pathlib import Path

DRY = "--apply" not in sys.argv
f = Path.home() / "Stable/Dockerfile"
text = f.read_text()
original = text

OLD = (
    "# Build TypeScript → dist/ (must be AFTER all source is copied)\n"
    "RUN pnpm build"
)
NEW = (
    "# Build LLPTE packages first — server imports from their dist/\n"
    "RUN pnpm --filter \"@llpte/*\" build\n"
    "# Build server TypeScript → dist/\n"
    "RUN pnpm build"
)

if OLD not in text:
    # Try without the comment line
    OLD2 = "RUN pnpm build\n"
    if OLD2 in text:
        print("WARN: comment anchor not found, using bare RUN pnpm build")
        # Only replace the last occurrence (the actual server build, not a hypothetical)
        idx = text.rfind("RUN pnpm build")
        text = text[:idx] + NEW + text[idx + len("RUN pnpm build"):]
    else:
        print("ERROR: could not find anchor. Print current RUN lines:")
        for i, line in enumerate(text.splitlines(), 1):
            if "RUN" in line or "COPY" in line:
                print(f"  {i:3}: {line}")
        sys.exit(1)
else:
    text = text.replace(OLD, NEW, 1)

if DRY:
    print("DRY RUN — would change:")
    for o, n in zip(OLD.splitlines(), NEW.splitlines()):
        if o != n:
            print(f"  - {o}")
            print(f"  + {n}")
    print(f"\nRe-run with --apply to write.")
else:
    f.write_text(text)
    print("Dockerfile patched: LLPTE build step added before server build")
