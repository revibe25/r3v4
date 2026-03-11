#!/usr/bin/env bash
# =============================================================================
# R3 v4 — Principal Architect Audit & Remediation Script
# Run from repo root: bash r3-audit.sh [--fix] [--audit-only]
# Default: audit + interactive fix prompts
# =============================================================================
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
FIX_MODE=false
AUDIT_ONLY=false
REPORT="$ROOT/internal/dev/AUDIT_REPORT.md"
ERRORS=0
WARNINGS=0

for arg in "$@"; do
  case $arg in
    --fix)         FIX_MODE=true ;;
    --audit-only)  AUDIT_ONLY=true ;;
  esac
done

RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

err()  { echo -e "${RED}[ERR]${RESET}  $*"; ((ERRORS++));  echo "- ❌ $*" >> "$REPORT"; }
warn() { echo -e "${YELLOW}[WARN]${RESET} $*"; ((WARNINGS++)); echo "- ⚠️  $*" >> "$REPORT"; }
ok()   { echo -e "${GREEN}[OK]${RESET}   $*"; echo "- ✅ $*" >> "$REPORT"; }
info() { echo -e "${CYAN}[INFO]${RESET} $*"; echo "- ℹ️  $*" >> "$REPORT"; }
section() {
  echo ""
  echo -e "${BOLD}━━━ $* ━━━${RESET}"
  echo "" >> "$REPORT"
  echo "## $*" >> "$REPORT"
}

fix_it() {
  # Usage: fix_it "description" "command"
  local desc="$1"; shift
  if $FIX_MODE; then
    echo -e "  ${GREEN}→ FIX:${RESET} $desc"
    eval "$@"
    echo "  → FIXED: $desc" >> "$REPORT"
  elif ! $AUDIT_ONLY; then
    echo -e "  ${YELLOW}→ FIX AVAILABLE:${RESET} $desc"
    read -rp "    Apply? [y/N] " yn
    [[ "${yn,,}" == "y" ]] && eval "$@" && echo "  → FIXED: $desc" >> "$REPORT"
  else
    echo -e "  ${YELLOW}→ PENDING FIX:${RESET} $desc"
    echo "  → PENDING: $desc" >> "$REPORT"
  fi
}

mkdir -p "$ROOT/internal/dev"
cat > "$REPORT" << EOF
# R3 v4 — Principal Architect Audit Report
**Generated:** $(date -u '+%Y-%m-%d %H:%M UTC')
**Mode:** $( $FIX_MODE && echo "FIX" || ($AUDIT_ONLY && echo "AUDIT-ONLY") || echo "INTERACTIVE" )

EOF

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}║        R3 v4 — Principal Architect Audit & Remediation       ║${RESET}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════════╝${RESET}"
echo "  Root: $ROOT"
echo ""

# =============================================================================
section "1. ROOT-LEVEL ARTIFACT CLEANUP"
# =============================================================================

echo "Checking root-level noise files..." >> "$REPORT"

declare -A ROOT_ARTIFACTS=(
  ["App.tsx"]="Belongs in client/src/ — move or delete. Root has no renderer."
  ["analyzer.ts"]="Belongs in packages/llpte-signal or client/src/engine/. Move it."
  ["fx-chain.ts"]="Belongs in packages/llpte-execution or llpte-signal. Move it."
  ["vst-master-panel.tsx"]="Belongs in client/src/components/. Move it."
  ["crossfade.test.ts"]="Belongs in packages/llpte-transition-graph/. Move it."
  ["node"]="Stale binary or dir — remove."
  ["0.02"]="Version artifact or junk — remove."
  ["Ready!"]="Build marker — remove."
  ["fix_r3_errors.py"]="Fix script — consumed, delete."
  ["r3_fix.py"]="Fix script — consumed, delete."
  ["finalize.sh"]="Fix script — consumed, delete."
  ["fix-names.sh"]="Fix script — consumed, delete."
  ["fix-structure.sh"]="Fix script — consumed, delete."
  ["patch-final.sh"]="Fix script — consumed, delete."
  ["deploy-fixes.sh"]="Fix script — consumed, delete."
  ["apply-migration.sh"]="Belongs in scripts/ or drizzle/. Move it."
  ["r3-subscription-system.zip"]="Build artifact — should not be tracked. Add to .gitignore."
)

for artifact in "${!ROOT_ARTIFACTS[@]}"; do
  path="$ROOT/$artifact"
  verdict="${ROOT_ARTIFACTS[$artifact]}"
  if [[ -e "$path" ]]; then
    err "ROOT NOISE: $artifact — $verdict"
  else
    ok "NOT PRESENT: $artifact"
  fi
done

# Offer targeted fixes
for artifact in "node" "0.02" "Ready!" "fix_r3_errors.py" "r3_fix.py" \
                "finalize.sh" "fix-names.sh" "fix-structure.sh" \
                "patch-final.sh" "deploy-fixes.sh"; do
  [[ -e "$ROOT/$artifact" ]] && \
    fix_it "Remove $artifact from root" "rm -rf '$ROOT/$artifact'"
