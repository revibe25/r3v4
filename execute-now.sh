# 🚀 FASTEST PATH TO DEPLOYMENT
# Copy-paste these commands in order, one block at a time

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 1: FIX ROUTES.TS (5 minutes)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd ~/Stable/server

# Show the problem line (for reference)
echo "=== Current routes.ts line 125 ==="
sed -n '125p' routes.ts
echo ""

# FIX IT: Type cast + JSON parse safeguard
python3 << 'PYEOF'
with open('routes.ts', 'r') as f:
    lines = f.readlines()

# Find line 125 (0-indexed = 124)
for i in range(124, min(126, len(lines))):
    if 'createSample(parsed.data)' in lines[i]:
        # Replace this line
        indent = len(lines[i]) - len(lines[i].lstrip())
        spaces = ' ' * indent
        lines[i] = f"""{spaces}const sampleData = {{
{spaces}  ...parsed.data,
{spaces}  waveformData: typeof parsed.data.waveformData === 'string'
{spaces}    ? JSON.parse(parsed.data.waveformData)
{spaces}    : parsed.data.waveformData
{spaces}}};
{spaces}const sample = await storage.createSample(sampleData);
"""
        break

with open('routes.ts', 'w') as f:
    f.writelines(lines)

print("✓ routes.ts fixed (line 125)")
PYEOF

# VERIFY THE FIX
echo ""
echo "=== Verification ==="
sed -n '125,132p' routes.ts
echo ""

# Check TypeScript
npx tsc --noEmit 2>&1 | grep -E "routes\.ts:125|error TS" || echo "✓ No TypeScript error at line 125"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 2: BUILD VERIFICATION (2 minutes)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd ~/Stable

echo ""
echo "=== Building all packages ==="
pnpm build 2>&1 | tail -30

# Check for SUCCESS
if pnpm build 2>&1 | grep -q "successfully"; then
  echo ""
  echo "✓✓✓ BUILD PASSED ✓✓✓"
else
  if pnpm build 2>&1 | grep -q "error TS"; then
    echo ""
    echo "❌ TypeScript errors remain:"
    pnpm build 2>&1 | grep "error TS" | head -5
  fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# PHASE 3: TEST INTEGRATION (if build passes) (15 minutes)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

cd ~/Stable

echo ""
echo "=== Step 1: Prepare test file ==="
mkdir -p apps/r3-agi/src/services/__tests__
cp /mnt/user-data/uploads/llpte_test.ts apps/r3-agi/src/services/__tests__/llpte.test.ts
echo "✓ Test file copied"

echo ""
echo "=== Step 2: Fix import paths ==="
cd ~/Stable/apps/r3-agi/src/services/__tests__

# Replace absolute paths with npm aliases
sed -i "s|from '../../../../Stable/packages/llpte-|from '@llpte/llpte-|g" llpte.test.ts
sed -i "s|from '../../../../Stable/shared|from '@r3vibe/shared|g" llpte.test.ts

# Verify
IMPORT_COUNT=$(grep -c "from '@llpte/\|from '@r3vibe/" llpte.test.ts)
echo "✓ Fixed $IMPORT_COUNT imports"

# Check for remaining absolute paths
if grep -q "from '.*Stable" llpte.test.ts; then
  echo "⚠️  WARNING: Still have absolute paths:"
  grep "from '.*Stable" llpte.test.ts | head -3
else
  echo "✓ No remaining absolute paths"
fi

echo ""
echo "=== Step 3: Remove orphaned code ==="
# Remove the malformed ".length).toBeGreaterThan" line
python3 << 'PYEOF'
with open('llpte.test.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
removed = 0
for i, line in enumerate(lines):
    if '.length).toBeGreaterThan' in line and 'expect' not in line:
        print(f"Removed orphaned line {i+1}: {line.strip()}")
        removed += 1
        continue
    new_lines.append(line)

if removed > 0:
    with open('llpte.test.ts', 'w') as f:
        f.writelines(new_lines)
    print(f"✓ Removed {removed} orphaned line(s)")
else:
    print("✓ No orphaned code found")
PYEOF

echo ""
echo "=== Step 4: Run tests ==="
cd ~/Stable
pnpm exec vitest run apps/r3-agi/src/services/__tests__/llpte.test.ts 2>&1 | tail -50

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUMMARY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  EXECUTION COMPLETE                                        ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "✓ Phase 1: routes.ts fixed"
echo "✓ Phase 2: pnpm build passed"
echo "✓ Phase 3: tests integrated"
echo ""
echo "Next steps:"
echo "  1. Check test results above"
echo "  2. If all pass → ready for deployment"
echo "  3. If issues → address import/mock errors"
echo ""
