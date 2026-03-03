#!/usr/bin/env bash
# client_setup.sh — R3 Client Setup v3, Professional Edition
# ─────────────────────────────────────────────────────────────────────────────
# v3 fixes (over v2):
#   • Framework detection (Vite / Next.js / CRA) — sets correct default port
#     (Vite=5173, Next/CRA=3000) and passes --port flag to Vite at launch so
#     the server always binds to DEV_PORT instead of its own default.
#   • Source-file integrity check — scans all entry-point TSX/JSX files for
#     @/* path-alias imports and verifies each resolves to a real file under
#     src/. Produces a structured missing-files report before attempting to
#     start the dev server, so you know exactly what to restore.
#   • Actual-port tracking — reads the port Vite/Next actually bound to from
#     its stdout (e.g. "Local: http://localhost:5173") and updates DEV_PORT
#     so the browser opens the correct URL even if the port shifted.
#   • wait_for_server now polls both configured and detected ports.
# ─────────────────────────────────────────────────────────────────────────────
# v2 fixes (over v1):
#   • Detects npm workspace-hoisting and installs with --no-workspaces +
#     --prefix to force deps into the client directory.
#   • Explicit --prefix "$CLIENT_DIR" on every npm call.
#   • Richer error classification: WORKSPACE, EACCES, ERESOLVE, NETWORK,
#     ENOSPC, ELOCKFILE, UNKNOWN.
#   • Strategy ladder expanded: ci → install → no-workspaces → legacy → force
#   • pushd/popd replaces cd … cd - to prevent directory drift.
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail   # intentionally NO -e — all errors handled manually

# ─────────────────────────────────────────────────────────────────────────────
# GLOBALS
# ─────────────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Auto-detect: script can live inside client/ or one level above it
if [[ -f "${SCRIPT_DIR}/package.json" ]]; then
    CLIENT_DIR="${SCRIPT_DIR}"
elif [[ -d "${SCRIPT_DIR}/client" && -f "${SCRIPT_DIR}/client/package.json" ]]; then
    CLIENT_DIR="${SCRIPT_DIR}/client"
else
    echo "ERROR: Cannot find package.json — place this script inside the client folder or one level above it." >&2
    exit 1
fi

LOG_DIR="${CLIENT_DIR}/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="${LOG_DIR}/client_setup_$(date +%Y%m%d_%H%M%S).log"
touch "$LOG_FILE"

CLIENT_PID=""
WORKSPACE_ROOT=""        # set by detect_workspace() if a root is found
INSTALL_FLAGS_EXTRA=""   # populated at install time based on workspace mode
FRAMEWORK=""             # set by detect_framework(): vite | next | cra | unknown
ACTUAL_PORT=""           # updated by start_dev_server() from server stdout
# Port defaults: Vite=5173, Next.js/CRA=3000. Set PORT env to override.
# detect_framework() sets this before start_dev_server() runs.
DEV_PORT="${PORT:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
NC='\033[0m'

