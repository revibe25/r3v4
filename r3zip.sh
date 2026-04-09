#!/usr/bin/env bash
# ============================================================
#  r3zip.sh — Advanced archive script for R3 v4
#  Usage:
#    ./r3zip.sh                  # full snapshot (source mode)
#    ./r3zip.sh --mode=source    # source-only (default)
#    ./r3zip.sh --mode=full      # include build artifacts
#    ./r3zip.sh --mode=deploy    # deployable bundle (no dev deps)
#    ./r3zip.sh --dry            # dry-run, list what would be included
#    ./r3zip.sh --verify         # verify integrity of last archive
#    ./r3zip.sh --help
# ============================================================

set -euo pipefail

# ── Config ───────────────────────────────────────────────────
PROJECT_ROOT="${HOME}/Stable/R3 v4"
ARCHIVE_DIR="${HOME}/Stable/archives"
LOG_DIR="${HOME}/Stable/logs"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
MODE="source"
DRY=false
VERIFY=false

# Palette (tput-safe; no-op if terminal doesn't support colors)
if command -v tput &>/dev/null && tput colors &>/dev/null 2>&1; then
  ACID='\033[38;2;163;230;53m'   # --ag-acid #a3e635
  DIM='\033[2m'
  RED='\033[0;31m'
  YLW='\033[0;33m'
  RST='\033[0m'
else
  ACID='' DIM='' RED='' YLW='' RST=''
fi

# ── Helpers ──────────────────────────────────────────────────
log()  { echo -e "${ACID}▸${RST} $*"; }
dim()  { echo -e "${DIM}  $*${RST}"; }
warn() { echo -e "${YLW}⚠  $*${RST}"; }
die()  { echo -e "${RED}✗  $*${RST}" >&2; exit 1; }
hr()   { printf '%.0s─' {1..60}; echo; }

human_size() {
  local bytes="$1"
  if   (( bytes >= 1073741824 )); then printf "%.2f GB" "$(echo "scale=2; $bytes/1073741824" | bc)"
  elif (( bytes >= 1048576    )); then printf "%.2f MB" "$(echo "scale=2; $bytes/1048576"    | bc)"
  elif (( bytes >= 1024       )); then printf "%.2f KB" "$(echo "scale=2; $bytes/1024"       | bc)"
  else printf "%d B" "$bytes"
  fi
}

# ── Arg parse ────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --mode=source|--mode=full|--mode=deploy) MODE="${arg#--mode=}" ;;
    --dry)    DRY=true ;;
    --verify) VERIFY=true ;;
    --help)
      sed -n '3,12p' "$0" | sed 's/^#  *//'
      exit 0 ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

# ── Verify mode (standalone) ─────────────────────────────────
if $VERIFY; then
  LATEST="$(ls -t "${ARCHIVE_DIR}"/r3v4_*.tar.gz 2>/dev/null | head -1 || true)"
  [[ -z "$LATEST" ]] && die "No archives found in ${ARCHIVE_DIR}"
  log "Verifying: $(basename "$LATEST")"
  if tar -tzf "$LATEST" &>/dev/null; then
    log "✓ Archive is intact"
    SIZE=$(stat -c%s "$LATEST" 2>/dev/null || stat -f%z "$LATEST")
    dim "Size    : $(human_size "$SIZE")"
    dim "Entries : $(tar -tzf "$LATEST" | wc -l | tr -d ' ')"
  else
    die "Archive is corrupted!"
  fi
  exit 0
fi

# ── Guard: project must exist ─────────────────────────────────
[[ -d "$PROJECT_ROOT" ]] || die "Project not found: ${PROJECT_ROOT}"

mkdir -p "$ARCHIVE_DIR" "$LOG_DIR"

ARCHIVE_NAME="r3v4_${MODE}_${TIMESTAMP}.tar.gz"
ARCHIVE_PATH="${ARCHIVE_DIR}/${ARCHIVE_NAME}"
LOG_PATH="${LOG_DIR}/r3zip_${TIMESTAMP}.log"
MANIFEST_PATH="${ARCHIVE_DIR}/r3v4_${MODE}_${TIMESTAMP}.manifest"
CHECKSUM_FILE="${LOG_DIR}/r3v4_${MODE}_${TIMESTAMP}.sha256"

# ── Exclusion rules per mode ──────────────────────────────────
# Patterns follow GNU tar glob rules (matched against archive member paths).
BASE_EXCLUDES=(
  # package deps — never archive these
  "*/node_modules"
  "*/.pnpm-store"
  "*/pnpm-lock.yaml.bak"

  # build / emit artifacts
  "*/.turbo"
  "*/dist"
  "*/build"
  "*/.next"
  "*/.vite"
  "*/storybook-static"
  "*/tsconfig.tsbuildinfo"

  # test artifacts
  "*/coverage"
  "*/.nyc_output"
  "*/test-results"
  "*/playwright-report"

  # runtime caches
  "*/.cache"
  "*/__pycache__"
  "*.pyc"

  # secret env files — never include
  "*/.env.local"
  "*/.env.production"
  "*/.env.*.local"
  "*/.env.secret"

  # log files
  "*.log"
  "npm-debug.log*"
  "yarn-error.log*"
  "pnpm-debug.log*"

  # OS junk
  ".DS_Store"
  "Thumbs.db"
  "desktop.ini"

  # editor artifacts
  "*/.idea"
  "*/.vscode/settings.json"

  # temp / swap
  "*.tmp"
  "*.swp"
  "*.bak"
)

