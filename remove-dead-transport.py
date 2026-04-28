#!/usr/bin/env python3
"""
remove-dead-transport.py — R3 v4  (v2 — corrected)
====================================================
Removes the dead transport-store dependency chain.

Confirmed dead via full import tracing:

  unified-daw.tsx                   @ts-nocheck, zero importers
  instruments/transport-bar.tsx     only importer: unified-daw.tsx (dead)
                                    props-only, no store coupling
  ui/transport-bar.tsx              zero importers anywhere
                                    uses useTransportStore directly
  store/transport-store.ts          only consumer: ui/transport-bar.tsx (dead)
  store/index.ts line 50            re-export of useTransportStore (remove only)

NOT touched:
  hooks/use-transport-state.ts      local useState hook, live
                                    (waveform-editor.tsx → instrument.tsx)
  waveform-editor.tsx               live component

v1 bug fixed: v1 targeted components/ui/transport-bar.tsx only.
unified-daw.tsx imports "./transport-bar" which resolves to
components/instruments/transport-bar.tsx — a different file.
Both are now correctly identified and deleted.
"""

import os
import re
import shutil
import subprocess
import sys

CLIENT = os.path.expanduser("~/Stable/client")
SRC    = os.path.join(CLIENT, "src")

# ── Files to delete outright ──────────────────────────────────────────────────

DELETE_FILES = [
    os.path.join(CLIENT, "src/components/instruments/unified-daw.tsx"),
    os.path.join(CLIENT, "src/components/instruments/transport-bar.tsx"),
    os.path.join(CLIENT, "src/components/ui/transport-bar.tsx"),
    os.path.join(CLIENT, "src/store/transport-store.ts"),
]

# ── Line to remove from store/index.ts ───────────────────────────────────────

INDEX_FILE   = os.path.join(CLIENT, "src/store/index.ts")
INDEX_NEEDLE = "export { useTransportStore } from './transport-store';"

# ── Helpers ───────────────────────────────────────────────────────────────────

def die(msg):
    print(f"[FATAL] {msg}", file=sys.stderr)
    sys.exit(1)

def ok(msg):   print(f"[OK]    {msg}")
def info(msg): print(f"[INFO]  {msg}")

# ── Pre-flight: confirm all targets exist ─────────────────────────────────────

print("=== Pre-flight ===")
for path in DELETE_FILES:
    if not os.path.isfile(path):
        die(f"Expected file not found: {path}\nInspect manually before proceeding.")
    ok(f"Found: {os.path.relpath(path, CLIENT)}")

if not os.path.isfile(INDEX_FILE):
    die(f"store/index.ts not found at {INDEX_FILE}")
ok(f"Found: {os.path.relpath(INDEX_FILE, CLIENT)}")

with open(INDEX_FILE, "r", encoding="utf-8") as f:
    index_content = f.read()

if INDEX_NEEDLE not in index_content:
    die(f"Re-export line not found in store/index.ts:\n  {INDEX_NEEDLE}\n"
        "Already removed or file changed — inspect manually.")
ok("Re-export line located in store/index.ts")

# ── Safety: confirm no live files import the dead ones ───────────────────────
#
# Pattern covers all import styles:
#   "/transport-bar"  → matches "./transport-bar" and "@/.../transport-bar"
#   "unified-daw"     → matches any import of unified-daw
#   "transport-store" → matches hyphenated module name (NOT camelCase
#                       useTransportStore, so comment mentions are safe)
#
# Filters applied before reporting:
#   1. Lines from the dead files themselves (self-references)
#   2. The index.ts re-export line we are already removing

print()
print("=== Safety: confirming no live importers ===")

result = subprocess.run(
    ["grep", "-rn",
     r"/transport-bar|unified-daw|transport-store",
     SRC,
     "--include=*.ts", "--include=*.tsx"],
    capture_output=True, text=True
)

dead_rel = {os.path.relpath(p, CLIENT) for p in DELETE_FILES}

live_hits = []
for line in result.stdout.splitlines():
    parts    = line.split(":")
    abs_path = parts[0]
    rel      = os.path.relpath(abs_path, CLIENT)
    content  = ":".join(parts[2:])
    if rel in dead_rel:
        continue                        # self-reference inside a dead file
    if abs_path == INDEX_FILE and INDEX_NEEDLE in content:
        continue                        # the re-export line we're removing
    live_hits.append(line)

