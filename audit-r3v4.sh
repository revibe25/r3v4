#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# R3V4 PROJECT AUDIT SCRIPT
# Comprehensive analysis of project structure, dependencies, and configuration
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Counters
TOTAL_FILES=0
TOTAL_SIZE=0
TS_FILES=0
TSX_FILES=0
JSON_FILES=0
CSS_FILES=0

PROJECT_ROOT="${1:-.}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="r3v4-audit-${TIMESTAMP}.md"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# HELPER FUNCTIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_header() {
  echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}$1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

log_success() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_info() {
  echo -e "${BLUE}ℹ${NC} $1"
}

append_report() {
  echo "$1" >> "$REPORT_FILE"
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MAIN AUDIT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════════════╗"
echo "║          R3V4 PROJECT AUDIT — $(date +%Y-%m-%d)            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Initialize report
> "$REPORT_FILE"

append_report "# R3V4 Project Audit"
append_report ""
append_report "**Generated:** $(date)"
append_report ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. PROJECT STRUCTURE
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_header "1. PROJECT STRUCTURE"

if [ ! -d "$PROJECT_ROOT" ]; then
  log_error "Project directory not found: $PROJECT_ROOT"
  exit 1
fi

log_success "Project root: $PROJECT_ROOT"

append_report "## 1. Project Structure"
append_report ""
append_report "\`\`\`"
tree -L 3 -I "node_modules|.git|dist|build" "$PROJECT_ROOT" 2>/dev/null || find "$PROJECT_ROOT" -maxdepth 3 -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -type d | sort
append_report "\`\`\`"
append_report ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. CONFIGURATION FILES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_header "2. CONFIGURATION FILES"

append_report "## 2. Configuration Files"
append_report ""

check_config() {
  local file="$1"
  local name="$2"
  local path="$PROJECT_ROOT/$file"

  if [ -f "$path" ]; then
    log_success "$name found"
    append_report "### $name"
    append_report ""
    append_report "\`\`\`json"
    head -30 "$path" | append_report
    append_report "\`\`\`"
    append_report ""
  else
    log_warning "$name not found"
    append_report "### $name"
    append_report "⚠ Not found"
    append_report ""
  fi
}

check_config "package.json" "package.json"
check_config "pnpm-workspace.yaml" "pnpm-workspace.yaml"
check_config "tsconfig.json" "tsconfig.json"
check_config ".env" ".env (sanitized)"
check_config ".gitignore" ".gitignore"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. DEPENDENCIES
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_header "3. DEPENDENCIES"

append_report "## 3. Dependencies"
append_report ""

if [ -f "$PROJECT_ROOT/package.json" ]; then
  log_info "Analyzing package.json..."

  # Count dependencies
  DEP_COUNT=$(jq '.dependencies | length' "$PROJECT_ROOT/package.json" 2>/dev/null || echo "0")
  DEVDEP_COUNT=$(jq '.devDependencies | length' "$PROJECT_ROOT/package.json" 2>/dev/null || echo "0")

  log_info "Dependencies: $DEP_COUNT"
  log_info "Dev Dependencies: $DEVDEP_COUNT"

  append_report "### Dependencies"
  append_report "- **Total:** $DEP_COUNT"
  append_report "- **Dev:** $DEVDEP_COUNT"
  append_report ""

  append_report "### Key Dependencies"
  append_report "\`\`\`json"
  jq '.dependencies | keys[] | select(. | test("react|vue|vite|typescript|tailwind|stripe"))' "$PROJECT_ROOT/package.json" 2>/dev/null | while read -r dep; do
    VERSION=$(jq ".dependencies[$dep]" "$PROJECT_ROOT/package.json" 2>/dev/null)
    echo "$dep: $VERSION"
  done | append_report
  append_report "\`\`\`"
  append_report ""
else
  log_warning "package.json not found"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. FILE INVENTORY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_header "4. FILE INVENTORY"

append_report "## 4. File Inventory"
append_report ""

count_files() {
  local ext="$1"
  local name="$2"
  local count=$(find "$PROJECT_ROOT" -name "*.$ext" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | wc -l)
  
  if [ "$count" -gt 0 ]; then
    log_success "$name: $count files"
    append_report "- **$name:** $count"
  fi
}

count_files "ts" "TypeScript (.ts)"
count_files "tsx" "TypeScript React (.tsx)"
count_files "jsx" "JavaScript React (.jsx)"
count_files "js" "JavaScript (.js)"
count_files "json" "JSON (.json)"
count_files "css" "CSS (.css)"
count_files "scss" "SCSS (.scss)"
count_files "html" "HTML (.html)"

append_report ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. SOURCE CODE ANALYSIS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_header "5. SOURCE CODE ANALYSIS"

append_report "## 5. Source Code Analysis"
append_report ""

# Find src directory
if [ -d "$PROJECT_ROOT/src" ]; then
  log_success "Found /src directory"
  
  append_report "### Source Structure"
  append_report "\`\`\`"
  find "$PROJECT_ROOT/src" -maxdepth 3 -type d | head -20 | append_report
  append_report "\`\`\`"
  append_report ""

  # Check for common directories
  for dir in components pages hooks services utils types styles; do
    if [ -d "$PROJECT_ROOT/src/$dir" ]; then
      COUNT=$(find "$PROJECT_ROOT/src/$dir" -type f | wc -l)
      log_success "Found /src/$dir ($COUNT files)"
      append_report "- **src/$dir:** $COUNT files"
    fi
  done
  append_report ""
elif [ -d "$PROJECT_ROOT/client/src" ]; then
  log_success "Found /client/src directory"
  append_report "### Client Source"
  append_report "- Client source found at \`client/src/\`"
  append_report ""
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. AUTH INTEGRATION STATUS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_header "6. AUTH INTEGRATION STATUS"

append_report "## 6. Auth Integration Status"
append_report ""

check_auth_file() {
  local path="$1"
  local name="$2"
  
  if [ -f "$path" ]; then
    log_success "$name found at $path"
    append_report "- ✓ $name"
  else
    log_warning "$name not found at $path"
    append_report "- ✗ $name (missing)"
  fi
}

check_auth_file "$PROJECT_ROOT/client/public/auth.html" "auth.html deployment"
check_auth_file "$PROJECT_ROOT/src/services/authService.ts" "authService.ts"
check_auth_file "$PROJECT_ROOT/src/hooks/useAuth.ts" "useAuth hook"
check_auth_file "$PROJECT_ROOT/src/components/ProtectedRoute.tsx" "ProtectedRoute"

append_report ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. BUILD & DEPLOYMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_header "7. BUILD & DEPLOYMENT"

append_report "## 7. Build & Deployment"
append_report ""

# Check for build artifacts
if [ -d "$PROJECT_ROOT/dist" ]; then
  DIST_SIZE=$(du -sh "$PROJECT_ROOT/dist" | cut -f1)
  log_success "Build output found (size: $DIST_SIZE)"
  append_report "- **Build output:** Found ($DIST_SIZE)"
else
  log_info "No dist/ directory found (expected, not built yet)"
  append_report "- **Build output:** Not built"
fi

# Check for deployment config
check_deploy_config() {
  local file="$1"
  local name="$2"
  
  if [ -f "$PROJECT_ROOT/$file" ]; then
    log_success "$name found"
    append_report "- ✓ $name"
  fi
}

check_deploy_config "Dockerfile" "Docker"
check_deploy_config ".env.example" ".env.example"
check_deploy_config "railway.json" "Railway config"
check_deploy_config ".github/workflows" "GitHub Actions"

append_report ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 8. POTENTIAL ISSUES & RECOMMENDATIONS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_header "8. POTENTIAL ISSUES & RECOMMENDATIONS"

append_report "## 8. Potential Issues & Recommendations"
append_report ""

ISSUES=()
RECOMMENDATIONS=()

# Check Node version
if [ -f "$PROJECT_ROOT/.nvmrc" ]; then
  NODE_VERSION=$(cat "$PROJECT_ROOT/.nvmrc")
  log_info "Node version specified: $NODE_VERSION"
  append_report "- Node version: $NODE_VERSION"
else
  log_warning ".nvmrc not found"
  RECOMMENDATIONS+=("Create .nvmrc to pin Node version")
fi

# Check for environment variables
if [ -f "$PROJECT_ROOT/.env.example" ]; then
  log_success ".env.example found"
else
  log_warning ".env.example not found"
  RECOMMENDATIONS+=("Create .env.example for documentation")
fi

# Check git status
if [ -d "$PROJECT_ROOT/.git" ]; then
  UNCOMMITTED=$(cd "$PROJECT_ROOT" && git status --porcelain | wc -l)
  if [ "$UNCOMMITTED" -gt 0 ]; then
    log_warning "Uncommitted changes: $UNCOMMITTED files"
    append_report "- ⚠ Uncommitted changes: $UNCOMMITTED files"
  else
    log_success "Git working tree clean"
  fi
fi

append_report ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 9. SUMMARY & HEALTH CHECK
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

log_header "9. SUMMARY & HEALTH CHECK"

append_report "## 9. Summary"
append_report ""

# Calculate health score
HEALTH_SCORE=100

# Deductions for missing files
[ ! -f "$PROJECT_ROOT/package.json" ] && HEALTH_SCORE=$((HEALTH_SCORE - 20))
[ ! -f "$PROJECT_ROOT/.gitignore" ] && HEALTH_SCORE=$((HEALTH_SCORE - 10))
[ ! -f "$PROJECT_ROOT/.env.example" ] && HEALTH_SCORE=$((HEALTH_SCORE - 5))
[ ! -f "$PROJECT_ROOT/tsconfig.json" ] && HEALTH_SCORE=$((HEALTH_SCORE - 5))

append_report "**Project Health Score:** $HEALTH_SCORE/100"
append_report ""

if [ "$HEALTH_SCORE" -ge 80 ]; then
  log_success "Project health: GOOD ($HEALTH_SCORE/100)"
elif [ "$HEALTH_SCORE" -ge 60 ]; then
  log_warning "Project health: FAIR ($HEALTH_SCORE/100)"
else
  log_error "Project health: POOR ($HEALTH_SCORE/100)"
fi

append_report ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 10. NEXT STEPS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

append_report "## 10. Next Steps"
append_report ""
append_report "### Auth Integration"
append_report "1. Copy auth service files from \`/home/cloud/auth-integration/\` to your project"
append_report "2. Update \`src/App.tsx\` with the provided router configuration"
append_report "3. Add \`<AuthProvider>\` wrapper to your root component"
append_report "4. Test login at \`http://localhost:5173/auth\`"
append_report ""
append_report "### Testing"
append_report "- Add \`<AuthDebugger />\` to your app during development"
append_report "- Use the debug panel to test endpoints and token refresh"
append_report "- Check browser DevTools → Application → Local Storage for tokens"
append_report ""
append_report "### Deployment"
append_report "- Ensure environment variables are set in Railway/production"
append_report "- Test auth flow in staging before production"
append_report "- Monitor token refresh failures in production logs"
append_report ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# FINISH
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

echo ""
log_header "✨ AUDIT COMPLETE"

log_success "Full report saved to: $REPORT_FILE"
echo ""
log_info "Report location: $(pwd)/$REPORT_FILE"
echo ""

cat << "EOF"
╔════════════════════════════════════════════════════════════╗
║  Next: Review the audit report and follow integration     ║
║  steps. Use AuthDebugger component for testing.           ║
╚════════════════════════════════════════════════════════════╝
EOF

echo ""