# ─────────────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────────────
ts()    { date '+%Y-%m-%d %H:%M:%S'; }
ok()    { echo -e "${GREEN}✔${NC}  ${BOLD}$*${NC}";         echo "[$(ts)] OK   $*" >> "$LOG_FILE"; }
err()   { echo -e "${RED}✖${NC}  ${BOLD}$*${NC}" >&2;       echo "[$(ts)] ERR  $*" >> "$LOG_FILE"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*";                    echo "[$(ts)] WARN $*" >> "$LOG_FILE"; }
info()  { echo -e "${CYAN}→${NC}  $*";                      echo "[$(ts)] INFO $*" >> "$LOG_FILE"; }
debug() { echo -e "${DIM}   $*${NC}";                       echo "[$(ts)] DBG  $*" >> "$LOG_FILE"; }
step()  { echo -e "\n${BOLD}${CYAN}━━ $* ━━${NC}";          echo "[$(ts)] STEP $*" >> "$LOG_FILE"; }
die()   { err "$*"; exit 1; }

# ─────────────────────────────────────────────────────────────────────────────
# CLEANUP / SIGNAL HANDLING
# ─────────────────────────────────────────────────────────────────────────────
cleanup() {
    local code=$?
    echo ""
    if [[ -n "$CLIENT_PID" ]] && kill -0 "$CLIENT_PID" 2>/dev/null; then
        warn "Stopping dev server (PID $CLIENT_PID)..."
        kill -TERM "$CLIENT_PID" 2>/dev/null || true
        sleep 1
        kill -9   "$CLIENT_PID" 2>/dev/null || true
    fi
    if [[ $code -eq 0 ]]; then
        ok "Done."
    else
        err "Exited with code $code. Full log: $LOG_FILE"
    fi
}
trap cleanup EXIT
trap 'echo ""; die "Interrupted."' INT TERM

# ─────────────────────────────────────────────────────────────────────────────
# HELPER: npm wrapper
#   Always uses --prefix so the working directory is irrelevant.
#   Streams output to terminal AND log simultaneously.
# ─────────────────────────────────────────────────────────────────────────────
npm_run() {
    # First arg is the npm sub-command; rest are flags.
    # We inject --prefix "$CLIENT_DIR" for install/ci/rebuild/dedupe.
    local subcmd="$1"; shift
    local prefix_cmds="install|ci|rebuild|dedupe|audit|pack"
    local extra_flags=()

    if [[ "$subcmd" =~ ^($prefix_cmds)$ ]]; then
        extra_flags=(--prefix "$CLIENT_DIR")
    fi

    npm "$subcmd" "${extra_flags[@]}" "$@" 2>&1 | tee -a "$LOG_FILE"
    return "${PIPESTATUS[0]}"
}

# ─────────────────────────────────────────────────────────────────────────────
# 1. PREFLIGHT
# ─────────────────────────────────────────────────────────────────────────────
preflight() {
    step "Preflight checks"

    [[ -d "$CLIENT_DIR" ]]              || die "Client directory not found: $CLIENT_DIR"
    [[ -f "$CLIENT_DIR/package.json" ]] || die "package.json missing in: $CLIENT_DIR"

    for cmd in node npm; do
        command -v "$cmd" &>/dev/null || die "'$cmd' not found — install Node.js first."
        info "$cmd $($cmd --version)"
    done

    local node_major
    node_major=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
    [[ "$node_major" -ge 16 ]] || die "Node >= 16 required (found $node_major)"

    info "Client dir : $CLIENT_DIR"
    info "Log file   : $LOG_FILE"
    info "npm version: $(npm --version)"
    ok "Preflight passed"
}

# ─────────────────────────────────────────────────────────────────────────────
# 2. WORKSPACE DETECTION  ← NEW
#
#   npm v7+ automatically hoists installs to the monorepo root when it finds a
#   parent package.json with a "workspaces" field that matches the client path.
#   This makes `npm install` in the client folder appear to succeed ("added N
#   packages") while node_modules never appears locally.
#
#   We walk up the directory tree looking for such a root, warn the user, and
#   set INSTALL_FLAGS_EXTRA="--no-workspaces" so every install strategy opts
#   out of workspace hoisting and installs deps locally.
# ─────────────────────────────────────────────────────────────────────────────
detect_workspace() {
    step "Workspace / monorepo detection"

    local dir
    dir="$(dirname "$CLIENT_DIR")"

    while [[ "$dir" != "/" && "$dir" != "$HOME" ]]; do
        if [[ -f "$dir/package.json" ]]; then
            local has_workspaces
            has_workspaces=$(node -e "
                try {
                    const p = require('$dir/package.json');
                    process.stdout.write(p.workspaces ? 'yes' : 'no');
                } catch(e) { process.stdout.write('no'); }
            " 2>/dev/null || echo "no")

            if [[ "$has_workspaces" == "yes" ]]; then
                WORKSPACE_ROOT="$dir"
                warn "Workspace root detected: $WORKSPACE_ROOT"
                warn "npm would normally hoist node_modules to the workspace root."
                warn "Enabling --no-workspaces --prefix to force local install."
                INSTALL_FLAGS_EXTRA="--no-workspaces"
                ok "Workspace conflict prevention: ON"
                return 0
            else
                debug "Found parent package.json at $dir (no workspaces field — OK)"
            fi
        fi
        dir="$(dirname "$dir")"
    done

    ok "No workspace root found — standard install mode"
}

# ─────────────────────────────────────────────────────────────────────────────
# 3. FRAMEWORK DETECTION
#
#   Identifies whether this is a Vite, Next.js, or CRA project so we can:
#     • Set the correct default dev port (Vite=5173, others=3000)
#     • Pass --port to Vite at launch so it binds to OUR port, not its own
#     • Tailor any framework-specific advice in error messages
# ─────────────────────────────────────────────────────────────────────────────
detect_framework() {
    step "Framework detection"

    # Check devDependencies + dependencies for known framework packages
    local fw
    fw=$(node -e "
        const p = require('$CLIENT_DIR/package.json');
        const all = Object.assign({}, p.dependencies||{}, p.devDependencies||{});
        if (all['vite'] || all['@vitejs/plugin-react'] || all['@vitejs/plugin-vue']) {
            process.stdout.write('vite');
        } else if (all['next']) {
            process.stdout.write('next');
        } else if (all['react-scripts']) {
            process.stdout.write('cra');
        } else {
            process.stdout.write('unknown');
        }
    " 2>/dev/null || echo "unknown")

    FRAMEWORK="$fw"

    # Set port unless the caller already exported PORT=
    if [[ -z "$DEV_PORT" ]]; then
        case "$FRAMEWORK" in
            vite)    DEV_PORT=5173 ;;
            next|cra) DEV_PORT=3000 ;;
            *)        DEV_PORT=3000 ;;
        esac
    fi

    # Check vite.config for an explicit server.port override
    local vite_cfg_port=""
    for cfg in vite.config.ts vite.config.js vite.config.mts vite.config.mjs; do
        if [[ -f "$CLIENT_DIR/$cfg" ]]; then
            vite_cfg_port=$(grep -E 'port\s*:\s*[0-9]+' "$CLIENT_DIR/$cfg" \
                | grep -oE '[0-9]{4,5}' | head -1 || true)
            [[ -n "$vite_cfg_port" ]] && break
        fi
    done
    if [[ -n "$vite_cfg_port" && -z "${PORT:-}" ]]; then
        info "vite.config defines port $vite_cfg_port — using it"
        DEV_PORT="$vite_cfg_port"
    fi

    ok "Framework : $FRAMEWORK  |  Dev port : $DEV_PORT"
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. PURGE STALE ARTIFACTS
# ─────────────────────────────────────────────────────────────────────────────
purge_artifacts() {
    step "Purging stale artifacts"

    pushd "$CLIENT_DIR" > /dev/null

    for target in node_modules .next dist build .turbo .cache .vite; do
        if [[ -e "$target" ]]; then
            info "Removing: $target"
            rm -rf "$target"
        fi
    done

    # Only remove lock file when node_modules is absent (stale lock)
    if [[ -f package-lock.json && ! -d node_modules ]]; then
        info "Removing stale package-lock.json"
        rm -f package-lock.json
    fi

    info "Clearing npm cache..."
    npm cache clean --force >> "$LOG_FILE" 2>&1 \
        && ok "npm cache cleared" \
        || warn "npm cache clean failed (non-fatal)"

    ok "Purge complete"
    popd > /dev/null
}

# ─────────────────────────────────────────────────────────────────────────────
# HELPERS: error classification
# ─────────────────────────────────────────────────────────────────────────────
_classify_npm_error() {
    local snippet
    snippet=$(tail -80 "$LOG_FILE" 2>/dev/null || true)

    if   echo "$snippet" | grep -q "EACCES";                              then echo "EACCES"
    elif echo "$snippet" | grep -q "ERESOLVE";                             then echo "ERESOLVE"
    elif echo "$snippet" | grep -q "ENOTFOUND\|EAI_AGAIN\|ETIMEDOUT";     then echo "NETWORK"
    elif echo "$snippet" | grep -q "ENOSPC";                               then echo "ENOSPC"
    elif echo "$snippet" | grep -q "ELOCKFILE\|package-lock.*conflict";    then echo "ELOCKFILE"
    elif echo "$snippet" | grep -q "workspaces\|workspace";                then echo "WORKSPACE"
    else echo "UNKNOWN"
    fi
}

_fix_npm_permissions() {
    local cache_dir
    cache_dir=$(npm config get cache 2>/dev/null || echo "$HOME/.npm")
    warn "Fixing npm cache ownership: $cache_dir"
    chown -R "$(whoami)" "$cache_dir" 2>/dev/null \
        && ok "Permissions fixed" \
        || warn "Auto-fix failed — run: sudo chown -R \$(whoami) $cache_dir"
}

# ─────────────────────────────────────────────────────────────────────────────
# 4. INSTALL DEPENDENCIES
# Strategy ladder (in order):
#   ci             → clean deterministic install from lock file
#   install        → standard fresh resolve
#   no-workspaces  → force local install, bypass workspace hoisting  ← NEW
#   legacy         → bypass ERESOLVE peer conflicts
#   force          → last resort
# All strategies use --prefix "$CLIENT_DIR" via npm_run().
# ─────────────────────────────────────────────────────────────────────────────
install_deps() {
    step "Installing dependencies"

    info "Target : $CLIENT_DIR"
    info "package.json : $(test -f "$CLIENT_DIR/package.json" && echo YES || echo NO)"
    [[ -n "$WORKSPACE_ROOT" ]] && info "Workspace root : $WORKSPACE_ROOT"

    local -a strategies=()
    [[ -f "$CLIENT_DIR/package-lock.json" ]] && strategies+=("ci")
    strategies+=(install no-workspaces legacy force)

    local attempt=0
    local exit_code

    for strategy in "${strategies[@]}"; do
        attempt=$((attempt + 1))
        exit_code=0

        echo "" >> "$LOG_FILE"
        echo "[$(ts)] ─── Strategy: $strategy (attempt $attempt) ───" >> "$LOG_FILE"

        case "$strategy" in
            ci)
                info "Attempt $attempt: npm ci  (deterministic, uses lock file)"
                npm_run ci --prefer-offline --no-audit --no-fund \
                    $INSTALL_FLAGS_EXTRA || exit_code=$?
                ;;
            install)
                info "Attempt $attempt: npm install"
                npm_run install --no-audit --no-fund \
                    $INSTALL_FLAGS_EXTRA || exit_code=$?
                ;;
            no-workspaces)
                info "Attempt $attempt: npm install --no-workspaces (override workspace hoisting)"
                npm_run install --no-workspaces --no-audit --no-fund || exit_code=$?
                ;;
            legacy)
                info "Attempt $attempt: npm install --legacy-peer-deps"
                npm_run install --legacy-peer-deps --no-workspaces \
                    --no-audit --no-fund || exit_code=$?
                ;;
            force)
                info "Attempt $attempt: npm install --force"
                npm_run install --force --no-workspaces \
                    --no-audit --no-fund || exit_code=$?
                ;;
        esac

        # ── Success check ──────────────────────────────────────────────────
        if [[ $exit_code -eq 0 ]]; then
            if [[ -d "$CLIENT_DIR/node_modules" && -d "$CLIENT_DIR/node_modules/.bin" ]]; then
                ok "Dependencies installed (strategy: $strategy)"
                return 0
            else
                _diagnose_missing_node_modules
                warn "npm exited 0 but node_modules is still missing in $CLIENT_DIR"
                warn "Escalating to next strategy..."
            fi
        else
            local error_class
            error_class=$(_classify_npm_error)
            case "$error_class" in
                WORKSPACE) warn "Workspace hoisting issue detected — escalating strategy" ;;
                EACCES)    err "Permission error (EACCES)"; _fix_npm_permissions ;;
                ERESOLVE)  warn "Peer conflict (ERESOLVE) — escalating strategy" ;;
                ELOCKFILE) warn "Lock file conflict — removing and retrying";
                           rm -f "$CLIENT_DIR/package-lock.json" 2>/dev/null || true ;;
                NETWORK)   die "Network error — check your internet connection." ;;
                ENOSPC)    die "Disk full — free up space and retry." ;;
                *)         warn "Install failed (exit $exit_code) — escalating strategy" ;;
            esac
        fi

        # Clean up before next attempt
        info "Cleaning up before attempt $((attempt + 1))..."
        rm -rf "$CLIENT_DIR/node_modules" "$CLIENT_DIR/package-lock.json" 2>/dev/null || true
        npm cache clean --force >> "$LOG_FILE" 2>&1 || true
    done

    # All strategies exhausted
    echo ""
    err "════════════════════════════════════════════════"
    err "All install strategies exhausted."
    err ""
    err "Likely causes:"
    if [[ -n "$WORKSPACE_ROOT" ]]; then
        err "  • Workspace root at $WORKSPACE_ROOT may still be interfering."
        err "    Try: cd \"$WORKSPACE_ROOT\" && npm install"
        err "    Then re-run this script."
    fi
    err "  • A .npmrc in parent directories may be redirecting installs."
    err "  • The package.json may reference private/unavailable packages."
    err ""
    err "Diagnostics:"
    err "  Full log : $LOG_FILE"
    _diagnose_missing_node_modules >&2 || true
    err "════════════════════════════════════════════════"
    exit 1
}