if live_hits:
    print("[WARN]  Unexpected live importers — aborting:", file=sys.stderr)
    for h in live_hits:
        print(f"  {h}", file=sys.stderr)
    die("Live importers detected. Inspect before deleting.")

ok("No live importers found — safe to delete")

# ── Backup ────────────────────────────────────────────────────────────────────

print()
print("=== Backup ===")
BAK_DIR = os.path.expanduser("~/Stable/.dead-transport-bak")
os.makedirs(BAK_DIR, exist_ok=True)
ok(f"Backup dir: {BAK_DIR}")

backed_up = []  # list of (original_path, backup_path)
for path in DELETE_FILES:
    # Encode subdirectory into backup filename to avoid collisions between
    # instruments/transport-bar.tsx and ui/transport-bar.tsx
    rel_parts = os.path.relpath(path, os.path.join(CLIENT, "src")).replace("/", "_")
    dest = os.path.join(BAK_DIR, rel_parts)
    shutil.copy2(path, dest)
    backed_up.append((path, dest))
    ok(f"Backed up: {os.path.relpath(path, CLIENT)} → {rel_parts}")

index_bak = os.path.join(BAK_DIR, "index.ts.bak")
shutil.copy2(INDEX_FILE, index_bak)
ok("Backed up: store/index.ts")

def rollback():
    print("[ROLLBACK] Restoring...", file=sys.stderr)
    for orig, bak in backed_up:
        if not os.path.isfile(orig):    # only restore files already deleted
            os.makedirs(os.path.dirname(orig), exist_ok=True)
            shutil.copy2(bak, orig)
            print(f"[ROLLBACK]   Restored {os.path.relpath(orig, CLIENT)}", file=sys.stderr)
    shutil.copy2(index_bak, INDEX_FILE)
    print("[ROLLBACK]   Restored store/index.ts", file=sys.stderr)

# ── Delete dead files ─────────────────────────────────────────────────────────

print()
print("=== Deleting dead files ===")
for path in DELETE_FILES:
    try:
        os.remove(path)
        ok(f"Deleted: {os.path.relpath(path, CLIENT)}")
    except OSError as e:
        rollback()
        die(f"Failed to delete {path}: {e}")

# ── Remove re-export line from store/index.ts ─────────────────────────────────

print()
print("=== Patching store/index.ts ===")

lines     = index_content.splitlines(keepends=True)
new_lines = [l for l in lines if INDEX_NEEDLE not in l]
removed   = len(lines) - len(new_lines)

if removed == 0:
    rollback()
    die("Re-export line not removed — filter had no effect")
if removed != 1:
    rollback()
    die(f"Expected to remove exactly 1 line, removed {removed}")

try:
    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    ok("Removed useTransportStore re-export from store/index.ts")
except OSError as e:
    rollback()
    die(f"Failed to write store/index.ts: {e}")

with open(INDEX_FILE, "r", encoding="utf-8") as f:
    verify = f.read()
if "transport-store" in verify:
    rollback()
    die("transport-store still present in store/index.ts after patch")
ok("store/index.ts verified — transport-store absent")

# ── Post-deletion: confirm all files gone ─────────────────────────────────────

print()
print("=== Post-deletion verify ===")
for path in DELETE_FILES:
    if os.path.isfile(path):
        rollback()
        die(f"File still present after deletion: {path}")
    ok(f"Confirmed gone: {os.path.relpath(path, CLIENT)}")

# ── Done ──────────────────────────────────────────────────────────────────────

print()
print("[DONE]")
print()
print("Deleted:")
for path in DELETE_FILES:
    print(f"  {os.path.relpath(path, CLIENT)}")
print()
print("Patched:")
print("  src/store/index.ts — removed useTransportStore re-export")
print()
print("Backups: ~/.dead-transport-bak/")
print()
print("Next:")
print("  cd ~/Stable/client && tsc --noEmit")
print()
print("Then commit:")
print('  cd ~/Stable && git add -A && git commit -m \\')
print('    "chore: remove dead transport-store chain (unified-daw, transport-bar x2, transport-store)"')
print()
print("Pre-existing bug (separate fix):")
print("  waveform-editor.tsx:232 destructures setBpm from useTransportState()")
print("  but the hook never returns setBpm — runtime value is undefined.")