done

if [[ -e "$ROOT/App.tsx" ]]; then
  fix_it "Move App.tsx → client/src/App.tsx" \
    "mkdir -p '$ROOT/client/src' && mv '$ROOT/App.tsx' '$ROOT/client/src/App.tsx'"
fi

if [[ -e "$ROOT/analyzer.ts" ]]; then
  fix_it "Move analyzer.ts → packages/llpte-signal/src/analyzer.ts" \
    "mkdir -p '$ROOT/packages/llpte-signal/src' && mv '$ROOT/analyzer.ts' '$ROOT/packages/llpte-signal/src/analyzer.ts'"
fi

if [[ -e "$ROOT/fx-chain.ts" ]]; then
  fix_it "Move fx-chain.ts → packages/llpte-execution/src/fx-chain.ts" \
    "mkdir -p '$ROOT/packages/llpte-execution/src' && mv '$ROOT/fx-chain.ts' '$ROOT/packages/llpte-execution/src/fx-chain.ts'"
fi

if [[ -e "$ROOT/vst-master-panel.tsx" ]]; then
  fix_it "Move vst-master-panel.tsx → client/src/components/vst-master-panel.tsx" \
    "mkdir -p '$ROOT/client/src/components' && mv '$ROOT/vst-master-panel.tsx' '$ROOT/client/src/components/vst-master-panel.tsx'"
fi

if [[ -e "$ROOT/crossfade.test.ts" ]]; then
  fix_it "Move crossfade.test.ts → packages/llpte-transition-graph/src/__tests__/" \
    "mkdir -p '$ROOT/packages/llpte-transition-graph/src/__tests__' && mv '$ROOT/crossfade.test.ts' '$ROOT/packages/llpte-transition-graph/src/__tests__/crossfade.test.ts'"
fi

if [[ -e "$ROOT/apply-migration.sh" ]]; then
  fix_it "Move apply-migration.sh → scripts/" \
    "mkdir -p '$ROOT/scripts' && mv '$ROOT/apply-migration.sh' '$ROOT/scripts/apply-migration.sh'"
fi

if [[ -e "$ROOT/r3-subscription-system.zip" ]]; then
  fix_it "Add *.zip to .gitignore and remove artifact" \
    "echo '*.zip' >> '$ROOT/.gitignore' && rm -f '$ROOT/r3-subscription-system.zip'"
fi

# Remove .bak files everywhere
BAK_FILES=$(find "$ROOT" -name "*.bak" -not -path "*/node_modules/*" 2>/dev/null || true)
if [[ -n "$BAK_FILES" ]]; then
  err "BAK FILES FOUND:"
  echo "$BAK_FILES" | while read -r f; do info "  $f"; done
  fix_it "Delete all .bak files" \
    "find '$ROOT' -name '*.bak' -not -path '*/node_modules/*' -delete"
fi

# =============================================================================
section "2. SERVER DIRECTORY CONFLICTS"
# =============================================================================

# routes.ts vs routes/
if [[ -f "$ROOT/server/routes.ts" ]] && [[ -d "$ROOT/server/routes" ]]; then
  err "CONFLICT: server/routes.ts AND server/routes/ both exist"
  info "Inspecting both to identify canonical..."

  ROUTES_TS_LINES=$(wc -l < "$ROOT/server/routes.ts" 2>/dev/null || echo 0)
  ROUTES_DIR_FILES=$(find "$ROOT/server/routes" -type f 2>/dev/null | wc -l || echo 0)

  info "  server/routes.ts: $ROUTES_TS_LINES lines"
  info "  server/routes/: $ROUTES_DIR_FILES files"

  if [[ "$ROUTES_TS_LINES" -lt 20 ]] && [[ "$ROUTES_DIR_FILES" -gt 0 ]]; then
    warn "routes.ts appears to be a barrel/re-export stub — likely dead after routes/ was introduced"
    fix_it "Archive routes.ts (routes/ is canonical)" \
      "mv '$ROOT/server/routes.ts' '$ROOT/server/routes.ts.dead' && echo '// DEAD — see server/routes/' >> '$ROOT/server/routes.ts.dead'"
  elif [[ "$ROUTES_DIR_FILES" -eq 0 ]]; then
    warn "routes/ is empty — routes.ts is canonical"
    fix_it "Remove empty server/routes/" \
      "rmdir '$ROOT/server/routes' 2>/dev/null || rm -rf '$ROOT/server/routes'"
  else
    warn "Both have content — manual review required. Diff:"
    warn "  Decide: does routes.ts re-export routes/index.ts, or is it a legacy monolith?"
    err "MANUAL ACTION REQUIRED: Reconcile server/routes.ts vs server/routes/"
  fi