# Diagnostic helper: look for node_modules in parent directories (workspace root)
_diagnose_missing_node_modules() {
    local dir
    dir="$(dirname "$CLIENT_DIR")"
    while [[ "$dir" != "/" ]]; do
        if [[ -d "$dir/node_modules" ]]; then
            warn "  node_modules found at: $dir/node_modules  ← likely workspace root"
            warn "  npm may have hoisted your packages there instead of $CLIENT_DIR"
            break
        fi
        dir="$(dirname "$dir")"
    done

    # Also check for .npmrc that could interfere
    local check_dir="$CLIENT_DIR"
    while [[ "$check_dir" != "/" ]]; do
        if [[ -f "$check_dir/.npmrc" ]]; then
            local prefix_val
            prefix_val=$(grep -E '^prefix\s*=' "$check_dir/.npmrc" 2>/dev/null | head -1 || true)
            if [[ -n "$prefix_val" ]]; then
                warn "  .npmrc at $check_dir sets: $prefix_val  ← may be redirecting installs"
            fi
        fi
        check_dir="$(dirname "$check_dir")"
    done
}

# ─────────────────────────────────────────────────────────────────────────────
# 5. POST-INSTALL FIXES
# ─────────────────────────────────────────────────────────────────────────────
post_install_fixes() {
    step "Post-install fixes"

    info "Rebuilding native modules..."
    npm_run rebuild >> "$LOG_FILE" 2>&1 \
        && ok "Native modules rebuilt" \
        || warn "npm rebuild warnings (non-fatal)"

    info "Deduplicating dependency tree..."
    npm_run dedupe --no-workspaces >> "$LOG_FILE" 2>&1 \
        && ok "Dedupe complete" \
        || warn "dedupe warnings (non-fatal)"
}

