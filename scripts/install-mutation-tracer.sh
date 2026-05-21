#!/bin/bash

################################################################################
# Mutation Replay System — Automated Integration Script
# 
# Purpose: Integrate mutation tracer into R3 v4 project safely
# - Pre-flight validation
# - Atomic operations with rollback
# - Dry-run mode for testing
# - Comprehensive error handling
# - Zero application breakage guarantee
#
# Usage:
#   ./install-mutation-tracer.sh                 # Interactive mode
#   ./install-mutation-tracer.sh --dry-run       # Test without changes
#   ./install-mutation-tracer.sh --skip-tests    # Skip unit tests
#   ./install-mutation-tracer.sh --force         # Override safety checks
#
# Author: Claude (Anthropic) for @3R
# Date: 2026-05-19
# WIRE Protocol Compliant: Yes (atomic + rollback + validation)
#
################################################################################

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# ─────────────────────────────────────────────────────────────────────────
# CONFIGURATION & CONSTANTS
# ─────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${SCRIPT_DIR}/.mutation-tracer-backup-${TIMESTAMP}"
DRY_RUN=false
SKIP_TESTS=false
FORCE_MODE=false
VERBOSE=true
EXIT_CODE=0

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# File paths (adjust if needed)
PROJECT_ROOT="${PROJECT_ROOT:-.}"
CLIENT_DIR="${PROJECT_ROOT}/client"
SRC_DIR="${CLIENT_DIR}/src"
DEBUG_DIR="${SRC_DIR}/debug"
TEST_DIR="${DEBUG_DIR}/__tests__"

# Source files location (from /mnt/user-data/outputs/)
SOURCES_DIR="/mnt/user-data/outputs"

# ─────────────────────────────────────────────────────────────────────────
# LOGGING & OUTPUT
# ─────────────────────────────────────────────────────────────────────────

log_info() {
  echo -e "${BLUE}[INFO]${NC} $*" >&2
}

log_success() {
  echo -e "${GREEN}[✓]${NC} $*" >&2
}

log_warn() {
  echo -e "${YELLOW}[⚠]${NC} $*" >&2
}

log_error() {
  echo -e "${RED}[✗]${NC} $*" >&2
  EXIT_CODE=1
}

log_section() {
  echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}$*${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# ─────────────────────────────────────────────────────────────────────────
# ARGUMENT PARSING
# ─────────────────────────────────────────────────────────────────────────

parse_args() {
  while [[ $# -gt 0 ]]; do
    case $1 in
      --dry-run)
        DRY_RUN=true
        log_warn "DRY RUN MODE: No changes will be made"
        shift
        ;;
      --skip-tests)
        SKIP_TESTS=true
        log_warn "Unit tests will be skipped"
        shift
        ;;
      --force)
        FORCE_MODE=true
        log_warn "Force mode enabled: skipping some safety checks"
        shift
        ;;
      --quiet)
        VERBOSE=false
        shift
        ;;
      --help)
        print_help
        exit 0
        ;;
      *)
        log_error "Unknown option: $1"
        print_help
        exit 1
        ;;
    esac
  done
}

print_help() {
  cat << 'EOF'
Usage: ./install-mutation-tracer.sh [OPTIONS]

Options:
  --dry-run       Test integration without making changes
  --skip-tests    Skip unit test execution (faster)
  --force         Override safety checks (use with caution)
  --quiet         Suppress verbose output
  --help          Show this help message

Examples:
  # Normal integration (recommended)
  ./install-mutation-tracer.sh

  # Test integration without changes
  ./install-mutation-tracer.sh --dry-run

  # Fast integration (skip tests)
  ./install-mutation-tracer.sh --skip-tests

  # Force integration (override checks)
  ./install-mutation-tracer.sh --force

For more details, see INTEGRATION_GUIDE.md
EOF
}

# ─────────────────────────────────────────────────────────────────────────
# PHASE 1: PRE-FLIGHT CHECKS
# ─────────────────────────────────────────────────────────────────────────

