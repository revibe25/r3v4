#!/usr/bin/env bash
# =============================================================================
# LLPTE / R3 v4 — Master Commands Reference
# Run from: ~/Stable/R3 v4/
#
# USAGE:
#   bash llpte_commands.sh [category]
#
#   Categories: dev | build | db | docker | test | bench | git | llpte | python | clean
#   No argument: print full reference
# =============================================================================

# ── Colors ────────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; YELLOW='\033[1;33m'; GREEN='\033[0;32m'
BOLD='\033[1m'; RESET='\033[0m'; DIM='\033[2m'

section() { echo -e "\n${BOLD}${CYAN}┌─────────────────────────────────────────────────────────┐${RESET}"; \
            echo -e "${BOLD}${CYAN}│  $1${RESET}"; \
            echo -e "${BOLD}${CYAN}└─────────────────────────────────────────────────────────┘${RESET}"; }
cmd()     { echo -e "  ${GREEN}$1${RESET}"; }
note()    { echo -e "  ${DIM}# $1${RESET}"; }
label()   { echo -e "\n  ${YELLOW}$1${RESET}"; }

FILTER="${1:-all}"

show_section() {
  [[ "$FILTER" == "all" ]] || [[ "$FILTER" == "$1" ]]
}


# ==============================================================================
if show_section "dev"; then
section "DEV — Start Development Environment"

label "Full stack (client + server concurrently)"
cmd  "npm run dev"
note "Uses concurrently — defined in root package.json"

label "Client only (Vite dev server)"
cmd  "cd client && npm run dev"
note "Typically http://localhost:5173"

label "Server only (TypeScript / tsx)"
cmd  "cd server && npm run dev"
note "Or: cd server && npx tsx watch index.ts"

label "Server with explicit tsx watch"
cmd  "cd server && npx tsx watch --clear-screen=false index.ts"

label "Check what's running on a port"
cmd  "lsof -i :5173    # client"
cmd  "lsof -i :3000    # server (common)"
cmd  "lsof -i :8001    # Python AI service"

label "Kill process on port"
cmd  "kill -9 \$(lsof -ti :3000)"

fi


# ==============================================================================
if show_section "build"; then
section "BUILD — Compile & Bundle"

label "Build everything (root)"
cmd  "npm run build"

label "Build client only"
cmd  "cd client && npm run build"
note "Output: client/dist/"

label "Build server only"
cmd  "cd server && npm run build"
note "Or: cd server && npx tsc"

label "Build a single LLPTE package"
cmd  "npm run build --workspace=packages/llpte-transition-graph"
cmd  "npm run build --workspace=packages/llpte-signal"
cmd  "npm run build --workspace=packages/llpte-execution"
cmd  "npm run build --workspace=packages/llpte-core"

label "Build ALL LLPTE packages"
cmd  "for pkg in packages/llpte-*; do (cd \"\$pkg\" && npx tsc --project tsconfig.json); done"

label "Type-check without emitting"
cmd  "npx tsc --noEmit"
cmd  "cd client && npx tsc --noEmit"
cmd  "cd server && npx tsc --noEmit"
cmd  "npm run typecheck --workspace=packages/llpte-transition-graph"

label "Build audio worklets"
cmd  "node scripts/build-worklets.js"

fi


# ==============================================================================
if show_section "db"; then
section "DB — Drizzle ORM & Migrations"

label "Generate new migration (after schema change)"
cmd  "npx drizzle-kit generate"
note "Reads: drizzle.config.ts  →  Output: drizzle/migrations/"

label "Run all pending migrations"
cmd  "npx drizzle-kit migrate"

label "Open Drizzle Studio (visual DB browser)"
cmd  "npx drizzle-kit studio"
note "Opens browser at https://local.drizzle.studio"

label "Push schema directly (dev only — skips migration files)"
cmd  "npx drizzle-kit push"

label "Inspect current DB schema"
cmd  "npx drizzle-kit introspect"

label "Drop all tables and re-migrate (DESTRUCTIVE)"
cmd  "npx drizzle-kit drop && npx drizzle-kit migrate"

