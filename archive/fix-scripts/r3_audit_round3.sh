#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# r3_audit_round3.sh
# R3 v4 — Round 3 frontend audit file dump
#
# Usage:
#   chmod +x r3_audit_round3.sh
#   ./r3_audit_round3.sh                  # prints to stdout
#   ./r3_audit_round3.sh > audit_r3.txt   # captures to file
#   ./r3_audit_round3.sh 2>&1 | tee audit_r3.txt  # tee to file + stdout
#
# What it does:
#   1. Resolves REPO_ROOT automatically (script location = Stable/)
#   2. For each target file: prints a header, cats the file, prints a footer
#   3. For each target directory: prints tree -L 2 then cats every source file
#   4. Ghost file check: reports which root-level .tsx/.ts/.jsx files exist
#   5. Orphan check: reports which client-root hooks/stores exist outside src/
#   6. Migration conflict check: lists drizzle/migrations/ with duplicate prefixes
#   7. Exits non-zero if any mandatory file is missing
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Resolve repo root ─────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# If script is run from Stable/ directly, REPO_ROOT = SCRIPT_DIR
# If it lives inside Stable/, same result. Adjust if needed.
REPO_ROOT="${SCRIPT_DIR}"
CLIENT_SRC="${REPO_ROOT}/client/src"

# ── Colour helpers ────────────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  BOLD=$'\e[1m'; DIM=$'\e[2m'; RESET=$'\e[0m'
  RED=$'\e[31m'; GRN=$'\e[32m'; YLW=$'\e[33m'; CYN=$'\e[36m'; MAG=$'\e[35m'
else
  BOLD=''; DIM=''; RESET=''; RED=''; GRN=''; YLW=''; CYN=''; MAG=''
fi

MISSING_FILES=()

# ── Print helpers ─────────────────────────────────────────────────────────────
separator() {
  printf '\n%s\n' "${CYN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
}

header() {
  local label="$1" path="$2"
  separator
  printf '%s FILE: %s%s\n' "${BOLD}${MAG}" "${label}" "${RESET}"
  printf '%s      %s%s\n' "${DIM}" "${path}" "${RESET}"
  separator
}

footer() {
  printf '%s── END ─────────────────────────────────────────────────────────────────────%s\n' "${DIM}" "${RESET}"
}

section() {
  printf '\n%s╔══════════════════════════════════════════════════════════════════════════╗%s\n' "${BOLD}${YLW}" "${RESET}"
  printf '%s║  %-72s║%s\n' "${BOLD}${YLW}" "$1" "${RESET}"
  printf '%s╚══════════════════════════════════════════════════════════════════════════╝%s\n\n' "${BOLD}${YLW}" "${RESET}"
}

# cat a single file with full header/footer; record missing
cat_file() {
  local label="$1" path="$2"
  header "${label}" "${path}"
  if [[ -f "${path}" ]]; then
    cat "${path}"
  else
    printf '%s[FILE NOT FOUND]%s\n' "${RED}" "${RESET}"
    MISSING_FILES+=("${path}")
  fi
  footer
}

# cat every source file inside a directory (non-recursive beyond 1 level unless specified)
cat_dir_files() {
  local label="$1" dir="$2"
  shift 2
  local extensions=("${@:-ts,tsx,js,jsx}")

  section "DIRECTORY TREE: ${label}"
  if [[ -d "${dir}" ]]; then
    tree -L 2 --noreport "${dir}" 2>/dev/null || find "${dir}" -maxdepth 2 | sort
  else
    printf '%s[DIRECTORY NOT FOUND: %s]%s\n' "${RED}" "${dir}" "${RESET}"
    return
  fi

  # Build find -name patterns from extensions
  local find_args=()
  local IFS_SAVE="${IFS}"; IFS=','
  for ext in ${extensions[*]}; do
    find_args+=(-name "*.${ext}" -o)
  done
  IFS="${IFS_SAVE}"
  # Remove trailing -o
  unset 'find_args[${#find_args[@]}-1]'

  while IFS= read -r -d '' file; do
    cat_file "$(basename "${file}")" "${file}"
  done < <(find "${dir}" -maxdepth 1 \( "${find_args[@]}" \) -print0 | sort -z)
}

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 1 — GHOST FILE CHECK (root-level .tsx/.ts files)
# ─────────────────────────────────────────────────────────────────────────────
section "§1 — GHOST FILES AT MONOREPO ROOT"

