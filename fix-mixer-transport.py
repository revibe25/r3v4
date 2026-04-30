#!/usr/bin/env python3
"""
fix-mixer-transport.py — Phase A: Eliminate double transport bar on /mixer page
-------------------------------------------------------------------------------
Applies coordinated edits to
  - client/src/components/multi-track-view.tsx
  - client/src/App.tsx

Adds `hideTransport?: boolean` prop to MultitrackView (default false), wraps the
transport bar in {!hideTransport && (...)} and passes hideTransport={true} from
MultitrackViewWrapper in App.tsx only for /mixer route.

SAFE FOR DEMO: does NOT impact other consumers.
Automatically creates backups and bails out (rolls back) if any edit/anchor is missing.

Usage:
    python3 fix-mixer-transport.py

To roll back:
    cp ~/.mixer-transport-bak/multi-track-view.tsx.bak ~/Stable/client/src/components/multi-track-view.tsx
    cp ~/.mixer-transport-bak/App.tsx.bak              ~/Stable/client/src/App.tsx
"""

import os
import shutil
import sys

# === PATH SETUP ===
STABLE = os.path.expanduser("~/Stable")
VIEW_PATH = os.path.join(STABLE, "client/src/components/multi-track-view.tsx")
APP_PATH  = os.path.join(STABLE, "client/src/App.tsx")
BAK_DIR   = os.path.expanduser("~/.mixer-transport-bak")

def die(msg):
    print(f"\n[FATAL] {msg}", file=sys.stderr)
    sys.exit(1)

def ok(msg): print(f"[OK]    {msg}")

# === PATCH DEFINITIONS ===

VIEW_EDIT1_OLD = """  onReorderTracks?: (fromId: string, toId: string) => void;
  onReorderFX?: (trackId: string, fromIndex: number, toIndex: number) => void;
}"""
VIEW_EDIT1_NEW = """  onReorderTracks?: (fromId: string, toId: string) => void;
  onReorderFX?: (trackId: string, fromIndex: number, toIndex: number) => void;
  /** When true, suppresses the inline transport bar (header is rendered upstream). */
  hideTransport?: boolean;
}"""

VIEW_EDIT2_OLD = """const MultitrackView: React.FC<MultitrackViewProps> = ({
  tracks,
  transport,
  onTogglePlay,"""
VIEW_EDIT2_NEW = """const MultitrackView: React.FC<MultitrackViewProps> = ({
  tracks,
  transport,
  hideTransport = false,
  onTogglePlay,"""

VIEW_EDIT3A_OLD = """    <div className="flex flex-col h-full bg-card text-white font-sans">
      {/* Transport Control */}
      <div className="h-14 flex items-center gap-4 px-4 border-b border-border bg-background shadow-lg">"""
VIEW_EDIT3A_NEW = """    <div className="flex flex-col h-full bg-card text-white font-sans">
      {!hideTransport && (
      <div className="h-14 flex items-center gap-4 px-4 border-b border-border bg-background shadow-lg">"""

VIEW_EDIT3B_OLD = """        {transport.isRecording && (
          <div className="text-xs font-medium">
            <span className="text-red-400 font-bold animate-pulse">● RECORDING</span>
          </div>
        )}
      </div>"""
VIEW_EDIT3B_NEW = """        {transport.isRecording && (
          <div className="text-xs font-medium">
            <span className="text-red-400 font-bold animate-pulse">● RECORDING</span>
          </div>
        )}
      </div>
      )}"""

APP_EDIT_OLD = """    <MultitrackView
      tracks={tracks.map(adaptTrack)}
      transport={{ isPlaying: playing, isRecording: recording, position }}
      onTogglePlay={()    => setPlaying(!playing)}"""
APP_EDIT_NEW = """    <MultitrackView
      tracks={tracks.map(adaptTrack)}
      transport={{ isPlaying: playing, isRecording: recording, position }}
      hideTransport={true}
      onTogglePlay={()    => setPlaying(!playing)}"""

# === PHASE 1: Pre-flight Checks ===

print("=" * 60)
print("PHASE 1 — Pre-flight")
print("=" * 60)

for path in (VIEW_PATH, APP_PATH):
    if not os.path.isfile(path):
        die(f"File not found: {path}")
    ok(f"Found: {os.path.relpath(path, STABLE)}")

with open(VIEW_PATH, "r", encoding="utf-8") as f:
    old_view = f.read()
with open(APP_PATH, "r", encoding="utf-8") as f:
    old_app = f.read()

if "hideTransport" in old_view or "hideTransport" in old_app:
    die("hideTransport already present. Patch already applied or prop added by other means. Inspect manually before re-running.")
ok("Idempotency check passed — hideTransport not yet present")

# Check all patch anchors (they must exist once and only once)
anchors = [
    ("multi-track-view.tsx", "EDIT 1 (interface)",   old_view, VIEW_EDIT1_OLD),
    ("multi-track-view.tsx", "EDIT 2 (signature)",   old_view, VIEW_EDIT2_OLD),
    ("multi-track-view.tsx", "EDIT 3a (open wrap)",  old_view, VIEW_EDIT3A_OLD),
    ("multi-track-view.tsx", "EDIT 3b (close wrap)", old_view, VIEW_EDIT3B_OLD),
    ("App.tsx",              "EDIT 4 (wrapper)",     old_app,  APP_EDIT_OLD),
]
for label, edit_name, content, anchor in anchors:
    if anchor not in content:
        die(f"{label}: {edit_name} anchor not found. File may have changed or whitespace differs.\nExpected:\n{anchor[:120]}...")
    if content.count(anchor) > 1:
        die(f"{label}: {edit_name} anchor matched more than once — patch is unsafe. Please resolve ambiguity.")
    ok(f"{label}: {edit_name} anchor located (1 occurrence)")