label "Shared drizzle config (if using shared/drizzle.config.ts)"
cmd  "cd shared && npx drizzle-kit generate --config=drizzle.config.ts"

fi


# ==============================================================================
if show_section "docker"; then
section "DOCKER — Container Management"

label "Start all services"
cmd  "docker compose up -d"
note "Runs in background (detached)"

label "Start with logs visible"
cmd  "docker compose up"

label "Stop all services"
cmd  "docker compose down"

label "Stop and remove volumes (DESTRUCTIVE)"
cmd  "docker compose down -v"

label "Rebuild images (after Dockerfile change)"
cmd  "docker compose build"
cmd  "docker compose up -d --build"

label "View live logs"
cmd  "docker compose logs -f"
cmd  "docker compose logs -f server"
cmd  "docker compose logs -f client"

label "Exec into running container"
cmd  "docker compose exec server bash"
cmd  "docker compose exec server sh"

label "Check container status"
cmd  "docker compose ps"

label "Remove all stopped containers + unused images"
cmd  "docker system prune -f"

fi


# ==============================================================================
if show_section "test"; then
section "TEST — Unit & Integration Tests"

label "Run all LLPTE package tests"
cmd  "npm test --workspaces --if-present"

label "Run specific package tests"
cmd  "npm test --workspace=packages/llpte-transition-graph"
cmd  "npm test --workspace=packages/llpte-signal"
cmd  "npm test --workspace=packages/llpte-execution"

label "Run tests in watch mode"
cmd  "npm run test:watch --workspace=packages/llpte-transition-graph"

label "Run server tests (if configured)"
cmd  "cd server && npm test"
cmd  "cd server && npx tsx --test tests/**/*.test.ts"

label "Run with coverage"
cmd  "cd packages/llpte-transition-graph && npx vitest run --coverage"

label "Run specific test file"
cmd  "cd packages/llpte-transition-graph && npx vitest run tests/scoreModel.test.ts"

label "Verbose test output"
cmd  "cd packages/llpte-transition-graph && npx vitest run --reporter=verbose"

fi


# ==============================================================================
if show_section "bench"; then
section "BENCH — Performance Benchmarks"

label "Run transition graph benchmarks"
cmd  "cd packages/llpte-transition-graph && npx tsx benchmarks/run.bench.ts"
note "Measures: rankTransitions avg/p99 across 10/50/200 candidates"

label "Run with profiling (Node.js inspector)"
cmd  "cd packages/llpte-transition-graph && node --inspect-brk -r tsx/cjs benchmarks/run.bench.ts"
note "Then open chrome://inspect in Chrome"

label "Run with CPU profiling"
cmd  "cd packages/llpte-transition-graph && node --prof -r tsx/cjs benchmarks/run.bench.ts && node --prof-process isolate-*.log"

label "Memory usage snapshot"
cmd  "cd packages/llpte-transition-graph && node -e \"
const { execSync } = require('child_process');
const before = process.memoryUsage().heapUsed;
require('tsx/cjs');
require('./benchmarks/run.bench.ts');
const after = process.memoryUsage().heapUsed;
console.log('Delta MB:', ((after - before) / 1024 / 1024).toFixed(2));
\""

label "Time a command (unix)"
cmd  "time npx tsx packages/llpte-transition-graph/benchmarks/run.bench.ts"

fi


# ==============================================================================
if show_section "lint"; then
section "LINT — Code Quality"

label "ESLint (root)"
cmd  "npx eslint ."
cmd  "npx eslint . --fix"

label "ESLint on specific dirs"
cmd  "npx eslint client/src server packages"

label "Type check everything"
cmd  "npx tsc --noEmit && echo 'TypeScript: OK'"

label "Check for unused exports (ts-prune)"
cmd  "npx ts-prune"

fi


# ==============================================================================
if show_section "git"; then
section "GIT — Workflow"

label "See current LLPTE branch state"
cmd  "git log --oneline -20"
cmd  "git log --oneline --graph --all -20"

label "See what changed in this extraction branch"
cmd  "git diff main..feature/llpte-extraction --stat"
cmd  "git diff main..feature/llpte-extraction -- packages/"