GHOST_EXTENSIONS=("tsx" "ts" "jsx" "js")
printf '%-60s %s\n' "FILE" "SIZE"
printf '%-60s %s\n' "────────────────────────────────────────────────────────" "────"
found_ghost=0
for ext in "${GHOST_EXTENSIONS[@]}"; do
  while IFS= read -r f; do
    # Skip node_modules, config files at root (drizzle.config, vitest.config etc. are expected)
    rel="${f#${REPO_ROOT}/}"
    [[ "${rel}" == *node_modules* ]] && continue
    [[ "${rel}" == *packages/* ]]   && continue
    [[ "${rel}" == *server/* ]]     && continue
    [[ "${rel}" == *client/* ]]     && continue
    [[ "${rel}" == *shared/* ]]     && continue
    [[ "${rel}" == *tools/* ]]      && continue
    [[ "${rel}" == *tests/* ]]      && continue
    [[ "${rel}" == *config/* ]]     && continue
    [[ "${rel}" == *docs/* ]]       && continue
    size=$(wc -c < "${f}" 2>/dev/null || echo '?')
    printf '%-60s %s bytes\n' "${rel}" "${size}"
    found_ghost=$((found_ghost + 1))
  done < <(find "${REPO_ROOT}" -maxdepth 1 -name "*.${ext}" -type f 2>/dev/null | sort)
done
[[ "${found_ghost}" -eq 0 ]] && printf '%s[none found]%s\n' "${GRN}" "${RESET}"

# Cat each ghost file for content comparison
section "§1b — GHOST FILE CONTENTS"
for ext in tsx ts; do
  while IFS= read -r f; do
    rel="${f#${REPO_ROOT}/}"
    [[ "${rel}" == *node_modules* ]] && continue
    [[ "${rel}" == *packages/* ]]   && continue
    [[ "${rel}" == *server/* ]]     && continue
    [[ "${rel}" == *client/* ]]     && continue
    [[ "${rel}" == *shared/* ]]     && continue
    [[ "${rel}" == *tools/* ]]      && continue
    [[ "${rel}" == *tests/* ]]      && continue
    [[ "${rel}" == *config/* ]]     && continue
    [[ "${rel}" == *docs/* ]]       && continue
    cat_file "ROOT/${rel}" "${f}"
  done < <(find "${REPO_ROOT}" -maxdepth 1 -name "*.${ext}" -type f 2>/dev/null | sort)
done

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 2 — MIGRATION CONFLICT CHECK
# ─────────────────────────────────────────────────────────────────────────────
section "§2 — DRIZZLE MIGRATION PREFIX CONFLICTS"
MIGRATIONS_DIR="${REPO_ROOT}/drizzle/migrations"
if [[ -d "${MIGRATIONS_DIR}" ]]; then
  printf 'All migration files:\n'
  ls -1 "${MIGRATIONS_DIR}"/*.sql 2>/dev/null | xargs -I{} basename {} | sort || echo '[none]'
  printf '\nDuplicate prefix check:\n'
  ls -1 "${MIGRATIONS_DIR}"/*.sql 2>/dev/null \
    | xargs -I{} basename {} \
    | grep -oP '^\d+' \
    | sort | uniq -d \
    | while read -r prefix; do
        printf '%s[CONFLICT]%s prefix "%s" used by:\n' "${RED}" "${RESET}" "${prefix}"
        ls -1 "${MIGRATIONS_DIR}/${prefix}_"*.sql 2>/dev/null | xargs -I{} basename {}
      done
  printf '%s[OK — no duplicate prefixes found]%s\n' "${GRN}" "${RESET}" 2>/dev/null || true
else
  printf '%s[MIGRATIONS DIR NOT FOUND: %s]%s\n' "${RED}" "${MIGRATIONS_DIR}" "${RESET}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 3 — ORPHAN FILE CHECK (client-root hooks/stores outside src/)
# ─────────────────────────────────────────────────────────────────────────────
section "§3 — ORPHANED FILES OUTSIDE client/src/"

ORPHAN_TARGETS=(
  "${REPO_ROOT}/client/hooks"
  "${REPO_ROOT}/client/stores"
  "${REPO_ROOT}/client/client"
)
for target in "${ORPHAN_TARGETS[@]}"; do
  if [[ -e "${target}" ]]; then
    printf '%s[EXISTS]%s %s\n' "${RED}" "${RESET}" "${target#${REPO_ROOT}/}"
    find "${target}" -type f | sort | while read -r f; do
      printf '  └─ %s (%s bytes)\n' "${f#${REPO_ROOT}/}" "$(wc -c < "${f}" 2>/dev/null)"
    done
  else
    printf '%s[OK - absent]%s %s\n' "${GRN}" "${RESET}" "${target#${REPO_ROOT}/}"
  fi
done

# Check for double-nested client/client/
if [[ -d "${REPO_ROOT}/client/client" ]]; then
  printf '\n%s[CRITICAL]%s client/client/ double-nest confirmed — tree:\n' "${RED}" "${RESET}"
  tree -L 3 --noreport "${REPO_ROOT}/client/client" 2>/dev/null || true
fi

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 4 — LOCKFILE CONFLICT CHECK
# ─────────────────────────────────────────────────────────────────────────────
section "§4 — LOCKFILE CONFLICT"
for lf in pnpm-lock.yaml package-lock.json yarn.lock; do
  path="${REPO_ROOT}/${lf}"
  if [[ -f "${path}" ]]; then
    size=$(wc -l < "${path}")
    printf '%s[FOUND]%s %-30s (%s lines)\n' "${YLW}" "${RESET}" "${lf}" "${size}"
  else
    printf '%s[absent]%s %s\n' "${GRN}" "${RESET}" "${lf}"
  fi
done

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 5 — SECRETS LOG CHECK
# ─────────────────────────────────────────────────────────────────────────────
section "§5 — SECRETS LOG"
SECRETS_LOG="${REPO_ROOT}/logs/r3secrets_20260415_205734.log"
if [[ -f "${SECRETS_LOG}" ]]; then
  printf '%s[WARNING]%s Secrets log exists. First 5 lines (redacted view):\n' "${RED}" "${RESET}"
  head -5 "${SECRETS_LOG}" | sed 's/=.*/=<REDACTED>/'
  printf 'Total lines: %s\n' "$(wc -l < "${SECRETS_LOG}")"
else
  printf '%s[OK - not found]%s\n' "${GRN}" "${RESET}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 6 — ROUND 3 SOURCE FILES
# ─────────────────────────────────────────────────────────────────────────────

# ── 6a. client/src/pages/ tree + all page files ──────────────────────────────
section "§6a — client/src/pages/ TREE"
PAGES_DIR="${CLIENT_SRC}/pages"
if [[ -d "${PAGES_DIR}" ]]; then
  tree -L 3 --noreport "${PAGES_DIR}" 2>/dev/null || find "${PAGES_DIR}" -maxdepth 3 | sort
else
  printf '%s[NOT FOUND: %s]%s\n' "${RED}" "${PAGES_DIR}" "${RESET}"
fi

section "§6b — client/src/pages/ FILE CONTENTS"
if [[ -d "${PAGES_DIR}" ]]; then
  while IFS= read -r -d '' file; do
    cat_file "pages/$(basename "${file}")" "${file}"
  done < <(find "${PAGES_DIR}" -maxdepth 3 \( -name "*.tsx" -o -name "*.ts" -o -name "*.jsx" -o -name "*.js" \) -print0 | sort -z)
fi

# ── 6c. client/src/components/ tree ──────────────────────────────────────────
section "§6c — client/src/components/ TREE"
COMP_DIR="${CLIENT_SRC}/components"
if [[ -d "${COMP_DIR}" ]]; then
  tree -L 3 --noreport "${COMP_DIR}" 2>/dev/null || find "${COMP_DIR}" -maxdepth 3 | sort
else
  printf '%s[NOT FOUND]%s\n' "${RED}" "${RESET}"
fi

# ── 6d. Specific component files ─────────────────────────────────────────────
section "§6d — KEY COMPONENT FILES"

KEY_COMPONENTS=(
  "page-nav.tsx"
  "ProtectedRoute.tsx"
  "theme-provider.tsx"
  "multi-track-panel/index.ts"
  "multi-track-view.tsx"
)
for comp in "${KEY_COMPONENTS[@]}"; do
  # Try flat and nested
  flat="${COMP_DIR}/${comp}"
  cat_file "components/${comp}" "${flat}"
done

# Also check root ghost page-nav.tsx for diff comparison
cat_file "ROOT/page-nav.tsx [ghost]" "${REPO_ROOT}/page-nav.tsx"

# ── 6e. Hooks ────────────────────────────────────────────────────────────────
section "§6e — client/src/hooks/ TREE + KEY FILES"
HOOKS_DIR="${CLIENT_SRC}/hooks"
if [[ -d "${HOOKS_DIR}" ]]; then
  tree -L 2 --noreport "${HOOKS_DIR}" 2>/dev/null || find "${HOOKS_DIR}" -maxdepth 2 | sort
fi

KEY_HOOKS=(
  "useDAWStore.ts"
  "useSubscription.tsx"
  "useSubscription.ts"
  "useSessionLifecycle.ts"
)
for hook in "${KEY_HOOKS[@]}"; do
  path="${HOOKS_DIR}/${hook}"
  cat_file "hooks/${hook}" "${path}"
done

# Also check orphan location
cat_file "client/hooks/useSessionLifecycle.ts [orphan?]" \
  "${REPO_ROOT}/client/hooks/useSessionLifecycle.ts"

# ── 6f. lib/trpc ─────────────────────────────────────────────────────────────
section "§6f — client/src/lib/"
LIB_DIR="${CLIENT_SRC}/lib"
if [[ -d "${LIB_DIR}" ]]; then
  tree -L 2 --noreport "${LIB_DIR}" 2>/dev/null || find "${LIB_DIR}" -maxdepth 2 | sort
fi
cat_file "lib/trpc.ts" "${LIB_DIR}/trpc.ts"
cat_file "lib/trpc.tsx" "${LIB_DIR}/trpc.tsx"

# ── 6g. Store files (all three locations) ────────────────────────────────────
section "§6g — STORE FILES (all three locations)"
cat_file "src/store/ tree" /dev/null  # placeholder, use tree below

printf 'client/src/store/:\n'
tree -L 2 --noreport "${CLIENT_SRC}/store" 2>/dev/null || echo '[not found]'
printf '\nclient/src/stores/:\n'
tree -L 2 --noreport "${CLIENT_SRC}/stores" 2>/dev/null || echo '[not found]'
printf '\nclient/stores/:\n'
tree -L 2 --noreport "${REPO_ROOT}/client/stores" 2>/dev/null || echo '[not found]'

# Cat all store files
for store_dir in \
  "${CLIENT_SRC}/store" \
  "${CLIENT_SRC}/stores" \
  "${REPO_ROOT}/client/stores"; do
  if [[ -d "${store_dir}" ]]; then
    while IFS= read -r -d '' file; do
      cat_file "${file#${REPO_ROOT}/}" "${file}"
    done < <(find "${store_dir}" -name "*.ts" -o -name "*.tsx" | sort | tr '\n' '\0')
  fi
done

# ── 6h. src/contexts/ ────────────────────────────────────────────────────────
section "§6h — client/src/contexts/"
CONTEXTS_DIR="${CLIENT_SRC}/contexts"
if [[ -d "${CONTEXTS_DIR}" ]]; then
  tree -L 2 --noreport "${CONTEXTS_DIR}" 2>/dev/null
  while IFS= read -r -d '' file; do
    cat_file "contexts/$(basename "${file}")" "${file}"
  done < <(find "${CONTEXTS_DIR}" \( -name "*.ts" -o -name "*.tsx" \) -print0 | sort -z)
else
  printf '%s[NOT FOUND]%s\n' "${RED}" "${RESET}"
fi

# ── 6i. src/hook/ (the singular — likely a typo dupe of hooks/) ──────────────
section "§6i — client/src/hook/ (singular — possible duplicate of hooks/)"
HOOK_DIR="${CLIENT_SRC}/hook"
if [[ -d "${HOOK_DIR}" ]]; then
  tree -L 2 --noreport "${HOOK_DIR}" 2>/dev/null
  while IFS= read -r -d '' file; do
    cat_file "hook/$(basename "${file}")" "${file}"
  done < <(find "${HOOK_DIR}" \( -name "*.ts" -o -name "*.tsx" \) -print0 | sort -z)
else
  printf '%s[NOT FOUND — correct, should not exist]%s\n' "${GRN}" "${RESET}"
fi

# ── 6j. Confirm DAW.tsx location ─────────────────────────────────────────────
section "§6j — DAW.tsx LOCATION CONFIRMATION"
for candidate in \
  "${REPO_ROOT}/DAW.tsx" \
  "${CLIENT_SRC}/pages/DAW.tsx" \
  "${CLIENT_SRC}/pages/DAW/index.tsx" \
  "${CLIENT_SRC}/pages/daw.tsx" \
  "${CLIENT_SRC}/pages/daw/index.tsx"; do
  if [[ -f "${candidate}" ]]; then
    printf '%s[FOUND]%s %s (%s lines)\n' "${GRN}" "${RESET}" \
      "${candidate#${REPO_ROOT}/}" "$(wc -l < "${candidate}")"
  fi
done

# Cat all found DAW files
for candidate in \
  "${REPO_ROOT}/DAW.tsx" \
  "${CLIENT_SRC}/pages/DAW.tsx" \
  "${CLIENT_SRC}/pages/DAW/index.tsx"; do
  [[ -f "${candidate}" ]] && cat_file "DAW.tsx @ ${candidate#${REPO_ROOT}/}" "${candidate}"
done

# ── 6k. main.js vs main.tsx ──────────────────────────────────────────────────
section "§6k — main.js vs main.tsx"
cat_file "src/main.js" "${CLIENT_SRC}/main.js"
cat_file "src/main.tsx" "${CLIENT_SRC}/main.tsx"

# ── 6l. audio-init.js ────────────────────────────────────────────────────────
section "§6l — audio-init.js"
cat_file "src/audio-init.js" "${CLIENT_SRC}/audio-init.js"

# ─────────────────────────────────────────────────────────────────────────────
# SECTION 7 — MISSING FILE SUMMARY
# ─────────────────────────────────────────────────────────────────────────────
section "§7 — MISSING FILE SUMMARY"
if [[ "${#MISSING_FILES[@]}" -eq 0 ]]; then
  printf '%s[ALL MANDATORY FILES FOUND]%s\n' "${GRN}" "${RESET}"
else
  printf '%s%s files not found:%s\n' "${RED}" "${#MISSING_FILES[@]}" "${RESET}"
  for f in "${MISSING_FILES[@]}"; do
    printf '  ✗ %s\n' "${f#${REPO_ROOT}/}"
  done
fi

separator
printf '%s AUDIT DUMP COMPLETE %s\n' "${BOLD}${GRN}" "${RESET}"
separator

# Exit non-zero only if mandatory files are missing (not just optionals)
MANDATORY_MISSING=0
MANDATORY=(
  "${CLIENT_SRC}/lib/trpc.ts"
  "${CLIENT_SRC}/hooks/useDAWStore.ts"
)
for mf in "${MANDATORY[@]}"; do
  if [[ ! -f "${mf}" ]]; then
    printf '%s[MANDATORY MISSING]%s %s\n' "${RED}" "${RESET}" "${mf#${REPO_ROOT}/}"
    MANDATORY_MISSING=$((MANDATORY_MISSING + 1))
  fi
done

exit "${MANDATORY_MISSING}"
