#!/bin/bash
set -e

echo "🔍 Agi-Suite Test Failure Diagnostic"
echo "===================================="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd ~/Stable

# 1. Check pnpm workspace health
echo -e "${BLUE}[1] Checking workspace & dependency status...${NC}"
echo ""
pnpm ls --depth=0 2>&1 | head -20
echo ""

# 2. Check if dist/build artifacts exist
echo -e "${BLUE}[2] Checking for build artifacts...${NC}"
echo ""
if [ -d "dist" ]; then
  echo "  ✓ dist/ exists"
  find dist -type f -name "*.html" | head -3
else
  echo "  ✗ dist/ NOT FOUND"
fi
echo ""

# 3. Check for data-test attributes in source
echo -e "${BLUE}[3] Scanning source for data-test attributes...${NC}"
echo ""
data_test_count=$(find . -type f \( -name "*.tsx" -o -name "*.jsx" -o -name "*.ts" -o -name "*.js" \) ! -path "./node_modules/*" ! -path "./.pnpm/*" ! -path "./dist/*" ! -path "./test-results/*" -exec grep -l "data-test" {} \; | wc -l)
echo "  Found data-test in $data_test_count source files"
if [ "$data_test_count" -eq 0 ]; then
  echo "  ${RED}⚠️  WARNING: No data-test attributes found in source!${NC}"
fi
echo ""

# 4. Peek at one test file to see what it's looking for
echo -e "${BLUE}[4] Sample of what tests expect:${NC}"
echo ""
grep -h "data-test=" tests/e2e/*.spec.ts 2>/dev/null | head -5 | sed 's/^/  /'
echo ""

# 5. Try to start the dev server with a timeout
echo -e "${BLUE}[5] Attempting to start dev server (10 sec timeout)...${NC}"
echo ""
timeout 10 pnpm start 2>&1 | tee /tmp/pnpm-start.log &
SERVER_PID=$!
sleep 3

# Check if it's still running
if ps -p $SERVER_PID > /dev/null 2>&1; then
  echo "  ✓ Dev server started (PID: $SERVER_PID)"
  
  # Try to hit the health endpoint
  sleep 2
  echo ""
  echo -e "${BLUE}[6] Testing health endpoint...${NC}"
  echo ""
  if curl -s http://127.0.0.1:3000/health; then
    echo ""
    echo "  ✓ Health endpoint responded"
  else
    echo "  ✗ Health endpoint failed"
  fi
  
  # Try to get the homepage
  echo ""
  echo -e "${BLUE}[7] Testing homepage...${NC}"
  echo ""
  HTML=$(curl -s http://127.0.0.1:3000/ | head -100)
  if echo "$HTML" | grep -q "data-test"; then
    echo "  ✓ Homepage contains data-test attributes"
    echo "$HTML" | grep "data-test=" | head -3 | sed 's/^/    /'
  else
    echo "  ✗ Homepage does NOT contain data-test attributes"
    echo "  First 100 chars of response:"
    echo "$HTML" | head -c 200 | sed 's/^/    /'
  fi
  
  # Kill server
  kill $SERVER_PID 2>/dev/null || true
else
  echo "  ✗ Dev server failed to start"
  echo ""
  echo "  Last log output:"
  tail -20 /tmp/pnpm-start.log | sed 's/^/    /'
fi

echo ""
echo -e "${BLUE}===================================="
echo "Diagnostic complete. Review findings above.${NC}"