label "Review uncommitted changes"
cmd  "git status"
cmd  "git diff --staged"

label "Merge extraction branch to main (when ready)"
cmd  "git checkout main"
cmd  "git merge --no-ff feature/llpte-extraction -m 'feat(llpte): merge LLPTE v0.1.0 extraction'"

label "Tag a release"
cmd  "git tag -a v0.1.0 -m 'LLPTE v0.1.0 — initial engine extraction'"
cmd  "git push origin v0.1.0"

label "Stash work in progress"
cmd  "git stash push -m 'wip: description'"
cmd  "git stash list"
cmd  "git stash pop"

label "Undo last commit (keep changes)"
cmd  "git reset --soft HEAD~1"

label "Hard reset to remote (DESTRUCTIVE)"
cmd  "git fetch origin && git reset --hard origin/main"

label "See full diff of a file"
cmd  "git diff HEAD -- packages/llpte-transition-graph/src/scoreModel.ts"

label "Find when a line was introduced"
cmd  "git log -S 'scoreTransition' --oneline"
cmd  "git blame packages/llpte-transition-graph/src/scoreModel.ts"

fi


# ==============================================================================
if show_section "python"; then
section "PYTHON — AI Server (server/ai_mix.py)"

label "Start Python AI service (from server/)"
cmd  "cd server && python3 main.py"
cmd  "cd server && uvicorn main:app --reload --port 8001"
note "Assumes FastAPI / uvicorn setup in main.py"

label "Start with virtual env"
cmd  "cd server && source .venv/bin/activate && python3 main.py"

label "Install Python dependencies"
cmd  "cd server && pip install -r requirements.txt"

label "Create virtual environment"
cmd  "cd server && python3 -m venv .venv"
cmd  "cd server && source .venv/bin/activate"

label "Check Python environment"
cmd  "python3 --version"
cmd  "pip list"
cmd  "pip show uvicorn fastapi"

label "Run AI mix script directly"
cmd  "cd server && python3 ai_mix.py"

label "Test AI endpoint"
cmd  "curl -X POST http://localhost:8001/suggest \\"
cmd  "  -H 'Content-Type: application/json' \\"
cmd  "  -d '{\"fromTrackId\":\"t1\",\"toTrackId\":\"t2\",\"fromBpm\":128,\"toBpm\":128,\"fromKey\":\"8A\",\"toKey\":\"9A\"}'"

fi


# ==============================================================================
if show_section "llpte"; then
section "LLPTE — Engine-Specific Commands"

label "Install all workspace packages"
cmd  "npm install"
note "Hoists shared deps to root node_modules"

label "Add dependency to specific package"
cmd  "npm install essentia.js --workspace=packages/llpte-signal"
cmd  "npm install aubio --workspace=packages/llpte-signal"

label "List all workspace packages"
cmd  "npm query .workspace"
note "Or: cat package.json | grep -A5 workspaces"

label "Run command in specific workspace"
cmd  "npm run build   --workspace=packages/llpte-transition-graph"
cmd  "npm test        --workspace=packages/llpte-transition-graph"
cmd  "npm run typecheck --workspace=packages/llpte-transition-graph"

label "Run command in ALL workspaces"
cmd  "npm run build   --workspaces --if-present"
cmd  "npm test        --workspaces --if-present"
cmd  "npm run typecheck --workspaces --if-present"

label "Explore engine structure"
cmd  "tree packages/ -I 'node_modules|dist|*.tsbuildinfo' -L 3"

label "View transition scoring in action (quick REPL test)"
cmd  "node -e \""
cmd  "const { scoreTransition, DEFAULT_WEIGHTS } = require('./packages/llpte-transition-graph/dist');"
cmd  "const a = { bpm:128, key:'8A', energy:0.8, spectralCentroid:3200, rmsLoudness:0.65 };"
cmd  "const b = { bpm:128, key:'9A', energy:0.75, spectralCentroid:3100, rmsLoudness:0.60 };"
cmd  "console.log(JSON.stringify(scoreTransition(a, b, 'a', 'b', DEFAULT_WEIGHTS), null, 2));"
cmd  "\""
note "Run after: npm run build --workspace=packages/llpte-transition-graph"

