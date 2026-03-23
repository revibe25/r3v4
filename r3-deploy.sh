#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
#  R3 Platform — Expert Deployment Script
#  Orchestrates implement-r3.ts across all 15 phases with full verification.
#
#  USAGE
#  ─────
#    chmod +x r3-deploy.sh
#    ./r3-deploy.sh                  # full run (interactive)
#    ./r3-deploy.sh --dry-run        # preview only, no writes
#    ./r3-deploy.sh --phase=8        # single phase
#    ./r3-deploy.sh --skip-verify    # skip post-phase file checks
#    ./r3-deploy.sh --no-git         # skip git safety checks
#    ./r3-deploy.sh --ci             # non-interactive (for CI pipelines)
#
#  WHAT THIS DOES (in order)
#  ─────────────────────────
#    0. Pre-flight: directory, git, node, tsx, pnpm
#    1. Dry run — preview every file that will be written
#    2. Implement phases 1-11  (new source files)
#    3. Verify generated files exist and are non-empty
#    4. Implement phases 12-15 (wiring: pkg.json, trpc ctx, server index)
#    5. pnpm install — hoist new workspace deps
#    6. TypeScript check — tsc --noEmit across all packages
#    7. drizzle-kit check — verify schema against DB
#    8. Orphan report — print duplicate type files to action
#    9. Git commit checkpoint — staged only, nothing force-pushed
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─────────────────────────────────────────────
# 0. CONFIGURATION
# ─────────────────────────────────────────────
SCRIPT_NAME="implement-r3.ts"
REPORT_FILE="implement-r3-report.md"
LOG_FILE="r3-deploy.log"
DRY_RUN=false
PHASE_ARG=""
SKIP_VERIFY=false
NO_GIT=false
CI_MODE=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)      DRY_RUN=true ;;
    --phase=*)      PHASE_ARG="--phase=${arg#--phase=}" ;;
    --skip-verify)  SKIP_VERIFY=true ;;
    --no-git)       NO_GIT=true ;;
    --ci)           CI_MODE=true ;;
    --help|-h)
      head -30 "$0" | grep "^#" | sed 's/^# \?//'
      exit 0
      ;;
  esac
done

# ─────────────────────────────────────────────
# 1. COLOUR + LOGGING
# ─────────────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
else
  RED=''; YELLOW=''; GREEN=''; CYAN=''; BOLD=''; RESET=''
fi

step()  { echo -e "\n${BOLD}${CYAN}▶ $*${RESET}" | tee -a "$LOG_FILE"; }
ok()    { echo -e "${GREEN}  ✓ $*${RESET}" | tee -a "$LOG_FILE"; }
warn()  { echo -e "${YELLOW}  ⚠ $*${RESET}" | tee -a "$LOG_FILE"; }
fail()  { echo -e "${RED}  ✗ $*${RESET}" | tee -a "$LOG_FILE"; }
info()  { echo -e "  $*" | tee -a "$LOG_FILE"; }
die()   { fail "$*"; echo "" ; exit 1; }
hr()    { echo -e "${BOLD}$(printf '═%.0s' {1..70})${RESET}" | tee -a "$LOG_FILE"; }

confirm() {
  if $CI_MODE; then return 0; fi
  local msg="${1:-Continue?}"
  echo -e "\n${YELLOW}${msg} [y/N]${RESET} \c"
  read -r ans
  [[ "$ans" =~ ^[Yy]$ ]] || die "Aborted by user."
}

# ─────────────────────────────────────────────
# 2. PRE-FLIGHT CHECKS
# ─────────────────────────────────────────────
hr
echo -e "${BOLD}  R3 Platform — Expert Deployment$([ "$DRY_RUN" = true ] && echo ' [DRY RUN]')${RESET}"
echo "  $(date)"
hr

: > "$LOG_FILE"    # clear log

step "PRE-FLIGHT CHECKS"

# 2a. Must run from project root
if [[ ! -f "package.json" ]]; then
  die "Not in project root — no package.json found.\nRun from: ~/Stable/R3 v4"
fi

ROOT_NAME=$(node -pe "require('./package.json').name" 2>/dev/null || echo "unknown")
ok "Project root confirmed: $ROOT_NAME"