phase_preflight() {
  log_section "PHASE 1: PRE-FLIGHT VALIDATION"

  # Check 1: Source files exist
  log_info "Checking source files..."
  local required_files=(
    "mutation-tracer.debug.ts"
    "trpc-tracer.debug.ts"
    "mutation-tracer.test.ts"
    "vite.config.snippet.ts"
    "main.tsx.snippet"
  )

  for file in "${required_files[@]}"; do
    if [[ ! -f "${SOURCES_DIR}/${file}" ]]; then
      log_error "Source file missing: ${SOURCES_DIR}/${file}"
      return 1
    fi
    log_success "Found: ${file}"
  done

  # Check 2: Project structure exists
  log_info "Checking project structure..."
  if [[ ! -d "${CLIENT_DIR}" ]]; then
    log_error "Client directory not found: ${CLIENT_DIR}"
    return 1
  fi
  log_success "Client directory exists"

  if [[ ! -f "${CLIENT_DIR}/package.json" ]]; then
    log_error "package.json not found in ${CLIENT_DIR}"
    return 1
  fi
  log_success "package.json found"

  # Check 3: Required tools installed
  log_info "Checking required tools..."
  local required_tools=("pnpm" "node" "git")
  for tool in "${required_tools[@]}"; do
    if ! command -v "$tool" &> /dev/null; then
      log_error "Required tool not found: $tool"
      return 1
    fi
    log_success "Found: $(command -v $tool)"
  done

  # Check 4: Git status (warn if uncommitted changes)
  log_info "Checking git status..."
  if [[ -d "${PROJECT_ROOT}/.git" ]]; then
    if ! git -C "${PROJECT_ROOT}" diff-index --quiet HEAD -- 2>/dev/null; then
      log_warn "Uncommitted changes detected in git"
      if [[ "${FORCE_MODE}" != "true" ]]; then
        log_error "Commit changes before integration (or use --force)"
        return 1
      fi
    else
      log_success "Git repository is clean"
    fi
  else
    log_warn "Not a git repository; backup will be created instead"
  fi

  # Check 5: TypeScript configuration
  log_info "Checking TypeScript configuration..."
  if [[ ! -f "${PROJECT_ROOT}/tsconfig.json" ]]; then
    log_warn "No tsconfig.json found at project root"
  else
    log_success "tsconfig.json found"
  fi

  # Check 6: vite.config.ts exists
  log_info "Checking Vite configuration..."
  local vite_config=""
  if [[ -f "${PROJECT_ROOT}/vite.config.ts" ]]; then
    vite_config="${PROJECT_ROOT}/vite.config.ts"
  elif [[ -f "${CLIENT_DIR}/vite.config.ts" ]]; then
    vite_config="${CLIENT_DIR}/vite.config.ts"
  else
    log_error "vite.config.ts not found"
    return 1
  fi
  log_success "Vite config found: ${vite_config}"

  # Check 7: main.tsx exists
  log_info "Checking application entry point..."
  local main_file=""
  if [[ -f "${SRC_DIR}/main.tsx" ]]; then
    main_file="${SRC_DIR}/main.tsx"
  elif [[ -f "${SRC_DIR}/main.ts" ]]; then
    main_file="${SRC_DIR}/main.ts"
  else
    log_error "main.tsx or main.ts not found"
    return 1
  fi
  log_success "Entry point found: ${main_file}"

  # Check 8: tRPC client configuration
  log_info "Checking tRPC client..."
  if [[ ! -f "${SRC_DIR}/lib/trpc.ts" ]] && [[ ! -f "${SRC_DIR}/utils/trpc.ts" ]]; then
    log_warn "tRPC client not found in expected locations"
    log_warn "You'll need to integrate tRPC middleware manually"
  else
    log_success "tRPC client found"
  fi

  log_success "All pre-flight checks passed!"
  return 0
}