# === PHASE 2: Backups ===

print("\n" + "=" * 60)
print("PHASE 2 — Backup")
print("=" * 60)

os.makedirs(BAK_DIR, exist_ok=True)
view_bak = os.path.join(BAK_DIR, "multi-track-view.tsx.bak")
app_bak  = os.path.join(BAK_DIR, "App.tsx.bak")

shutil.copy2(VIEW_PATH, view_bak)
ok(f"Backed up: multi-track-view.tsx  →  {view_bak}")
shutil.copy2(APP_PATH,  app_bak)
ok(f"Backed up: App.tsx               →  {app_bak}")

def rollback():
    print("\n[ROLLBACK] Restoring originals...", file=sys.stderr)
    for src, dst, label in (
        (view_bak, VIEW_PATH, "multi-track-view.tsx"),
        (app_bak,  APP_PATH,  "App.tsx"),
    ):
        try:
            shutil.copy2(src, dst)
            print(f"[ROLLBACK]   Restored: {label}", file=sys.stderr)
        except OSError as e:
            print(f"[ROLLBACK]   FAILED {label}: {e}", file=sys.stderr)

# === PHASE 3: Apply Edits ===

print("\n" + "=" * 60)
print("PHASE 3 — Applying edits")
print("=" * 60)

try:
    new_view = old_view
    for edit_name, old, new in (
        ("EDIT 1 — interface",   VIEW_EDIT1_OLD, VIEW_EDIT1_NEW),
        ("EDIT 2 — signature",   VIEW_EDIT2_OLD, VIEW_EDIT2_NEW),
        ("EDIT 3a — open wrap",  VIEW_EDIT3A_OLD, VIEW_EDIT3A_NEW),
        ("EDIT 3b — close wrap", VIEW_EDIT3B_OLD, VIEW_EDIT3B_NEW),
    ):
        if old not in new_view:
            rollback()
            die(f"{edit_name}: anchor disappeared mid-script.")
        new_view = new_view.replace(old, new, 1)
        if old in new_view:
            rollback()
            die(f"{edit_name}: could not remove old pattern — patch integrity failed.")
        ok(f"Applied: {edit_name}")

    new_app = old_app.replace(APP_EDIT_OLD, APP_EDIT_NEW, 1)
    if new_app == old_app:
        rollback()
        die("EDIT 4 (App.tsx wrapper): replace had no effect.")
    ok("Applied: EDIT 4 — wrapper passes hideTransport={true}")

except Exception as e:
    rollback()
    die(f"Patching failed: {e}")

# === PHASE 4: Write results ===

print("\n" + "=" * 60)
print("PHASE 4 — Writing patched files")
print("=" * 60)

try:
    with open(VIEW_PATH, "w", encoding="utf-8") as f:
        f.write(new_view)
    ok(f"Wrote: multi-track-view.tsx ({len(new_view) - len(old_view):+d} bytes)")
except OSError as e:
    rollback()
    die(f"Write failed for multi-track-view.tsx: {e}")

try:
    with open(APP_PATH, "w", encoding="utf-8") as f:
        f.write(new_app)
    ok(f"Wrote: App.tsx               ({len(new_app) - len(old_app):+d} bytes)")
except OSError as e:
    rollback()
    die(f"Write failed for App.tsx: {e}")

# === PHASE 5: Post-patch triple-check ===

print("\n" + "=" * 60)
print("PHASE 5 — Post-patch triple-check")
print("=" * 60)

with open(VIEW_PATH, "r", encoding="utf-8") as f: check_view = f.read()
with open(APP_PATH, "r", encoding="utf-8") as f: check_app = f.read()

if check_view.count("hideTransport") < 3:
    rollback()
    die(f"multi-track-view.tsx hideTransport count = {check_view.count('hideTransport')}, expected >= 3")
ok(f"multi-track-view.tsx contains hideTransport ({check_view.count('hideTransport')} occurrences)")

if check_view.count("{!hideTransport && (") != 1:
    rollback()
    die("multi-track-view.tsx: wrap-open '{!hideTransport && (' count ≠ 1")
ok("multi-track-view.tsx: wrap-open present exactly once")

if check_app.count("hideTransport={true}") != 1:
    rollback()
    die(f"App.tsx hideTransport={{true}} count = {check_app.count('hideTransport={true}')}, expected 1")
ok(f"App.tsx contains hideTransport={{true}} (1 occurrence)")

# === DONE ===

print("\n" + "=" * 60)
print("[DONE] Phase A patch for single transport bar applied & triple-checked.")
print("=" * 60)
print("\nTo verify:")
print("- Only one transport bar on /mixer.")
print("- All other routes/functionality unaffected.")
print("\nRollback:")
print(f"  cp {view_bak} {VIEW_PATH}")
print(f"  cp {app_bak}  {APP_PATH}")
