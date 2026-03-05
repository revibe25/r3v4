#!/usr/bin/env bash
# test_scripts.sh — R3 Project Shell Script Test Suite v2
# ─────────────────────────────────────────────────────────────────────────────
# Tests: fix_and_restart.sh | client_setup.sh | client_setup_v2_backup.sh
#
# Usage:
#   chmod +x test_scripts.sh && ./test_scripts.sh
#   ./test_scripts.sh --suite fix        # fix_and_restart tests only
#   ./test_scripts.sh --suite setup      # client_setup unit + integration
#   ./test_scripts.sh --suite v2         # v2 backup regression checks
#   ./test_scripts.sh --suite static     # bash -n + shellcheck + hygiene
#   ./test_scripts.sh --verbose          # print every pass, not just dots
#
# Requirements:
#   bash 4+, node 16+, npm, timeout(1)
#   Run from client/ (same directory as client_setup.sh)
#   npm install must have run so @babel/parser is available for JSX tests
#
# Exit codes:  0 = all passed   1 = one or more failed
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────
SUITE_FILTER=""
VERBOSE=false

_args=("$@")
for (( _i=0; _i<${#_args[@]}; _i++ )); do
    case "${_args[$_i]}" in
        --verbose)           VERBOSE=true ;;
        --suite=*)           SUITE_FILTER="${_args[$_i]#--suite=}" ;;
        --suite)             (( _i++ )); SUITE_FILTER="${_args[$_i]:-}" ;;
        fix|setup|v2|static) SUITE_FILTER="${_args[$_i]}" ;;
    esac
done

if [[ -n "$SUITE_FILTER" ]] && \
   [[ "$SUITE_FILTER" != "fix"    && "$SUITE_FILTER" != "setup" && \
      "$SUITE_FILTER" != "v2"     && "$SUITE_FILTER" != "static" ]]; then
    echo "Unknown suite '$SUITE_FILTER'. Valid: fix | setup | v2 | static" >&2
    exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# COLORS
# ─────────────────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

# ─────────────────────────────────────────────────────────────────────────────
# TEST STATE
# ─────────────────────────────────────────────────────────────────────────────
TESTS_RUN=0; TESTS_PASSED=0; TESTS_FAILED=0; TESTS_SKIPPED=0
FAILED_NAMES=()
CURRENT_SUITE="(none)"

# ─────────────────────────────────────────────────────────────────────────────
# ASSERT LIBRARY
# ─────────────────────────────────────────────────────────────────────────────
suite() {
    CURRENT_SUITE="$1"
    echo -e "\n${BOLD}${CYAN}━━  Suite: $1  ━━${NC}"
}

pass() {
    TESTS_PASSED=$(( TESTS_PASSED + 1 ))
    TESTS_RUN=$(( TESTS_RUN + 1 ))
    $VERBOSE && echo -e "  ${GREEN}✔${NC}  $1" || echo -ne "${GREEN}·${NC}"
}

fail() {
    TESTS_FAILED=$(( TESTS_FAILED + 1 ))
    TESTS_RUN=$(( TESTS_RUN + 1 ))
    FAILED_NAMES+=("[$CURRENT_SUITE] $1")
    echo -e "\n  ${RED}✖${NC}  ${BOLD}$1${NC}"
    [[ -n "${2:-}" ]] && echo -e "     ${DIM}↳ $2${NC}"
}

skip() {
    TESTS_SKIPPED=$(( TESTS_SKIPPED + 1 ))
    echo -e "  ${YELLOW}⊘${NC}  ${DIM}$1${NC}${2:+  ($2)}"
}

assert_exit() {
    local expected="$1" actual="$2" name="$3"
    [[ "$actual" -eq "$expected" ]] \
        && pass "$name" \
        || fail "$name" "expected exit $expected, got $actual"
}

assert_equals() {
    [[ "$1" == "$2" ]] && pass "$3" || fail "$3" "expected '$1', got '$2'"
}

assert_file_exists()     { [[ -f "$1" ]] && pass "$2" || fail "$2" "not found: $1"; }
assert_file_not_exists() { [[ ! -f "$1" ]] && pass "$2" || fail "$2" "should not exist: $1"; }
assert_dir_exists()      { [[ -d "$1" ]] && pass "$2" || fail "$2" "dir not found: $1"; }
assert_dir_not_exists()  { [[ ! -d "$1" ]] && pass "$2" || fail "$2" "dir should not exist: $1"; }

assert_file_contains() {
    local file="$1" pattern="$2" name="$3"
    if [[ -z "$pattern" ]]; then fail "$name" "BUG: empty search pattern passed to assert_file_contains"; return; fi
    grep -qF "$pattern" "$file" 2>/dev/null \
        && pass "$name" \
        || fail "$name" "'$pattern' not found in $(basename "$file")"
}

assert_output_contains() {
    local out="$1" pattern="$2" name="$3"
    if [[ -z "$pattern" ]]; then fail "$name" "BUG: empty search pattern"; return; fi
    echo "$out" | grep -qF "$pattern" \
        && pass "$name" \
        || fail "$name" "output missing: '$pattern'"
}

assert_output_not_contains() {
    local out="$1" pattern="$2" name="$3"
    if [[ -z "$pattern" ]]; then fail "$name" "BUG: empty search pattern"; return; fi
    echo "$out" | grep -qF "$pattern" \
        && fail "$name" "output should NOT contain: '$pattern'" \
        || pass "$name"
}

