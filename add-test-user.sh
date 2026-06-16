#!/bin/bash
set -euo pipefail

DRY_RUN=true
[[ "${1:-}" == "--apply" ]] && DRY_RUN=false

MODE=$([ "$DRY_RUN" = true ] && echo "DRY-RUN" || echo "APPLY MODE")

cat <<'EOF'
──────────────────────────────────────────────────────
  add-test-user.sh  |  R3 v4  |  Stable
──────────────────────────────────────────────────────
EOF

printf "  %s — pass --apply to write changes\n\n" "$MODE"

echo "[INFO]  STEP 1 — Precondition checks"

if ! command -v psql &> /dev/null; then
  echo "[FAIL]  psql not found"
  exit 1
fi
echo "[ OK ]  psql available"

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[FAIL]  DATABASE_URL not set"
  exit 1
fi
echo "[ OK ]  DATABASE_URL set"

echo ""
echo "[INFO]  STEP 2 — Generate bcrypt hash (12 rounds)"

TEST_USERNAME="testuser"
TEST_EMAIL="test@r3vibe.io"
TEST_PASSWORD="TestPassword123!"

BCRYPT_HASH=$(node -e "
const bcrypt = require('bcrypt');
(async () => {
  const hash = await bcrypt.hash('${TEST_PASSWORD}', 12);
  console.log(hash);
})();
" 2>/dev/null || echo "")

if [[ -z "$BCRYPT_HASH" ]]; then
  echo "[FAIL]  bcrypt hash generation failed (is bcrypt installed?)"
  exit 1
fi

echo "[ OK ]  Hash: ${BCRYPT_HASH:0:20}..."

echo ""
echo "[INFO]  STEP 3 — Check if test user exists"

USER_EXISTS=$(psql "$DATABASE_URL" -t -c \
  "SELECT COUNT(*) FROM users WHERE username = '${TEST_USERNAME}';" 2>/dev/null || echo "0")

if [[ "$USER_EXISTS" -gt 0 ]]; then
  echo "[WARN]  Test user already exists: ${TEST_USERNAME}"
  exit 1
fi
echo "[ OK ]  No existing test user"

echo ""
echo "[INFO]  STEP 4 — Planned insert"
cat <<PLAN
  INSERT INTO users (username, email, password, tier, is_admin)
  VALUES ('${TEST_USERNAME}', '${TEST_EMAIL}', '<bcrypt_hash>', 'explorer', false);
PLAN

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "Dry-run complete. Re-run with --apply to write changes."
  exit 0
fi

echo ""
echo "[INFO]  STEP 5 — Insert test user"

psql "$DATABASE_URL" <<SQL
INSERT INTO users (username, email, password, tier, is_admin)
VALUES ('${TEST_USERNAME}', '${TEST_EMAIL}', '${BCRYPT_HASH}', 'explorer', false);
SQL

echo "[ OK ]  Test user inserted"

echo ""
echo "[INFO]  STEP 6 — Verify"

USER_ID=$(psql "$DATABASE_URL" -t -c \
  "SELECT id FROM users WHERE username = '${TEST_USERNAME}';")

echo "[ OK ]  User ID: ${USER_ID}"

echo ""
cat <<'ENVTEMPLATE'
──────────────────────────────────────────────────────
  Copy this to .env.test
──────────────────────────────────────────────────────
DATABASE_URL=postgresql://r3:r3local@127.0.0.1:5432/r3vibe
NODE_ENV=test
VITE_API_URL=http://localhost:3001
TEST_USERNAME=testuser
TEST_EMAIL=test@r3vibe.io
TEST_PASSWORD=TestPassword123!
──────────────────────────────────────────────────────
ENVTEMPLATE

echo ""
echo "DONE — test user created"
echo "Next: Create .env.test, then run: source .env.test && pnpm test"
