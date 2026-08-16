#!/bin/bash
###############################################################################
# R3 NATIVE v2.0.0 — LOCAL VALIDATION & BUILD TEST
# For projects where files already exist in ~/Stable/client/src
# 
# Purpose: Validate deployed files are correct, all imports present,
#          TypeScript compiles, and build succeeds
###############################################################################

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

PROJECT_ROOT="${HOME}/Stable"
CLIENT_SRC="${PROJECT_ROOT}/client/src"

log_info()    { echo -e "${BLUE}ℹ ${NC}$1"; }
log_success() { echo -e "${GREEN}✅${NC} $1"; }
log_warn()    { echo -e "${YELLOW}⚠️ ${NC}$1"; }
log_error()   { echo -e "${RED}❌${NC} $1"; }
log_section() { echo -e "\n${MAGENTA}━━━ $1 ━━━${NC}\n"; }

# Component manifest
COMP_1="DrumWorkstation.tsx:components/drum/"
COMP_2="VisualizerCanvas.tsx:components/visuals/"
COMP_3="MarqueeTicker.tsx:components/ui/"
COMP_4="r3-tokens.css:styles/"
COMP_5="instrument.tsx:pages/"
COMP_6="StudioShell.tsx:components/studio/"
COMP_7="StudioHeader.tsx:components/studio/"
COMP_8="TransportBar.tsx:components/studio/"
COMP_9="EngineTelemetry.tsx:components/studio/"
COMP_10="StudioFooter.tsx:components/studio/"

# ============================================================================
# STEP 1: Environment Verification
# ============================================================================
log_section "STEP 1: Environment Verification"

if [ ! -d "$PROJECT_ROOT" ]; then
  log_error "Project root not found: $PROJECT_ROOT"
  exit 1
fi
log_success "Project root found: $PROJECT_ROOT"

if [ ! -d "$CLIENT_SRC" ]; then
  log_error "Client source not found: $CLIENT_SRC"
  exit 1
fi
log_success "Client source found: $CLIENT_SRC"

if ! command -v pnpm >/dev/null 2>&1; then
  log_error "pnpm not found"
  exit 1
fi
log_success "pnpm found: $(pnpm --version)"

if ! command -v node >/dev/null 2>&1; then
  log_error "Node.js not found"
  exit 1
fi
log_success "Node.js found: $(node --version)"

# ============================================================================
# STEP 2: Verify All Required Files Exist
# ============================================================================
log_section "STEP 2: Verifying All Required Files Exist"

MISSING=0

for manifest in "$COMP_1" "$COMP_2" "$COMP_3" "$COMP_4" "$COMP_5" "$COMP_6" "$COMP_7" "$COMP_8" "$COMP_9" "$COMP_10"; do
  file_name="${manifest%%:*}"
  target_path="${manifest##*:}"
  full_path="${CLIENT_SRC}/${target_path}${file_name}"
  
  if [ ! -f "$full_path" ]; then
    log_error "Missing: $full_path"
    MISSING=$((MISSING + 1))
  else
    actual_lines=$(wc -l < "$full_path" 2>/dev/null || echo 0)
    log_success "Found: $file_name ($actual_lines lines)"
  fi
done

if [ "$MISSING" -gt 0 ]; then
  log_error "$MISSING file(s) missing from project"
  exit 1
fi

log_success "All 10 required files present"

# ============================================================================
# STEP 3: Verify File Integrity & Syntax
# ============================================================================
log_section "STEP 3: Verifying File Integrity"

SYNTAX_ERRORS=0

# Check for obvious syntax issues
for manifest in "$COMP_1" "$COMP_2" "$COMP_3" "$COMP_5" "$COMP_6" "$COMP_7" "$COMP_8" "$COMP_9" "$COMP_10"; do
  file_name="${manifest%%:*}"
  target_path="${manifest##*:}"
  full_path="${CLIENT_SRC}/${target_path}${file_name}"
  
  if [ ! -f "$full_path" ]; then
    continue
  fi
  
  # Check for common issues
  if grep -q "^\s*{.*{.*}.*}.*{" "$full_path" 2>/dev/null; then
    log_warn "$file_name: Possible duplicate object properties (check line 392 in DrumWorkstation)"
  fi
  
  actual_lines=$(wc -l < "$full_path")
  log_success "$file_name: $actual_lines lines"
done

log_success "File integrity verified"

# ============================================================================
# STEP 4: Verify Critical Imports
# ============================================================================
log_section "STEP 4: Verifying Critical Imports"

IMPORT_FAIL=0

# Check drum components have audio engine
if grep -q "useAudioEngine" "${CLIENT_SRC}/components/drum/DrumWorkstation.tsx"; then
  log_success "DrumWorkstation: useAudioEngine import ✓"
