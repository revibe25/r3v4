#!/usr/bin/env bash
# MANUAL FIX for C-03 duplication error
#
# The patch script appended the new aiTransitionUsage table without removing
# the old one. shared/schema-subscription.ts now has two definitions.
#
# Run this to fix it:

set -euo pipefail

FILE="shared/schema-subscription.ts"

if [[ ! -f "$FILE" ]]; then
  echo "[ERR] $FILE not found. Run from ~/Stable root."
  exit 1
fi

echo "[C-03 FIX] Removing duplicate aiTransitionUsage definition"
echo "  File: $FILE"

# Backup
cp "$FILE" "${FILE}.bak_c03_dup"
echo "  [BAK] ${FILE}.bak_c03_dup"

# Count occurrences
OLD_COUNT=$(grep -c "export const aiTransitionUsage" "$FILE" || echo 0)
if [[ $OLD_COUNT -ne 2 ]]; then
  echo "[WARN] Expected 2 definitions of aiTransitionUsage, found $OLD_COUNT"
  echo "       Manual review may be needed. Backup available at ${FILE}.bak_c03_dup"
  exit 0
fi

# Strategy: keep only the new definition (the second one with "usage_date")
# and remove the first (old one with "sessionId")

python3 << 'PYTHON'
import re

with open('shared/schema-subscription.ts', 'r') as f:
    src = f.read()

# Pattern 1: old definition (has sessionId in the key)
# It should be from "export const aiTransitionUsage = pgTable"
# through the closing "});" for that specific definition
# Assume the old one is first in the file

# Find all aiTransitionUsage blocks
blocks = []
for m in re.finditer(r'export const aiTransitionUsage\s*=\s*pgTable\([^}]+?\}\)\s*;', src, re.DOTALL):
    blocks.append((m.start(), m.end(), src[m.start():m.end()]))

if len(blocks) == 2:
    # Keep the one with 'usage_date', remove the one with 'sessionId'
    old_idx = 0 if 'sessionId' in blocks[0][2] else 1
    new_idx = 1 if old_idx == 0 else 0
    
    # Remove the old definition
    patched = src[:blocks[old_idx][0]] + src[blocks[old_idx][1]:]
    
    # Also remove duplicate type exports
    patched = patched.replace(
        'export type AiTransitionUsage    = typeof aiTransitionUsage.$inferSelect;\n'
        'export type NewAiTransitionUsage = typeof aiTransitionUsage.$inferInsert;\n',
        '',
        1  # remove only the first occurrence
    )
    
    with open('shared/schema-subscription.ts', 'w') as f:
        f.write(patched)
    
    print("[OK] Old aiTransitionUsage definition removed")
    print("[OK] Duplicate type exports removed")
    
    # Verify only one definition remains
    with open('shared/schema-subscription.ts', 'r') as f:
        final = f.read()
    final_count = final.count('export const aiTransitionUsage')
    if final_count == 1:
        print(f"[OK] Verification: 1 definition remaining")
    else:
        print(f"[WARN] Verification: {final_count} definitions found (expected 1)")
else:
    print(f"[WARN] Found {len(blocks)} definitions (expected 2) — no automatic fix applied")
    exit(1)
PYTHON

echo ""
echo "[OK] C-03 duplication fixed. Verify with:"
echo "     grep -n 'export const aiTransitionUsage' shared/schema-subscription.ts"
echo ""
echo "Next: pnpm tsc --noEmit   (check for remaining schema errors)"
