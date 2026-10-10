#!/usr/bin/env bash
#==============================================================================
# R3VIBE Server/Client Fix Script v2
# Fixes: serveStatic crash, worklet URL, import conflicts, bundle size,
#        dead code, race condition, tsx watch patterns
#==============================================================================
set -uo pipefail
IFS=$'\n\t'

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
BACKUP_DIR=".backup-$(date +%Y%m%d-%H%M%S)"
DRY_RUN=${DRY_RUN:-false}

# Counters
FIXES_APPLIED=0
FIXES_SKIPPED=0
WARNINGS=0
ERRORS=0

#==============================================================================
# UTILITIES
#==============================================================================

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; ((WARNINGS++)) || true; }
log_err()  { echo -e "${RED}[ERR]${NC} $1"; ((ERRORS++)) || true; }
log_step() { echo -e "${CYAN}\n==> $1${NC}"; }

backup_file() {
    local file="$1"
    if [[ -f "$file" ]]; then
        mkdir -p "$BACKUP_DIR/$(dirname "$file")"
        cp "$file" "$BACKUP_DIR/$file"
        log_info "Backed up: $file"
    fi
}

verify_file() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        log_err "File not found: $file"
        return 1
    fi
    return 0
}

# Python-based safe text replacement
safe_replace() {
    local file="$1"
    local search="$2"
    local replace="$3"
    local desc="$4"

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} Would apply: $desc"
        return 0
    fi

    backup_file "$file"

    python3 << PYEOF
import sys
file_path = """$file"""
search = """$search"""
replace = """$replace"""

try:
    with open(file_path, "r") as f:
        content = f.read()

    if search not in content:
        print(f"PATTERN_NOT_FOUND:{file_path}")
        sys.exit(2)

    if replace in content:
        print(f"ALREADY_APPLIED:{file_path}")
        sys.exit(3)

    new_content = content.replace(search, replace, 1)

    with open(file_path, "w") as f:
        f.write(new_content)

    with open(file_path, "r") as f:
        verify = f.read()

    if replace not in verify:
        print(f"VERIFY_FAILED:{file_path}")
        sys.exit(4)

    print(f"SUCCESS:{file_path}")

except Exception as e:
    print(f"ERROR:{file_path}:{str(e)}")
    sys.exit(1)
PYEOF

    local py_exit=$?
    case $py_exit in
        0) log_ok "Applied: $desc"; ((FIXES_APPLIED++)) || true ;;
        2) log_warn "Pattern not found for '$desc' in $file"; ((FIXES_SKIPPED++)) || true ;;
        3) log_ok "Already applied: $desc" ;;
        4) log_err "Verification failed for '$desc' in $file"; ((ERRORS++)) || true ;;
        *) log_err "Python error for '$desc' in $file"; ((ERRORS++)) || true ;;
    esac
}

# Python-based regex replacement
safe_regex_replace() {
    local file="$1"
    local pattern="$2"
    local replace="$3"
    local desc="$4"
    local verify="${5:-$replace}"

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} Would apply: $desc"
        return 0
    fi

    backup_file "$file"

    python3 << PYEOF
import re, sys
file_path = """$file"""
pattern = r"""$pattern"""
replace = """$replace"""
verify = """$verify"""

try:
    with open(file_path, "r") as f:
        content = f.read()

    if not re.search(pattern, content):
        print(f"PATTERN_NOT_FOUND:{file_path}")
        sys.exit(2)

    if verify in content:
        print(f"ALREADY_APPLIED:{file_path}")
        sys.exit(3)

    new_content = re.sub(pattern, replace, content, count=1)

    with open(file_path, "w") as f:
        f.write(new_content)

    with open(file_path, "r") as f:
        check = f.read()

    if verify not in check:
        print(f"VERIFY_FAILED:{file_path}")
        sys.exit(4)

    print(f"SUCCESS:{file_path}")

except Exception as e:
    print(f"ERROR:{file_path}:{str(e)}")
    sys.exit(1)