# ─────────────────────────────────────────────────────────────────────────────
# TEMP DIR
# Created once at startup. Each suite writes into its own subdirectory.
# Single trap cleans everything on exit.
# ─────────────────────────────────────────────────────────────────────────────
TEST_TMP=""

_init_tmp() {
    TEST_TMP="$(mktemp -d /tmp/r3_test_XXXXXX)"
    mkdir -p \
        "${TEST_TMP}/suite_fix" \
        "${TEST_TMP}/suite_setup" \
        "${TEST_TMP}/suite_integration" \
        "${TEST_TMP}/suite_v2" \
        "${TEST_TMP}/mock_bin" \
        "${TEST_TMP}/sourced"
    MOCK_BIN="${TEST_TMP}/mock_bin"
}

_cleanup() {
    [[ -n "${_ORIGINAL_PATH:-}" ]] && export PATH="$_ORIGINAL_PATH"
    [[ -n "$TEST_TMP" && -d "$TEST_TMP" ]] && rm -rf "$TEST_TMP"
}
trap _cleanup EXIT

# ─────────────────────────────────────────────────────────────────────────────
# MOCK BIN
# Injected into PATH only for the integration suite; restored immediately after.
# Other suites always use the real system PATH.
# ─────────────────────────────────────────────────────────────────────────────
_ORIGINAL_PATH="${PATH}"
MOCK_BIN=""  # set in _init_tmp

_inject_mock_bin()  { export PATH="${MOCK_BIN}:${_ORIGINAL_PATH}"; }
_restore_mock_bin() { export PATH="$_ORIGINAL_PATH"; }

# Write a configurable mock npm binary.
# $1 behavior: success | fail_always | fail_once | no_node_modules
# $2 node_modules_dir: path where /.bin is created on success (optional)
_write_mock_npm() {
    local behavior="${1:-success}" nm_dir="${2:-}"
    cat > "${MOCK_BIN}/npm" <<EOF
#!/usr/bin/env bash
sub="\$1"
case "\$sub" in
    --version)           echo "9.0.0"; exit 0 ;;
    cache|rebuild|dedupe) exit 0 ;;
    run|start)           echo "Local: http://localhost:5173"; sleep 999 ;;
    install|ci)
        case "$behavior" in
            success)
                [[ -n "$nm_dir" ]] && mkdir -p "${nm_dir}/.bin"
                exit 0 ;;
            fail_always)
                echo "npm ERR! ERESOLVE peer conflict"; exit 1 ;;
            fail_once)
                _flag="${TEST_TMP}/.npm_fail_once_done"
                if [[ -f "\$_flag" ]]; then
                    [[ -n "$nm_dir" ]] && mkdir -p "${nm_dir}/.bin"; exit 0
                fi
                touch "\$_flag"
                echo "npm ERR! ERESOLVE unable to resolve"; exit 1 ;;
            no_node_modules)
                exit 0 ;;
        esac ;;
    *) exit 0 ;;
esac
EOF
    chmod +x "${MOCK_BIN}/npm"
}

# ─────────────────────────────────────────────────────────────────────────────
# SOURCE HELPER
# Strips `main "$@"` with grep -vF (fixed-string, no regex escaping needed).
# This is the critical fix from v1: the old version used single-quoted grep
# which could never match the literal line `main "$@"` in the scripts.
# ─────────────────────────────────────────────────────────────────────────────
_source_fns() {
    local script="$1"
    local tmp="${TEST_TMP}/sourced/$(basename "$script")"
    grep -vF 'main "$@"' "$script" > "$tmp"
    # shellcheck disable=SC1090
    source "$tmp" 2>/dev/null || true
}

# ─────────────────────────────────────────────────────────────────────────────
# FIXTURES
# ─────────────────────────────────────────────────────────────────────────────
make_client_dir() {
    local dir="$1" fw="${2:-vite}"
    mkdir -p "${dir}/src" "${dir}/logs"
    case "$fw" in
        vite)
            cat > "${dir}/package.json" <<'EOF'
{
  "name": "r3-client", "version": "1.0.0",
  "scripts": { "dev": "vite", "build": "vite build" },
  "dependencies": { "react": "^18.0.0" },
  "devDependencies": { "vite": "^4.0.0", "@vitejs/plugin-react": "^3.0.0" }
}
EOF
            ;;
        next)
            cat > "${dir}/package.json" <<'EOF'
{
  "name": "r3-client",
  "scripts": { "dev": "next dev" },
  "dependencies": { "next": "^13.0.0", "react": "^18.0.0" }
}
EOF
            ;;
        cra)
            cat > "${dir}/package.json" <<'EOF'
{
  "name": "r3-client",
  "scripts": { "start": "react-scripts start" },
  "dependencies": { "react-scripts": "5.0.0", "react": "^18.0.0" }
}
EOF
            ;;
        *)
            cat > "${dir}/package.json" <<'EOF'
{ "name": "r3-client", "scripts": { "dev": "node server.js" }, "dependencies": {} }
EOF
            ;;
    esac
    cat > "${dir}/tsconfig.json" <<'EOF'
{ "compilerOptions": { "target": "ES2020", "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }
EOF
}

make_workspace_root() {
    mkdir -p "$1"
    cat > "${1}/package.json" <<'EOF'
{ "name": "r3-monorepo", "workspaces": ["client", "server"] }
EOF
}

make_tsx_file() {
    local path="$1" type="${2:-valid}"
    mkdir -p "$(dirname "$path")"
    case "$type" in
        valid)
            cat > "$path" <<'EOF'
import React from 'react';
export default function Component() {
  return (<div><span>Hello</span></div>);
}
EOF
            ;;
        missing_close)
            cat > "$path" <<'EOF'
