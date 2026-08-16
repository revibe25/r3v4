#!/bin/bash
###############################################################################
# R3 NATIVE v2.0.0 — COMPLETE STUDIO SHELL DEPLOYMENT (FIXED)
# 10 Files: 5 core components + 5 studio shell components
# Total: ~2,800 lines of production code
#
# FIXES from execution audit:
#  ✅ Fix #1: Remove piped while loops (proper exit handling)
#  ✅ Fix #2: Properly check TypeScript exit codes (no false positives)
#  ✅ Fix #3: Fail hard if source files missing
#  ✅ Fix #4: Check required imports before proceeding
#  ✅ Fix #5: Proper build validation
###############################################################################

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m'

PROJECT_ROOT="${HOME}/Stable"
CLIENT_SRC="${PROJECT_ROOT}/client/src"
UPLOAD_DIR="/mnt/user-data/uploads"
BACKUP_DIR="${PROJECT_ROOT}/.backups/r3-native-v2-complete-$(date +%s)"

# Logging functions
log_info()    { echo -e "${BLUE}ℹ ${NC}$1"; }
log_success() { echo -e "${GREEN}✅${NC} $1"; }
log_warn()    { echo -e "${YELLOW}⚠️ ${NC}$1"; }
log_error()   { echo -e "${RED}❌${NC} $1"; }
log_section() { echo -e "\n${MAGENTA}━━━ $1 ━━━${NC}\n"; }

# Component manifest (hardcoded to avoid piped loops)
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

# Helper: extract filename and path from manifest
parse_component() {
  local manifest="$1"
  local file_name="${manifest%%:*}"
  local target_path="${manifest##*:}"
  echo "$file_name|$target_path"
}

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
# STEP 2: Verify Source Files EXIST (fail early)
# ============================================================================
log_section "STEP 2: Verifying Source Files Exist"

MISSING=0
for manifest in "$COMP_1" "$COMP_2" "$COMP_3" "$COMP_4" "$COMP_5" "$COMP_6" "$COMP_7" "$COMP_8" "$COMP_9" "$COMP_10"; do
  file_name="${manifest%%:*}"
  source_file="${UPLOAD_DIR}/${file_name}"
  
  if [ ! -f "$source_file" ]; then
    log_error "Source file MISSING: $source_file"
    MISSING=$((MISSING + 1))
  else
    log_success "Found: $file_name"
  fi
done

if [ "$MISSING" -gt 0 ]; then
  log_error "$MISSING file(s) missing from $UPLOAD_DIR"
  log_error "Cannot proceed — upload all 10 files before running this script"
  exit 1
fi

log_success "All source files verified ✓"

# ============================================================================
# STEP 3: Create Backup
# ============================================================================
log_section "STEP 3: Creating Backup"

mkdir -p "$BACKUP_DIR"

for manifest in "$COMP_1" "$COMP_2" "$COMP_3" "$COMP_4" "$COMP_5" "$COMP_6" "$COMP_7" "$COMP_8" "$COMP_9" "$COMP_10"; do
  file_name="${manifest%%:*}"
  target_path="${manifest##*:}"
  full_path="${CLIENT_SRC}/${target_path}${file_name}"
  
  if [ -f "$full_path" ]; then
    cp "$full_path" "$BACKUP_DIR/"
    log_success "Backed up: $file_name"
  else
    log_warn "Not found (new file): $file_name"
  fi
done

log_success "Backup stored at: $BACKUP_DIR"

# ============================================================================
# STEP 4: Create Directory Structure
# ============================================================================
log_section "STEP 4: Creating Directory Structure"

mkdir -p "$CLIENT_SRC/components/drum"
mkdir -p "$CLIENT_SRC/components/visuals"
mkdir -p "$CLIENT_SRC/components/ui"
mkdir -p "$CLIENT_SRC/components/studio"
mkdir -p "$CLIENT_SRC/styles"
mkdir -p "$CLIENT_SRC/pages"

log_success "All directories created"

# ============================================================================
# STEP 5: Deploy Files
# ============================================================================
log_section "STEP 5: Deploying 10 Component Files"

DEPLOYED=0

for manifest in "$COMP_1" "$COMP_2" "$COMP_3" "$COMP_4" "$COMP_5" "$COMP_6" "$COMP_7" "$COMP_8" "$COMP_9" "$COMP_10"; do
  file_name="${manifest%%:*}"
  target_path="${manifest##*:}"
  source_file="${UPLOAD_DIR}/${file_name}"
  dest_file="${CLIENT_SRC}/${target_path}${file_name}"
  
  # Double-check source (shouldn't fail due to step 2, but be safe)
  if [ ! -f "$source_file" ]; then
    log_error "Source file disappeared: $source_file"
    exit 1
  fi
  
  cp "$source_file" "$dest_file" || {
    log_error "Failed to copy $file_name to $dest_file"
    exit 1
  }
  
  DEPLOYED=$((DEPLOYED + 1))
  log_success "Deployed: $file_name → ${target_path}"
done

log_success "All $DEPLOYED files deployed successfully"

# ============================================================================
# STEP 6: Verify File Integrity
# ============================================================================
log_section "STEP 6: Verifying File Integrity"

for manifest in "$COMP_1" "$COMP_2" "$COMP_3" "$COMP_4" "$COMP_5" "$COMP_6" "$COMP_7" "$COMP_8" "$COMP_9" "$COMP_10"; do
  file_name="${manifest%%:*}"
  target_path="${manifest##*:}"
  full_path="${CLIENT_SRC}/${target_path}${file_name}"
  
  if [ ! -f "$full_path" ]; then
    log_error "$file_name: File not found at destination after deploy"
    exit 1
  fi
  
  actual_lines=$(wc -l < "$full_path" 2>/dev/null || echo 0)
  log_success "$file_name: $actual_lines lines ✓"