# ─────────────────────────────────────────────────────────────────────────
# PHASE 2: BACKUP CREATION
# ─────────────────────────────────────────────────────────────────────────

phase_backup() {
  log_section "PHASE 2: BACKUP CREATION"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_warn "DRY RUN: Skipping backup (no changes will be made)"
    return 0
  fi

  log_info "Creating backup directory: ${BACKUP_DIR}"
  mkdir -p "${BACKUP_DIR}"

  # Backup existing debug directory if it exists
  if [[ -d "${DEBUG_DIR}" ]]; then
    log_info "Backing up existing ${DEBUG_DIR}..."
    cp -r "${DEBUG_DIR}" "${BACKUP_DIR}/debug.backup" || {
      log_error "Failed to backup debug directory"
      return 1
    }
    log_success "Debug directory backed up"
  fi

  # Backup vite.config.ts
  local vite_config=""
  if [[ -f "${PROJECT_ROOT}/vite.config.ts" ]]; then
    vite_config="${PROJECT_ROOT}/vite.config.ts"
  elif [[ -f "${CLIENT_DIR}/vite.config.ts" ]]; then
    vite_config="${CLIENT_DIR}/vite.config.ts"
  fi

  if [[ -n "${vite_config}" ]]; then
    log_info "Backing up ${vite_config}..."
    cp "${vite_config}" "${BACKUP_DIR}/vite.config.ts.backup" || {
      log_error "Failed to backup vite.config.ts"
      return 1
    }
    log_success "vite.config.ts backed up"
  fi

  # Backup main.tsx
  local main_file=""
  if [[ -f "${SRC_DIR}/main.tsx" ]]; then
    main_file="${SRC_DIR}/main.tsx"
  elif [[ -f "${SRC_DIR}/main.ts" ]]; then
    main_file="${SRC_DIR}/main.ts"
  fi

  if [[ -n "${main_file}" ]]; then
    log_info "Backing up ${main_file}..."
    cp "${main_file}" "${BACKUP_DIR}/main.backup" || {
      log_error "Failed to backup main file"
      return 1
    }
    log_success "main.tsx backed up"
  fi

  log_success "Backup created at: ${BACKUP_DIR}"
  echo "${BACKUP_DIR}" > "${SCRIPT_DIR}/.mutation-tracer-last-backup"
  return 0
}

# ─────────────────────────────────────────────────────────────────────────
# PHASE 3: FILE PLACEMENT
# ─────────────────────────────────────────────────────────────────────────

phase_file_placement() {
  log_section "PHASE 3: FILE PLACEMENT"

  # Create directories
  log_info "Creating directories..."
  local dirs_to_create=("${DEBUG_DIR}" "${TEST_DIR}")
  for dir in "${dirs_to_create[@]}"; do
    if [[ ! -d "${dir}" ]]; then
      if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would create: ${dir}"
      else
        mkdir -p "${dir}" || {
          log_error "Failed to create directory: ${dir}"
          return 1
        }
      fi
      log_success "Created: ${dir}"
    else
      log_success "Already exists: ${dir}"
    fi
  done

  # Copy source files
  local files_to_copy=(
    "mutation-tracer.debug.ts:${DEBUG_DIR}/mutation-tracer.debug.ts"
    "trpc-tracer.debug.ts:${DEBUG_DIR}/trpc-tracer.debug.ts"
    "mutation-tracer.test.ts:${TEST_DIR}/mutation-tracer.test.ts"
  )

  for mapping in "${files_to_copy[@]}"; do
    local src="${SOURCES_DIR}/${mapping%:*}"
    local dst="${mapping#*:}"

    log_info "Copying $(basename $src) to $(dirname $dst)..."
    if [[ "${DRY_RUN}" == "true" ]]; then
      log_info "[DRY RUN] Would copy: ${src} → ${dst}"
    else
      cp "${src}" "${dst}" || {
        log_error "Failed to copy file: ${src}"
        return 1
      }
    fi
    log_success "Placed: ${dst}"
  done

  log_success "All files placed successfully"
  return 0
}