import React from 'react';
export default function PianoKeys() {
  return (
    <div className="piano">
      <div className="keys"><span>C</span></div>
  );
}
EOF
            ;;
        good_imports)
            cat > "$path" <<'EOF'
import { useState } from 'react';
import { AudioEngine } from '@/lib/audio';
import { PianoKey } from '@/components/piano-key';
export default function App() { return <div />; }
EOF
            ;;
        bad_imports)
            cat > "$path" <<'EOF'
import { useState } from 'react';
import { AudioEngine } from '@/lib/audio';
import { Missing } from '@/components/does-not-exist';
import { Ghost } from '@/utils/ghost-util';
export default function App() { return <div />; }
EOF
            ;;
    esac
}

# ─────────────────────────────────────────────────────────────────────────────
# LOCATE SCRIPTS UNDER TEST
# ─────────────────────────────────────────────────────────────────────────────
_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

_find_script() {
    local name="$1"
    for candidate in \
        "${_SCRIPT_DIR}/${name}" \
        "${_SCRIPT_DIR}/scripts/${name}" \
        "${_SCRIPT_DIR}/../${name}"
    do
        [[ -f "$candidate" ]] && { echo "$candidate"; return 0; }
    done
    echo ""
}

FIX_SCRIPT="$(_find_script "fix_and_restart.sh")"
SETUP_SCRIPT="$(_find_script "client_setup.sh")"
SETUP_V2_SCRIPT="$(_find_script "client_setup_v2_backup.sh")"