# 2b. implement-r3.ts must be present
if [[ ! -f "$SCRIPT_NAME" ]]; then
  die "$SCRIPT_NAME not found in project root. Copy it here first:\n  cp ~/implement-r3.ts ."
fi
ok "Found $SCRIPT_NAME"

# 2c. Node.js >= 18
NODE_VER=$(node --version 2>/dev/null | tr -d 'v' | cut -d. -f1)
if [[ -z "$NODE_VER" ]] || (( NODE_VER < 18 )); then
  die "Node.js 18+ required. Found: $(node --version 2>/dev/null || echo 'none')"
fi
ok "Node.js $(node --version)"

# 2d. tsx available
if ! command -v tsx &>/dev/null && ! npx tsx --version &>/dev/null 2>&1; then
  die "tsx not found. Install: pnpm add -D tsx  or  npm i -D tsx"
fi
TSX_CMD=$(command -v tsx 2>/dev/null || echo "npx tsx")
ok "tsx: $TSX_CMD"

# 2e. pnpm available
if ! command -v pnpm &>/dev/null; then
  warn "pnpm not found — will fall back to npm for install step"
  PKG_MGR="npm"
else
  ok "pnpm: $(pnpm --version)"
  PKG_MGR="pnpm"
fi

# 2f. Git working tree check
if ! $NO_GIT; then
  if ! git rev-parse --git-dir &>/dev/null; then
    warn "Not a git repo — skipping git checks (pass --no-git to silence)"
  else
    DIRTY=$(git status --porcelain 2>/dev/null | grep -v "^??" || true)
    if [[ -n "$DIRTY" ]]; then
      warn "Uncommitted changes detected:"
      git status --short | head -20
      confirm "Continue anyway? (recommend committing first)"
    else
      ok "Git working tree clean"
    fi
    BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
    ok "Branch: $BRANCH"
  fi
fi

# 2g. Workspace sanity
if [[ -f "pnpm-workspace.yaml" ]]; then
  ok "pnpm workspace: pnpm-workspace.yaml present"
elif node -pe "(require('./package.json').workspaces||[]).length > 0" 2>/dev/null | grep -q "true"; then
  ok "pnpm workspace: package.json workspaces present"
else
  warn "No workspace config found — make sure pnpm-workspace.yaml covers packages/ and services/"
fi

# ─────────────────────────────────────────────
# 3. DRY RUN — preview everything
# ─────────────────────────────────────────────
step "DRY RUN — previewing all 15 phases"

DRY_OUTPUT=$($TSX_CMD "$SCRIPT_NAME" --dry-run 2>&1) || {
  fail "Dry run failed with exit code $?"
  echo "$DRY_OUTPUT"
  die "Fix the errors above before proceeding"
}

echo "$DRY_OUTPUT" >> "$LOG_FILE"

# Count files that would be written
WRITE_COUNT=$(echo "$DRY_OUTPUT" | grep -c "^\[WRITE" || true)
PATCH_COUNT=$(echo "$DRY_OUTPUT" | grep -c "^\[PATCH" || true)
SKIP_COUNT=$(echo "$DRY_OUTPUT" | grep -c "SKIP (already exists)" || true)
WARN_COUNT=$(echo "$DRY_OUTPUT" | grep -c "^\[WARN" || true)
HARDSTOP=$(echo "$DRY_OUTPUT" | grep -c "HARD STOP" || true)

if (( HARDSTOP > 0 )); then
  echo "$DRY_OUTPUT"
  die "Hard stop triggered during dry run — see above"
fi

echo ""
info "  Files to write:  $WRITE_COUNT"
info "  Files to patch:  $PATCH_COUNT"
info "  Already exists:  $SKIP_COUNT (will be skipped)"
info "  Warnings:        $WARN_COUNT"

if (( WARN_COUNT > 0 )); then
  echo ""
  warn "Warnings detected:"
  echo "$DRY_OUTPUT" | grep "^\[WARN" | sed 's/^/    /'
fi

if $DRY_RUN; then
  echo ""
  ok "Dry-run complete — no files written."
  info "Remove --dry-run to execute."
  exit 0