PYEOF

    local py_exit=$?
    case $py_exit in
        0) log_ok "Applied: $desc"; ((FIXES_APPLIED++)) || true ;;
        2) log_warn "Pattern not found for '$desc' in $file"; ((FIXES_SKIPPED++)) || true ;;
        3) log_ok "Already applied: $desc" ;;
        4) log_err "Verification failed for '$desc' in $file"; ((ERRORS++)) || true ;;
        *) log_err "Python error for '$desc' in $file"; ((ERRORS++)) || true ;;
    esac
}

# Insert after a pattern
safe_insert_after() {
    local file="$1"
    local search="$2"
    local insert="$3"
    local desc="$4"
    local verify="${5:-$insert}"

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY-RUN]${NC} Would insert: $desc"
        return 0
    fi

    backup_file "$file"

    python3 << PYEOF
import sys
file_path = """$file"""
search = """$search"""
insert = """$insert"""
verify = """$verify"""

try:
    with open(file_path, "r") as f:
        content = f.read()

    if search not in content:
        print(f"PATTERN_NOT_FOUND:{file_path}")
        sys.exit(2)

    if verify in content:
        print(f"ALREADY_APPLIED:{file_path}")
        sys.exit(3)

    new_content = content.replace(search, search + insert, 1)

    with open(file_path, "w") as f:
        f.write(new_content)

    with open(file_path, "r") as f:
        check = f.read()

    if verify not in check:
        print(f"VERIFY_FAILED:{file_path}")
        sys.exit(4)

    print(f"SUCCESS:{file_path}")

except Exception as e:
    print(f"ERROR:{file_path}:{str(e)}")
    sys.exit(1)
PYEOF

    local py_exit=$?
    case $py_exit in
        0) log_ok "Applied: $desc"; ((FIXES_APPLIED++)) || true ;;
        2) log_warn "Anchor not found for '$desc' in $file"; ((FIXES_SKIPPED++)) || true ;;
        3) log_ok "Already applied: $desc" ;;
        4) log_err "Verification failed for '$desc' in $file"; ((ERRORS++)) || true ;;
        *) log_err "Python error for '$desc' in $file"; ((ERRORS++)) || true ;;
    esac
}

#==============================================================================
# ROLLBACK
#==============================================================================

rollback() {
    log_step "ROLLBACK"
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log_err "No backup directory found: $BACKUP_DIR"
        exit 1
    fi

    find "$BACKUP_DIR" -type f | while read -r backup_file; do
        local rel_path="${backup_file#$BACKUP_DIR/}"
        cp "$backup_file" "$rel_path"
        log_ok "Restored: $rel_path"
    done

    log_ok "Rollback complete"
    exit 0
}

#==============================================================================
# FIX 1: serveStatic crash in static.ts
#==============================================================================