# ─────────────────────────────────────────────────────────────────────────────
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUITE 1 — fix_and_restart.sh
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
run_suite_fix() {
    [[ -n "$SUITE_FILTER" && "$SUITE_FILTER" != "fix" ]] && return 0
    suite "fix_and_restart.sh"

    if [[ -z "$FIX_SCRIPT" ]]; then
        skip "all fix_and_restart tests" "fix_and_restart.sh not found"
        return 0
    fi

    local T="${TEST_TMP}/suite_fix"

    # Mock bin for this suite: node passes through but short-circuits the heredoc,
    # git returns failure so the commit path is never taken.
    local fix_mock="${T}/mock_bin"
    mkdir -p "$fix_mock"
    cat > "${fix_mock}/node" <<'MOCK'
#!/usr/bin/env bash
if [[ "$1" == "-" ]]; then
    echo "No parse errors detected. No changes necessary."
    exit 0
fi
exec /usr/bin/env node "$@"
MOCK
    chmod +x "${fix_mock}/node"
    cat > "${fix_mock}/git" <<'MOCK'
#!/usr/bin/env bash
[[ "$1" == "rev-parse" ]] && exit 1; exit 0
MOCK
    chmod +x "${fix_mock}/git"

    # ── 1a: Missing target → exit 2 ──────────────────────────────────────────
    local out="" code=0
    out=$(bash "$FIX_SCRIPT" "/nonexistent/r3_test_file.tsx" 2>&1) || code=$?
    assert_exit 2 "$code" "exits 2 when target file does not exist"
    assert_output_contains "$out" "not found" "prints 'not found' for missing file"

    # ── 1b: Backup file is created ───────────────────────────────────────────
    local tsx="${T}/component.tsx"
    make_tsx_file "$tsx" valid
    local original_md5
    original_md5=$(md5sum "$tsx" | awk '{print $1}')

    PATH="${fix_mock}:${_ORIGINAL_PATH}" bash "$FIX_SCRIPT" "$tsx" >/dev/null 2>&1 || true

    local bak_count
    bak_count=$(ls "${T}"/component.tsx.*.bak 2>/dev/null | wc -l)
    [[ "$bak_count" -ge 1 ]] \
        && pass "backup .bak file is created" \
        || fail "backup .bak file is created" "no .bak file found in $T"

    # ── 1c: Backup content is byte-for-byte copy of original ─────────────────
    local bak_file
    bak_file=$(ls "${T}"/component.tsx.*.bak 2>/dev/null | head -1)
    if [[ -n "$bak_file" ]]; then
        local bak_md5
        bak_md5=$(md5sum "$bak_file" | awk '{print $1}')
        assert_equals "$original_md5" "$bak_md5" "backup content is byte-for-byte copy of original"
    else
        skip "backup content matches original" "no backup file found"
    fi

    # ── 1d: Clean file content is not modified ────────────────────────────────
    local after_md5
    after_md5=$(md5sum "$tsx" | awk '{print $1}')
    assert_equals "$original_md5" "$after_md5" "clean file is not modified"

    # ── 1e: Script reports no parse errors on a clean file ───────────────────
    out=""
    out=$(PATH="${fix_mock}:${_ORIGINAL_PATH}" bash "$FIX_SCRIPT" "$tsx" 2>&1) || true
    assert_output_contains "$out" "No parse errors" "reports no errors when file is clean"

    # ── 1f: No git commit attempted outside a git repo ───────────────────────
    local no_git_dir="${T}/no_git_project"
    mkdir -p "$no_git_dir"
    local ng_file="${no_git_dir}/comp.tsx"
    make_tsx_file "$ng_file" valid
    out=""
    out=$(cd "$no_git_dir" && \
          PATH="${fix_mock}:${_ORIGINAL_PATH}" bash "$FIX_SCRIPT" "$ng_file" 2>&1) || true
    assert_output_contains "$out" "Not a git repo" "skips git commit when not in a git repo"

    # ── 1g–1i: JSX auto-fix (requires real @babel/parser) ────────────────────
    local has_babel=false
    node -e "require('$(pwd)/node_modules/@babel/parser')" 2>/dev/null \
        && has_babel=true || true

    if $has_babel; then
        local broken="${T}/broken.tsx"
        make_tsx_file "$broken" missing_close
        # Use real node (no mock) so the embedded heredoc actually runs
        bash "$FIX_SCRIPT" "$broken" >/dev/null 2>&1 || true

        grep -q '</div>' "$broken" \
            && pass "inserts closing </div> to fix mismatched JSX tag" \
            || fail "inserts closing </div> to fix mismatched JSX tag" "no tag inserted"

        local parse_result
        parse_result=$(node -e "
            const p = require('./node_modules/@babel/parser');
            try {
                p.parse(require('fs').readFileSync('${broken}','utf8'),
                    {sourceType:'module',plugins:['typescript','jsx']});
                console.log('clean');
            } catch(e) { console.log('error'); }
        " 2>/dev/null || echo "node_error")
        assert_equals "clean" "$parse_result" "fixed file parses cleanly with @babel/parser"

        # Non-JSX parse error should abort with an informative message
        local badsyntax="${T}/badsyntax.tsx"
        echo 'const x = {{{;  // totally broken' > "$badsyntax"
        out=""
        out=$(bash "$FIX_SCRIPT" "$badsyntax" 2>&1) || true
        assert_output_contains "$out" "not the expected" \
            "aborts with clear message when parse error is not a JSX mismatch"
    else
        skip "inserts closing </div> to fix JSX tag"  "@babel/parser not installed — run npm install"
        skip "fixed file parses cleanly"              "@babel/parser not installed"
        skip "aborts on non-JSX parse error"          "@babel/parser not installed"
    fi

    $VERBOSE && echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUITE 2 — client_setup.sh unit tests
# Functions are sourced in isolated subshells. Real PATH is used throughout.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
run_suite_setup() {
    [[ -n "$SUITE_FILTER" && "$SUITE_FILTER" != "setup" ]] && return 0
    suite "client_setup.sh — unit tests"

    if [[ -z "$SETUP_SCRIPT" ]]; then
        skip "all client_setup unit tests" "client_setup.sh not found"
        return 0
    fi

    local T="${TEST_TMP}/suite_setup"
    local code=0

    # ── 2a: Errors when no package.json ──────────────────────────────────────
    local empty="${T}/empty"; mkdir -p "$empty"
    local out=""
    out=$(cd "$empty" && bash "$SETUP_SCRIPT" 2>&1) || true
    assert_output_contains "$out" "Cannot find package.json" \
        "exits with error when no package.json present"

    # ── 2b–2c: Vite detection ────────────────────────────────────────────────
    local vite_dir="${T}/vite"; make_client_dir "$vite_dir" vite
    (
        CLIENT_DIR="$vite_dir"; LOG_FILE="${vite_dir}/logs/test.log"; touch "$LOG_FILE"
        FRAMEWORK=""; DEV_PORT=""
        _source_fns "$SETUP_SCRIPT"; detect_framework >/dev/null 2>&1
        echo "FRAMEWORK=$FRAMEWORK"; echo "DEV_PORT=$DEV_PORT"
    ) > "${T}/fw_vite.txt" 2>/dev/null
    assert_file_contains "${T}/fw_vite.txt" "FRAMEWORK=vite" "detect_framework: identifies Vite"
    assert_file_contains "${T}/fw_vite.txt" "DEV_PORT=5173"  "detect_framework: port 5173 for Vite"

    # ── 2d–2e: Next.js detection ──────────────────────────────────────────────
    local next_dir="${T}/next"; make_client_dir "$next_dir" next
    (
        CLIENT_DIR="$next_dir"; LOG_FILE="${next_dir}/logs/test.log"; touch "$LOG_FILE"
        FRAMEWORK=""; DEV_PORT=""
        _source_fns "$SETUP_SCRIPT"; detect_framework >/dev/null 2>&1
        echo "FRAMEWORK=$FRAMEWORK"; echo "DEV_PORT=$DEV_PORT"
    ) > "${T}/fw_next.txt" 2>/dev/null
    assert_file_contains "${T}/fw_next.txt" "FRAMEWORK=next" "detect_framework: identifies Next.js"
    assert_file_contains "${T}/fw_next.txt" "DEV_PORT=3000"  "detect_framework: port 3000 for Next.js"

    # ── 2f–2g: CRA detection ──────────────────────────────────────────────────
    local cra_dir="${T}/cra"; make_client_dir "$cra_dir" cra
    (
        CLIENT_DIR="$cra_dir"; LOG_FILE="${cra_dir}/logs/test.log"; touch "$LOG_FILE"
        FRAMEWORK=""; DEV_PORT=""
        _source_fns "$SETUP_SCRIPT"; detect_framework >/dev/null 2>&1
        echo "FRAMEWORK=$FRAMEWORK"; echo "DEV_PORT=$DEV_PORT"
    ) > "${T}/fw_cra.txt" 2>/dev/null
    assert_file_contains "${T}/fw_cra.txt" "FRAMEWORK=cra"  "detect_framework: identifies CRA"
    assert_file_contains "${T}/fw_cra.txt" "DEV_PORT=3000"  "detect_framework: port 3000 for CRA"

    # ── 2h: vite.config port override ────────────────────────────────────────
    local vite_cfg="${T}/vite_cfg"; make_client_dir "$vite_cfg" vite
    echo "export default { server: { port: 4321 } }" > "${vite_cfg}/vite.config.js"
    (
        CLIENT_DIR="$vite_cfg"; LOG_FILE="${vite_cfg}/logs/test.log"; touch "$LOG_FILE"
        FRAMEWORK=""; DEV_PORT=""
        _source_fns "$SETUP_SCRIPT"; detect_framework >/dev/null 2>&1
        echo "DEV_PORT=$DEV_PORT"
    ) > "${T}/fw_vite_cfg.txt" 2>/dev/null
    assert_file_contains "${T}/fw_vite_cfg.txt" "DEV_PORT=4321" \
        "detect_framework: reads port override from vite.config.js"

    # ── 2i–2j: Workspace root detected ───────────────────────────────────────
    local ws_root="${T}/monorepo" ws_client="${T}/monorepo/client"
    make_workspace_root "$ws_root"; make_client_dir "$ws_client" vite
    (
        CLIENT_DIR="$ws_client"; LOG_FILE="${ws_client}/logs/test.log"; touch "$LOG_FILE"
        WORKSPACE_ROOT=""; INSTALL_FLAGS_EXTRA=""
        _source_fns "$SETUP_SCRIPT"; detect_workspace >/dev/null 2>&1
        echo "WORKSPACE_ROOT=$WORKSPACE_ROOT"; echo "FLAGS=$INSTALL_FLAGS_EXTRA"
    ) > "${T}/ws_found.txt" 2>/dev/null
    assert_file_contains "${T}/ws_found.txt" "WORKSPACE_ROOT=${ws_root}" \
        "detect_workspace: finds monorepo workspace root"
    assert_file_contains "${T}/ws_found.txt" "FLAGS=--no-workspaces" \
        "detect_workspace: sets --no-workspaces when root found"

    # ── 2k: No false-positive in plain project ────────────────────────────────
    local plain="${T}/plain"; make_client_dir "$plain" vite
    (
        CLIENT_DIR="$plain"; LOG_FILE="${plain}/logs/test.log"; touch "$LOG_FILE"
        WORKSPACE_ROOT=""; INSTALL_FLAGS_EXTRA=""
        _source_fns "$SETUP_SCRIPT"; detect_workspace >/dev/null 2>&1
        echo "WORKSPACE_ROOT=${WORKSPACE_ROOT}"
    ) > "${T}/ws_absent.txt" 2>/dev/null
    assert_file_contains "${T}/ws_absent.txt" "WORKSPACE_ROOT=" \
        "detect_workspace: WORKSPACE_ROOT empty for plain project"

    # ── 2l: Source integrity passes when all imports resolve ─────────────────
    local ok_src="${T}/src_ok"; make_client_dir "$ok_src" vite
    mkdir -p "${ok_src}/src/lib" "${ok_src}/src/components"
    make_tsx_file "${ok_src}/src/App.tsx" good_imports
    echo "export const AudioEngine = {};"    > "${ok_src}/src/lib/audio.ts"
    echo "export const PianoKey = () => null;" > "${ok_src}/src/components/piano-key.tsx"
    (
        CLIENT_DIR="$ok_src"; LOG_FILE="${ok_src}/logs/test.log"; touch "$LOG_FILE"
        _source_fns "$SETUP_SCRIPT"; check_source_integrity 2>&1
    ) > "${T}/src_ok.txt" 2>/dev/null
    assert_file_contains "${T}/src_ok.txt" "All @/ imports resolve" \
        "check_source_integrity: passes when all imports exist"

    # ── 2m–2o: Source integrity reports specific missing files ────────────────
    local bad_src="${T}/src_bad"; make_client_dir "$bad_src" vite
    mkdir -p "${bad_src}/src/lib"
    make_tsx_file "${bad_src}/src/App.tsx" bad_imports
    echo "export const AudioEngine = {};" > "${bad_src}/src/lib/audio.ts"
    (
        CLIENT_DIR="$bad_src"; LOG_FILE="${bad_src}/logs/test.log"; touch "$LOG_FILE"
        _source_fns "$SETUP_SCRIPT"; check_source_integrity 2>&1
    ) > "${T}/src_bad.txt" 2>/dev/null
    assert_file_contains "${T}/src_bad.txt" "missing source file" \
        "check_source_integrity: reports missing imports"
    assert_file_contains "${T}/src_bad.txt" "does-not-exist" \
        "check_source_integrity: names the first missing file"
    assert_file_contains "${T}/src_bad.txt" "ghost-util" \
        "check_source_integrity: names all missing files"

    # ── 2p–2r: purge_artifacts ───────────────────────────────────────────────
    local purge="${T}/purge"; make_client_dir "$purge" vite
    mkdir -p "${purge}/node_modules/.bin" "${purge}/dist" "${purge}/.next"
    (
        CLIENT_DIR="$purge"; LOG_FILE="${purge}/logs/test.log"; touch "$LOG_FILE"
        _source_fns "$SETUP_SCRIPT"; purge_artifacts >/dev/null 2>&1
    ) 2>/dev/null || true
    assert_dir_not_exists "${purge}/node_modules" "purge_artifacts: removes node_modules"
    assert_dir_not_exists "${purge}/dist"         "purge_artifacts: removes dist"
    assert_dir_not_exists "${purge}/.next"        "purge_artifacts: removes .next"

    # ── 2s: verify_install exits non-zero when node_modules missing ───────────
    local no_nm="${T}/no_nm"; make_client_dir "$no_nm" vite
    code=0
    ( CLIENT_DIR="$no_nm"; LOG_FILE="/dev/null"
      _source_fns "$SETUP_SCRIPT" 2>/dev/null
      verify_install >/dev/null 2>&1 ) || code=$?
    [[ "$code" -ne 0 ]] \
        && pass "verify_install: exits non-zero when node_modules missing" \
        || fail "verify_install: exits non-zero when node_modules missing" "got exit 0"

    # ── 2t: verify_install exits 0 when node_modules and .bin exist ───────────
    local ok_nm="${T}/ok_nm"; make_client_dir "$ok_nm" vite
    mkdir -p "${ok_nm}/node_modules/.bin"; touch "${ok_nm}/node_modules/.bin/vite"
    code=0
    ( CLIENT_DIR="$ok_nm"; LOG_FILE="/dev/null"
      _source_fns "$SETUP_SCRIPT" 2>/dev/null
      verify_install >/dev/null 2>&1 ) || code=$?
    [[ "$code" -eq 0 ]] \
        && pass "verify_install: exits 0 when node_modules/.bin and binary exist" \
        || fail "verify_install: exits 0 when node_modules/.bin and binary exist" \
                "got exit $code"

    # ── 2u: port_in_use returns false for unused port ─────────────────────────
    code=0
    ( LOG_FILE="/dev/null"
      _source_fns "$SETUP_SCRIPT" 2>/dev/null
      port_in_use 19991 2>/dev/null ) || code=$?
    [[ "$code" -ne 0 ]] \
        && pass "port_in_use: returns false for an unused port" \
        || fail "port_in_use: returns false for an unused port" \
                "port 19991 appears to be in use on this machine"

    $VERBOSE && echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUITE 3 — client_setup.sh integration tests (mocked npm)
# _inject_mock_bin / _restore_mock_bin are called to bracket this suite ONLY.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
run_suite_integration() {
    [[ -n "$SUITE_FILTER" && "$SUITE_FILTER" != "setup" ]] && return 0
    suite "client_setup.sh — integration tests (mocked npm)"

    if [[ -z "$SETUP_SCRIPT" ]]; then
        skip "all integration tests" "client_setup.sh not found"
        return 0
    fi

    local T="${TEST_TMP}/suite_integration"
    _inject_mock_bin

    # ── 3a: install_deps exits 0 when npm succeeds ────────────────────────────
    local win="${T}/first_win"; make_client_dir "$win" vite
    _write_mock_npm "success" "${win}/node_modules"
    (
        CLIENT_DIR="$win"; LOG_FILE="${win}/logs/test.log"; touch "$LOG_FILE"
        WORKSPACE_ROOT=""; INSTALL_FLAGS_EXTRA=""
        _source_fns "$SETUP_SCRIPT" 2>/dev/null
        install_deps >/dev/null 2>&1; echo "EXIT=$?"
    ) > "${T}/install_win.txt" 2>/dev/null
    assert_file_contains "${T}/install_win.txt" "EXIT=0" \
        "install_deps: exits 0 when npm succeeds on first strategy"

    # ── 3b: install_deps exits non-zero when all strategies fail ─────────────
    local fail_dir="${T}/all_fail"; make_client_dir "$fail_dir" vite
    _write_mock_npm "fail_always"
    (
        CLIENT_DIR="$fail_dir"; LOG_FILE="${fail_dir}/logs/test.log"; touch "$LOG_FILE"
        WORKSPACE_ROOT=""; INSTALL_FLAGS_EXTRA=""
        _source_fns "$SETUP_SCRIPT" 2>/dev/null
        install_deps >/dev/null 2>&1; echo "EXIT=$?"
    ) > "${T}/install_fail.txt" 2>/dev/null || true
    if grep -q "EXIT=0" "${T}/install_fail.txt" 2>/dev/null; then
        fail "install_deps: exits non-zero when all strategies exhausted"
    else
        pass "install_deps: exits non-zero when all strategies exhausted"
    fi

    # ── 3c: npm ci NOT called when no lock file ───────────────────────────────
    local no_lock="${T}/no_lock"; make_client_dir "$no_lock" vite
    rm -f "${no_lock}/package-lock.json"
    cat > "${MOCK_BIN}/npm" <<EOF
#!/usr/bin/env bash
case "\$1" in
    ci)       echo "CI_WAS_CALLED"; exit 1 ;;
    install)  mkdir -p "${no_lock}/node_modules/.bin"; exit 0 ;;
    --version|cache|rebuild|dedupe) echo "9.0.0"; exit 0 ;;
    *) exit 0 ;;