label "Verify no circular dependencies"
cmd  "npx madge --circular packages/llpte-transition-graph/src/index.ts"

label "Generate package dependency graph"
cmd  "npx madge --image graph.svg packages/llpte-transition-graph/src/index.ts"

label "Check package sizes"
cmd  "for pkg in packages/llpte-*; do"
cmd  "  echo -n \"\$pkg: \""
cmd  "  du -sh \"\$pkg/dist\" 2>/dev/null || echo '(not built)'"
cmd  "done"

fi


# ==============================================================================
if show_section "inspect"; then
section "INSPECT — Project Analysis"

label "Full project tree (excluding node_modules)"
cmd  "tree -L 3 -I 'node_modules|dist|.git|*.tsbuildinfo' ."

label "Count lines of TypeScript"
cmd  "find . -name '*.ts' -not -path '*/node_modules/*' -not -path '*/dist/*' | xargs wc -l | sort -rn | head -20"

label "Find all TODO comments in LLPTE packages"
cmd  "grep -rn 'TODO' packages/ --include='*.ts'"

label "Find all stub/placeholder implementations"
cmd  "grep -rn 'stub\|STUB\|placeholder\|PLACEHOLDER' packages/ --include='*.ts'"

label "Check for console.log left in packages"
cmd  "grep -rn 'console.log' packages/ --include='*.ts'"

label "View all exported symbols from transition graph"
cmd  "cd packages/llpte-transition-graph && npx tsx -e \"console.log(Object.keys(require('./src/index.ts')))\""

label "Size of all node_modules"
cmd  "du -sh node_modules client/node_modules server/node_modules 2>/dev/null"

label "Check TypeScript version in each workspace"
cmd  "npm ls typescript --workspaces 2>/dev/null | grep typescript"

fi


# ==============================================================================
if show_section "clean"; then
section "CLEAN — Remove Build Artifacts"

label "Remove all dist/ directories in packages"
cmd  "find packages -name 'dist' -type d -exec rm -rf {} + 2>/dev/null; echo 'Done'"

label "Remove all .tsbuildinfo files"
cmd  "find . -name '*.tsbuildinfo' -not -path '*/node_modules/*' -delete"

label "Remove root node_modules and reinstall"
cmd  "rm -rf node_modules && npm install"

label "Clean everything and full reinstall (nuclear)"
cmd  "rm -rf node_modules client/node_modules server/node_modules"
cmd  "find packages -name 'node_modules' -type d -exec rm -rf {} + 2>/dev/null"
cmd  "npm install"

label "Clean temp files"
cmd  "rm -rf temp/* client/temp/* 2>/dev/null"
cmd  "rm -rf logs/*.log 2>/dev/null"

fi


# ==============================================================================
if show_section "nginx"; then
section "NGINX — Reverse Proxy"

label "Test nginx config"
cmd  "nginx -t -c \$(pwd)/nginx/nginx.conf"

label "Reload nginx (no downtime)"
cmd  "nginx -s reload"

label "Start nginx with project config"
cmd  "nginx -c \$(pwd)/nginx/nginx.conf"

label "Check nginx status (if systemd)"
cmd  "sudo systemctl status nginx"
cmd  "sudo systemctl reload nginx"

fi


# ==============================================================================
echo ""
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${BOLD}  LLPTE / R3 v4 — Command Reference${RESET}"
echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo "  Sections available:"
echo "    dev       Start development servers"
echo "    build     Compile TypeScript + worklets"
echo "    db        Drizzle ORM migrations"
echo "    docker    Container management"
echo "    test      Unit and integration tests"
echo "    bench     Performance benchmarks"
echo "    lint      Code quality checks"
echo "    git       Git workflow"
echo "    python    Python AI service"
echo "    llpte     LLPTE engine commands"
echo "    inspect   Project analysis"
echo "    clean     Remove build artifacts"
echo "    nginx     Reverse proxy"
echo ""
echo "  Usage:  bash llpte_commands.sh [section]"
echo "  Eg:     bash llpte_commands.sh bench"
echo ""