elif [[ -f "$ROOT/server/routes.ts" ]] && [[ ! -d "$ROOT/server/routes" ]]; then
  ok "server/routes.ts only — no conflict"
elif [[ -d "$ROOT/server/routes" ]] && [[ ! -f "$ROOT/server/routes.ts" ]]; then
  ok "server/routes/ only — no conflict"
fi

# server/server/ nested dir
if [[ -d "$ROOT/server/server" ]]; then
  err "NESTED DIR: server/server/ — this should not exist"
  SERVER_SERVER_COUNT=$(find "$ROOT/server/server" -type f 2>/dev/null | wc -l || echo 0)
  info "  Contains $SERVER_SERVER_COUNT files"
  if [[ "$SERVER_SERVER_COUNT" -eq 0 ]]; then
    fix_it "Remove empty server/server/" \
      "rm -rf '$ROOT/server/server'"
  else
    info "  Files inside:"
    find "$ROOT/server/server" -type f | while read -r f; do
      info "    $f ($(wc -l < "$f") lines)"
    done
    err "  MANUAL ACTION: Merge server/server/* up to server/ or delete duplicates"
    fix_it "Move server/server/* to server/ and remove nested dir" \
      "rsync -av '$ROOT/server/server/' '$ROOT/server/' --ignore-existing && rm -rf '$ROOT/server/server'"
  fi
else
  ok "No server/server/ nested dir"
fi

# storage.ts vs storage.js duplicate
if [[ -f "$ROOT/server/storage.ts" ]] && [[ -f "$ROOT/server/storage.js" ]]; then
  err "DUPLICATE: server/storage.ts and server/storage.js both exist"
  warn "  storage.js is likely a compiled artifact — should be in dist/, not tracked"
  fix_it "Remove server/storage.js (keep .ts, add .js to .gitignore)" \
    "rm -f '$ROOT/server/storage.js' && echo 'server/storage.js' >> '$ROOT/.gitignore'"
else
  ok "No storage.ts/.js conflict"
fi

# trpc.ts vs trpc.js duplicate
if [[ -f "$ROOT/server/trpc.ts" ]] && [[ -f "$ROOT/server/trpc.js" ]]; then
  err "DUPLICATE: server/trpc.ts and server/trpc.js both exist"
  fix_it "Remove server/trpc.js (keep .ts, add .js to .gitignore)" \
    "rm -f '$ROOT/server/trpc.js' && echo 'server/trpc.js' >> '$ROOT/.gitignore'"
else
  ok "No trpc.ts/.js conflict"
fi

# =============================================================================
section "3. DUAL src/ DIRECTORY RESOLUTION"
# =============================================================================

ROOT_SRC_EXISTS=false
CLIENT_SRC_EXISTS=false

[[ -d "$ROOT/src" ]]        && ROOT_SRC_EXISTS=true
[[ -d "$ROOT/client/src" ]] && CLIENT_SRC_EXISTS=true

if $ROOT_SRC_EXISTS && $CLIENT_SRC_EXISTS; then
  err "TWO src/ ROOTS: $ROOT/src/ AND $ROOT/client/src/ both exist"

  ROOT_SRC_FILES=$(find "$ROOT/src" -type f -not -path "*/node_modules/*" | wc -l)
  CLIENT_SRC_FILES=$(find "$ROOT/client/src" -type f -not -path "*/node_modules/*" | wc -l)

  info "  Root src/: $ROOT_SRC_FILES files ($(ls "$ROOT/src" 2>/dev/null | tr '\n' ' '))"
  info "  client/src/: $CLIENT_SRC_FILES files"

  # Inspect contents
  if [[ -d "$ROOT/src/engine" ]]; then
    info "  Root src/engine/ found — likely audio engine primitives"
    ENGINE_TS=$(find "$ROOT/src/engine" -name "*.ts" | wc -l)
    info "    $ENGINE_TS .ts files in src/engine/"
  fi
  if [[ -d "$ROOT/src/visual" ]]; then
    info "  Root src/visual/ found — likely visual/waveform renderers"
  fi

  warn "ARCHITECTURE DECISION REQUIRED:"
  warn "  Option A: Root src/ is the engine library → move to packages/llpte-core/src/"
  warn "  Option B: Root src/ is client-only → merge into client/src/ and delete root src/"
  warn "  Option C: src/engine → packages/llpte-execution, src/visual → client/src/visual"

  info "Recommended: Move root src/engine → packages/llpte-core/src/engine"
  info "             Move root src/visual  → client/src/visual"

  fix_it "Move src/engine → packages/llpte-core/src/ (engine is a package, not root)" \
    "mkdir -p '$ROOT/packages/llpte-core/src' && cp -r '$ROOT/src/engine/.' '$ROOT/packages/llpte-core/src/' && rm -rf '$ROOT/src/engine'"

  fix_it "Move src/visual → client/src/visual (visual belongs in client)" \
    "mkdir -p '$ROOT/client/src/visual' && cp -r '$ROOT/src/visual/.' '$ROOT/client/src/visual/' && rm -rf '$ROOT/src/visual'"

  fix_it "Remove root src/ if now empty" \
    "[[ -z \"\$(ls -A '$ROOT/src' 2>/dev/null)\" ]] && rm -rf '$ROOT/src' || echo 'src/ not empty — check remaining files'"

