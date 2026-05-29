#!/bin/bash
# c03_diagnostic.sh — Investigate duplicate table definitions

echo "━━━ C-03 Duplicate Definitions Diagnostic ━━━"
echo ""

# Search for common duplicate patterns
echo "1️⃣  Searching for 'aiTransitionUsage' definitions:"
echo "   Location: shared/schema-subscription.ts"
if [[ -f "shared/schema-subscription.ts" ]]; then
  grep -n "aiTransitionUsage\|const aiTransitionUsage\|export const aiTransitionUsage" shared/schema-subscription.ts || echo "   (not found)"
else
  echo "   ❌ File not found: shared/schema-subscription.ts"
fi

echo ""
echo "2️⃣  Searching for all table definitions (pattern: 'export const [A-Za-z]* = table'):"
if [[ -f "shared/schema-subscription.ts" ]]; then
  grep -En "^\s*(export\s+)?const\s+\w+\s*=\s*\w+\.table\(" shared/schema-subscription.ts | head -20
else
  echo "   ❌ File not found"
fi

echo ""
echo "3️⃣  Checking file metadata:"
if [[ -f "shared/schema-subscription.ts" ]]; then
  echo "   Lines: $(wc -l < shared/schema-subscription.ts)"
  echo "   Size: $(du -h shared/schema-subscription.ts | cut -f1)"
  echo "   Last modified: $(stat -c %y shared/schema-subscription.ts 2>/dev/null || stat -f %Sm shared/schema-subscription.ts 2>/dev/null)"
else
  echo "   File not found"
fi

echo ""
echo "4️⃣  Looking for any .bak files (may indicate previous fixes):"
find . -name "*.bak_c03*" 2>/dev/null | head -10 || echo "   (none found)"

echo ""
echo "━━━ End Diagnostic ━━━"
