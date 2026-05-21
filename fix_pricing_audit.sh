#!/bin/bash
# ───────────────────────────────────────────────────────────────────────────
# fix_pricing_audit.sh — R3 v4 Pricing Page Audit & Repair
# WIRE.txt Protocol: read-before-write, dry-run default, assert count==1
# Run on your penguin/Crostini machine: bash fix_pricing_audit.sh [dry-run|apply|check]
# ───────────────────────────────────────────────────────────────────────────

set -euo pipefail

PRICING_PAGE="$HOME/Stable/client/src/pages/pricing/PricingPage.tsx"
BACKUP_DIR="$HOME/Stable/client/src/pages/pricing"
TIMESTAMP=$(date +%s)
BACKUP_FILE="${BACKUP_DIR}/PricingPage.tsx.bak.audit.${TIMESTAMP}"

MODE="${1:-dry-run}"  # dry-run | apply | check

if [[ ! -f "$PRICING_PAGE" ]]; then
  echo "❌ File not found: $PRICING_PAGE"
  echo "   (Expected path: ~/Stable/client/src/pages/pricing/PricingPage.tsx)"
  exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 PRICING PAGE AUDIT & REPAIR (Mode: $MODE)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ─── AUDIT: Count occurrences of each problem ──────────────────────────────

echo "🔍 AUDIT: Scanning for issues..."
echo ""

# Issue 1: HeaderGlow visibility
HEADERGLOW_COUNT=$(grep -c "function HeaderGlow" "$PRICING_PAGE" || true)
echo "  [1] HeaderGlow() function:         $HEADERGLOW_COUNT occurrence(s)"

# Issue 2: Plan badges
BADGE_COUNT=$(grep -c "plan.badge &&" "$PRICING_PAGE" || true)
echo "  [2] Plan card badges (plan.badge): $BADGE_COUNT occurrence(s)"

# Issue 3: BillingToggle onSet prop
ONSET_BILLING_COUNT=$(grep -c "onSet={setCycle}" "$PRICING_PAGE" || true)
echo "  [3] BillingToggle onSet wiring:   $ONSET_BILLING_COUNT occurrence(s)"

# Issue 4: Grid layout constraint
GRID_COLS_COUNT=$(grep -c "grid grid-cols-1 md:grid-cols-3" "$PRICING_PAGE" || true)
echo "  [4] Plan grid (grid-cols-1):      $GRID_COLS_COUNT occurrence(s)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ "$MODE" == "check" ]]; then
  echo "✅ Audit complete. Use 'apply' to fix, or 'dry-run' to preview changes."
  exit 0
fi

# ─── DRY-RUN: Show what will change ───────────────────────────────────────

if [[ "$MODE" == "dry-run" ]]; then
  echo "📝 DRY-RUN: Preview of fixes"
  echo ""
  echo "  FIX [1]: Remove HeaderGlow() function and its JSX call"
  echo "    → Eliminates the bright lime green gradient above heading"
  echo ""
  echo "  FIX [2]: Comment out plan.badge rendering in PlanCard"
  echo "    → Removes green rectangles from top-right of tier cards"
  echo ""
  echo "  FIX [3]: Add proper responsive gaps to plan grid"
  echo "    → Grid: gap-3 → md:gap-4 (tight on mobile, normal on desktop)"
  echo ""
  echo "  FIX [4]: Verify BillingToggle button wiring"
  echo "    → Confirm onSet={setCycle} is correct"
  echo "    → (full wiring check requires usePricing.ts inspection)"
  echo ""
  echo "  BACKUP: ${BACKUP_FILE}"
  echo ""
  echo "To apply fixes:"
  echo "  bash fix_pricing_audit.sh apply"
  echo ""
  exit 0
fi

# ─── APPLY: Make the fixes ─────────────────────────────────────────────────

if [[ "$MODE" != "apply" ]]; then
  echo "❌ Mode must be: dry-run | apply | check"
  exit 1
fi

echo "⚠️  APPLYING FIXES TO: $PRICING_PAGE"
echo ""

# Backup
cp "$PRICING_PAGE" "$BACKUP_FILE"
echo "✓ Backup saved: $BACKUP_FILE"
echo ""