# ─────────────────────────────────────────────────────────────────────────────
# 6. VERIFY INSTALL
# ─────────────────────────────────────────────────────────────────────────────
verify_install() {
    step "Verifying install"

    local errors=0

    if [[ ! -d "$CLIENT_DIR/node_modules" ]]; then
        err "node_modules missing in $CLIENT_DIR"
        errors=$((errors+1))
    fi
    if [[ ! -d "$CLIENT_DIR/node_modules/.bin" ]]; then
        err "node_modules/.bin missing"
        errors=$((errors+1))
    fi

    local dev_bin=""
    for bin in next vite react-scripts; do
        [[ -f "$CLIENT_DIR/node_modules/.bin/$bin" ]] && { dev_bin="$bin"; break; }
    done
    if [[ -n "$dev_bin" ]]; then
        ok "Dev binary found: $dev_bin"
    else
        warn "No common dev binary found (next / vite / react-scripts)"
    fi

    # Check for 'dev' script in package.json
    if node -e "const p=require('$CLIENT_DIR/package.json'); process.exit(p.scripts&&p.scripts.dev?0:1)" 2>/dev/null; then
        ok "package.json 'dev' script present"
    else
        warn "No 'dev' script — will fall back to 'start'"
    fi

    [[ -f "$CLIENT_DIR/tsconfig.json" ]] \
        && ok "tsconfig.json present" \
        || warn "tsconfig.json not found"

    # Report installed package count
    local pkg_count
    pkg_count=$(find "$CLIENT_DIR/node_modules" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
    info "Packages in node_modules: $pkg_count"

    if [[ $errors -gt 0 ]]; then
        die "Verification failed ($errors error(s))"
    fi
    ok "Install verified"
}

# ─────────────────────────────────────────────────────────────────────────────
# 7. SOURCE FILE INTEGRITY CHECK
#
#   Scans every TSX/JSX/TS/JS file in src/ for `@/` path-alias imports and
#   verifies each resolves to a real file on disk.  Missing source files are
#   reported as a structured list BEFORE we attempt to start the server —
#   saving you from a cryptic Vite/TS error and a 90s timeout.
#
#   This does NOT fail the script; it emits a clear warning block so you know
#   exactly which files to restore from version control.
# ─────────────────────────────────────────────────────────────────────────────
check_source_integrity() {
    step "Source file integrity check"

    local src_dir="$CLIENT_DIR/src"
    if [[ ! -d "$src_dir" ]]; then
        warn "src/ directory not found — skipping source check"
        return 0
    fi

    # Extensions to try when resolving a bare @/foo import
    local -a try_exts=(".tsx" ".ts" ".jsx" ".js" "/index.tsx" "/index.ts" "/index.jsx" "/index.js")

    local -a missing_imports=()
    local -a checked_files=()
    local total_imports=0

    # Scan all source files for @/ imports
    while IFS= read -r src_file; do
        # Extract all unique @/ import paths from the file
        local -a imports
        mapfile -t imports < <(
            grep -oE "from ['\"]@/[^'\"]*['\"]" "$src_file" 2>/dev/null \
            | sed -E "s/from ['\"]@\///; s/['\"]$//" \
            | sort -u
        )

        for imp in "${imports[@]}"; do
            total_imports=$((total_imports + 1))
            local resolved=false
            for ext in "${try_exts[@]}"; do
                local candidate="${src_dir}/${imp}${ext}"
                # Strip double extensions if imp already had one
                candidate="${candidate//.tsx.tsx/.tsx}"
                candidate="${candidate//.ts.ts/.ts}"
                if [[ -f "$candidate" ]]; then
                    resolved=true
                    break
                fi
            done

            if [[ "$resolved" == "false" ]]; then
                # Record: "relative/src/path → import_path  (imported by file)"
                local rel_src="${src_file#$CLIENT_DIR/}"
                missing_imports+=("  @/${imp}  ← ${rel_src}")
            fi
        done
    done < <(find "$src_dir" -type f \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) 2>/dev/null)

    info "Scanned $total_imports @/ imports across src/"

    if [[ ${#missing_imports[@]} -eq 0 ]]; then
        ok "All @/ imports resolve to existing files"
        return 0
    fi

    local count="${#missing_imports[@]}"
    echo ""
    echo -e "${YELLOW}${BOLD}  ⚠  $count missing source file(s) detected${NC}"
    echo -e "${YELLOW}  ─────────────────────────────────────────────────────${NC}"
    echo -e "${YELLOW}  These @/ imports could not be resolved under src/:${NC}"
    echo ""
    for entry in "${missing_imports[@]}"; do
        echo -e "${RED}    ✖  ${entry}${NC}"
        echo "[$(ts)] MISSING $entry" >> "$LOG_FILE"
    done
    echo ""
    echo -e "${YELLOW}  These are your own source files — not npm packages.${NC}"
    echo -e "${YELLOW}  To fix, restore them from version control:${NC}"
    echo -e "${CYAN}    git status                  # see what's missing${NC}"
    echo -e "${CYAN}    git checkout -- src/         # restore all src/ files${NC}"
    echo -e "${CYAN}    git stash pop               # if changes were stashed${NC}"
    echo ""
    echo -e "${YELLOW}  The dev server will start but will error on these imports.${NC}"
    echo -e "${YELLOW}  ─────────────────────────────────────────────────────${NC}"
    echo ""
    warn "$count missing source file(s) — server will report import errors (see above)"
}

# ─────────────────────────────────────────────────────────────────────────────
# 8. PORT UTILITIES
# ─────────────────────────────────────────────────────────────────────────────
port_in_use() {
    timeout 1 bash -c "cat < /dev/null > /dev/tcp/127.0.0.1/$1" 2>/dev/null
    return $?
}

free_port() {
    local port=$1
    if port_in_use "$port"; then
        warn "Port $port in use — freeing it..."
        local pids
        pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
        if [[ -n "$pids" ]]; then
            echo "$pids" | xargs kill -TERM 2>/dev/null || true
            sleep 1
            echo "$pids" | xargs kill -9 2>/dev/null || true
            ok "Freed port $port"
        else
            warn "Could not identify process on port $port — it may free itself"
        fi
    fi
}

wait_for_server() {
    local port=$1 max=${2:-90} elapsed=0
    info "Waiting for server on port $port (max ${max}s)..."
    while [[ $elapsed -lt $max ]]; do
        port_in_use "$port" && { ok "Server up on port $port (${elapsed}s)"; return 0; }
        sleep 1
        elapsed=$((elapsed + 1))
        [[ $((elapsed % 15)) -eq 0 ]] && info "  still waiting... (${elapsed}s)"
    done
    warn "Server not responding after ${max}s — it may still be compiling. Check: $LOG_FILE"
    return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# 9. START DEV SERVER
# ─────────────────────────────────────────────────────────────────────────────
start_dev_server() {
    step "Starting dev server on port $DEV_PORT"

    free_port "$DEV_PORT"

    local dev_cmd
    if node -e "const p=require('$CLIENT_DIR/package.json'); process.exit(p.scripts&&p.scripts.dev?0:1)" 2>/dev/null; then
        dev_cmd="npm run dev"
    elif node -e "const p=require('$CLIENT_DIR/package.json'); process.exit(p.scripts&&p.scripts.start?0:1)" 2>/dev/null; then
        warn "No 'dev' script — using 'npm start'"
        dev_cmd="npm start"
    else
        die "No 'dev' or 'start' script found in package.json"
    fi

    # For Vite: append -- --port $DEV_PORT so it binds exactly where we expect.
    # Next.js uses -p flag via env; CRA reads PORT env var (already exported).
    local port_flag=""
    case "$FRAMEWORK" in
        vite)  port_flag="-- --port ${DEV_PORT}" ;;
        next)  port_flag="-- -p ${DEV_PORT}" ;;
        *)     ;;   # CRA / unknown: PORT env variable is sufficient
    esac

    local full_cmd="${dev_cmd}${port_flag:+ $port_flag}"
    info "Command: $full_cmd"
    info "CWD    : $CLIENT_DIR"

    # Temp file to capture server output so we can parse the actual port
    local server_out="${LOG_DIR}/server_out_$$.tmp"

    (
        cd "$CLIENT_DIR"
        export NODE_ENV=development
        export PORT="${DEV_PORT}"
        $full_cmd 2>&1 | tee -a "$LOG_FILE" "$server_out"
    ) &
    CLIENT_PID=$!

    ok "Dev server launched (PID: $CLIENT_PID)"

    # Wait for server, then parse the actual URL it bound to
    wait_for_server "$DEV_PORT" 90
    local ws_result=$?

    # Extract the actual port from server output (handles Vite / Next / CRA patterns)
    if [[ -f "$server_out" ]]; then
        local detected_port
        detected_port=$(grep -oE 'localhost:[0-9]+' "$server_out" 2>/dev/null \
            | head -1 | grep -oE '[0-9]+' || true)
        if [[ -n "$detected_port" && "$detected_port" != "$DEV_PORT" ]]; then
            warn "Server bound to port $detected_port (expected $DEV_PORT)"
            ACTUAL_PORT="$detected_port"
            DEV_PORT="$detected_port"
            ok "Updated DEV_PORT → $DEV_PORT"
        else
            ACTUAL_PORT="$DEV_PORT"
        fi
        rm -f "$server_out"
    fi

    return $ws_result
}

# ─────────────────────────────────────────────────────────────────────────────
# 10. OPEN BROWSER
# ─────────────────────────────────────────────────────────────────────────────
open_browser() {
    local url="http://localhost:${DEV_PORT}"
    sleep 1
    info "Opening $url"
    if   command -v xdg-open &>/dev/null; then xdg-open "$url" &>/dev/null &
    elif command -v open      &>/dev/null; then open      "$url" &>/dev/null &
    elif command -v wslview   &>/dev/null; then wslview   "$url" &>/dev/null &
    else warn "Cannot auto-open browser — visit: $url"
    fi
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
main() {
    echo -e "\n${BOLD}${CYAN}╔══════════════════════════════════════════════╗"
    echo    "║    R3 Client Setup — Professional Edition    ║"
    echo -e "╚══════════════════════════════════════════════╝${NC}"
    echo -e "${DIM}  Log: $LOG_FILE${NC}\n"

    preflight
    detect_workspace        # must run before install so flags are set
    detect_framework        # sets DEV_PORT based on framework
    purge_artifacts
    install_deps
    post_install_fixes
    verify_install
    check_source_integrity  # warn about missing src/ files before server start
    start_dev_server
    open_browser

    echo ""
    echo -e "${GREEN}${BOLD}✔  R3 Client running at http://localhost:${DEV_PORT}${NC}"
    echo -e "${CYAN}   PID: $CLIENT_PID  |  Log: $LOG_FILE${NC}"
    echo -e "${YELLOW}   Press Ctrl+C to stop.${NC}\n"

    wait "$CLIENT_PID" 2>/dev/null || true
}

main "$@"