SOURCE_ONLY_EXCLUDES=()

DEPLOY_EXCLUDES=(
  "*/.env.development"
  "*/.env.test"
  "*/src"
  "*/test"
  "*/tests"
  "*/*.test.ts"
  "*/*.spec.ts"
  "*/vitest.config.*"
  "*/jest.config.*"
  "*/.eslintrc*"
  "*/.eslintignore"
  "*/.prettierrc*"
)

declare -a EXCLUDES=("${BASE_EXCLUDES[@]}")
case "$MODE" in
  source)  EXCLUDES+=("${SOURCE_ONLY_EXCLUDES[@]}") ;;
  deploy)  EXCLUDES+=("${DEPLOY_EXCLUDES[@]}") ;;
  full)    : ;;
esac

EXCLUDE_FLAGS=()
for pat in "${EXCLUDES[@]}"; do
  EXCLUDE_FLAGS+=("--exclude=${pat}")
done

# ── Pre-flight summary ────────────────────────────────────────
hr
echo -e "${ACID}  R3 v4 — Archive Script${RST}"
hr
log "Mode     : ${MODE}"
log "Source   : ${PROJECT_ROOT}"
log "Output   : ${ARCHIVE_PATH}"
log "Dry run  : ${DRY}"
hr

# FIX (Bug 5): du --exclude matches basenames only — no leading */
RAW_SIZE=$(du -sb \
           --exclude="node_modules" \
           --exclude=".turbo" \
           --exclude="dist" \
           --exclude="build" \
           --exclude=".next" \
           "$PROJECT_ROOT" 2>/dev/null \
           | awk '{print $1}' || echo 0)
dim "Approx source size (excl. build artifacts): $(human_size "$RAW_SIZE")"
echo

# ── Dry run ───────────────────────────────────────────────────
# FIX (Bug 2): -t/--list and -c are mutually exclusive tar operations.
#              Correct approach: -czv to /dev/null (verbose create = lists files).
if $DRY; then
  log "DRY RUN — files that would be included:"
  tar -czvf /dev/null \
      "${EXCLUDE_FLAGS[@]}" \
      -C "${PROJECT_ROOT%/*}" \
      "${PROJECT_ROOT##*/}" \
    2>/dev/null \
    | while IFS= read -r line; do dim "$line"; done
  TOTAL=$(tar -czvf /dev/null \
      "${EXCLUDE_FLAGS[@]}" \
      -C "${PROJECT_ROOT%/*}" \
      "${PROJECT_ROOT##*/}" \
    2>/dev/null | wc -l || echo 0)
  echo
  dim "Total entries that would be archived: ${TOTAL}"
  warn "Dry run complete — no archive written."
  exit 0
fi

# ── Checksums pre-archive ─────────────────────────────────────
log "Computing pre-archive checksums..."

# FIX (Bug 1): -name clauses MUST be wrapped in \( ... \) so the
#              -not\( path exclusions \) applies to ALL name branches.
#              Without the grouping, bare -o creates top-level OR branches
#              that bypass path exclusions entirely — files inside
#              node_modules/dist/etc. would be incorrectly checksummed.
find "$PROJECT_ROOT" \
  -not \( \
    -path "*/node_modules/*" -o \
    -path "*/.turbo/*"       -o \
    -path "*/dist/*"         -o \
    -path "*/build/*"        -o \
    -path "*/.next/*"        -o \
    -path "*/.cache/*"       \
  \) \
  -type f \
  \( \
    -name "*.ts"   -o \
    -name "*.tsx"  -o \
    -name "*.js"   -o \
    -name "*.jsx"  -o \
    -name "*.json" -o \
    -name "*.env"  -o \
    -name "*.sql"  -o \
    -name "*.css"  -o \
    -name "*.scss" \
  \) \
  2>/dev/null \
| LC_ALL=C sort \
| xargs -d '\n' sha256sum 2>/dev/null > "$CHECKSUM_FILE" || true

CKSUM_COUNT=$(wc -l < "$CHECKSUM_FILE" | tr -d ' ')
dim "Pre-archive checksums: ${CKSUM_COUNT} source files → ${CHECKSUM_FILE}"

# ── Build manifest ────────────────────────────────────────────
log "Generating manifest..."

