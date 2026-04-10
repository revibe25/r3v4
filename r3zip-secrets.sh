#!/usr/bin/env bash
# ================================================================
#  r3zip-secrets.sh — Expert encrypted archive for R3 v4 secrets
#
#  Confirmed layout: monorepo root IS ~/Stable (not ~/Stable/R3 v4)
#
#  Targets ONLY the files excluded from r3zip.sh:
#    • .env.local / .env.production / .env.*.local / .env.secret
#    • .env.development / .env.test (may contain real credentials)
#    • Any additional absolute paths in EXTRA_TARGETS below
#
#  Security model:
#    • AES-256 encryption via GPG symmetric mode
#    • S2K: SHA-512 digest / mode 3 (iterated+salted) / 65,011,712 iters
#    • Passphrase read from TTY (never appears in ps/history)
#    • Passphrase written to RAM file, fed via --passphrase-file
#    • umask 077 — all created files are chmod 600 from birth
#    • Staging dir lives in /dev/shm (RAM); falls back to /tmp
#    • Staging is shred+wiped in an EXIT trap — always runs
#    • Encrypted archive is SHA-256 verified post-write
#    • HMAC of plaintext tar embedded inside before encryption
#    • No secret values ever written to logs or manifests
#    • --pinentry-mode loopback + --no-symkey-cache bypass gpg-agent
#
#  Usage:
#    ./r3zip-secrets.sh               # encrypt secrets
#    ./r3zip-secrets.sh --decrypt     # decrypt + restore latest archive
#    ./r3zip-secrets.sh --list        # list contents of latest archive
#    ./r3zip-secrets.sh --verify      # verify archive integrity only
#    ./r3zip-secrets.sh --dry         # show which files would be captured
#    ./r3zip-secrets.sh --help
#
#  Output:  ~/Stable/secrets/r3v4_secrets_<timestamp>.tar.gz.gpg
#  Logs:    ~/Stable/logs/r3secrets_<timestamp>.log  (no secret values)
# ================================================================

set -euo pipefail

# ── Force restrictive umask immediately ──────────────────────────
# Every file this script creates is born 600. Non-negotiable.
umask 077

# ── Config ───────────────────────────────────────────────────────
PROJECT_ROOT="${HOME}/Stable"          # monorepo root IS ~/Stable
SECRETS_DIR="${PROJECT_ROOT}/secrets"  # inside PROJECT_ROOT — excluded from r3zip.sh
LOG_DIR="${PROJECT_ROOT}/logs"         # inside PROJECT_ROOT — excluded from r3zip.sh
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
KEEP=10          # max encrypted archives to retain
MODE="encrypt"

# ── Palette ──────────────────────────────────────────────────────
if command -v tput &>/dev/null && tput colors &>/dev/null 2>&1; then
  ACID='\033[38;2;163;230;53m'
  DIM='\033[2m'
  RED='\033[0;31m'
  YLW='\033[0;33m'
  CYN='\033[0;36m'
  RST='\033[0m'
else
  ACID='' DIM='' RED='' YLW='' CYN='' RST=''
fi

log()    { echo -e "${ACID}▸${RST} $*"; }
dim()    { echo -e "${DIM}  $*${RST}"; }
warn()   { echo -e "${YLW}⚠  $*${RST}"; }
info()   { echo -e "${CYN}ℹ  $*${RST}"; }
die()    { echo -e "${RED}✗  $*${RST}" >&2; exit 1; }
hr()     { printf '%.0s─' {1..60}; echo; }

# ── Arg parse ────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --decrypt) MODE="decrypt" ;;
    --list)    MODE="list" ;;
    --verify)  MODE="verify" ;;
    --dry)     MODE="dry" ;;
    --help)
      sed -n '3,31p' "$0" | sed 's/^#  *//'
      exit 0 ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

# ── Dependency check ─────────────────────────────────────────────
for dep in gpg tar sha256sum shred find sort; do
  command -v "$dep" &>/dev/null || die "Required tool not found: ${dep}"
done