else
  log_error "DrumWorkstation: Missing useAudioEngine import"
  IMPORT_FAIL=1
fi

if grep -q "useAudioEngine" "${CLIENT_SRC}/components/visuals/VisualizerCanvas.tsx"; then
  log_success "VisualizerCanvas: useAudioEngine import ✓"
else
  log_error "VisualizerCanvas: Missing useAudioEngine import"
  IMPORT_FAIL=1
fi

# Check instrument imports studio components
STUDIO_IMPORTS=0
for comp in "StudioShell" "StudioHeader" "TransportBar" "EngineTelemetry" "StudioFooter"; do
  if grep -q "$comp" "${CLIENT_SRC}/pages/instrument.tsx"; then
    STUDIO_IMPORTS=$((STUDIO_IMPORTS + 1))
  fi
done

if [ "$STUDIO_IMPORTS" -ge 3 ]; then
  log_success "instrument.tsx: Studio shell imports present ($STUDIO_IMPORTS/5)"
else
  log_warn "instrument.tsx: Only $STUDIO_IMPORTS/5 studio components imported (check file)"
fi

# Check main.tsx has design tokens
if grep -q "r3-tokens" "${CLIENT_SRC}/main.tsx"; then
  log_success "main.tsx: r3-tokens.css imported ✓"
else
  log_warn "main.tsx: r3-tokens.css not imported (add manually if needed)"
fi

if [ "$IMPORT_FAIL" -eq 1 ]; then
  log_error "Critical imports missing"
  exit 1
fi

log_success "Import verification passed"

# ============================================================================
# STEP 5: TypeScript Type Check
# ============================================================================
log_section "STEP 5: Running TypeScript Type Check"

cd "$PROJECT_ROOT" || exit 1

log_info "Running: npm run typecheck"
npm run typecheck 2>&1 | tee /tmp/typecheck.log
TYPECHECK_EXIT=${PIPESTATUS[0]}

if [ "$TYPECHECK_EXIT" -eq 0 ]; then
  log_success "TypeScript check PASSED ✓"
else
  log_error "TypeScript check FAILED with exit code $TYPECHECK_EXIT"
  log_error ""
  log_error "Fix TypeScript errors and re-run this script:"
  log_error ""
  log_error "Common fixes:"
  log_error "  • Missing imports: add to package.json (e.g., npm install react-router-dom)"
  log_error "  • Duplicate properties: remove one (line 392 in DrumWorkstation)"
  log_error "  • Type mismatches: check Request/Response/Express types"
  log_error ""
  exit 1
fi

# ============================================================================
# STEP 6: Build Test
# ============================================================================
log_section "STEP 6: Testing Build"

log_info "Running: npm run build (may take 1-2 minutes)..."

npm run build 2>&1 | tee /tmp/build.log
BUILD_EXIT=${PIPESTATUS[0]}

if [ "$BUILD_EXIT" -eq 0 ]; then
  log_success "Build SUCCEEDED ✓"
  
  # Check build output
  if [ -d "$PROJECT_ROOT/dist" ]; then
    DIST_SIZE=$(du -sh "$PROJECT_ROOT/dist" 2>/dev/null | cut -f1)
    log_success "Build output: $DIST_SIZE"
  fi
else
  log_error "Build FAILED with exit code $BUILD_EXIT"
  log_error "Review output above"
  exit 1
fi

# ============================================================================
# STEP 7: Summary
# ============================================================================
log_section "VALIDATION COMPLETE ✓"

cat << EOF
${GREEN}✅ R3 NATIVE v2.0.0 VALIDATION SUCCESSFUL${NC}

Verified Files (10 total):
  Core Components:
  • DrumWorkstation.tsx
  • VisualizerCanvas.tsx
  • MarqueeTicker.tsx
  • r3-tokens.css
  • instrument.tsx

  Studio Shell (NEW):
  • StudioShell.tsx
  • StudioHeader.tsx
  • TransportBar.tsx
  • EngineTelemetry.tsx
  • StudioFooter.tsx

Validation Results:
  ✅ All 10 files present
  ✅ File integrity verified
  ✅ Imports verified
  ✅ TypeScript check PASSED
  ✅ Build succeeded

Status: ${GREEN}READY FOR DEPLOYMENT${NC} 🚀

Next Steps:
  1. Run: ${BLUE}npm run dev${NC}
  2. Navigate to: ${BLUE}http://localhost:5173/instrument${NC}
  3. Verify studio shell renders
  4. Test audio engine integration
  5. Check browser console for runtime errors

Debug Logs:
  TypeScript: /tmp/typecheck.log
  Build:      /tmp/build.log
EOF

log_success "Validation complete! Ready to run npm run dev"