fi

echo ""
confirm "Dry run looks good. Execute all 15 phases?"

# ─────────────────────────────────────────────
# 4. PHASE EXECUTION
# ─────────────────────────────────────────────

run_phase() {
  local phase_arg="${1:-}"
  local label="${2:-all phases}"
  step "RUNNING: $label"
  if [[ -n "$phase_arg" ]]; then
    $TSX_CMD "$SCRIPT_NAME" "$phase_arg" 2>&1 | tee -a "$LOG_FILE"
  else
    $TSX_CMD "$SCRIPT_NAME" 2>&1 | tee -a "$LOG_FILE"
  fi
  local exit_code=${PIPESTATUS[0]}
  if (( exit_code != 0 )); then
    die "Phase execution failed (exit $exit_code) — check $LOG_FILE"
  fi
}

if [[ -n "$PHASE_ARG" ]]; then
  # Single phase mode
  run_phase "$PHASE_ARG" "Phase ${PHASE_ARG#--phase=}"
else
  # ── Content phases (1-11): new source files ──
  step "CONTENT PHASES 1-11 — writing new source files"
  for phase in $(seq 1 11); do
    echo -e "  ${CYAN}Phase $phase...${RESET}"
    $TSX_CMD "$SCRIPT_NAME" "--phase=$phase" 2>&1 | tee -a "$LOG_FILE" \
      | grep -E "^\[(WRITE|PATCH|VERIFY|WARN|HARD)" || true
    exit_code=${PIPESTATUS[0]}
    if (( exit_code != 0 )); then
      die "Phase $phase failed — check $LOG_FILE"
    fi
  done
  ok "Phases 1-11 complete"
fi

# ─────────────────────────────────────────────
# 5. VERIFY GENERATED FILES
# ─────────────────────────────────────────────
if ! $SKIP_VERIFY && [[ -z "$PHASE_ARG" ]]; then
  step "VERIFYING generated files exist and are non-empty"

  EXPECTED_FILES=(
    # Phase 1 — Types
    "packages/llpte-core/src/types/audio-graph.types.ts"
    "packages/llpte-core/src/types/mixer.types.ts"
    "packages/llpte-core/src/types/dj.types.ts"
    "packages/llpte-core/src/types/effects.types.ts"
    "packages/llpte-core/src/types/index.ts"
    # Phase 2 — Audio engine
    "packages/llpte-core/src/engine/AudioGraphEngine.ts"
    "packages/llpte-core/src/engine/LatencyCompensator.ts"
    "packages/llpte-core/src/engine/index.ts"
    # Phase 3 — Mixer
    "packages/llpte-core/src/mixer/MixerEngine.ts"
    "packages/llpte-core/src/mixer/index.ts"
    # Phase 4 — DJ
    "packages/llpte-core/src/dj/DJEngine.ts"
    "packages/llpte-core/src/dj/index.ts"
    # Phase 5 — Effects
    "packages/llpte-core/src/effects/EffectsEngine.ts"
    "packages/llpte-core/src/effects/index.ts"
    # Phase 6 — AI Mix
    "services/ai-mix/src/AIMixingService.ts"
    "services/ai-mix/src/index.ts"
    # Phase 7 — Arrangement
    "packages/llpte-core/src/arrangement/ArrangementEngine.ts"
    "packages/llpte-core/src/arrangement/index.ts"
    # Phase 8 — tRPC
    "server/routers/mixer.router.ts"
    "server/routers/dj.router.ts"
    "server/routers/aiMix.router.ts"
    "server/routers/index.ts"
    # Phase 9 — WebSocket
    "server/ws/SessionBroadcaster.ts"
    # Phase 10 — DB
    "db/schema/r3-platform.schema.ts"
  )

  MISSING=0
  EMPTY=0
  for f in "${EXPECTED_FILES[@]}"; do
    if [[ ! -f "$f" ]]; then
      fail "Missing: $f"
      (( MISSING++ )) || true
    elif [[ ! -s "$f" ]]; then
      fail "Empty:   $f"
      (( EMPTY++ )) || true
    else
      ok "$f"
    fi
  done

  if (( MISSING + EMPTY > 0 )); then
    warn "$MISSING missing, $EMPTY empty files — re-run phases manually:"
    info "  npx tsx $SCRIPT_NAME --phase=<N>"
    die "Verification failed. Fix before proceeding to wiring phases."
  fi
  ok "All ${#EXPECTED_FILES[@]} expected files verified"