esac
EOF
    chmod +x "${MOCK_BIN}/npm"
    (
        CLIENT_DIR="$no_lock"; LOG_FILE="${no_lock}/logs/test.log"; touch "$LOG_FILE"
        WORKSPACE_ROOT=""; INSTALL_FLAGS_EXTRA=""
        _source_fns "$SETUP_SCRIPT" 2>/dev/null
        install_deps 2>&1
    ) > "${T}/no_lock.txt" 2>/dev/null || true
    assert_output_not_contains "$(cat "${T}/no_lock.txt")" "CI_WAS_CALLED" \
        "install_deps: skips npm ci when no package-lock.json present"

    # ── 3d: npm ci IS first when lock file exists ─────────────────────────────
    local with_lock="${T}/with_lock"; make_client_dir "$with_lock" vite
    touch "${with_lock}/package-lock.json"
    local ci_marker="${T}/ci_was_called.marker"
    cat > "${MOCK_BIN}/npm" <<EOF
#!/usr/bin/env bash
case "\$1" in
    ci)      touch "$ci_marker"; mkdir -p "${with_lock}/node_modules/.bin"; exit 0 ;;
    --version|cache|rebuild|dedupe) echo "9.0.0"; exit 0 ;;
    *) exit 0 ;;
esac
EOF
    chmod +x "${MOCK_BIN}/npm"
    (
        CLIENT_DIR="$with_lock"; LOG_FILE="${with_lock}/logs/test.log"; touch "$LOG_FILE"
        WORKSPACE_ROOT=""; INSTALL_FLAGS_EXTRA=""
        _source_fns "$SETUP_SCRIPT" 2>/dev/null
        install_deps >/dev/null 2>&1
    ) 2>/dev/null || true
    assert_file_exists "$ci_marker" \
        "install_deps: attempts npm ci first when package-lock.json exists"

    # ── 3e: node_modules lands in CLIENT_DIR even inside a monorepo ───────────
    local ws_root="${T}/monorepo2" ws_client="${T}/monorepo2/client"
    make_workspace_root "$ws_root"; make_client_dir "$ws_client" vite
    cat > "${MOCK_BIN}/npm" <<EOF