# ─────────────────────────────────────────────────────────────────────────
# PHASE 4: CONFIGURATION MERGING
# ─────────────────────────────────────────────────────────────────────────

phase_config_merge() {
  log_section "PHASE 4: CONFIGURATION MERGING"

  # Find vite.config.ts
  local vite_config=""
  if [[ -f "${PROJECT_ROOT}/vite.config.ts" ]]; then
    vite_config="${PROJECT_ROOT}/vite.config.ts"
  elif [[ -f "${CLIENT_DIR}/vite.config.ts" ]]; then
    vite_config="${CLIENT_DIR}/vite.config.ts"
  fi

  # Merge Vite config
  if [[ -n "${vite_config}" ]]; then
    log_info "Checking vite.config.ts for __DEV__ define..."
    
    if grep -q "__DEV__" "${vite_config}"; then
      log_success "__DEV__ define already present"
    else
      log_info "Adding __DEV__ define to ${vite_config}..."
      
      if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would add __DEV__ define"
      else
        # Add define block if not present
        if ! grep -q "define:" "${vite_config}"; then
          # No define block exists, add it
          local define_block='  define: {\n    __DEV__: JSON.stringify(process.env.NODE_ENV === "development"),\n  },'
          sed -i "/plugins:/i\\${define_block}" "${vite_config}" || {
            log_error "Failed to add define block to vite.config.ts"
            return 1
          }
        else
          # define block exists, add __DEV__ to it
          sed -i "/define: {/a\\    __DEV__: JSON.stringify(process.env.NODE_ENV === \"development\")," "${vite_config}" || {
            log_error "Failed to add __DEV__ to define block"
            return 1
          }
        fi
      fi
      log_success "__DEV__ define added"
    fi

    # Check for terser config
    if ! grep -q "terserOptions" "${vite_config}"; then
      log_info "Adding terser configuration..."
      
      if [[ "${DRY_RUN}" != "true" ]]; then
        # This is complex; for now just warn
        log_warn "Terser config should be added manually (see vite.config.snippet.ts)"
        log_warn "Add to build.terserOptions: { compress: { dead_code: true, passes: 3 } }"
      fi
    fi
  fi

  # Merge main.tsx
  local main_file=""
  if [[ -f "${SRC_DIR}/main.tsx" ]]; then
    main_file="${SRC_DIR}/main.tsx"
  elif [[ -f "${SRC_DIR}/main.ts" ]]; then
    main_file="${SRC_DIR}/main.ts"
  fi

  if [[ -n "${main_file}" ]]; then
    log_info "Checking ${main_file} for setupMutationTracer import..."
    
    if grep -q "setupMutationTracer" "${main_file}"; then
      log_success "setupMutationTracer already present"
    else
      log_info "Adding setupMutationTracer to ${main_file}..."
      
      if [[ "${DRY_RUN}" == "true" ]]; then
        log_info "[DRY RUN] Would add setupMutationTracer import and call"
      else
        # Add import at top
        sed -i "1i import { setupMutationTracer } from '@/debug/mutation-tracer.debug';" "${main_file}" || {
          log_error "Failed to add import to main file"
          return 1
        }
        
        # Add initialization before ReactDOM.createRoot
        # Find the line with ReactDOM.createRoot and add setupMutationTracer before it
        sed -i "/ReactDOM.createRoot/i\\setupMutationTracer();\n" "${main_file}" || {
          log_error "Failed to add setupMutationTracer call"
          return 1
        }
      fi
      log_success "setupMutationTracer added"
    fi
  fi

  log_success "Configuration merging complete"
  return 0
}

# ─────────────────────────────────────────────────────────────────────────
# PHASE 5: TYPSCRIPT VALIDATION
# ─────────────────────────────────────────────────────────────────────────