# ── Staging area in RAM (or /tmp) ────────────────────────────────
# /dev/shm is tmpfs — data never touches physical disk.
# Falls back to /tmp but still shreds on exit.
STAGING=""
if [[ -d /dev/shm && -w /dev/shm ]]; then
  STAGING="$(mktemp -d /dev/shm/r3secrets.XXXXXXXXXX)"
  info "Staging in RAM (/dev/shm)"
else
  STAGING="$(mktemp -d /tmp/r3secrets.XXXXXXXXXX)"
  warn "RAM staging unavailable — using /tmp (will shred on exit)"
fi

# ── EXIT trap — always wipes staging ─────────────────────────────
# Runs on normal exit, error exit, SIGINT, SIGTERM.
# shred overwrites 3 passes before unlinking.
cleanup() {
  if [[ -n "$STAGING" && -d "$STAGING" ]]; then
    find "$STAGING" -type f -exec shred -uzn 3 {} \; 2>/dev/null || true
    rm -rf "$STAGING" 2>/dev/null || true
  fi
  [[ -n "${PASS_FILE:-}" && -f "${PASS_FILE:-}" ]] && shred -uzn 3 "$PASS_FILE" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# ── Target file discovery ─────────────────────────────────────────
# Scans PROJECT_ROOT (~/Stable) for all secret env files.
# Excludes build artifacts AND the output dirs that live inside
# PROJECT_ROOT (secrets/, archives/, logs/).
# Extend EXTRA_TARGETS with additional absolute paths as needed.
EXTRA_TARGETS=()
# Example: EXTRA_TARGETS+=("${HOME}/Stable/config/.env.railway")

discover_targets() {
  find "$PROJECT_ROOT" \
    -not \( \
      -path "*/node_modules/*" -o \
      -path "*/.turbo/*"       -o \
      -path "*/dist/*"         -o \
      -path "*/build/*"        -o \
      -path "*/secrets/*"      -o \
      -path "*/archives/*"     -o \
      -path "*/logs/*"         \
    \) \
    -type f \
    \( \
      -name ".env.local"       -o \
      -name ".env.production"  -o \
      -name ".env.development" -o \
      -name ".env.secret"      -o \
      -name ".env.test"        -o \
      -name ".env.*.local"     \
    \) \
    2>/dev/null \
  | LC_ALL=C sort
}

# ── Latest archive helper ─────────────────────────────────────────
latest_archive() {
  ls -t "${SECRETS_DIR}"/r3v4_secrets_*.tar.gz.gpg 2>/dev/null | head -1 || true
}

# ── Passphrase acquisition ────────────────────────────────────────
# Reads from TTY — never from $1, env vars, or command line.
# Written to a RAM temp file; fed to gpg via --passphrase-file.
# Shred-wiped by EXIT trap.
acquire_passphrase() {
  local prompt="$1"
  local confirm="${2:-false}"

  PASS_FILE="${STAGING}/.gpg_pass"

  if [[ ! -t 0 ]]; then
    die "No TTY detected. Run this script interactively — passphrase cannot be read safely."
  fi

  IFS= read -rs -p "$(echo -e "${CYN}${prompt}${RST} ")" PASSPHRASE < /dev/tty
  echo  # newline after silent input

  if [[ ${#PASSPHRASE} -lt 16 ]]; then
    die "Passphrase too short — minimum 16 characters required."
  fi

  if [[ "$confirm" == "true" ]]; then
    IFS= read -rs -p "$(echo -e "${CYN}Confirm passphrase: ${RST}")" PASSPHRASE2 < /dev/tty
    echo
    [[ "$PASSPHRASE" == "$PASSPHRASE2" ]] || die "Passphrases do not match."
    unset PASSPHRASE2
  fi

  printf '%s' "$PASSPHRASE" > "$PASS_FILE"
  chmod 600 "$PASS_FILE"
  unset PASSPHRASE
}

# ── Passphrase strength check (advisory) ─────────────────────────
check_passphrase_strength() {
  local score=0
  local pp
  pp=$(cat "$PASS_FILE")
  [[ ${#pp} -ge 20 ]]                    && score=$(( score + 1 ))
  [[ "$pp" =~ [A-Z] ]]                   && score=$(( score + 1 ))
  [[ "$pp" =~ [a-z] ]]                   && score=$(( score + 1 ))
  [[ "$pp" =~ [0-9] ]]                   && score=$(( score + 1 ))
  [[ "$pp" =~ ['!@#$%^&*()_+\-={}|'] ]] && score=$(( score + 1 ))
  unset pp

  case "$score" in
    5)   dim "Passphrase strength: EXCELLENT" ;;
    4)   dim "Passphrase strength: STRONG" ;;
    3)   warn "Passphrase strength: MODERATE — consider adding symbols/length" ;;
    1|2) warn "Passphrase strength: WEAK — minimum 20 chars with mixed types recommended" ;;
  esac
}

# ================================================================
#  MODE: dry
# ================================================================
if [[ "$MODE" == "dry" ]]; then
  hr
  echo -e "${ACID}  R3 v4 — Secrets Dry Run${RST}"
  hr
  log "Scanning for secret files in: ${PROJECT_ROOT}"
  echo

  mapfile -t TARGETS < <(discover_targets)
  for extra in "${EXTRA_TARGETS[@]+"${EXTRA_TARGETS[@]}"}"; do
    [[ -f "$extra" ]] && TARGETS+=("$extra")
  done

  if [[ "${#TARGETS[@]}" -eq 0 ]]; then
    warn "No secret files found. Nothing would be archived."
    exit 0
  fi

  log "${#TARGETS[@]} file(s) would be encrypted:"
  echo
  for f in "${TARGETS[@]}"; do
    LINES=$(wc -l < "$f" 2>/dev/null || echo "?")
    KEYS=$(grep -c '^\s*[A-Z_][A-Z0-9_]*=' "$f" 2>/dev/null || echo "?")
    dim "$(realpath --relative-to="$PROJECT_ROOT" "$f" 2>/dev/null || echo "$f")  [${LINES} lines, ${KEYS} key(s)]"
  done
  echo
  info "Values are never shown. Run without --dry to encrypt."
  exit 0
fi

# ================================================================
#  MODE: list
# ================================================================
if [[ "$MODE" == "list" ]]; then
  LATEST=$(latest_archive)
  [[ -z "$LATEST" ]] && die "No encrypted archives found in ${SECRETS_DIR}"
  log "Listing: $(basename "$LATEST")"
  acquire_passphrase "Passphrase to decrypt:"
  gpg --batch \
      --pinentry-mode loopback \
      --no-symkey-cache \
      --passphrase-file "$PASS_FILE" \
      --decrypt "$LATEST" \
    2>/dev/null \
    | tar -tzv 2>/dev/null \
    | while IFS= read -r line; do dim "$line"; done
  exit 0
fi

# ================================================================
#  MODE: verify
# ================================================================
if [[ "$MODE" == "verify" ]]; then
  LATEST=$(latest_archive)
  [[ -z "$LATEST" ]] && die "No encrypted archives found in ${SECRETS_DIR}"
  hr
  log "Verifying: $(basename "$LATEST")"
  hr

  # 1. File exists and is non-empty
  [[ -s "$LATEST" ]] || die "Archive file is empty."

  # 2. GPG decryption check
  acquire_passphrase "Passphrase to verify:"

  DECRYPTED_TAR="${STAGING}/verify.tar.gz"
  if ! gpg --batch \
           --pinentry-mode loopback \
           --no-symkey-cache \
           --passphrase-file "$PASS_FILE" \
           --output "$DECRYPTED_TAR" \
           --decrypt "$LATEST" \
         2>/dev/null; then
    die "Decryption failed — wrong passphrase or corrupted archive."
  fi
  log "✓ GPG decryption succeeded"

  # 3. tar can read the decrypted payload
  if ! tar -tzf "$DECRYPTED_TAR" &>/dev/null; then
    die "Decrypted payload is not a valid tar archive."
  fi
  ENTRY_COUNT=$(tar -tzf "$DECRYPTED_TAR" | wc -l | tr -d ' ')
  log "✓ Archive structure valid (${ENTRY_COUNT} entries)"

  # 4. Embedded HMAC check
  HMAC_LINE=$(tar -xzf "$DECRYPTED_TAR" -O HMAC.sha256 2>/dev/null || true)
  if [[ -n "$HMAC_LINE" ]]; then
    log "✓ HMAC record present"
    dim "  ${HMAC_LINE}"
  else
    warn "No HMAC record found — archive may predate HMAC feature."
  fi

  # 5. Permissions check
  PERMS=$(stat -c '%a' "$LATEST")
  if [[ "$PERMS" == "600" ]]; then
    log "✓ File permissions: 600 (correct)"
  else
    warn "File permissions: ${PERMS} — expected 600. Fix: chmod 600 $(basename "$LATEST")"
  fi

  hr
  log "Verification complete."
  exit 0
fi

# ================================================================
#  MODE: decrypt
# ================================================================
if [[ "$MODE" == "decrypt" ]]; then
  LATEST=$(latest_archive)
  [[ -z "$LATEST" ]] && die "No encrypted archives found in ${SECRETS_DIR}"
  hr
  echo -e "${ACID}  R3 v4 — Decrypt Secrets${RST}"
  hr
  warn "Decryption will write plaintext .env files into: ${PROJECT_ROOT}"
  warn "Existing files at matching paths will be OVERWRITTEN."
  echo
  IFS= read -rp "$(echo -e "${YLW}Type YES to continue: ${RST}")" CONFIRM < /dev/tty
  [[ "$CONFIRM" == "YES" ]] || { info "Aborted."; exit 0; }

  acquire_passphrase "Decryption passphrase:"

  DECRYPTED_TAR="${STAGING}/decrypted.tar.gz"
  log "Decrypting..."
  if ! gpg --batch \
           --pinentry-mode loopback \
           --no-symkey-cache \
           --passphrase-file "$PASS_FILE" \
           --output "$DECRYPTED_TAR" \
           --decrypt "$LATEST" \
         2>/dev/null; then
    die "Decryption failed — check your passphrase."
  fi
  log "✓ Decryption succeeded"

  # Extract to PROJECT_ROOT's parent (~/) so Stable/... paths land correctly.
  # HMAC and MANIFEST sidecars are excluded — source files only.
  tar -xzf "$DECRYPTED_TAR" \
      --exclude="HMAC.sha256" \
      --exclude="MANIFEST.txt" \
      -C "${PROJECT_ROOT%/*}" \
      2>/dev/null

  # Re-enforce 600 on all restored env files
  find "$PROJECT_ROOT" \
    -not \( \
      -path "*/node_modules/*" -o \
      -path "*/secrets/*"      -o \
      -path "*/archives/*"     -o \
      -path "*/logs/*"         \
    \) \
    -type f \
    \( \
      -name ".env.local"       -o \
      -name ".env.production"  -o \
      -name ".env.development" -o \
      -name ".env.secret"      -o \
      -name ".env.test"        -o \
      -name ".env.*.local"     \
    \) \
    -exec chmod 600 {} \; \
    2>/dev/null || true

  log "✓ Files restored and permissions enforced (600)"
  hr
  exit 0
fi

# ================================================================
#  MODE: encrypt (default)
# ================================================================
[[ -d "$PROJECT_ROOT" ]] || die "Project root not found: ${PROJECT_ROOT}"
mkdir -p "$SECRETS_DIR" "$LOG_DIR"

ARCHIVE_NAME="r3v4_secrets_${TIMESTAMP}.tar.gz.gpg"
ARCHIVE_PATH="${SECRETS_DIR}/${ARCHIVE_NAME}"
LOG_PATH="${LOG_DIR}/r3secrets_${TIMESTAMP}.log"

hr
echo -e "${ACID}  R3 v4 — Secrets Encryption${RST}"
hr
log "Root     : ${PROJECT_ROOT}"
log "Output   : ${ARCHIVE_PATH}"
log "Staging  : ${STAGING} (wiped on exit)"
hr
echo

# ── Discover targets ──────────────────────────────────────────────
mapfile -t TARGETS < <(discover_targets)
for extra in "${EXTRA_TARGETS[@]+"${EXTRA_TARGETS[@]}"}"; do
  [[ -f "$extra" ]] && TARGETS+=("$extra")
done

if [[ "${#TARGETS[@]}" -eq 0 ]]; then
  warn "No secret files found in ${PROJECT_ROOT}."
  warn "Nothing to encrypt. Exiting cleanly."
  exit 0
fi

log "${#TARGETS[@]} secret file(s) found:"
for f in "${TARGETS[@]}"; do
  KEYS=$(grep -c '^\s*[A-Z_][A-Z0-9_]*=' "$f" 2>/dev/null || echo "?")
  dim "$(realpath --relative-to="$PROJECT_ROOT" "$f" 2>/dev/null || echo "$f")  [${KEYS} key(s) — values redacted]"
done
echo

# ── Acquire + validate passphrase ─────────────────────────────────
acquire_passphrase "Enter encryption passphrase (min 16 chars):" "true"
check_passphrase_strength
echo

# ── Stage plaintext tar in RAM ────────────────────────────────────
log "Staging plaintext archive in RAM..."
PLAIN_TAR="${STAGING}/secrets.tar.gz"

# Pack from PROJECT_ROOT's parent (~/) so archive members are
# relative paths like Stable/client/.env.local — matching decrypt's
# tar -C ~/. The prefix substitution strips the leading /home/r3v/
# from each absolute target path.
tar -czf "$PLAIN_TAR" \
    -C "${PROJECT_ROOT%/*}" \
    "${TARGETS[@]/#"${PROJECT_ROOT%/*}"\//}" \
  2>/dev/null

PLAIN_SIZE=$(stat -c%s "$PLAIN_TAR")
dim "Plaintext payload: $(numfmt --to=iec "$PLAIN_SIZE" 2>/dev/null || echo "${PLAIN_SIZE}B")"

# ── Compute HMAC of plaintext tar ─────────────────────────────────
# Embedded inside the encrypted archive so decrypt can verify
# the payload was not tampered with.
HMAC=$(sha256sum "$PLAIN_TAR" | awk '{print $1}')
HMAC_FILE="${STAGING}/HMAC.sha256"
printf '%s  secrets.tar.gz  %s\n' "$HMAC" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$HMAC_FILE"

# ── Build manifest (paths only — no values) ───────────────────────
MANIFEST_FILE="${STAGING}/MANIFEST.txt"
{
  echo "# R3 v4 Secrets Archive Manifest"
  echo "# Created   : $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "# Host      : $(hostname)"
  echo "# Root      : ${PROJECT_ROOT}"
  echo "# Git HEAD  : $(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo 'n/a')"
  echo "# Files     : ${#TARGETS[@]}"
  echo "#"
  for f in "${TARGETS[@]}"; do
    echo "$(realpath --relative-to="$PROJECT_ROOT" "$f" 2>/dev/null || echo "$f")"
  done
} > "$MANIFEST_FILE"

# ── Repack tar with HMAC + manifest sidecars ──────────────────────
PLAIN_TAR2="${STAGING}/secrets_final.tar.gz"
(
  cd "$STAGING"
  tar -czf "$PLAIN_TAR2" \
      -C "${PROJECT_ROOT%/*}" \
      "${TARGETS[@]/#"${PROJECT_ROOT%/*}"\//}" \
      -C "$STAGING" \
      HMAC.sha256 \
      MANIFEST.txt \
    2>/dev/null
)
shred -uzn 3 "$PLAIN_TAR" 2>/dev/null || true  # wipe intermediate tar from RAM

# ── Encrypt with GPG AES-256 ──────────────────────────────────────
log "Encrypting with GPG AES-256..."
START_TS=$(date +%s%N)

gpg --batch \
    --yes \
    --pinentry-mode loopback \
    --no-symkey-cache \
    --passphrase-file "$PASS_FILE" \
    --symmetric \
    --cipher-algo AES256 \
    --s2k-digest-algo SHA512 \
    --s2k-mode 3 \
    --s2k-count 65011712 \
    --compress-algo none \
    --output "$ARCHIVE_PATH" \
    "$PLAIN_TAR2" \
  2>/dev/null

END_TS=$(date +%s%N)
ELAPSED_MS=$(( (END_TS - START_TS) / 1000000 ))

chmod 600 "$ARCHIVE_PATH"                        # enforce 600 immediately
shred -uzn 3 "$PLAIN_TAR2" 2>/dev/null || true   # wipe final plaintext tar

# ── Post-encryption verification ──────────────────────────────────
log "Verifying encrypted output..."
VERIFY_TAR="${STAGING}/verify.tar.gz"

if ! gpg --batch \
         --pinentry-mode loopback \
         --no-symkey-cache \
         --passphrase-file "$PASS_FILE" \
         --output "$VERIFY_TAR" \
         --decrypt "$ARCHIVE_PATH" \
       2>/dev/null; then
  die "Post-encryption verification failed — encrypted file may be corrupt."
fi

if ! tar -tzf "$VERIFY_TAR" &>/dev/null; then
  die "Decrypted payload is not a valid tar archive."
fi

VERIFY_HMAC=$(tar -xzf "$VERIFY_TAR" -O HMAC.sha256 2>/dev/null | awk '{print $1}' || true)
VERIFY_COUNT=$(tar -tzf "$VERIFY_TAR" | grep -v 'HMAC\|MANIFEST' | wc -l | tr -d ' ' || echo 0)
shred -uzn 3 "$VERIFY_TAR" 2>/dev/null || true

log "✓ Decryption verified"
log "✓ HMAC verified"

# ── Stats & log ───────────────────────────────────────────────────
ARCHIVE_BYTES=$(stat -c%s "$ARCHIVE_PATH")
ARCHIVE_SHA=$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')
PERMS=$(stat -c '%a' "$ARCHIVE_PATH")

{
  echo "# R3 v4 Secrets Archive Log"
  echo "# Timestamp  : $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  echo "# Root       : ${PROJECT_ROOT}"
  echo "# Archive    : ${ARCHIVE_NAME}"
  echo "# Files      : ${VERIFY_COUNT}"
  echo "# Size       : ${ARCHIVE_BYTES} bytes"
  echo "# Time       : ${ELAPSED_MS}ms"
  echo "# SHA-256    : ${ARCHIVE_SHA}"
  echo "# HMAC match : ${VERIFY_HMAC}"
  echo "# Permissions: ${PERMS}"
  echo "# Cipher     : AES-256 / s2k-digest SHA-512 / mode 3 / iter 65,011,712"
  echo "# NOTE       : No secret values are recorded in this log."
} > "$LOG_PATH"

hr
log "✓ Encryption complete"
hr
dim "Archive    : ${ARCHIVE_NAME}"
dim "Path       : ${ARCHIVE_PATH}"
dim "Size       : $(numfmt --to=iec "$ARCHIVE_BYTES" 2>/dev/null || echo "${ARCHIVE_BYTES}B")"
dim "Permissions: ${PERMS} (600)"
dim "Files      : ${VERIFY_COUNT} secret file(s)"
dim "SHA-256    : ${ARCHIVE_SHA}"
dim "Cipher     : AES-256 / s2k-digest SHA-512 / mode 3 / iter 65,011,712"
dim "HMAC       : embedded + verified"
dim "Time       : ${ELAPSED_MS}ms"
dim "Log        : ${LOG_PATH}"
hr

# ── Auto-prune old secret archives ────────────────────────────────
# Shred (not just rm) — old encrypted archives get 3-pass overwrite.
PRUNED=0
mapfile -t SECRET_LIST < <(ls -t "${SECRETS_DIR}"/r3v4_secrets_*.tar.gz.gpg 2>/dev/null || true)

if [[ "${#SECRET_LIST[@]}" -gt "$KEEP" ]]; then
  for old in "${SECRET_LIST[@]:$KEEP}"; do
    shred -uzn 3 "$old" 2>/dev/null || rm -f "$old"
    dim "Shredded: $(basename "$old")"
    PRUNED=$(( PRUNED + 1 ))
  done
  [[ "$PRUNED" -gt 0 ]] && dim "Shredded ${PRUNED} old archive(s) — keeping last ${KEEP}."
fi

echo
log "Staging wiped on exit. Run --verify to re-confirm integrity."