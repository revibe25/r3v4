#!/usr/bin/env python3
import os, shutil, sys

STABLE = os.path.expanduser("~/Stable")
FLAT_PATH = os.path.join(STABLE, "client/src/components/multi-track-panel.tsx")
MODULAR_DIR = os.path.join(STABLE, "client/src/components/multi-track-panel")
BACKUP = os.path.expanduser("~/.stable-modular-bak")

def die(msg): print(f"[FATAL] {msg}", file=sys.stderr); sys.exit(1)
def ok(msg): print(f"[OK]    {msg}")

print("="*60)
print("STEP 2 — REMOVE DEAD MODULAR FOLDER")
print("="*60)

if not os.path.isfile(FLAT_PATH): die(f"Flat file not found: {FLAT_PATH}")
if not os.path.isdir(MODULAR_DIR): die(f"No modular folder exists: {MODULAR_DIR}")

os.makedirs(BACKUP, exist_ok=True)
modular_bak = os.path.join(BACKUP, "multi-track-panel-folder.bak")
flat_bak = os.path.join(BACKUP, "multi-track-panel.tsx.bak")

# Backup modular folder
if os.path.isdir(modular_bak): shutil.rmtree(modular_bak)
shutil.copytree(MODULAR_DIR, modular_bak)
ok(f"Backup: {MODULAR_DIR} → {modular_bak}")

# Backup flat file
shutil.copy2(FLAT_PATH, flat_bak)
ok(f"Backup: {FLAT_PATH} → {flat_bak}")

# Remove modular folder
try:
    shutil.rmtree(MODULAR_DIR)
    ok(f"Deleted modular folder: {MODULAR_DIR}")
except Exception as e:
    die(f"Failed to delete modular folder: {e}")

# Final check
if not os.path.isdir(MODULAR_DIR):
    ok("Modular directory removal successful.")
    print("\nSUCCESS. Only the flat file remains in client/src/components/.")
else:
    die("Modular directory was not deleted — manual check required.")

print("\nRollback: Restore with")
print(f"  cp -r {modular_bak} {MODULAR_DIR}")
print(f"  cp {flat_bak} {FLAT_PATH}")