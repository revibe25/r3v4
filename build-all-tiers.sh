#!/bin/bash
# ============================================================
# STEP C: Build and Verify All Tiers
# ============================================================
set -euo pipefail

echo "🔧 BUILDING AND VERIFYING ALL TIERS"
echo "====================================="

# Tier 1: Agent-OS
echo ""
echo "📦 TIER 1: Agent-OS"
echo "-------------------"
cd ~/Agent-OS
if pnpm run build; then
    echo "   ✅ Agent-OS build SUCCESS"
else
    echo "   ❌ Agent-OS build FAILED"
    exit 1
fi

# Tier 2: Agi-Suite
echo ""
echo "📦 TIER 2: Agi-Suite"
echo "--------------------"
cd ~/Agi-Suite
if pnpm run build; then
    echo "   ✅ Agi-Suite build SUCCESS"
else
    echo "   ❌ Agi-Suite build FAILED"
    exit 1
fi

# Tier 3: Stable
echo ""
echo "📦 TIER 3: Stable"
echo "-----------------"
cd ~/Stable
if pnpm run build; then
    echo "   ✅ Stable build SUCCESS"
else
    echo "   ❌ Stable build FAILED"
    exit 1
fi

echo ""
echo "====================================="
echo "✅ ALL TIERS BUILT SUCCESSFULLY"
echo ""
echo "Next: Start the tier stack"
echo "  bash start-tier-stack.sh"
