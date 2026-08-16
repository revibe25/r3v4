#!/usr/bin/env python3
"""
R3 Native Tone.js Import Fix
Fixes: TypeError: Tone.start is not a function
"""
import sys
import os
from pathlib import Path
from datetime import datetime

# ============================================================================
# CONFIGURATION
# ============================================================================

AUDIO_FILE = Path.home() / "Stable" / "client" / "src" / "utils" / "audio.ts"
BACKUP_DIR = Path.home() / "Stable" / ".backups"
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")
BACKUP_FILE = BACKUP_DIR / f"audio.ts.{TIMESTAMP}.bak"

# ============================================================================
# VALIDATION
# ============================================================================

print(f"[INFO] Tone.js Import Fix")
print(f"[INFO] File: {AUDIO_FILE}")

# Check 1: File exists
if not AUDIO_FILE.exists():
    print(f"[ERROR] File not found: {AUDIO_FILE}")
    sys.exit(1)
print(f"[✓] File found")

# Check 2: Read file
try:
    with open(AUDIO_FILE, 'r') as f:
        lines = f.readlines()
except Exception as e:
    print(f"[ERROR] Cannot read file: {e}")
    sys.exit(1)
print(f"[✓] File readable ({len(lines)} lines)")

# Check 3: Anchor validation
anchor_found = False
for i, line in enumerate(lines):
    if "const Tone = await import('tone');" in line:
        # Verify next two lines
        if i+1 < len(lines) and "await Tone.start();" in lines[i+1]:
            if i+2 < len(lines) and "console.debug" in lines[i+2]:
                anchor_found = True
                anchor_line = i
                print(f"[✓] Code pattern found at line {i+1}")
                break

if not anchor_found:
    print(f"[ERROR] Cannot find expected code pattern")
    print(f"[ERROR] Looking for:")
    print(f"       const Tone = await import('tone');")
    print(f"       await Tone.start();")
    print(f"       console.debug(...)")
    sys.exit(1)

# ============================================================================
# BACKUP
# ============================================================================

BACKUP_DIR.mkdir(parents=True, exist_ok=True)
try:
    with open(AUDIO_FILE, 'r') as src:
        content = src.read()
    with open(BACKUP_FILE, 'w') as dst:
        dst.write(content)
    print(f"[✓] Backup created: {BACKUP_FILE}")
except Exception as e:
    print(f"[ERROR] Backup failed: {e}")
    sys.exit(1)

# ============================================================================
# APPLY FIX
# ============================================================================

print(f"[INFO] Applying fix...")

# Replace the three lines
new_lines = lines.copy()

# Lines to replace: anchor_line, anchor_line+1, anchor_line+2
# Old:
#   const Tone = await import('tone');
#   await Tone.start();
#   console.debug('[R3 Audio] AudioContext resumed via user gesture.');
# New:
#   const { default: Tone } = await import('tone');
#   if (typeof Tone?.start !== 'function') {
#     throw new Error('[R3 Audio] Tone.start is not a function; import destructuring failed');
#   }
#   await Tone.start();
#   console.debug('[R3 Audio] AudioContext resumed via user gesture.');

indent = lines[anchor_line][:len(lines[anchor_line]) - len(lines[anchor_line].lstrip())]

replacement = [
    f"{indent}const {{ default: Tone }} = await import('tone');\n",
    f"{indent}if (typeof Tone?.start !== 'function') {{\n",
    f"{indent}  throw new Error('[R3 Audio] Tone.start is not a function; import destructuring failed');\n",
    f"{indent}}}\n",
    f"{indent}await Tone.start();\n",
    lines[anchor_line + 2],  # console.debug line
]

new_lines[anchor_line:anchor_line+3] = replacement

# Write back
try:
    with open(AUDIO_FILE, 'w') as f:
        f.writelines(new_lines)
    print(f"[✓] Fix applied")
except Exception as e:
    print(f"[ERROR] Write failed: {e}")
    print(f"[WARN] Restoring backup...")
    with open(BACKUP_FILE, 'r') as src:
        content = src.read()
    with open(AUDIO_FILE, 'w') as dst:
        dst.write(content)
    sys.exit(1)

# ============================================================================
# VERIFY
# ============================================================================

print(f"[INFO] Verifying fix...")

with open(AUDIO_FILE, 'r') as f:
    content = f.read()

checks = [
    ("New import pattern", "const { default: Tone } = await import('tone');"),
    ("Guard clause", "if (typeof Tone?.start !== 'function')"),
    ("Error message", "Tone.start is not a function; import destructuring failed"),
    ("Tone.start call", "await Tone.start();"),
]

all_passed = True
for name, pattern in checks:
    if pattern in content:
        print(f"[✓] {name}")
    else:
        print(f"[✗] {name} - NOT FOUND")
        all_passed = False

if not all_passed:
    print(f"[ERROR] Verification failed")
    print(f"[WARN] Restoring backup...")
    with open(BACKUP_FILE, 'r') as src:
        content = src.read()
    with open(AUDIO_FILE, 'w') as dst:
        dst.write(content)
    sys.exit(1)

# ============================================================================
# SHOW RESULT
# ============================================================================

print(f"\n[✓] FIX COMPLETED SUCCESSFULLY\n")
print(f"Backup: {BACKUP_FILE}")
print(f"File:   {AUDIO_FILE}")
print(f"\nNew code:")
print(f"---")
with open(AUDIO_FILE, 'r') as f:
    new_lines_read = f.readlines()
for i in range(anchor_line, min(anchor_line + 8, len(new_lines_read))):
    print(f"  {new_lines_read[i]}", end='')
print(f"---")
print(f"\nNext steps:")
print(f"1. Run: pnpm tsc --noEmit")
print(f"2. Refresh browser")
print(f"3. Trigger gesture (click, touch, keydown)")
print(f"4. Check console for '[R3 Audio] AudioContext resumed'")
print(f"\nIf issues persist, restore backup:")
print(f"  cp {BACKUP_FILE} {AUDIO_FILE}")
