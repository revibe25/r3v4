#!/usr/bin/env bash
# master_sync_drizzle_journal.sh — Mythos/ASI master-level deploy repair for Drizzle migration loop
# Copyright 2026 (your org)
# Purpose: ONLY touch drizzle.__drizzle_migrations if DB+codebase state matches exactly.
# Requires: psql, jq

set -euo pipefail
cd "$(dirname "$0")" || { echo "Cannot cd into script dir"; exit 2; }

JOURNAL_JSON="drizzle/migrations/meta/_journal.json"
DRIZZLE_SCHEMA="drizzle"
DRIZZLE_TABLE="__drizzle_migrations"
DRIZZLE_FULL="${DRIZZLE_SCHEMA}.${DRIZZLE_TABLE}"
PSQL=${PSQL:-psql}
DATABASE_URL="${DATABASE_URL:-}"

log() { printf "[%s] %s\n" "$(date +'%Y-%m-%d %H:%M:%S')" "$*"; }

err() { log "ERROR: $*" >&2; }

require() { command -v "$1" >/dev/null 2>&1 || { err "Missing required command: $1"; exit 20; }; }

require "psql"
require "jq"

[[ -n "$DATABASE_URL" ]] || { err "Set the DATABASE_URL env variable (export DATABASE_URL=...)"; exit 11; }

# 1. Check drizzle journal table exists and schema matches
log "Auditing table $DRIZZLE_FULL existence and columns..."
TABLE_DEF=$($PSQL "$DATABASE_URL" -Atc "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='$DRIZZLE_SCHEMA' AND table_name='$DRIZZLE_TABLE' ORDER BY ordinal_position;")
if [[ -z "$TABLE_DEF" ]]; then
  err "Table $DRIZZLE_FULL does NOT exist. Exiting, DBA action required."
  exit 1
fi
log "Found columns:"
echo "$TABLE_DEF"

if ! grep -q "^hash|" <<< "$TABLE_DEF"; then err "Missing 'hash' column"; exit 2; fi
if ! grep -q "created_at" <<< "$TABLE_DEF"; then err "Missing 'created_at' column"; exit 2; fi

# 2. Check rowcount
ROWCOUNT=$($PSQL "$DATABASE_URL" -Atc "SELECT COUNT(*) FROM $DRIZZLE_FULL;")
log "Current rowcount in $DRIZZLE_FULL: $ROWCOUNT"
if (( ROWCOUNT > 0 )); then
  log "Table is NOT empty. No action. Dumping rows:"
  $PSQL "$DATABASE_URL" -c "SELECT * FROM $DRIZZLE_FULL ORDER BY created_at;"
  exit 0
fi
log "Table empty, proceeding to insert migration journal rows..."

# 3. Parse current migration meta
if [[ ! -f "$JOURNAL_JSON" ]]; then
  err "No $JOURNAL_JSON file in repo root"
  exit 12
fi
MIGRATIONS=$(jq -c '.entries[]' "$JOURNAL_JSON")
if [[ -z "$MIGRATIONS" ]]; then
  err "$JOURNAL_JSON has empty entries?"
  exit 99
fi

# 4. Construct insert statements
TMP_SQL=$(mktemp)
echo "BEGIN;" >"$TMP_SQL"
IDX=0
while read -r entry; do
  ID=$(jq -r '.idx' <<< "$entry")
  TAG=$(jq -r '.tag' <<< "$entry")
  WHEN=$(jq -r '.when' <<< "$entry")
  # Guess format for created_at: if table is timestamp, to_timestamp(ms/1000) else bigint as is
  COL_TYPE=$($PSQL "$DATABASE_URL" -Atc "SELECT data_type FROM information_schema.columns WHERE table_schema='$DRIZZLE_SCHEMA' AND table_name='$DRIZZLE_TABLE' AND column_name='created_at';")
  if [[ "$COL_TYPE" == "timestamp without time zone" || "$COL_TYPE" == "timestamp with time zone" ]]; then
    CREATED_AT="to_timestamp($WHEN/1000.0)"
  else
    CREATED_AT="$WHEN"
  fi
  # Minimal set: (id, hash, created_at) or (hash, created_at) as schema requires
  # Try id/hash/created_at, removing id on error
  if grep -q "^id|" <<< "$TABLE_DEF"; then
    echo "INSERT INTO $DRIZZLE_FULL (id, hash, created_at) VALUES ($ID, '$TAG', $CREATED_AT);" >>"$TMP_SQL"
  else
    echo "INSERT INTO $DRIZZLE_FULL (hash, created_at) VALUES ('$TAG', $CREATED_AT);" >>"$TMP_SQL"
  fi
  IDX=$((IDX+1))
done <<< "$MIGRATIONS"
echo "COMMIT;" >>"$TMP_SQL"
log "Will insert $IDX entries."

log "SQL preview:"
cat "$TMP_SQL"

# 5. Confirm with user
read -rp "Insert these journal rows into $DRIZZLE_FULL now? [y/N] " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
  log "Abort by user."
  exit 125
fi

$PSQL "$DATABASE_URL" -f "$TMP_SQL"
log "Rows inserted. Final state:"
$PSQL "$DATABASE_URL" -c "SELECT * FROM $DRIZZLE_FULL ORDER BY created_at;"

rm -f "$TMP_SQL"

log "DONE. Next: re-run deploy, migrations should now exit cleanly."

# Optional: Suggest removing migrate from toml if looping continues
RAILWAY_TOML="railway.toml"
if [[ -f "$RAILWAY_TOML" ]]; then
  if grep -q "drizzle-kit migrate" "$RAILWAY_TOML"; then
    log "Suggest review of $RAILWAY_TOML: found 'drizzle-kit migrate' in deploy command. For manual migration, remove it."
    grep "drizzle-kit migrate" "$RAILWAY_TOML"
  fi
fi