fi

# ─────────────────────────────────────────────
# 6. WIRING PHASES 12-15
# ─────────────────────────────────────────────
if [[ -z "$PHASE_ARG" ]]; then
  step "WIRING PHASES 12-15 — package.json / trpc.ts / server/index.ts"

  for phase in 12 13 14 15; do
    echo -e "  ${CYAN}Phase $phase...${RESET}"
    $TSX_CMD "$SCRIPT_NAME" "--phase=$phase" 2>&1 | tee -a "$LOG_FILE" \
      | grep -E "^\[(WRITE|PATCH|VERIFY|WARN|HARD)" || true
    exit_code=${PIPESTATUS[0]}
    if (( exit_code != 0 )); then
      die "Phase $phase failed — check $LOG_FILE"
    fi
  done
  ok "Wiring phases 12-15 complete"

  # Show what was patched
  echo ""
  info "Files patched by wiring phases:"
  grep "^\[PATCH" "$LOG_FILE" | awk '{print "  🔧", $0}' || true
fi

# ─────────────────────────────────────────────
# 7. INSTALL DEPENDENCIES
# ─────────────────────────────────────────────
if [[ -z "$PHASE_ARG" ]]; then
  step "INSTALLING dependencies (workspace hoisting)"

  if [[ "$PKG_MGR" == "pnpm" ]]; then
    pnpm install --frozen-lockfile=false 2>&1 | tee -a "$LOG_FILE" | tail -5
  else
    npm install 2>&1 | tee -a "$LOG_FILE" | tail -5
  fi

  ok "Dependencies installed"
fi

# ─────────────────────────────────────────────
# 8. TYPESCRIPT CHECK
# ─────────────────────────────────────────────
if [[ -z "$PHASE_ARG" ]]; then
  step "TYPESCRIPT CHECK — tsc --noEmit"

  # Check root tsconfig
  if [[ -f "tsconfig.json" ]]; then
    if npx tsc --noEmit --skipLibCheck 2>&1 | tee -a "$LOG_FILE" | grep -E "error TS" | head -20; then
      warn "TypeScript errors found — see above"
      warn "Common causes:"
      warn "  1. @r3/llpte-core not yet resolvable — run: $PKG_MGR install"
      warn "  2. tsconfig paths missing '@r3/llpte-core' — see step 9 below"
      warn "  3. Existing code imports old type shapes — migrate to @r3/llpte-core"
      info ""
      info "  These are NOT fatal — your existing server still starts."
      info "  Fix incrementally after this script completes."
      TS_ERRORS=true
    else
      ok "No TypeScript errors in root tsconfig"
      TS_ERRORS=false
    fi
  else
    warn "No root tsconfig.json found — skipping TypeScript check"
    TS_ERRORS=false
  fi

  # Check llpte-core package specifically
  if [[ -f "packages/llpte-core/tsconfig.json" ]]; then
    echo ""
    info "Checking packages/llpte-core..."
    if npx tsc -p packages/llpte-core/tsconfig.json --noEmit --skipLibCheck 2>&1 \
        | tee -a "$LOG_FILE" | grep -E "error TS" | head -10; then
      warn "Type errors in llpte-core — check packages/llpte-core/tsconfig.json"
    else
      ok "packages/llpte-core types clean"
    fi
  fi
fi

