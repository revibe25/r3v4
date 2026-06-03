#!/bin/bash
# fix_c03_proper.sh — Correctly remove duplicate aiTransitionUsage definitions
# 
# Issue: Two definitions of aiTransitionUsage exist in shared/schema-subscription.ts:
#   - Line 69: OLD definition (with sessionId, now marked as vulnerable)
#   - Line 109: NEW definition (with usageDate, rate-limited per-day)
#
# Fix: Remove lines 69-93 (old definition and its type) and keep 109+ (new, secure version)

set -euo pipefail

SCHEMA_FILE="shared/schema-subscription.ts"
BACKUP_FILE="${SCHEMA_FILE}.bak_c03_proper_$(date +%s)"

echo "[C-03 FIX] Removing duplicate aiTransitionUsage definitions"
echo ""
echo "  File: ${SCHEMA_FILE}"

# Verify file exists
if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo "  [ERROR] File not found: $SCHEMA_FILE"
  exit 1
fi

# Count current duplicates
DUPLICATE_COUNT=$(grep -c "export const aiTransitionUsage = pgTable" "$SCHEMA_FILE" || true)
echo "  [INFO] Found $DUPLICATE_COUNT duplicate 'export const aiTransitionUsage' definitions"

if [[ $DUPLICATE_COUNT -lt 2 ]]; then
  echo "  [WARN] Expected 2 definitions but found $DUPLICATE_COUNT — skipping"
  exit 1
fi

# Create backup
cp "$SCHEMA_FILE" "$BACKUP_FILE"
echo "  [BAK]  $BACKUP_FILE"

# Remove the OLD definition (lines 69-93, before the C-03 comment marker)
# Keep everything up to line 68, then skip to after the first definition block ends, then keep the rest
# Specifically: keep lines 1-68, skip 69-93, keep 94-end

# Use sed to delete lines 69-93 (the OLD definition)
sed -i '69,93d' "$SCHEMA_FILE"
echo "  [DEL]  Removed lines 69-93 (old aiTransitionUsage definition)"

# Also remove the first type definition (which was on line 94, now ~70 after deletion)
# Find and remove the old "export type AiTransitionUsage" that precedes the C-03 comment
# The structure is: old type def → blank lines/comments → new type defs
# Safer approach: remove only the FIRST occurrence of "export type AiTransitionUsage"

LINE_FIRST_TYPE=$(grep -n "export type AiTransitionUsage = typeof aiTransitionUsage" "$SCHEMA_FILE" | head -1 | cut -d: -f1)
if [[ -n "$LINE_FIRST_TYPE" ]]; then
  # Check if it's the old one (before the C-03 comment)
  C03_COMMENT_LINE=$(grep -n "aiTransitionUsage — C-03 fix" "$SCHEMA_FILE" | head -1 | cut -d: -f1)
  
  if [[ -n "$C03_COMMENT_LINE" ]] && [[ $LINE_FIRST_TYPE -lt $C03_COMMENT_LINE ]]; then
    # This is the old type definition, remove it
    sed -i "${LINE_FIRST_TYPE}d" "$SCHEMA_FILE"
    echo "  [DEL]  Removed old type definition at line $LINE_FIRST_TYPE"
  fi
fi

# Verify result
NEW_DUPLICATE_COUNT=$(grep -c "export const aiTransitionUsage = pgTable" "$SCHEMA_FILE" || true)
TYPE_COUNT=$(grep -c "export type AiTransitionUsage = typeof aiTransitionUsage" "$SCHEMA_FILE" || true)

echo ""
echo "  [VERIFY] After fix:"
echo "           - Constant definitions: $NEW_DUPLICATE_COUNT (expected 1)"
echo "           - Type definitions: $TYPE_COUNT (expected 1)"

if [[ $NEW_DUPLICATE_COUNT -eq 1 && $TYPE_COUNT -eq 1 ]]; then
  echo ""
  echo "  [OK] C-03 duplication fixed!"
  echo ""
  echo "  [WRITTEN] $SCHEMA_FILE (backup: $BACKUP_FILE)"
  echo ""
  echo "  Next steps:"
  echo "  1. Review the changes: git diff $SCHEMA_FILE"
  echo "  2. Rebuild: pnpm tsc --noEmit"
  echo "  3. If using Drizzle migrations:"
  echo "     - pnpm drizzle-kit generate"
  echo "     - pnpm drizzle-kit migrate"
  exit 0
else
  echo ""
  echo "  [ERROR] Fix incomplete — expected 1 constant and 1 type, but got $NEW_DUPLICATE_COUNT and $TYPE_COUNT"
  echo "  [RESTORE] Restoring from backup:"
  cp "$BACKUP_FILE" "$SCHEMA_FILE"
  exit 1
fi