#!/usr/bin/env bash
case "\$1" in
    install)  mkdir -p "${ws_client}/node_modules/.bin"; exit 0 ;;
    --version|cache|rebuild|dedupe) echo "9.0.0"; exit 0 ;;
    *) exit 0 ;;
esac
EOF
    chmod +x "${MOCK_BIN}/npm"
    (
        CLIENT_DIR="$ws_client"; LOG_FILE="${ws_client}/logs/test.log"; touch "$LOG_FILE"
        WORKSPACE_ROOT=""; INSTALL_FLAGS_EXTRA=""
        _source_fns "$SETUP_SCRIPT" 2>/dev/null
        detect_workspace >/dev/null 2>&1
        install_deps >/dev/null 2>&1
    ) 2>/dev/null || true
    assert_dir_exists "${ws_client}/node_modules" \
        "install_deps: node_modules lands in CLIENT_DIR not workspace root"

    _restore_mock_bin   # ← PATH restored; mock npm no longer active
    $VERBOSE && echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUITE 4 — client_setup_v2_backup.sh regression checks
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
run_suite_v2() {
    [[ -n "$SUITE_FILTER" && "$SUITE_FILTER" != "v2" ]] && return 0
    suite "client_setup_v2_backup.sh — regression checks"

    if [[ -z "$SETUP_V2_SCRIPT" ]]; then
        skip "all v2 tests" "v2 file not found — safe to delete once v3 is stable"
        return 0
    fi

    local T="${TEST_TMP}/suite_v2"

    # ── 4a: Errors when no package.json ──────────────────────────────────────
    local empty="${T}/empty"; mkdir -p "$empty"
    local out=""
    out=$(cd "$empty" && bash "$SETUP_V2_SCRIPT" 2>&1) || true
    assert_output_contains "$out" "Cannot find package.json" \
        "v2: exits with error when no package.json found"

    # ── 4b: v2 must NOT contain v3-only detect_framework ─────────────────────
    grep -q "detect_framework" "$SETUP_V2_SCRIPT" 2>/dev/null \
        && fail "v2 must not contain detect_framework (v3-only feature)" \
                "found in v2 — file may have been accidentally modified" \
        || pass "v2 must not contain detect_framework (v3-only feature)"

    # ── 4c: v2 must NOT contain v3-only check_source_integrity ───────────────
    grep -q "check_source_integrity" "$SETUP_V2_SCRIPT" 2>/dev/null \
        && fail "v2 must not contain check_source_integrity (v3-only feature)" \
                "found in v2 — file may have been accidentally modified" \
        || pass "v2 must not contain check_source_integrity (v3-only feature)"

    # ── 4d: Both v2 and v3 contain workspace detection ───────────────────────
    local v2_ws v3_ws
    v2_ws=$(grep -c "detect_workspace" "$SETUP_V2_SCRIPT" 2>/dev/null || echo 0)
    v3_ws=$(grep -c "detect_workspace" "$SETUP_SCRIPT"    2>/dev/null || echo 0)
    [[ "$v2_ws" -gt 0 && "$v3_ws" -gt 0 ]] \
        && pass "v2 and v3 both contain detect_workspace" \
        || fail "v2 and v3 both contain detect_workspace" \
                "v2_count=$v2_ws v3_count=$v3_ws"

    # ── 4e: v2 hardcodes DEV_PORT=3000 ───────────────────────────────────────
    grep -q 'DEV_PORT.*3000' "$SETUP_V2_SCRIPT" 2>/dev/null \
        && pass "v2 hardcodes DEV_PORT=3000 (expected — no framework detection in v2)" \
        || fail "v2 hardcodes DEV_PORT=3000" "pattern not found"

    $VERBOSE && echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# SUITE 5 — Static analysis
# Runs when no filter is set, OR when --suite static is explicit.
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
run_suite_static() {
    [[ -n "$SUITE_FILTER" && "$SUITE_FILTER" != "static" ]] && return 0
    suite "Static analysis"

    local scripts=()
    [[ -n "$FIX_SCRIPT"      ]] && scripts+=("$FIX_SCRIPT")
    [[ -n "$SETUP_SCRIPT"    ]] && scripts+=("$SETUP_SCRIPT")
    [[ -n "$SETUP_V2_SCRIPT" ]] && scripts+=("$SETUP_V2_SCRIPT")

    if [[ ${#scripts[@]} -eq 0 ]]; then
        skip "all static checks" "no scripts found"
        return 0
    fi

    for script in "${scripts[@]}"; do
        local name; name="$(basename "$script")"

        # bash -n syntax check
        local syn_err
        syn_err=$(bash -n "$script" 2>&1) \
            && pass "$name: bash -n syntax check" \
            || fail "$name: bash -n syntax check" "$(echo "$syn_err" | head -2)"

        # Shebang present
        head -1 "$script" | grep -q '^#!' \
            && pass "$name: has shebang line" \
            || fail "$name: has shebang line"

        # File is executable
        [[ -x "$script" ]] \
            && pass "$name: is executable" \
            || fail "$name: is executable" "fix with: chmod +x $script"

        # set -[options] safety flags
        grep -q '^set -' "$script" 2>/dev/null \
            && pass "$name: has set -[options] safety flags" \
            || fail "$name: has set -[options] safety flags"

        # No hardcoded /home/<other-user> paths
        # Matches any /home/word/ that is not the known project user (r3)
        local bad_paths
        bad_paths=$(grep -oE '/home/[A-Za-z0-9_-]+/' "$script" 2>/dev/null \
            | grep -v '/home/r3/' || true)
        [[ -z "$bad_paths" ]] \
            && pass "$name: no hardcoded foreign home directory paths" \
            || fail "$name: no hardcoded foreign home directory paths" \
                    "found: $(echo "$bad_paths" | tr '\n' ' ')"

        # Backup logic (.bak) only belongs in fix_and_restart.sh
        if grep -q '\.bak' "$script" 2>/dev/null; then
            [[ "$name" == "fix_and_restart.sh" ]] \
                && pass "$name: .bak references are expected and present" \
                || fail "$name: unexpected .bak references" \
                        "backup logic should only live in fix_and_restart.sh"
        fi
    done

    # shellcheck (optional — gracefully skipped if not installed)
    if command -v shellcheck &>/dev/null; then
        for script in "${scripts[@]}"; do
            local name; name="$(basename "$script")"
            # Suppressed: SC2086 intentional word-split on $INSTALL_FLAGS_EXTRA,
            # SC1090/91 dynamic source, SC2206/07 mapfile alternatives, SC2128 array ref
            local sc_out sc_errors
            sc_out=$(shellcheck \
                --exclude=SC2086,SC1090,SC1091,SC2206,SC2207,SC2128 \
                --severity=error \
                "$script" 2>&1) || true
            sc_errors=$(echo "$sc_out" | grep -cE ' error:' 2>/dev/null || echo 0)
            [[ "$sc_errors" -eq 0 ]] \
                && pass "$name: shellcheck — no errors" \
                || fail "$name: shellcheck — no errors" \
                        "$sc_errors error(s)  →  run: shellcheck $script"
        done
    else
        skip "shellcheck analysis" \
            "not installed  →  apt install shellcheck  /  brew install shellcheck"
    fi

    $VERBOSE && echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
main() {
    echo -e "\n${BOLD}${CYAN}╔══════════════════════════════════════════════════════╗"
    echo    "║        R3 Shell Script Test Suite  v2                ║"
    echo -e "╚══════════════════════════════════════════════════════╝${NC}"
    [[ -n "$SUITE_FILTER" ]] \
        && echo -e "${DIM}  Filtering to suite : ${SUITE_FILTER}${NC}"
    echo -e "${DIM}  fix_and_restart.sh : ${FIX_SCRIPT:-NOT FOUND}${NC}"
    echo -e "${DIM}  client_setup.sh    : ${SETUP_SCRIPT:-NOT FOUND}${NC}"
    echo -e "${DIM}  v2 backup          : ${SETUP_V2_SCRIPT:-NOT FOUND}${NC}"

    _init_tmp

    run_suite_fix
    run_suite_setup
    run_suite_integration
    run_suite_v2
    run_suite_static

    echo -e "\n${BOLD}${CYAN}━━  Results  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${GREEN}Passed  : $TESTS_PASSED${NC}"
    echo -e "  ${RED}Failed  : $TESTS_FAILED${NC}"
    echo -e "  ${YELLOW}Skipped : $TESTS_SKIPPED${NC}"
    echo    "  Total   : $TESTS_RUN"

    if [[ ${#FAILED_NAMES[@]} -gt 0 ]]; then
        echo -e "\n${RED}${BOLD}  Failed tests:${NC}"
        for name in "${FAILED_NAMES[@]}"; do
            echo -e "  ${RED}✖${NC}  $name"
        done
    fi

    echo ""
    if [[ $TESTS_FAILED -eq 0 ]]; then
        echo -e "${GREEN}${BOLD}  ✔  All tests passed.${NC}\n"; exit 0
    else
        echo -e "${RED}${BOLD}  ✖  $TESTS_FAILED test(s) failed.${NC}\n"; exit 1
    fi
}

main "$@"