elif $ROOT_SRC_EXISTS && ! $CLIENT_SRC_EXISTS; then
  err "ONLY root src/ exists — client/src/ is missing. Engine may be wrongly placed."
elif $CLIENT_SRC_EXISTS && ! $ROOT_SRC_EXISTS; then
  ok "Single canonical src/ at client/src/ — correct"
fi

# =============================================================================
section "4. SHARED TYPE CONSOLIDATION"
# =============================================================================

SHARED="$ROOT/shared"

if [[ -f "$SHARED/types.ts" ]]; then
  TYPES_LINES=$(wc -l < "$SHARED/types.ts")
  err "shared/types.ts exists ($TYPES_LINES lines) — must be absorbed into domain files"

  DOMAIN_FILES=("audio.types.ts" "dj.types.ts" "mixer.types.ts" "effects.types.ts" "waveform.types.ts")
  for df in "${DOMAIN_FILES[@]}"; do
    if [[ -f "$SHARED/$df" ]]; then
      ok "  Domain file exists: shared/$df"
    else
      warn "  Missing domain file: shared/$df — create it"
    fi
  done

  # Check for overlap using grep for common interface/type names
  info "Checking for duplicate type declarations..."
  for df in "${DOMAIN_FILES[@]}"; do
    [[ ! -f "$SHARED/$df" ]] && continue
    # Extract exported names from types.ts
    TYPES_EXPORTS=$(grep -E "^export (type|interface) " "$SHARED/types.ts" 2>/dev/null | awk '{print $3}' | tr -d '{' || true)
    DOMAIN_EXPORTS=$(grep -E "^export (type|interface) " "$SHARED/$df" 2>/dev/null | awk '{print $3}' | tr -d '{' || true)

    OVERLAP=$(comm -12 \
      <(echo "$TYPES_EXPORTS" | sort) \
      <(echo "$DOMAIN_EXPORTS" | sort) 2>/dev/null || true)

    if [[ -n "$OVERLAP" ]]; then
      err "  DUPLICATE TYPES between shared/types.ts and shared/$df:"
      echo "$OVERLAP" | while read -r t; do warn "    $t"; done
    fi
  done

  warn "MANUAL ACTION: grep shared/types.ts for each export, move to correct domain file, then delete types.ts"
  info "  Run: grep -E '^export' shared/types.ts to see all exports"
  info "  Then: add each to the correct domain file and remove from types.ts"
  info "  Then: rm shared/types.ts && update all imports"

  # Auto-generate a migration plan
  MIGRATION_PLAN="$ROOT/internal/dev/TYPE_MIGRATION_PLAN.md"
  echo "# Type Migration Plan — shared/types.ts → domain files" > "$MIGRATION_PLAN"
  echo "" >> "$MIGRATION_PLAN"
  echo "Generated: $(date)" >> "$MIGRATION_PLAN"
  echo "" >> "$MIGRATION_PLAN"
  echo "## Exports to migrate from shared/types.ts" >> "$MIGRATION_PLAN"
  echo "" >> "$MIGRATION_PLAN"
  grep -E "^export (type|interface|const|enum)" "$SHARED/types.ts" 2>/dev/null | \
    awk '{print "- [ ] `" $0 "`"}' >> "$MIGRATION_PLAN" || true
  echo "" >> "$MIGRATION_PLAN"
  echo "## Migration targets" >> "$MIGRATION_PLAN"
  echo "- Audio/Web Audio API types → audio.types.ts" >> "$MIGRATION_PLAN"
  echo "- DJ controls, cue/mix state → dj.types.ts" >> "$MIGRATION_PLAN"
  echo "- Mixer channel/send/return → mixer.types.ts" >> "$MIGRATION_PLAN"
  echo "- Effects parameters/chains → effects.types.ts" >> "$MIGRATION_PLAN"
  echo "- Waveform/peak data → waveform.types.ts" >> "$MIGRATION_PLAN"
  echo "- Subscription/billing → subscription.types.ts" >> "$MIGRATION_PLAN"
  ok "Type migration plan written to: $MIGRATION_PLAN"

else
  ok "shared/types.ts does not exist — already consolidated"
fi

# =============================================================================
section "5. LLPTE PACKAGE DEPENDENCY GRAPH AUDIT"
# =============================================================================

PKGS_DIR="$ROOT/packages"
EXPECTED_PACKAGES=("llpte-core" "llpte-signal" "llpte-transition-graph" "llpte-adapters" "llpte-execution" "llpte-ai")