fix_static_ts() {
    log_step "FIX 1: server/static.ts - Graceful fallback for missing dist"

    verify_file "server/static.ts" || return 0

    if grep -q "process.env.NODE_ENV === 'production'" server/static.ts; then
        log_ok "static.ts already has env guard"
        return 0
    fi

    # The actual file has a multiline throw with backticks
    safe_replace "server/static.ts" \
        "  if (!fs.existsSync(distPath)) {
    throw new Error(
      \`Could not find the build directory: \${distPath}, make sure to build the client first\`,
    );
  }" \
        "  if (!fs.existsSync(distPath)) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        \`Could not find the build directory: \${distPath}, make sure to build the client first\`,
      );
    } else {
      console.warn(\`[serveStatic] Skipping: \${distPath} not found (dev mode)\`);
      return;
    }
  }" \
        "Add env guard to serveStatic error throw"
}

#==============================================================================
# FIX 2: index.ts serveStatic call
#==============================================================================

fix_index_ts() {
    log_step "FIX 2: index.ts - Conditional serveStatic for dev mode"

    verify_file "index.ts" || return 0

    if grep -q "NODE_ENV.*production.*serveStatic\|serveStatic.*production\|env.*production.*serveStatic" index.ts; then
        log_ok "index.ts already has conditional serveStatic"
        return 0
    fi

    if grep -q "serveStatic" index.ts; then
        local serve_line
        serve_line=$(grep -n "serveStatic" index.ts | grep -v "import" | head -1)

        if [[ -n "$serve_line" ]]; then
            local line_num
            line_num=$(echo "$serve_line" | cut -d: -f1)
            local line_content
            line_content=$(echo "$serve_line" | cut -d: -f2-)

            log_info "Found serveStatic call at line $line_num: $line_content"

            # Check if already inside an if block by looking at context
            local context
            context=$(sed -n "$((line_num-3)),$((line_num+1))p" index.ts)

            if echo "$context" | grep -q "if.*("; then
                log_warn "serveStatic appears to already be inside a conditional block"
                log_info "Context:\n$context"
                return 0
            fi

            # Use exact string replacement for the line
            safe_replace "index.ts" \
                "$line_content" \
                "    const env = process.env.NODE_ENV || 'development';\n    if (env === 'production') {\n$line_content\n    } else {\n      console.log('[dev] Static serving skipped - client dev server runs on port 5174');\n    }" \
                "Wrap serveStatic call in env check"
        else
            log_warn "No serveStatic call (non-import) found in index.ts"
        fi
    else
        log_warn "No serveStatic found in index.ts"
    fi
}

#==============================================================================
# FIX 3: Health endpoint (already exists per dry-run)
#==============================================================================

fix_health_endpoint() {
    log_step "FIX 3: Verify /health endpoint"

    if grep -q "'/health'" index.ts 2>/dev/null || grep -q '"/health"' index.ts 2>/dev/null; then
        log_ok "Health endpoint already exists"
        return 0
    fi

    log_warn "Health endpoint not found - this is needed for wait-on http check"
}

#==============================================================================
# FIX 4: package.json scripts
#==============================================================================

fix_package_json() {
    log_step "FIX 4: package.json - Fix dev scripts and wait-on"

    verify_file "package.json" || return 0

    # Fix dev:client to use http health check instead of tcp
    if grep -q '"dev:client": "wait-on tcp:3000' package.json; then
        safe_replace "package.json" \
            '"dev:client": "wait-on tcp:3000 && pnpm --filter @r3vibe/client dev"' \
            '"dev:client": "wait-on http://localhost:3000/health --timeout 30000 && pnpm --filter @r3vibe/client dev"' \
            "Change wait-on from tcp to http health endpoint"
    else
        log_warn "Could not find exact dev:client pattern with wait-on tcp:3000"
    fi

    # Fix dev:server tsx watch arguments
    if grep -q '"dev:server": "NODE_OPTIONS' package.json; then
        safe_replace "package.json" \
            '"dev:server": "NODE_OPTIONS=\x27--import dotenv/config\x27 tsx watch --ignore ./client --ignore ./node_modules index.ts"' \
            '"dev:server": "NODE_OPTIONS=\x27--import dotenv/config\x27 tsx watch --exclude \x27./client/**/*\x27 --exclude \x27./storage/**/*\x27 --exclude \x27./dist/**/*\x27 index.ts"' \
            "Update tsx watch to use --exclude with proper patterns"
    else
        log_warn "Could not find dev:server script pattern"
    fi
}

#==============================================================================
# FIX 5: Vite config manualChunks (already exists per dry-run)
#==============================================================================

fix_vite_config() {
    log_step "FIX 5: client/vite.config.ts - Verify manualChunks"

    local vite_file="client/vite.config.ts"
    if [[ ! -f "$vite_file" ]]; then
        vite_file="client/vite.config.js"
    fi
    if [[ ! -f "$vite_file" ]]; then
        log_warn "No vite.config found in client/"
        return 0
    fi

    if grep -q "manualChunks" "$vite_file"; then
        log_ok "manualChunks already configured"
    else
        log_warn "manualChunks not found in $vite_file"
    fi
}

#==============================================================================
# FIX 6: Worklet URL path
#==============================================================================

fix_worklet_url() {
    log_step "FIX 6: Fix worklet URL paths"

    local files
    files=$(grep -rl "public/worklets" client/src/ 2>/dev/null || true)

    if [[ -z "$files" ]]; then
        log_warn "No files found with 'public/worklets' pattern"
        return 0
    fi

    for file in $files; do
        log_info "Found worklet URL in: $file"
        safe_regex_replace "$file" \
            "(new URL\(\s*['\"])../../public/worklets/" \
            "\1/worklets/" \
            "Fix worklet URL path in $file" \
            "/worklets/"
    done
}

#==============================================================================
# FIX 7-9: Report-only warnings
#==============================================================================

fix_import_conflicts() {
    log_step "FIX 7-9: Import conflicts and dead code (report only)"

    local collab_file="client/src/pages/collaborative-daw-pro.tsx"
    if [[ -f "$collab_file" ]]; then
        if grep -q "vst-browser" "$collab_file"; then
            log_warn "vst-browser import conflict detected in $collab_file"
            log_warn "  Check if both lazy() and static import exist"
        fi
    fi

    local app_file="client/src/App.tsx"
    if [[ -f "$app_file" ]]; then
        if grep -q "LoopStation505" "$app_file"; then
            log_warn "LoopStation505 in App.tsx may defeat dynamic imports"
        fi
    fi

    local router_file="server/routers/aiMix.router.ts"
    if [[ -f "$router_file" ]]; then
        if grep -q "loaded but unused" "$router_file"; then
            log_warn "aiMix.router.ts has deprecation warning - review if still needed"
        fi
    fi
}

#==============================================================================
# MAIN
#==============================================================================

main() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════════╗"
    echo "║     R3VIBE Server/Client Fix Script v2                           ║"
    echo "║     Safe, surgical fixes with backups and verification             ║"
    echo "╚══════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    if [[ "${1:-}" == "--rollback" ]]; then
        BACKUP_DIR="${2:-}"
        rollback
    fi

    if [[ "${1:-}" == "--dry-run" ]]; then
        DRY_RUN=true
        log_info "DRY RUN MODE - No changes will be made"
    fi

    if ! command -v python3 &>/dev/null; then
        log_err "python3 is required but not installed"
        exit 1
    fi

    if [[ "$DRY_RUN" == "false" ]]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Backup directory: $BACKUP_DIR"
    fi

    fix_static_ts
    fix_index_ts
    fix_health_endpoint
    fix_package_json
    fix_vite_config
    fix_worklet_url
    fix_import_conflicts

    echo -e "${CYAN}\n══════════════════════════════════════════════════════════════════${NC}"
    log_ok "Fixes applied: $FIXES_APPLIED"
    log_warn "Fixes skipped: $FIXES_SKIPPED"
    log_warn "Warnings: $WARNINGS"
    if [[ $ERRORS -gt 0 ]]; then
        log_err "Errors: $ERRORS"
    fi

    if [[ "$DRY_RUN" == "false" && $FIXES_APPLIED -gt 0 ]]; then
        echo -e "${GREEN}\nBackup saved to: $BACKUP_DIR${NC}"
        echo -e "${YELLOW}To rollback: $0 --rollback $BACKUP_DIR${NC}"
        echo -e "${CYAN}\nNext steps:${NC}"
        echo "  1. Review the changes above"
        echo "  2. Run: pnpm dev"
        echo "  3. If issues occur, run: $0 --rollback $BACKUP_DIR"
    fi

    if [[ $FIXES_SKIPPED -gt 0 || $WARNINGS -gt 0 ]]; then
        echo -e "${YELLOW}\nSome items need manual attention. Review warnings above.${NC}"
    fi

    if [[ $ERRORS -gt 0 ]]; then
        echo -e "${RED}\nErrors occurred. Consider rolling back and investigating.${NC}"
        exit 1
    fi
}

main "$@"