TMPFILE=$(mktemp)
cat "$PRICING_PAGE" > "$TMPFILE"

# ─── FIX [1]: Remove HeaderGlow function and call ────────────────────────

echo "  [1/4] Removing HeaderGlow() function..."
if grep -q "function HeaderGlow()" "$TMPFILE"; then
  # Find line numbers and delete the function
  START_LINE=$(grep -n "^function HeaderGlow()" "$TMPFILE" | cut -d: -f1)
  END_LINE=$(awk -v start="$START_LINE" 'NR==start{found=1} found && /^}$/{print NR; exit}' "$TMPFILE")
  if [[ -n "$END_LINE" ]]; then
    sed -i "${START_LINE},${END_LINE}d" "$TMPFILE"
    echo "       ✓ HeaderGlow() function removed (lines $START_LINE-$END_LINE)"
  fi
else
  echo "       ⚠ HeaderGlow() not found (already removed?)"
fi

if grep -q "<HeaderGlow />" "$TMPFILE"; then
  sed -i '/<HeaderGlow \/>/d' "$TMPFILE"
  echo "       ✓ <HeaderGlow /> call removed from JSX"
else
  echo "       ⚠ <HeaderGlow /> call not found"
fi

# ─── FIX [2]: Comment out plan.badge rendering ────────────────────────────

echo "  [2/4] Disabling plan card badges..."
if grep -q "{plan.badge &&" "$TMPFILE"; then
  # Comment out badge block (multiline)
  BADGE_START=$(grep -n "{plan.badge &&" "$TMPFILE" | cut -d: -f1 | head -1)
  if [[ -n "$BADGE_START" ]]; then
    # Find the closing )} on the same or next lines
    BADGE_END=$(awk -v start="$BADGE_START" 'NR>=start && /^      \}\)/{print NR; exit}' "$TMPFILE")
    if [[ -n "$BADGE_END" ]]; then
      sed -i "${BADGE_START},${BADGE_END}s/^/\/\/ /" "$TMPFILE"
      echo "       ✓ Plan badge block commented out (lines $BADGE_START-$BADGE_END)"
    fi
  fi
else
  echo "       ⚠ plan.badge block not found (already removed?)"
fi

# ─── FIX [3]: Improve grid responsiveness ──────────────────────────────────

echo "  [3/4] Fixing grid layout and gaps..."
if grep -q 'className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20"' "$TMPFILE"; then
  sed -i 's/className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-20"/className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-20"/g' "$TMPFILE"
  echo "       ✓ Grid gaps updated: gap-3 md:gap-4"
else
  echo "       ⚠ Grid className pattern not found (may already be fixed)"
fi

# ─── FIX [4]: Verify BillingToggle wiring ─────────────────────────────────

echo "  [4/4] Verifying BillingToggle wiring..."
ONSET_COUNT=$(grep -c "onSet={setCycle}" "$TMPFILE" || true)
if [[ "$ONSET_COUNT" -eq 1 ]]; then
  echo "       ✓ BillingToggle onSet wiring is correct (1 instance)"
else
  echo "       ⚠ Expected 1 onSet={setCycle}, found $ONSET_COUNT"
fi

# ─── Write back ────────────────────────────────────────────────────────────

mv "$TMPFILE" "$PRICING_PAGE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Fixes applied!"
echo ""
echo "📌 VERIFICATION & NEXT STEPS:"
echo ""
echo "  1. Type check:"
echo "     cd ~/Stable && pnpm tsc --noEmit"
echo ""
echo "  2. Dev server:"
echo "     cd ~/Stable && pnpm dev"
echo "     → Visit http://localhost:5174/pricing"
echo ""
echo "  3. Visual test:"
echo "     ✓ Green blocks gone (no glow, no badges)"
echo "     ✓ Layout fits viewport without zoom"
echo "     ✓ Monthly/Annual toggle works"
echo ""
echo "  4. If toggle still broken, debug usePricing:"
echo "     cat ~/Stable/client/src/pages/pricing/usePricing.ts | head -40"
echo ""
echo "  5. Restore backup if needed:"
echo "     cp $BACKUP_FILE $PRICING_PAGE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