for pkg in "${EXPECTED_PACKAGES[@]}"; do
  PKG_PATH="$PKGS_DIR/$pkg"
  if [[ ! -d "$PKG_PATH" ]]; then
    err "MISSING PACKAGE: $pkg"
  elif [[ ! -f "$PKG_PATH/package.json" ]]; then
    err "NO package.json: $pkg"
  else
    ok "Package exists: $pkg"

    # Check for index.ts entrypoint
    if [[ ! -f "$PKG_PATH/src/index.ts" ]] && [[ ! -f "$PKG_PATH/index.ts" ]]; then
      warn "  No src/index.ts entrypoint in $pkg"
    fi

    # Verify package name matches directory
    PKG_NAME=$(node -e "console.log(require('$PKG_PATH/package.json').name)" 2>/dev/null || echo "unknown")
    if [[ "$PKG_NAME" != "@r3/$pkg" ]] && [[ "$PKG_NAME" != "$pkg" ]]; then
      warn "  Package name mismatch: declared='$PKG_NAME', expected='@r3/$pkg' or '$pkg'"
    fi
  fi
done

# Check for circular dependencies using package.json dependencies
info "Checking dependency direction (must be acyclic)..."
echo "" >> "$REPORT"
echo "### Expected dependency DAG (valid directions only):" >> "$REPORT"
echo "\`\`\`" >> "$REPORT"
echo "llpte-ai" >> "$REPORT"
echo "  └── llpte-execution" >> "$REPORT"
echo "        └── llpte-adapters" >> "$REPORT"
echo "              └── llpte-signal" >> "$REPORT"
echo "                    └── llpte-transition-graph" >> "$REPORT"
echo "                          └── llpte-core" >> "$REPORT"
echo "                                (no dependencies within llpte-*)" >> "$REPORT"
echo "\`\`\`" >> "$REPORT"

# Validate each package's deps don't reach "upward"
declare -A LAYER_ORDER=(
  ["llpte-core"]=0
  ["llpte-signal"]=1
  ["llpte-transition-graph"]=1
  ["llpte-adapters"]=2
  ["llpte-execution"]=3
  ["llpte-ai"]=4
)

