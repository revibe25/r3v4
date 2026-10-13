#!/usr/bin/env bash
# Read-only: reports migration state for the database in PROD_DATABASE_URL. Never writes.
set -euo pipefail
: "${PROD_DATABASE_URL:?set PROD_DATABASE_URL in your shell, not in this file}"
export PGOPTIONS='-c default_transaction_read_only=on'
q() { psql "$PROD_DATABASE_URL" -At -v ON_ERROR_STOP=1 -c "$1"; }

RECORDED=$(q "select created_at from drizzle.__drizzle_migrations order by id;" | tr '\n' ' ')
TABLE=$(q "select to_regclass('public.diagnostic_findings') is not null;")
echo "recorded created_at values: ${RECORDED:-<none>}"
echo "diagnostic_findings present: ${TABLE}"

BASE=1790221322672; DIAG=1781302281879
has() { [[ " $RECORDED " == *" $1 "* ]]; }

if has "$BASE" && has "$DIAG" && [[ "$TABLE" == t ]]; then
  echo "STATE A: both migrations recorded, table present. OK."
elif has "$BASE" && ! has "$DIAG" && [[ "$TABLE" == f ]]; then
  echo "STATE B: baseline recorded, table MISSING. Fix with a forward migration (see below)."
  exit 1
else
  echo "STATE C: unrecognised. Stop and paste this output."
  exit 1
fi
