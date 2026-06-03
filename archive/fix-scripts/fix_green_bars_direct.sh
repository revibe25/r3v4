#!/bin/bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# DIRECT GREEN BAR REMOVAL - R3 v4 Pricing Page
# Removes ALL green gradient bars causing visual clutter
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

FILE="$HOME/Stable/client/src/pages/pricing/PricingPage.tsx"
BACKUP="${FILE}.bak.direct.$(date +%s)"

if [[ ! -f "$FILE" ]]; then
  echo "❌ File not found: $FILE"
  exit 1
fi

echo "🔧 DIRECT GREEN BAR REMOVAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Backup
cp "$FILE" "$BACKUP"
echo "✓ Backup: $BACKUP"
echo ""

# Fix 1: Remove the top gradient bar from PlanCard component
echo "🎯 FIX [1/3]: Remove card top gradient bar..."
if grep -q 'className="h-\[2px\] w-full shrink-0"' "$FILE"; then
  # Find and comment out the gradient bar div in PlanCard
  sed -i '/className="h-\[2px\] w-full shrink-0"/,+1s/^/\/\/ /' "$FILE"
  echo "    ✓ Card gradient bars disabled"
else
  echo "    ⚠ Pattern not found (may be already disabled)"
fi

# Fix 2: Remove ANY background gradient with accent colors
echo "🎯 FIX [2/3]: Remove green gradient backgrounds..."
# Comment out lines with "background: \`linear-gradient" that use accent
sed -i '/background:.*linear-gradient.*\${.*accent/s/^/\/\/ /' "$FILE"
echo "    ✓ Gradient backgrounds commented"

# Fix 3: Remove the badge block completely
echo "🎯 FIX [3/3]: Remove plan badges..."
if grep -q 'plan.badge &&' "$FILE"; then
  # Find the badge block and comment it out
  awk '
    /\{plan\.badge &&/ { 
      in_badge=1; 
      do_indent=gensub(/^([[:space:]]*).*/, "\\1", 1)
      print do_indent "/* plan.badge && ("
      next
    }
    in_badge && /^\s*\}\)/ { 
      print do_indent "*/"
      in_badge=0
      next
    }
    in_badge { 
      print "//" $0
    }
    !in_badge { 
      print $0
    }
  ' "$FILE" > "${FILE}.tmp"
  
  mv "${FILE}.tmp" "$FILE"
  echo "    ✓ Plan badge block commented out"
else
  echo "    ⚠ Badge block not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ GREEN BARS REMOVED!"
echo ""
echo "📌 NEXT STEPS:"
echo "  1. Type check: cd ~/Stable && pnpm tsc --noEmit"
echo "  2. Dev server: cd ~/Stable && pnpm dev"
echo "  3. Test: http://localhost:5174/pricing"
echo ""
echo "❌ IF SOMETHING BREAKS, RESTORE:"
echo "  cp $BACKUP $FILE"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