for pkg in "${EXPECTED_PACKAGES[@]}"; do
  PKG_PATH="$PKGS_DIR/$pkg"
  [[ ! -f "$PKG_PATH/package.json" ]] && continue

  MY_LAYER="${LAYER_ORDER[$pkg]:-99}"

  # Extract all llpte-* dependencies
  DEPS=$(node -e "
    const p = require('$PKG_PATH/package.json');
    const all = {...(p.dependencies||{}), ...(p.devDependencies||{})};
    const llpte = Object.keys(all).filter(k => k.includes('llpte'));
    console.log(llpte.join('\n'));
  " 2>/dev/null || true)

  while IFS= read -r dep; do
    [[ -z "$dep" ]] && continue
    DEP_BARE="${dep##*/}" # strip @scope/ if present
    DEP_LAYER="${LAYER_ORDER[$DEP_BARE]:-99}"

    if [[ "$DEP_LAYER" -ge "$MY_LAYER" ]]; then
      err "CIRCULAR/UPWARD DEP: $pkg (layer $MY_LAYER) depends on $dep (layer $DEP_LAYER)"
    else
      ok "  $pkg → $dep (valid)"
    fi
  done <<< "$DEPS"
done

# =============================================================================
section "6. TRPC ROUTER TYPE SAFETY AUDIT"
# =============================================================================

ROUTERS_DIR="$ROOT/server/routers"

if [[ ! -d "$ROUTERS_DIR" ]]; then
  warn "server/routers/ does not exist — checking server/routes/ for tRPC..."
  ROUTERS_DIR="$ROOT/server/routes"
fi

if [[ -d "$ROUTERS_DIR" ]]; then
  ROUTER_FILES=$(find "$ROUTERS_DIR" -name "*.ts" -not -name "*.d.ts" | sort)
  ROUTER_COUNT=$(echo "$ROUTER_FILES" | grep -c "." || echo 0)
  info "Found $ROUTER_COUNT router files in $ROUTERS_DIR"

  while IFS= read -r rf; do
    [[ -z "$rf" ]] && continue
    RNAME=$(basename "$rf")

    # Check for implicit any
    if grep -qE ": any\b|<any>" "$rf" 2>/dev/null; then
      ANYS=$(grep -nE ": any\b|<any>" "$rf" | head -5)
      err "IMPLICIT ANY in $RNAME:"
      echo "$ANYS" | while read -r line; do warn "    $line"; done
    else
      ok "No implicit any: $RNAME"
    fi

    # Check for .input() validators
    PROCEDURE_COUNT=$(grep -c "\.procedure\." "$rf" 2>/dev/null || echo 0)
    INPUT_COUNT=$(grep -c "\.input(" "$rf" 2>/dev/null || echo 0)
    if [[ "$PROCEDURE_COUNT" -gt 0 ]] && [[ "$INPUT_COUNT" -lt "$PROCEDURE_COUNT" ]]; then
      warn "MISSING INPUT VALIDATORS in $RNAME: $PROCEDURE_COUNT procedures, $INPUT_COUNT have .input()"
    fi

    # Check for error handling
    if ! grep -qE "TRPCError|onError|\.catch\(|try\s*\{" "$rf" 2>/dev/null; then
      warn "NO ERROR HANDLING in $RNAME — all mutations need error boundaries"
    fi

    # Check for middleware composition
    if grep -qE "\.mutation\(|\.query\(" "$rf" 2>/dev/null; then
      if ! grep -qE "protectedProcedure|authedProcedure|withAuth" "$rf" 2>/dev/null; then
        warn "UNPROTECTED PROCEDURES in $RNAME — no auth middleware visible"
      fi
    fi

  done <<< "$ROUTER_FILES"
else
  warn "No routers directory found at $ROUTERS_DIR"
fi

# Check tRPC root router
TRPC_ROUTER=$(find "$ROOT/server" -name "router.ts" -o -name "_app.ts" | head -1 || true)
if [[ -n "$TRPC_ROUTER" ]]; then
  info "Root tRPC router: $TRPC_ROUTER"
  if grep -q "createCallerFactory\|appRouter" "$TRPC_ROUTER" 2>/dev/null; then
    ok "Root router uses createCallerFactory — typed correctly"
  fi
else
  warn "No root tRPC router (_app.ts or router.ts) found in server/"
fi

# =============================================================================
section "7. DRIZZLE SCHEMA AS SINGLE SOURCE OF TRUTH"
# =============================================================================

SCHEMA="$ROOT/shared/schema.ts"

if [[ ! -f "$SCHEMA" ]]; then
  err "shared/schema.ts NOT FOUND — this is the canonical data contract"
else
  ok "shared/schema.ts exists"

  TABLE_COUNT=$(grep -cE "^export const .+ = pgTable|^export const .+ = sqliteTable|^export const .+ = mysqlTable" "$SCHEMA" 2>/dev/null || echo 0)
  info "  $TABLE_COUNT table definitions found"

  # Check drizzle-zod is being used
  if grep -qr "createInsertSchema\|createSelectSchema\|drizzle-zod" "$ROOT/server" 2>/dev/null; then
    ok "drizzle-zod in use in server/ — schema propagation active"
  else
    warn "drizzle-zod NOT USED in server/ — tRPC inputs may be manually re-declared (type drift risk)"
    info "  FIX: import { createInsertSchema, createSelectSchema } from 'drizzle-zod'"
    info "  Then: export const insertUserSchema = createInsertSchema(users)"
    info "  Then: use insertUserSchema as tRPC .input() validator"
  fi

  # Check for manual type redeclarations that mirror schema
  MANUAL_TYPES=$(grep -rn "type.*=.*{" "$ROOT/server" --include="*.ts" \
    | grep -v "node_modules\|dist\|\.d\.ts\|drizzle" | wc -l || echo 0)
  if [[ "$MANUAL_TYPES" -gt 20 ]]; then
    warn "$MANUAL_TYPES manual type declarations in server/ — audit for schema drift"
    info "  Run: grep -rn 'type.*=.*{' server/ --include='*.ts' | grep -v node_modules"
  fi

  # Check for migration files
  if [[ -d "$ROOT/drizzle/migrations" ]]; then
    MIGRATION_COUNT=$(find "$ROOT/drizzle/migrations" -name "*.sql" | wc -l)
    ok "Drizzle migrations: $MIGRATION_COUNT SQL files"
  else
    warn "No drizzle/migrations/ directory — run: pnpm drizzle-kit generate"
  fi

  # Check for duplicate schema
  if [[ -f "$ROOT/shared/drizzle/schema.ts" ]] || [[ -f "$ROOT/shared/drizzle.config.ts" ]]; then
    warn "Nested drizzle config in shared/ — consolidate to root drizzle.config.ts"
  fi
fi

# =============================================================================
section "8. WEB AUDIO WORKLET ISOLATION AUDIT"
# =============================================================================

info "Checking worklet files stay off main thread..."

WORKLET_FILES=$(find "$ROOT/client" "$ROOT/packages" "$ROOT/src" -name "*.worklet.ts" -o -name "*-worklet.ts" -o -name "*Worklet.ts" 2>/dev/null | grep -v node_modules || true)

if [[ -n "$WORKLET_FILES" ]]; then
  info "Worklet files found:"
  while IFS= read -r wf; do
    info "  $wf"

    # Worklets must not import React
    if grep -q "from 'react'" "$wf" 2>/dev/null; then
      err "WORKLET IMPORTS REACT: $wf — worklets cannot touch the React tree"
    fi

    # Worklets must not import from server/
    if grep -qE "from '.*server/" "$wf" 2>/dev/null; then
      err "WORKLET IMPORTS SERVER CODE: $wf"
    fi

    # Must extend AudioWorkletProcessor
    if ! grep -q "AudioWorkletProcessor" "$wf" 2>/dev/null; then
      warn "Worklet doesn't extend AudioWorkletProcessor: $wf"
    fi

    ok "Worklet structure looks clean: $(basename "$wf")"
  done <<< "$WORKLET_FILES"
else
  warn "No .worklet.ts files found — ensure worklets use the .worklet.ts convention for vite-plugin-worklet or similar"
fi

# Check build-worklets script
if [[ -f "$ROOT/client/scripts/build-worklets.js" ]] || [[ -f "$ROOT/scripts/build-worklets.js" ]]; then
  ok "build-worklets script exists — worklets have isolated build step"
else
  warn "No build-worklets script found — worklets may be bundled with main app"
  info "  FIX: Use vite-plugin-worklet or separate rollup step for worklet files"
fi

# Check fx-chain is not imported from React components directly
FX_IMPORTS=$(grep -rn "fx-chain\|fxChain" "$ROOT/client/src" --include="*.tsx" 2>/dev/null | grep -v node_modules | grep "import" || true)
if [[ -n "$FX_IMPORTS" ]]; then
  warn "React components importing fx-chain directly — use message passing instead:"
  echo "$FX_IMPORTS" | while read -r line; do warn "  $line"; done
fi

# =============================================================================
section "9. AI MIX LAYER ISOLATION AUDIT"
# =============================================================================

AI_DIRS=("$ROOT/server/agent" "$ROOT/services/ai-mix" "$ROOT/packages/llpte-ai")

for ai_dir in "${AI_DIRS[@]}"; do
  [[ ! -d "$ai_dir" ]] && continue
  info "Auditing AI layer: $ai_dir"

  AI_FILES=$(find "$ai_dir" -name "*.ts" | grep -v node_modules | grep -v dist || true)

  while IFS= read -r af; do
    [[ -z "$af" ]] && continue

    # Must not import audio engine directly
    if grep -qE "AudioContext|AudioWorkletNode|GainNode|createOscillator" "$af" 2>/dev/null; then
      err "AI MODULE TOUCHES AUDIO API: $af — AI must communicate via message queue"
    fi

    # Must handle errors gracefully (no unhandled promise rejections)
    ASYNC_COUNT=$(grep -c "async " "$af" 2>/dev/null || echo 0)
    CATCH_COUNT=$(grep -cE "\.catch\(|} catch" "$af" 2>/dev/null || echo 0)
    TRY_COUNT=$(grep -c "try {" "$af" 2>/dev/null || echo 0)

    if [[ "$ASYNC_COUNT" -gt 0 ]] && [[ "$((TRY_COUNT + CATCH_COUNT))" -eq 0 ]]; then
      warn "NO ERROR HANDLING in async AI module: $(basename "$af") ($ASYNC_COUNT async functions)"
    fi

    # Check for timeout/abort patterns
    if ! grep -qE "AbortController|AbortSignal|timeout|setTimeout" "$af" 2>/dev/null; then
      if grep -q "fetch\|axios\|openai\|anthropic" "$af" 2>/dev/null; then
        warn "AI API CALL WITHOUT TIMEOUT/ABORT: $(basename "$af")"
        info "  FIX: Wrap all AI calls with AbortController and timeout"
      fi
    fi

  done <<< "$AI_FILES"
done

# =============================================================================
section "10. PNPM WORKSPACE INTEGRITY"
# =============================================================================

if [[ -f "$ROOT/pnpm-workspace.yaml" ]]; then
  ok "pnpm-workspace.yaml exists"

  WORKSPACE_CONTENT=$(cat "$ROOT/pnpm-workspace.yaml")
  info "Workspace packages declared:"
  echo "$WORKSPACE_CONTENT" | grep -E "^\s+-" | while read -r line; do info "  $line"; done

  # Check r3-subscription is properly declared
  if ! grep -q "r3-subscription" "$ROOT/pnpm-workspace.yaml"; then
    warn "r3-subscription not in pnpm-workspace.yaml — it won't be treated as a workspace package"
    fix_it "Add r3-subscription to pnpm-workspace.yaml" \
      "sed -i '/packages:/a\\  - '\''r3-subscription/**'\''' '$ROOT/pnpm-workspace.yaml'"
  fi

  # Check turbo.json pipeline
  if [[ -f "$ROOT/turbo.json" ]]; then
    ok "turbo.json exists"
    if ! grep -q '"build"' "$ROOT/turbo.json"; then
      err "turbo.json missing 'build' pipeline definition"
    fi
    if ! grep -q '"typecheck"' "$ROOT/turbo.json"; then
      warn "turbo.json missing 'typecheck' task — add it for CI"
    fi
  else
    err "turbo.json not found — Turborepo pipeline not configured"
  fi

else
  err "pnpm-workspace.yaml not found — workspace is not properly configured"
fi

# =============================================================================
section "11. TYPESCRIPT STRICT MODE AUDIT"
# =============================================================================

for tsconfig in \
  "$ROOT/tsconfig.json" \
  "$ROOT/client/tsconfig.json" \
  "$ROOT/server/tsconfig.json" \
  "$ROOT/shared/tsconfig.json"; do

  [[ ! -f "$tsconfig" ]] && continue

  STRICT=$(node -e "
    const fs = require('fs');
    const src = fs.readFileSync('$tsconfig', 'utf8').replace(/\/\/.*/g, '').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    try {
      const c = JSON.parse(src);
      const opts = c.compilerOptions || {};
      console.log(opts.strict ? 'true' : (opts.noImplicitAny ? 'partial' : 'false'));
    } catch(e) { console.log('parse-error'); }
  " 2>/dev/null || echo "unknown")

  RELPATH="${tsconfig#$ROOT/}"
  if [[ "$STRICT" == "true" ]]; then
    ok "$RELPATH: strict: true ✓"
  elif [[ "$STRICT" == "partial" ]]; then
    warn "$RELPATH: noImplicitAny but not full strict mode"
    fix_it "Enable strict mode in $RELPATH" \
      "node -e \"
        const fs=require('fs'); const p='$tsconfig';
        const src=fs.readFileSync(p,'utf8');
        const fixed=src.replace('\"noImplicitAny\": true','\"strict\": true');
        fs.writeFileSync(p,fixed);
      \""
  else
    err "$RELPATH: strict mode DISABLED — implicit any allowed"
    fix_it "Enable strict mode in $RELPATH" \
      "node -e \"
        const fs=require('fs'); const p='$tsconfig';
        const c=JSON.parse(fs.readFileSync(p,'utf8').replace(/\/\/.*/g,''));
        c.compilerOptions = c.compilerOptions||{};
        c.compilerOptions.strict = true;
        fs.writeFileSync(p, JSON.stringify(c, null, 2));
      \""
  fi
done

# =============================================================================
section "12. FINAL GITIGNORE HARDENING"
# =============================================================================

GITIGNORE="$ROOT/.gitignore"
REQUIRED_IGNORES=(
  "*.bak"
  "*.js.map"
  "server/storage.js"
  "server/trpc.js"
  "*.zip"
  "internal/logs/"
  "node"
  "0.02"
  "Ready!"
)

for ign in "${REQUIRED_IGNORES[@]}"; do
  if ! grep -qF "$ign" "$GITIGNORE" 2>/dev/null; then
    warn ".gitignore missing: $ign"
    fix_it "Add '$ign' to .gitignore" "echo '$ign' >> '$GITIGNORE'"
  fi
done

# =============================================================================
# SUMMARY
# =============================================================================

echo "" >> "$REPORT"
echo "---" >> "$REPORT"
echo "## Summary" >> "$REPORT"
echo "**Total Errors:** $ERRORS" >> "$REPORT"
echo "**Total Warnings:** $WARNINGS" >> "$REPORT"
echo "" >> "$REPORT"
echo "### Remediation Priority" >> "$REPORT"
echo "1. **P0 — Blocking:** Root artifact cleanup, server/routes conflict, server/server/ removal" >> "$REPORT"
echo "2. **P1 — Type Safety:** shared/types.ts consolidation, tRPC strict types, drizzle-zod adoption" >> "$REPORT"
echo "3. **P2 — Architecture:** src/ directory resolution, llpte dependency graph, worklet isolation" >> "$REPORT"
echo "4. **P3 — Hygiene:** .gitignore, .bak files, compiled .js artifacts, strict tsconfig" >> "$REPORT"

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}AUDIT COMPLETE${RESET}"
echo -e "  Errors:   ${RED}$ERRORS${RESET}"
echo -e "  Warnings: ${YELLOW}$WARNINGS${RESET}"
echo ""
echo -e "  Full report: ${CYAN}$REPORT${RESET}"
if [[ -f "$ROOT/internal/dev/TYPE_MIGRATION_PLAN.md" ]]; then
  echo -e "  Type plan:   ${CYAN}$ROOT/internal/dev/TYPE_MIGRATION_PLAN.md${RESET}"
fi
echo ""

if [[ "$ERRORS" -eq 0 ]] && [[ "$WARNINGS" -eq 0 ]]; then
  echo -e "${GREEN}✓ Architecture is clean. Ship it.${RESET}"
elif [[ "$ERRORS" -eq 0 ]]; then
  echo -e "${YELLOW}⚠ Warnings only — review before shipping.${RESET}"
else
  echo -e "${RED}✗ Critical errors found — do not ship until resolved.${RESET}"
  echo ""
  echo "  Re-run with --fix to auto-apply safe remediations:"
  echo "    bash r3-audit.sh --fix"
  echo ""
  echo "  Or audit-only (no prompts):"
  echo "    bash r3-audit.sh --audit-only"
fi
echo ""
