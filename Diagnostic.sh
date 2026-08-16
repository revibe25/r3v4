#!/bin/bash
set -e

# COLORS
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}           R3 BUILD DIAGNOSTIC — ROOT CAUSE ANALYSIS             ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

cd ~/Stable || exit 1

# ============================================================================
# TEST 1: VITEST POOLOPTIONS — Are they actually in the files?
# ============================================================================
echo -e "${YELLOW}[TEST 1] Vitest poolOptions Status${NC}"
echo "────────────────────────────────────────"

VITEST_CONFIGS=(
  "packages/llpte-adapters/vitest.config.ts"
  "packages/llpte-ai/vitest.config.ts"
  "packages/llpte-core/vitest.config.ts"
  "packages/llpte-execution/vitest.config.ts"
  "packages/llpte-signal/vitest.config.ts"
  "packages/llpte-transition-graph/vitest.config.ts"
)

STILL_BROKEN=0
for config in "${VITEST_CONFIGS[@]}"; do
  if [ -f "$config" ]; then
    if grep -q "poolOptions" "$config"; then
      echo -e "${RED}✗ $config${NC} — poolOptions STILL PRESENT"
      STILL_BROKEN=$((STILL_BROKEN + 1))
      grep -n "poolOptions" "$config" | head -2 | sed 's/^/  Line: /'
    else
      echo -e "${GREEN}✓ $config${NC} — cleaned"
    fi
  fi
done

if [ $STILL_BROKEN -gt 0 ]; then
  echo -e "\n${RED}FINDING: $STILL_BROKEN vitest configs still have poolOptions${NC}"
  echo -e "${RED}ACTION: The fix-build.sh script did not complete removal.${NC}\n"
else
  echo -e "\n${GREEN}CLEAN: All vitest configs are poolOptions-free${NC}\n"
fi

# ============================================================================
# TEST 2: DAW ROUTER TYPE EXPORTS — Are LLPTESignal and MixSuggestion exported?
# ============================================================================
echo -e "${YELLOW}[TEST 2] DAW Router Type Exports (LLPTESignal, MixSuggestion)${NC}"
echo "────────────────────────────────────────"

if [ -f "server/routers/daw.ts" ]; then
  echo "Checking server/routers/daw.ts..."
  
  if grep -q "export.*LLPTESignal" server/routers/daw.ts; then
    echo -e "${GREEN}✓ LLPTESignal is exported${NC}"
  else
    echo -e "${RED}✗ LLPTESignal is NOT exported${NC}"
    echo "  Searching for definition..."
    grep -n "LLPTESignal" server/routers/daw.ts | head -3 || echo "  Not found anywhere"
  fi
  
  if grep -q "export.*MixSuggestion" server/routers/daw.ts; then
    echo -e "${GREEN}✓ MixSuggestion is exported${NC}"
  else
    echo -e "${RED}✗ MixSuggestion is NOT exported${NC}"
    echo "  Searching for definition..."
    grep -n "MixSuggestion" server/routers/daw.ts | head -3 || echo "  Not found anywhere"
  fi
else
  echo -e "${RED}✗ server/routers/daw.ts does not exist${NC}"
fi
echo ""

# ============================================================================
# TEST 3: PROCEDURES.TS TYPE IMPORTS — Is it importing from daw.ts?
# ============================================================================
echo -e "${YELLOW}[TEST 3] server/procedures.ts Type Imports${NC}"
echo "────────────────────────────────────────"

if [ -f "server/procedures.ts" ]; then
  if grep -q "import.*type.*{.*LLPTESignal.*MixSuggestion" server/procedures.ts; then
    echo -e "${GREEN}✓ Explicit type import found${NC}"
    grep "import.*type.*{.*LLPTESignal" server/procedures.ts | head -1
  elif grep -q "from.*daw" server/procedures.ts; then
    echo -e "${YELLOW}⚠ Import from daw exists but pattern doesn't match LLPTESignal/MixSuggestion${NC}"
    grep "from.*daw" server/procedures.ts
  else
    echo -e "${RED}✗ No explicit type import from daw router${NC}"
  fi
else
  echo -e "${RED}✗ server/procedures.ts does not exist${NC}"
fi
echo ""

# ============================================================================
# TEST 4: TSCONFIG STRUCTURE — Are client and server properly isolated?
# ============================================================================
echo -e "${YELLOW}[TEST 4] TypeScript Configuration Boundaries${NC}"
echo "────────────────────────────────────────"

ROOT_TSCONFIG="tsconfig.json"
if [ -f "$ROOT_TSCONFIG" ]; then
  echo "Root tsconfig.json 'include' pattern:"
  if grep -q '"include"' "$ROOT_TSCONFIG"; then
    grep -A 5 '"include"' "$ROOT_TSCONFIG" | head -6 | sed 's/^/  /'
    
    # Check if it includes everything (problematic)
    if grep -q '"include".*\[".*\*\*.*"' "$ROOT_TSCONFIG"; then
      echo -e "\n${RED}⚠ PROBLEM: Root tsconfig includes '**/*' pattern${NC}"
      echo -e "  This pulls BOTH server AND client into single compilation context"
      echo -e "  causing circular dependency issues\n"
    fi
  fi
else
  echo -e "${RED}✗ Root tsconfig.json not found${NC}"
fi