# FIX (Bug 2): verbose create to /dev/null instead of --list
{
  echo "# R3 v4 Archive Manifest"
  echo "# Generated : $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "# Mode      : ${MODE}"
  echo "# Host      : $(hostname)"
  echo "# Git HEAD  : $(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'not a git repo')"
  echo "# Git branch: $(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'n/a')"
  DIRTY_FILES=$(git -C "$PROJECT_ROOT" status --short 2>/dev/null | wc -l | tr -d ' ' || echo 0)
  echo "# Git dirty : ${DIRTY_FILES} uncommitted file(s)"
  echo "#"
  echo "# Excluded patterns:"
  for pat in "${EXCLUDES[@]}"; do
    echo "#   ${pat}"
  done
  echo "#"
  echo "# --- FILE LIST ---"
  tar -czvf /dev/null \
      "${EXCLUDE_FLAGS[@]}" \
      -C "${PROJECT_ROOT%/*}" \
      "${PROJECT_ROOT##*/}" \
    2>/dev/null || true
} > "$MANIFEST_PATH"

MANIFEST_LINES=$(grep -c '/' "$MANIFEST_PATH" 2>/dev/null || echo 0)
dim "Manifest: ${MANIFEST_LINES} entries → ${MANIFEST_PATH}"

# ── Git dirty check ───────────────────────────────────────────
# FIX (Bug 3a): [[ -gt ]] instead of bare (( )) to avoid set -e
#               tripping on a falsy (0) arithmetic result.
DIRTY_COUNT=$(git -C "$PROJECT_ROOT" status --short 2>/dev/null | wc -l | tr -d ' ' || echo 0)
if [[ "$DIRTY_COUNT" -gt 0 ]]; then
  warn "${DIRTY_COUNT} uncommitted change(s) — archiving current working state."
fi

# ── Archive ───────────────────────────────────────────────────
log "Compressing..."

START_TS=$(date +%s%N)

# FIX (Bug 4): --checkpoint-action="echo=...%{read,wrote}T" is non-standard
#              and breaks on many GNU tar versions. Use --checkpoint-action=dot
#              which is universally supported.
tar -czf "$ARCHIVE_PATH" \
    "${EXCLUDE_FLAGS[@]}" \
    --checkpoint=500 \
    --checkpoint-action=dot \
    -C "${PROJECT_ROOT%/*}" \
    "${PROJECT_ROOT##*/}" \
  2>&1 | tee -a "$LOG_PATH"

echo  # newline after checkpoint dots

END_TS=$(date +%s%N)
ELAPSED_MS=$(( (END_TS - START_TS) / 1000000 ))

# ── Integrity check — verify the archive we just wrote ────────
log "Verifying archive integrity..."
if ! tar -tzf "$ARCHIVE_PATH" &>/dev/null; then
  die "Archive failed integrity check — file may be truncated or corrupt."
fi
log "✓ Integrity verified"

# ── Post-archive stats ────────────────────────────────────────
ARCHIVE_BYTES=$(stat -c%s "$ARCHIVE_PATH" 2>/dev/null || stat -f%z "$ARCHIVE_PATH")
ENTRY_COUNT=$(tar -tzf "$ARCHIVE_PATH" | wc -l | tr -d ' ')

if [[ "$RAW_SIZE" -gt 0 ]]; then
  RATIO=$(echo "scale=1; (1 - $ARCHIVE_BYTES / $RAW_SIZE) * 100" | bc 2>/dev/null || echo "n/a")
else
  RATIO="n/a"
fi

ARCHIVE_SHA=$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')
echo "# archive sha256: ${ARCHIVE_SHA}" >> "$CHECKSUM_FILE"

hr
log "✓ Archive complete"
hr
dim "Archive  : ${ARCHIVE_NAME}"
dim "Path     : ${ARCHIVE_PATH}"
dim "Size     : $(human_size "$ARCHIVE_BYTES")"
dim "Entries  : ${ENTRY_COUNT}"
dim "Ratio    : ~${RATIO}% reduction vs raw source"
dim "Time     : ${ELAPSED_MS}ms"
dim "SHA256   : ${ARCHIVE_SHA}"
dim "Log      : ${LOG_PATH}"
dim "Manifest : ${MANIFEST_PATH}"
dim "Checksums: ${CHECKSUM_FILE}"
hr

# ── Auto-prune old archives (keep last 10 per mode) ───────────
# FIX (Bug 3b): mapfile avoids word-splitting on filenames.
#               PRUNED=$(( PRUNED + 1 )) instead of (( PRUNED++ )) —
#               the latter exits 1 when the value increments from 0,
#               which trips set -e and silently kills the script.
KEEP=10
PRUNED=0
mapfile -t ARCHIVE_LIST < <(ls -t "${ARCHIVE_DIR}"/r3v4_"${MODE}"_*.tar.gz 2>/dev/null || true)

if [[ "${#ARCHIVE_LIST[@]}" -gt "$KEEP" ]]; then
  for old in "${ARCHIVE_LIST[@]:$KEEP}"; do
    rm -f "$old"
    dim "Pruned: $(basename "$old")"
    PRUNED=$(( PRUNED + 1 ))
  done
  if [[ "$PRUNED" -gt 0 ]]; then
    dim "Auto-pruned ${PRUNED} archive(s) — keeping last ${KEEP} per mode."
  fi
fi

log "Done. Run with --verify to check the latest archive."
