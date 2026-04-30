#!/usr/bin/env python3
import os, re
CANONICAL = os.path.expanduser("~/Stable/client/src/components/multi-track-panel.tsx")
OWNER = "team-or-owner"
TRACKING_ISSUE = "https://github.com/YOUR_ORG/YOUR_REPO/issues/TYPECHECK"
with open(CANONICAL, encoding="utf-8") as f: code = f.read()
if "// @ts-nocheck" not in code:
    print("No // @ts-nocheck found — nothing to do.")
    exit(0)
new = re.sub(
    r"(// *@ts-nocheck\s*)",
    r"""// @ts-nocheck
/**
 * [DEBT] Type-checking suppressed for legacy reasons; tracked at {}
 * Owned by: {}
 * Remove when type errors are fixed!
 */
""".format(TRACKING_ISSUE, OWNER), code, count=1
)
if new != code:
    with open(CANONICAL, "w", encoding="utf-8") as f:
        f.write(new)
    print("Added rationale comment to @ts-nocheck.")
else:
    print("Pattern could not be replaced — check manually.")