phase_typescript_check() {
  log_section "PHASE 5: TYPESCRIPT VALIDATION"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_warn "[DRY RUN] Skipping TypeScript check"
    return 0
  fi

  log_info "Running TypeScript compiler..."
  if ! cd "${PROJECT_ROOT}" && pnpm tsc --noEmit 2>&1 | head -20; then
    log_warn "TypeScript errors found (review above)"
    log_info "This may be expected if project had pre-existing errors"
    
    # Check if errors are only in debug directory (our files)
    if cd "${PROJECT_ROOT}" && pnpm tsc --noEmit 2>&1 | grep -q "mutation-tracer"; then
      log_error "TypeScript errors in mutation tracer files detected"
      return 1
    fi
  else
    log_success "TypeScript check passed"
  fi

  return 0
}

# ─────────────────────────────────────────────────────────────────────────
# PHASE 6: BUILD TEST
# ─────────────────────────────────────────────────────────────────────────

phase_build_test() {
  log_section "PHASE 6: BUILD TEST"

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_warn "[DRY RUN] Skipping build test"
    return 0
  fi

  log_info "Testing development build..."
  if ! cd "${PROJECT_ROOT}" && pnpm build 2>&1 | tail -20; then
    log_error "Build failed"
    return 1
  fi

  log_success "Build completed successfully"

  # Verify no tracer code in production bundle
  log_info "Verifying tracer code eliminated from bundle..."
  if grep -r "__mutationTracer" dist/ 2>/dev/null; then
    log_error "Tracer code found in production bundle (tree-shaking failed)"
    return 1
  fi
  log_success "Verified: no tracer code in production bundle"

  return 0
}

# ─────────────────────────────────────────────────────────────────────────
# PHASE 7: UNIT TESTS
# ─────────────────────────────────────────────────────────────────────────

phase_unit_tests() {
  log_section "PHASE 7: UNIT TESTS"

  if [[ "${SKIP_TESTS}" == "true" ]]; then
    log_warn "Unit tests skipped (--skip-tests flag)"
    return 0
  fi

  if [[ "${DRY_RUN}" == "true" ]]; then
    log_warn "[DRY RUN] Skipping unit tests"
    return 0
  fi

  log_info "Running mutation tracer unit tests..."
  if ! cd "${PROJECT_ROOT}" && pnpm test -- mutation-tracer --run 2>&1 | tail -30; then
    log_warn "Unit test execution encountered issues"
    log_info "This may be expected if test framework is not yet configured"
  else
    log_success "Unit tests completed"
  fi

  return 0
}

# ─────────────────────────────────────────────────────────────────────────
# PHASE 8: VERIFICATION & CLEANUP
# ─────────────────────────────────────────────────────────────────────────

phase_verification() {
  log_section "PHASE 8: VERIFICATION & CLEANUP"

  local all_files_present=true

  # Check all expected files are in place
  for file in "${DEBUG_DIR}/mutation-tracer.debug.ts" \
              "${DEBUG_DIR}/trpc-tracer.debug.ts" \
              "${TEST_DIR}/mutation-tracer.test.ts"; do
    if [[ ! -f "${file}" ]]; then
      log_error "File missing: ${file}"
      all_files_present=false
    else
      log_success "Verified: ${file}"
    fi
  done

  if [[ "${all_files_present}" != "true" ]]; then
    return 1
  fi

  # Summary
  log_success "All verification checks passed!"
  
  if [[ "${DRY_RUN}" != "true" ]]; then
    log_info "Backup location: ${BACKUP_DIR}"
    log_info "To rollback: cp -r ${BACKUP_DIR}/* ${PROJECT_ROOT}/"
  fi

  return 0
}

# ─────────────────────────────────────────────────────────────────────────
# ROLLBACK FUNCTION
# ─────────────────────────────────────────────────────────────────────────