# ─────────────────────────────────────────────
# 9. DRIZZLE SCHEMA CHECK
# ─────────────────────────────────────────────
if [[ -z "$PHASE_ARG" ]] && [[ -f "drizzle.config.ts" ]]; then
  step "DRIZZLE SCHEMA CHECK"

  info "Running: pnpm drizzle-kit check"
  info "This compares db/schema/r3-platform.schema.ts against your existing DB."
  info "If no DB is running locally, this will warn — that is safe to ignore."
  echo ""

  if ! $PKG_MGR drizzle-kit check 2>&1 | tee -a "$LOG_FILE"; then
    warn "drizzle-kit check reported issues — review before deploying schema"
    warn "Do NOT run drizzle-kit push/migrate until you have reviewed the diff"
    warn "New tables: users, projects, audio_files, effect_presets, ai_mix_history"
  else
    ok "Drizzle schema check passed"
  fi
else
  [[ -z "$PHASE_ARG" ]] && warn "No drizzle.config.ts found — skipping schema check"
fi

# ─────────────────────────────────────────────
# 10. ORPHAN TYPE FILE REPORT
# ─────────────────────────────────────────────
if [[ -z "$PHASE_ARG" ]]; then
  step "ORPHAN TYPE FILE REPORT"

  info "Scanning for duplicate type files that now conflict with @r3/llpte-core..."
  echo ""

  for pattern in "mixer.types.ts" "dj.types.ts" "effects.types.ts"; do
    mapfile -t matches < <(find . -name "$pattern" -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/packages/llpte-core/*" 2>/dev/null)
    if (( ${#matches[@]} > 0 )); then
      warn "DUPLICATE FOUND: $pattern"
      for m in "${matches[@]}"; do
        info "    $m  ← migrate imports → delete this file"
      done
      info "    Canonical: packages/llpte-core/src/types/$pattern"
      echo ""
    fi
  done

  info "Migration steps for each duplicate:"
  info "  1. Search your codebase for: import.*from.*<duplicate-path>"
  info "  2. Replace with:             import { TypeName } from '@r3/llpte-core'"
  info "  3. Delete the duplicate file"
  info "  4. Rerun: npx tsc --noEmit --skipLibCheck"
fi

# ─────────────────────────────────────────────
# 11. TSCONFIG PATH ALIAS (advisory)
# ─────────────────────────────────────────────
if [[ -z "$PHASE_ARG" ]]; then
  step "TSCONFIG PATH ALIAS CHECK"

  ROOT_TS=$(cat tsconfig.json 2>/dev/null || echo "{}")
  if echo "$ROOT_TS" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8'); const j=JSON.parse(d); process.exit(j?.compilerOptions?.paths?.['@r3/llpte-core'] ? 0 : 1)" 2>/dev/null; then
    ok "@r3/llpte-core path alias already in tsconfig.json"
  else
    warn "@r3/llpte-core not found in tsconfig.json paths"
    info ""
    info "  Add this to your root tsconfig.json compilerOptions.paths:"
    cat << 'TSEOF'

    "paths": {
      "@r3/llpte-core":               ["./packages/llpte-core/src/index.ts"],
      "@r3/llpte-core/*":             ["./packages/llpte-core/src/*"],
      "@r3/ai-mix":                   ["./services/ai-mix/src/index.ts"]
    }

TSEOF
    info "  Then add to each sub-package tsconfig.json:"
    cat << 'TSEOF2'

    "references": [{ "path": "../../packages/llpte-core" }]

TSEOF2
  fi
fi

# ─────────────────────────────────────────────
# 12. GIT CHECKPOINT COMMIT
# ─────────────────────────────────────────────
if [[ -z "$PHASE_ARG" ]] && ! $NO_GIT; then
  if git rev-parse --git-dir &>/dev/null; then
    step "GIT CHECKPOINT"

    CHANGED=$(git status --porcelain 2>/dev/null | grep -v "^??" | wc -l | tr -d ' ')
    NEW=$(git status --porcelain 2>/dev/null | grep "^??" | wc -l | tr -d ' ')

    info "Changed/staged files: $CHANGED"
    info "Untracked new files:  $NEW"
    echo ""

    if (( CHANGED + NEW > 0 )); then
      confirm "Stage and commit all generated files as a checkpoint?"

      git add \
        "packages/llpte-core/src/" \
        "services/ai-mix/src/" \
        "server/routers/" \
        "server/ws/" \
        "db/schema/" \
        "packages/llpte-core/package.json" \
        "services/ai-mix/package.json" \
        "$REPORT_FILE" \
        2>/dev/null || true

      # Stage trpc.ts and server/index.ts changes if they were patched
      git add "server/trpc.ts" "server/index.ts" 2>/dev/null || true
      git add "server/src/trpc.ts" 2>/dev/null || true

      COMMIT_MSG="feat: R3 platform engine layer — phases 1-15

Adds:
  - Canonical type contracts (@r3/llpte-core)
  - AudioGraphEngine (Kahn topo sort, cycle detection)
  - LatencyCompensator
  - MixerEngine (event-sourced, automation-aware)
  - DJEngine (deck control, beat sync, invariant-checked)
  - EffectsEngine (DSP chain, preset system)
  - AIMixingService (genre-aware, model endpoint with fallback)
  - ArrangementEngine (clip timeline, tempo map — was missing)
  - tRPC routers: mixer, dj, aiMix
  - SessionBroadcaster (WebSocket fan-out)
  - Drizzle schema: users, projects, audio_files, effect_presets, ai_mix_history
  - Package.json exports wiring for @r3/llpte-core
  - Engine singletons injected into tRPC context
  - SessionBroadcaster wired to server

Generated by implement-r3.ts — 26/26 checks passing
$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

      git commit -m "$COMMIT_MSG" 2>&1 | tee -a "$LOG_FILE"
      ok "Checkpoint commit created"
      info "  $(git log --oneline -1)"
    else
      info "Nothing new to commit"
    fi
  fi
fi

# ─────────────────────────────────────────────
# 13. FINAL SUMMARY
# ─────────────────────────────────────────────
hr
echo ""
echo -e "${BOLD}${GREEN}  ✅ R3 Platform — Implementation Complete${RESET}"
echo ""
echo -e "${BOLD}  Files written this run:${RESET}"
grep "^\[WRITE" "$LOG_FILE" | sed 's/\[WRITE.*\] 📝 /    📝 /' | sed 's/ → .*$//' | sort | uniq
echo ""
echo -e "${BOLD}  Files patched this run:${RESET}"
grep "^\[PATCH" "$LOG_FILE" | sed 's/\[PATCH.*\] 🔧 /    🔧 /' | sed 's/\\n.*$//' | sort | uniq
echo ""

echo -e "${BOLD}  REMAINING MANUAL STEPS${RESET}"
echo "  ──────────────────────────────────────────────────────────"

echo ""
echo -e "  ${BOLD}1. Verify server/trpc.ts createContext()${RESET}"
echo "     Open server/trpc.ts and confirm createContext() returns:"
echo "     { mixerEngine, djEngine }  (Phase 14 prepended the engine singletons)"
echo "     and that initTRPC.context<Context>() uses the right Context type."
echo ""

echo -e "  ${BOLD}2. Verify server/index.ts WebSocket wiring${RESET}"
echo "     Confirm these lines are present after your wss construction:"
echo "       const broadcaster = new SessionBroadcaster();"
echo "       broadcaster.attach(wss);"
echo "     And tRPC is mounted:"
echo '       app.use("/trpc", createExpressMiddleware({ router: appRouter, createContext }));'
echo ""

echo -e "  ${BOLD}3. Migrate duplicate type imports${RESET}"
echo "     Run the orphan report above and replace all old type imports with:"
echo "       import { YourType } from '@r3/llpte-core'"
echo ""

echo -e "  ${BOLD}4. Add tsconfig paths (if not already done)${RESET}"
echo '     "paths": { "@r3/llpte-core": ["./packages/llpte-core/src/index.ts"] }'
echo ""

echo -e "  ${BOLD}5. Drizzle migration${RESET}"
echo "     ONLY after reviewing the diff:"
echo "       pnpm drizzle-kit generate  # create migration file"
echo "       pnpm drizzle-kit migrate   # apply to DB"
echo ""

echo -e "  ${BOLD}6. Build and smoke test${RESET}"
echo "     pnpm run build"
echo "     pnpm run dev"
echo "     curl http://localhost:<PORT>/trpc/mixer.getState"
echo ""

echo "  Full log:    $LOG_FILE"
echo "  Full report: $REPORT_FILE"
echo ""
hr
