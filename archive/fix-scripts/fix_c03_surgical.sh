#!/bin/bash
# fix_c03_surgical.sh — Surgical removal of OLD definition only
#
# Restore from backup, then surgically remove lines 69-94 (old def + type)
# Leave lines 97+ (C-03 comment + new definition)

set -euo pipefail

SCHEMA_FILE="shared/schema-subscription.ts"

echo "[C-03 FIX - SURGICAL] Removing old aiTransitionUsage definition"
echo ""

# Find and restore the most recent backup
BACKUP=$(ls -t ${SCHEMA_FILE}.bak_c03* 2>/dev/null | head -1)

if [[ -z "$BACKUP" ]]; then
  echo "  [ERROR] No backup found. Run the previous fix attempt again to create backup."
  exit 1
fi

echo "  [RESTORE] Using backup: $BACKUP"
cp "$BACKUP" "$SCHEMA_FILE"

# Create new backup with timestamp
NEW_BACKUP="${SCHEMA_FILE}.bak_c03_surgical_$(date +%s)"
cp "$SCHEMA_FILE" "$NEW_BACKUP"
echo "  [BAK]     Saved to: $NEW_BACKUP"

# Verify backup has 2 definitions
DUPLICATE_COUNT=$(grep -c "export const aiTransitionUsage = pgTable" "$SCHEMA_FILE" || true)
echo "  [INFO]    Backup has $DUPLICATE_COUNT definitions"

if [[ $DUPLICATE_COUNT -ne 2 ]]; then
  echo "  [ERROR]   Expected 2 definitions in backup"
  exit 1
fi

echo ""
echo "  [LINES]   Will delete 69-94:"
echo "            - Line 69: export const aiTransitionUsage = pgTable("
echo "            - Line 94: export type AiTransitionUsage = typeof..."
echo ""

# Show what we're deleting
echo "  [PREVIEW] Lines to remove:"
sed -n '69,94p' "$SCHEMA_FILE" | head -15

echo ""
echo "  [DEL]     Removing lines 69-94..."

# Use a more portable sed approach
sed -i.bak '69,94d' "$SCHEMA_FILE"

# Verify
NEW_DUPLICATE_COUNT=$(grep -c "export const aiTransitionUsage = pgTable" "$SCHEMA_FILE" || true)
TYPE_COUNT=$(grep -c "export type AiTransitionUsage.*typeof aiTransitionUsage" "$SCHEMA_FILE" || true)

echo ""
echo "  [VERIFY]  After deletion:"
echo "            - Constant definitions: $NEW_DUPLICATE_COUNT (expected 1)"
echo "            - Type definitions: $TYPE_COUNT (expected ≥1)"

if [[ $NEW_DUPLICATE_COUNT -eq 1 && $TYPE_COUNT -ge 1 ]]; then
  echo ""
  echo "  [SUCCESS] C-03 fix applied!"
  echo ""
  echo "  What was deleted:"
  grep -A 5 "Lines to remove:" "$NEW_BACKUP" 2>/dev/null | head -20 || echo "  (old definition with sessionId)"
  echo ""
  echo "  What remains:"
  grep -n "aiTransitionUsage" "$SCHEMA_FILE" | head -5
  echo ""
  echo "  Next: pnpm tsc --noEmit"
  exit 0
else
  echo ""
  echo "  [ERROR]   Unexpected result. Restoring..."
  cp "$NEW_BACKUP" "$SCHEMA_FILE"
  echo "  [RESTORED] $SCHEMA_FILE"
  exit 1
fi