# Check if client/tsconfig.json exists and excludes server
if [ -f "client/tsconfig.json" ]; then
  echo -e "\n${GREEN}✓ client/tsconfig.json exists${NC}"
  if grep -q '"exclude"' client/tsconfig.json; then
    echo "  Excludes:"
    grep -A 3 '"exclude"' client/tsconfig.json | sed 's/^/    /'
  fi
else
  echo -e "\n${YELLOW}⚠ client/tsconfig.json may not exist or may not have proper excludes${NC}"
fi

if [ -f "server/tsconfig.json" ]; then
  echo -e "\n${GREEN}✓ server/tsconfig.json exists${NC}"
  if grep -q '"exclude"' server/tsconfig.json; then
    echo "  Excludes:"
    grep -A 3 '"exclude"' server/tsconfig.json | sed 's/^/    /'
  fi
else
  echo -e "\n${YELLOW}⚠ server/tsconfig.json may not exist or may not have proper excludes${NC}"
fi

echo ""

# ============================================================================
# TEST 5: PATH ALIASES — Are @/ aliases leaking into server?
# ============================================================================
echo -e "${YELLOW}[TEST 5] Path Alias Contamination${NC}"
echo "────────────────────────────────────────"

if [ -f "$ROOT_TSCONFIG" ]; then
  if grep -q '"@/"' "$ROOT_TSCONFIG"; then
    echo -e "${RED}✗ FOUND @/ alias in root tsconfig${NC}"
    echo "  This will bleed client aliases into server compilation"
    grep -B 2 -A 5 '"@/"' "$ROOT_TSCONFIG" | sed 's/^/  /'
  else
    echo -e "${GREEN}✓ Root tsconfig has no @/ aliases${NC}"
  fi
fi

if [ -f "client/tsconfig.json" ]; then
  if grep -q '"@/"' client/tsconfig.json; then
    echo -e "${GREEN}✓ @/ alias properly scoped to client/tsconfig.json${NC}"
  fi
fi

echo ""

# ============================================================================
# TEST 6: VITEST WORKSPACE & COVERAGE CONFIG — Old vitest v4 syntax?
# ============================================================================
echo -e "${YELLOW}[TEST 6] Vitest Version Compatibility${NC}"
echo "────────────────────────────────────────"

if [ -f "vitest.workspace.ts" ]; then
  echo "vitest.workspace.ts imports:"
  grep "import.*from.*vitest" vitest.workspace.ts || echo "  No vitest imports found"
  
  if grep -q "defineWorkspace" vitest.workspace.ts && ! grep -q "from.*vitest" vitest.workspace.ts; then
    echo -e "${RED}✗ defineWorkspace used but not imported${NC}"
  fi
fi

if [ -f "vitest.config.ts" ]; then
  echo -e "\nvitest.config.ts coverage config:"
  if grep -q "lines:" vitest.config.ts; then
    echo -e "${RED}✗ Old vitest v4 coverage option 'lines:' found${NC}"
    echo "  Should use 'line:' in vitest v5+ or remove entirely"
    grep -n "lines:" vitest.config.ts | sed 's/^/  /'
  fi
fi

echo ""

# ============================================================================
# TEST 7: CLIENT MODULE DISCOVERY — Can @/ paths be resolved?
# ============================================================================
echo -e "${YELLOW}[TEST 7] Client Module Resolution${NC}"
echo "────────────────────────────────────────"

MISSING_COUNT=0

CLIENT_IMPORTS=(
  "client/src/lib/trpc.ts"
  "client/src/components/page-nav.tsx"
  "client/src/hooks/useDAWStore.ts"
  "client/src/types/daw.types.ts"
)

for import_file in "${CLIENT_IMPORTS[@]}"; do
  if [ -f "$import_file" ]; then
    echo -e "${GREEN}✓${NC} $import_file"
  else
    echo -e "${RED}✗${NC} $import_file"
    MISSING_COUNT=$((MISSING_COUNT + 1))
  fi
done

if [ $MISSING_COUNT -gt 0 ]; then
  echo -e "\n${RED}FINDING: $MISSING_COUNT expected client files are missing${NC}"
  echo -e "${RED}This explains ~200 'Cannot find module' errors${NC}"
fi

echo ""

# ============================================================================
# SUMMARY & PRIORITY FIXES
# ============================================================================
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                        PRIORITY FIX LIST                        ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}\n"

echo -e "${YELLOW}PRIORITY 1 (BLOCKS EVERYTHING):${NC}"
echo -e "  ${RED}[CRITICAL]${NC} vitest poolOptions in 6 config files"
echo -e "  → Manual fix required: each config needs poolOptions removed\n"

echo -e "${YELLOW}PRIORITY 2 (BLOCKS SERVER BUILD):${NC}"
echo -e "  ${RED}[TS4023]${NC} LLPTESignal/MixSuggestion not exported from daw.ts"
echo -e "  → Add: export type { LLPTESignal, MixSuggestion } to server/routers/daw.ts"
echo -e "  → Verify: server/procedures.ts imports them\n"

echo -e "${YELLOW}PRIORITY 3 (BLOCKS CLIENT INTEGRATION):${NC}"
echo -e "  ${RED}[MISSING FILES]${NC} ~15-20 critical client files not found"
echo -e "  → These must exist before tsc -b can validate the full workspace\n"

echo -e "${YELLOW}PRIORITY 4 (CONFIGURATION):${NC}"
echo -e "  ${RED}[TSCONFIG]${NC} Verify root tsconfig doesn't pull client into server build"
echo -e "  ${RED}[VITEST]${NC} Update vitest workspace syntax (v5 compatible)\n"

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
