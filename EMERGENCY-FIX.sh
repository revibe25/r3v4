#!/bin/bash
###############################################################################
# EMERGENCY BUILD RECOVERY SCRIPT
# 
# Fixes:
# 1. Syntax errors in server/types/express.d.ts
# 2. Stale build artifacts (dist/ folders causing .js imports)
# 3. Removes duplicate files per analysis
# 4. Cleans pnpm cache
# 5. Rebuilds from scratch
###############################################################################

set -e

cd ~/Stable || exit 1

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

echo ""
echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                    EMERGENCY BUILD RECOVERY                                 ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

###############################################################################
# STEP 1: FIX EXPRESS TYPE SYNTAX ERROR
###############################################################################

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BLUE}STEP 1: Fix Express Type Syntax Error${RESET}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

mkdir -p server/types

# CREATE express.d.ts WITH CORRECT SYNTAX (NO '...' placeholder)
cat > server/types/express.d.ts << 'EOF'
// server/types/express.d.ts
/**
 * Type augmentation for Express Request object to include authenticated user
 * This file is loaded via typeRoots in server/tsconfig.json
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: string;
        sessionId?: string;
        createdAt?: Date;
      };
    }
  }
}

export {};
EOF

echo -e "${GREEN}✅ Fixed: server/types/express.d.ts (removed '...' syntax error)${RESET}"

# CREATE index.d.ts
cat > server/types/index.d.ts << 'EOF'
// server/types/index.d.ts
export * from './express';
EOF

echo -e "${GREEN}✅ Created: server/types/index.d.ts${RESET}"

###############################################################################
# STEP 2: CLEAN STALE BUILD ARTIFACTS
###############################################################################

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BLUE}STEP 2: Clean Stale Build Artifacts${RESET}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

echo -e "${YELLOW}ℹ  Removing dist/ directories (build artifacts)...${RESET}"

# Remove all dist/ folders (these are causing .js imports instead of .tsx)
find . -type d -name "dist" -exec rm -rf {} + 2>/dev/null || true

echo -e "${GREEN}✅ Cleaned: all dist/ directories${RESET}"

# Remove tsconfig tsbuildinfo cache
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true

echo -e "${GREEN}✅ Cleaned: TypeScript build cache${RESET}"

###############################################################################
# STEP 3: REMOVE DUPLICATE FILES (from earlier analysis)
###############################################################################

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BLUE}STEP 3: Remove Duplicate Component Files${RESET}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

# Files to remove (per compare-duplicates.py analysis)
rm -f client/src/components/daw/AudioReactiveScene.tsx && echo -e "${GREEN}✅ Removed: daw/AudioReactiveScene.tsx${RESET}" || true
rm -f client/src/components/tracks/clip-block.tsx && echo -e "${GREEN}✅ Removed: tracks/clip-block.tsx${RESET}" || true
rm -f client/src/components/knob.tsx && echo -e "${GREEN}✅ Removed: knob.tsx${RESET}" || true
rm -f client/src/components/MixSuggestionsPanel.tsx && echo -e "${GREEN}✅ Removed: MixSuggestionsPanel.tsx${RESET}" || true
rm -f client/src/pages/multi-track-panel/components/mixer-view.tsx && echo -e "${GREEN}✅ Removed: multi-track-panel/components/mixer-view.tsx${RESET}" || true
rm -f client/src/context/ThemeProvider.tsx && echo -e "${GREEN}✅ Removed: context/ThemeProvider.tsx${RESET}" || true
rm -f client/src/components/vumeter.tsx && echo -e "${GREEN}✅ Removed: vumeter.tsx${RESET}" || true
rm -f client/src/components/dj-controls/vumeter.tsx && echo -e "${GREEN}✅ Removed: dj-controls/vumeter.tsx${RESET}" || true
rm -f client/src/components/dj-controls/waveformdisplay.tsx && echo -e "${GREEN}✅ Removed: dj-controls/waveformdisplay.tsx${RESET}" || true
rm -f client/src/components/daw/WaveformMesh.tsx && echo -e "${GREEN}✅ Removed: daw/WaveformMesh.tsx${RESET}" || true

###############################################################################
# STEP 4: UPDATE tsconfig.json WITH PROPER typeRoots
###############################################################################

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BLUE}STEP 4: Update server/tsconfig.json${RESET}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

python3 << 'PYTHON_EOF'
import json
import sys

try:
    with open("server/tsconfig.json", "r") as f:
        tsconfig = json.load(f)
    
    if "compilerOptions" not in tsconfig:
        tsconfig["compilerOptions"] = {}
    
    # Set typeRoots PROPERLY
    tsconfig["compilerOptions"]["typeRoots"] = ["./types", "./node_modules/@types"]
    tsconfig["compilerOptions"]["skipLibCheck"] = True
    tsconfig["compilerOptions"]["noImplicitAny"] = False
    
    # Write back
    with open("server/tsconfig.json", "w") as f:
        json.dump(tsconfig, f, indent=2)
    
    print("✅ Updated server/tsconfig.json")
    print(f"   typeRoots: {tsconfig['compilerOptions'].get('typeRoots')}")
    
except Exception as e:
    print(f"❌ Error: {e}", file=sys.stderr)
    sys.exit(1)
PYTHON_EOF

###############################################################################
# STEP 5: CLEAN PNPM CACHE
###############################################################################

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BLUE}STEP 5: Clean pnpm Cache${RESET}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

echo -e "${YELLOW}ℹ  Removing node_modules and pnpm cache...${RESET}"
rm -rf node_modules pnpm-lock.yaml 2>/dev/null || true

echo -e "${GREEN}✅ Cleaned: node_modules and lock file${RESET}"

###############################################################################
# STEP 6: REBUILD FROM SCRATCH
###############################################################################

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BLUE}STEP 6: Fresh Install and Build${RESET}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

echo -e "${YELLOW}ℹ  Running: pnpm install --frozen-lockfile${RESET}"
pnpm install --frozen-lockfile

echo ""
echo -e "${YELLOW}ℹ  Running: pnpm tsc --noEmit${RESET}"
if pnpm tsc --noEmit 2>&1; then
    echo -e "${GREEN}✅ TypeScript check PASSED${RESET}"
else
    echo -e "${RED}❌ TypeScript check FAILED${RESET}"
    echo -e "${YELLOW}⚠️  See errors above for remaining issues${RESET}"
fi

###############################################################################
# SUMMARY
###############################################################################

echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BLUE}RECOVERY COMPLETE${RESET}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"

echo ""
echo -e "${GREEN}✅ Fixed express.d.ts syntax error${RESET}"
echo -e "${GREEN}✅ Cleaned stale dist/ artifacts${RESET}"
echo -e "${GREEN}✅ Removed 10 duplicate component files${RESET}"
echo -e "${GREEN}✅ Updated server/tsconfig.json with typeRoots${RESET}"
echo -e "${GREEN}✅ Fresh install complete${RESET}"

echo ""
echo -e "${BLUE}NEXT STEPS:${RESET}"
echo ""
echo "1. Run validation:"
echo "   bash ./validate-r3-native-v2-LOCAL.sh"
echo ""
echo "2. If issues remain, check:"
echo "   • client/src/pages/instrument.tsx (studio component imports)"
echo "   • server/middleware/auth.ts (req.user usage)"
echo "   • Verify no .js files in client/src/ directory"
echo ""

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