done

log_success "File integrity verified"

# ============================================================================
# STEP 7: Check Required Imports (FAIL if missing)
# ============================================================================
log_section "STEP 7: Verifying Required Imports"

IMPORT_FAIL=0

# DrumWorkstation must have useAudioEngine
if grep -q "useAudioEngine" "${CLIENT_SRC}/components/drum/DrumWorkstation.tsx"; then
  log_success "DrumWorkstation: useAudioEngine import ✓"
else
  log_error "DrumWorkstation: Missing useAudioEngine import — file may be corrupted"
  IMPORT_FAIL=1
fi

# VisualizerCanvas must have useAudioEngine
if grep -q "useAudioEngine" "${CLIENT_SRC}/components/visuals/VisualizerCanvas.tsx"; then
  log_success "VisualizerCanvas: useAudioEngine import ✓"
else
  log_error "VisualizerCanvas: Missing useAudioEngine import — file may be corrupted"
  IMPORT_FAIL=1
fi

# instrument.tsx MUST import studio components
if grep -q "StudioShell\|StudioHeader\|TransportBar\|EngineTelemetry\|StudioFooter" "${CLIENT_SRC}/pages/instrument.tsx"; then
  log_success "instrument.tsx: Studio shell imports ✓"
else
  log_error "instrument.tsx: Missing studio component imports — deployment invalid"
  IMPORT_FAIL=1
fi

if [ "$IMPORT_FAIL" -eq 1 ]; then
  log_error "Import verification FAILED — do not proceed"
  exit 1
fi

log_success "All required imports present"

# ============================================================================
# STEP 8: Ensure r3-tokens.css imported in main.tsx
# ============================================================================
log_section "STEP 8: Checking Design Tokens Import"

MAIN="${CLIENT_SRC}/main.tsx"

if [ -f "$MAIN" ]; then
  if grep -q "r3-tokens" "$MAIN"; then
    log_success "main.tsx: r3-tokens.css already imported"
  else
    log_warn "main.tsx: r3-tokens.css not imported — adding now..."
    temp_main="${MAIN}.tmp.$$"
    echo "import './styles/r3-tokens.css';" > "$temp_main"
    cat "$MAIN" >> "$temp_main"
    mv "$temp_main" "$MAIN"
    log_success "Added r3-tokens.css import to main.tsx"
  fi
else
  log_error "main.tsx not found at $MAIN"
  exit 1
fi

# ============================================================================
# STEP 9: TypeScript Type Check (FAIL if errors)
# ============================================================================
log_section "STEP 9: Running TypeScript Type Check"

cd "$PROJECT_ROOT" || exit 1

log_info "Running: npm run typecheck"
npm run typecheck 2>&1 | tee /tmp/typecheck.log

# Check the actual exit code of npm run typecheck (not the pipe)
TYPECHECK_EXIT=${PIPESTATUS[0]}

if [ "$TYPECHECK_EXIT" -eq 0 ]; then
  log_success "TypeScript check passed ✓"
else
  log_error "TypeScript check FAILED with exit code $TYPECHECK_EXIT"
  log_error "Review errors above and fix before proceeding"
  log_error "Common fixes:"
  echo "  • Missing imports: add to package.json"
  echo "  • Duplicate object properties: remove one"
  echo "  • Type mismatches: check Request/Response types"
  exit 1
fi

# ============================================================================
# STEP 10: Build Test (FAIL if errors)
# ============================================================================
log_section "STEP 10: Testing Build"

log_info "Running: npm run build (this may take 1-2 minutes)..."
npm run build 2>&1 | tee /tmp/build.log

BUILD_EXIT=${PIPESTATUS[0]}

if [ "$BUILD_EXIT" -eq 0 ]; then
  log_success "Build succeeded ✓"
else
  log_error "Build FAILED with exit code $BUILD_EXIT"
  log_error "Review output above"
  exit 1
fi

# ============================================================================
# STEP 11: Success Summary
# ============================================================================
log_section "DEPLOYMENT COMPLETE ✓"

cat << EOF
${GREEN}✅ COMPLETE STUDIO SHELL DEPLOYMENT SUCCESSFUL${NC}

Files Deployed (10 total):
  Core Audio/UI Components:
  • DrumWorkstation.tsx
  • VisualizerCanvas.tsx
  • MarqueeTicker.tsx
  • r3-tokens.css
  • instrument.tsx

  Studio Shell Components:
  • StudioShell.tsx
  • StudioHeader.tsx
  • TransportBar.tsx
  • EngineTelemetry.tsx
  • StudioFooter.tsx

Verification Results:
  ✅ Source files verified (all 10 present)
  ✅ Backup created successfully
  ✅ All files deployed
  ✅ File integrity verified
  ✅ Required imports verified
  ✅ Design tokens imported
  ✅ TypeScript check PASSED
  ✅ Build succeeded

Backup Location:
  $BACKUP_DIR

Next Steps:
  1. Run: ${BLUE}npm run dev${NC}
  2. Navigate to: ${BLUE}http://localhost:5173/instrument${NC}
  3. Verify studio shell renders
  4. Test audio engine integration
  5. Check browser console for runtime errors

Rollback (if needed):
  ${YELLOW}cp -r $BACKUP_DIR/* $CLIENT_SRC/${NC}

Status: ${GREEN}READY FOR TESTING${NC} 🚀
EOF

log_success "Deployment automation complete!"
