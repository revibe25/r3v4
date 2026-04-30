#!/usr/bin/env python3
import os, re
APPTS = os.path.expanduser("~/Stable/client/src/App.tsx")
CANONICAL = os.path.expanduser("~/Stable/client/src/components/multi-track-panel.tsx")
def update_file(fp, pattern, repl, desc):
    with open(fp, encoding="utf-8") as f: data = f.read()
    newdata = re.sub(pattern, repl, data)
    if data != newdata:
        with open(fp, "w", encoding="utf-8") as f: f.write(newdata)
        print(f"Updated {desc} in {fp}")
    else:
        print(f"No {desc} found/stale; no change.")
update_file(
    APPTS,
    r'\{/\* *Multitrack DAW — MultiTrackPanel.*?index\.ts.*?\*/\}',
    '{/* Multitrack DAW — MultiTrackPanel (multi-track-panel.tsx is canonical, modular is dead) */}',
    "stale modular comment"
)
update_file(
    CANONICAL,
    r'(?mi)^\s*//.*(deprecated|dead code).*$',
    '// [INFO] This is the canonical loaded component as of 2026-04-29. Modular version is dead code.',
    "deprecated/dead code comment"
)