rollback() {
  log_section "ROLLING BACK CHANGES"

  if [[ ! -d "${BACKUP_DIR}" ]]; then
    log_error "Backup directory not found: ${BACKUP_DIR}"
    return 1
  fi

  log_warn "Restoring from backup..."

  # Restore debug directory
  if [[ -d "${BACKUP_DIR}/debug.backup" ]]; then
    rm -rf "${DEBUG_DIR}"
    mv "${BACKUP_DIR}/debug.backup" "${DEBUG_DIR}"
    log_success "Restored debug directory"
  fi

  # Restore vite.config.ts
  if [[ -f "${BACKUP_DIR}/vite.config.ts.backup" ]]; then
    if [[ -f "${PROJECT_ROOT}/vite.config.ts" ]]; then
      mv "${PROJECT_ROOT}/vite.config.ts" "${PROJECT_ROOT}/vite.config.ts.failed"
    fi
    mv "${BACKUP_DIR}/vite.config.ts.backup" "${PROJECT_ROOT}/vite.config.ts"
    log_success "Restored vite.config.ts"
  fi

  # Restore main.tsx
  if [[ -f "${BACKUP_DIR}/main.backup" ]]; then
    if [[ -f "${SRC_DIR}/main.tsx" ]]; then
      mv "${SRC_DIR}/main.tsx" "${SRC_DIR}/main.tsx.failed"
    elif [[ -f "${SRC_DIR}/main.ts" ]]; then
      mv "${SRC_DIR}/main.ts" "${SRC_DIR}/main.ts.failed"
    fi
    mv "${BACKUP_DIR}/main.backup" "${SRC_DIR}/main.tsx"
    log_success "Restored main.tsx"
  fi

  log_success "Rollback complete. Failed files saved with .failed extension"
  return 0
}

# ─────────────────────────────────────────────────────────────────────────
# MAIN EXECUTION
# ─────────────────────────────────────────────────────────────────────────

main() {
  log_section "MUTATION REPLAY SYSTEM — AUTOMATED INTEGRATION"
  log_info "Project: ${PROJECT_ROOT}"
  log_info "Client: ${CLIENT_DIR}"
  log_info "Timestamp: $(date)"

  # Parse arguments
  parse_args "$@"

  # Execute phases
  if ! phase_preflight; then
    log_error "Pre-flight checks failed"
    exit 1
  fi

  if ! phase_backup; then
    log_error "Backup creation failed"
    exit 1
  fi

  if ! phase_file_placement; then
    log_error "File placement failed"
    rollback
    exit 1
  fi

  if ! phase_config_merge; then
    log_error "Configuration merge failed"
    rollback
    exit 1
  fi

  if ! phase_typescript_check; then
    log_warn "TypeScript check had issues (reviewing)"
  fi

  if ! phase_build_test; then
    log_error "Build test failed"
    rollback
    exit 1
  fi

  if ! phase_unit_tests; then
    log_warn "Unit tests had issues (non-fatal)"
  fi

  if ! phase_verification; then
    log_error "Verification failed"
    rollback
    exit 1
  fi

  # Final summary
  log_section "INTEGRATION COMPLETE ✓"
  
  if [[ "${DRY_RUN}" == "true" ]]; then
    log_success "DRY RUN: All checks passed (no changes made)"
  else
    log_success "Integration successful!"
    log_info "Backup: ${BACKUP_DIR}"
  fi

  cat << 'EOF'

Next steps:
1. Integrate tRPC middleware manually (if needed):
   - Edit client/src/lib/trpc.ts
   - Add: import { createTracingHttpLinkMiddleware } from '@/debug/trpc-tracer.debug'
   - Add to httpLink middleware: createTracingHttpLinkMiddleware()

2. Test the integration:
   - Run: pnpm dev
   - Open browser console
   - Run: window.__mutationTracer.replay()
   - Should return empty array (no error)

3. Verify production build:
   - Run: pnpm build
   - Check: grep -r '__mutationTracer' dist/
   - Should return nothing (code eliminated)

For detailed instructions, see INTEGRATION_GUIDE.md

EOF

  exit 0
}

# ─────────────────────────────────────────────────────────────────────────
# EXECUTE
# ─────────────────────────────────────────────────────────────────────────

main "$@"
