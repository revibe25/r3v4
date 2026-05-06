#!/usr/bin/env bash
# r3-enhance-patches.sh
# Surgical patches for items that don't require full file rewrites.
# Run from the project root: bash r3-enhance-patches.sh
# Each patch is idempotent — re-running is safe.
#
# NO strict mode (set -e / set -o pipefail / set -u).
# grep returns exit code 1 on no-match, which under pipefail causes silent
# early termination when used in $() substitutions. All safety is explicit.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

RED='\033[0;31m'; GRN='\033[0;32m'; YLW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "  ${GRN}✅${NC} $*"; }
warn() { echo -e "  ${YLW}⚠ ${NC} $*"; }
fail() { echo -e "  ${RED}❌${NC} $*"; }

echo ""
echo "═══════════════════════════════════════════════════"
echo "  R3 v4 — Enhancement Patches"
echo "═══════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 1: shared/package.json — wrong package name
# Root cause: "@r3vibe/server" in the shared package breaks pnpm workspace
#   resolution when any consumer imports by name instead of by relative path.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[1/8] shared/package.json — package name"

if [ ! -f shared/package.json ]; then
  warn "shared/package.json not found — skipping"
elif grep -q '"@r3vibe/server"' shared/package.json 2>/dev/null; then
  sed -i 's/"name":[ ]*"@r3vibe\/server"/"name": "@r3vibe\/shared"/' shared/package.json
  ok "Fixed: @r3vibe/server → @r3vibe/shared"
elif grep -q '"@r3vibe/shared"' shared/package.json 2>/dev/null; then
  ok "Already correct"
else
  warn "Unexpected name field — inspect shared/package.json manually"
fi

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 2: server/index.ts — WebSocket magic number
# Root cause: client.readyState === 1 instead of the named constant WebSocket.OPEN.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[2/8] server/index.ts — WebSocket.OPEN constant"

if [ ! -f server/index.ts ]; then
  warn "server/index.ts not found — skipping"
else
  if grep -q '\.readyState === 1\b' server/index.ts 2>/dev/null; then
    sed -i 's/\.readyState === 1\b/.readyState === WebSocket.OPEN/g' server/index.ts
    ok "Replaced: readyState === 1 → readyState === WebSocket.OPEN"
  else
    ok "Magic number not found (already fixed or different pattern)"
  fi

  if grep -q 'WebSocket\.OPEN' server/index.ts 2>/dev/null; then
    if grep -q "^import WebSocket" server/index.ts 2>/dev/null || \
       grep -q "^import { WebSocket" server/index.ts 2>/dev/null; then
      ok "WebSocket import already present"
    else
      # Capture last import line number; pre-initialize to empty string so
      # the variable is always bound even if grep finds nothing.
      LAST_IMPORT_LINE=""
      LAST_IMPORT_LINE=$(grep -n '^import ' server/index.ts 2>/dev/null | tail -1 | cut -d: -f1) || true
      if [ -n "$LAST_IMPORT_LINE" ]; then
        sed -i "${LAST_IMPORT_LINE}a import WebSocket from 'ws';" server/index.ts
        ok "Added: import WebSocket from 'ws' (after line $LAST_IMPORT_LINE)"
      else
        sed -i "1s/^/import WebSocket from 'ws';\n/" server/index.ts
        ok "Added: import WebSocket from 'ws' (line 1)"
      fi
    fi
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 3: server/index.ts — billing route registration order
# Root cause: /billing/checkout registered before express.json() so req.body
#   is always undefined when the handler runs.
# Cannot auto-patch (block move required). Detects and reports only.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[3/8] server/index.ts — billing route registration order"

if [ ! -f server/index.ts ]; then
  warn "server/index.ts not found — skipping"
else
  # Pre-initialize both variables so -u (if ever re-enabled) won't fire.
  BILLING_LINE=""
  JSON_LINE=""
  BILLING_LINE=$(grep -n '/billing/checkout' server/index.ts 2>/dev/null | head -1 | cut -d: -f1) || true
  JSON_LINE=$(grep -n 'express\.json(' server/index.ts 2>/dev/null | head -1 | cut -d: -f1) || true

  if [ -z "$BILLING_LINE" ]; then
    warn "/billing/checkout not found in server/index.ts"
  elif [ -z "$JSON_LINE" ]; then
    warn "express.json() call not found in server/index.ts — inspect manually"
  elif [ "$BILLING_LINE" -lt "$JSON_LINE" ]; then
    fail "MANUAL FIX: billing route (line $BILLING_LINE) registered before express.json() (line $JSON_LINE)"
    echo "       Move the /billing/checkout block to AFTER the express.json() middleware."
    echo "       Also add requireUser to the billing route — it currently has no auth."
  else
    ok "Order correct: billing route (line $BILLING_LINE) after express.json() (line $JSON_LINE)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 4: server/routes/loops.ts — unauthenticated GET enumeration
# Root cause: GET /loops and GET /loops/:id have no auth or rate limiting.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[4/8] server/routes/loops.ts — GET route protection"

if [ ! -f server/routes/loops.ts ]; then
  warn "server/routes/loops.ts not found — skipping"
elif grep -q 'loopStationLimiter' server/routes/loops.ts 2>/dev/null; then
  ok "loopStationLimiter already applied"
else
  fail "MANUAL FIX: GET /loops and GET /loops/:id have no rate limiter."
  echo "       Add loopStationLimiter to both GET handlers:"
  echo "         router.get('/', loopStationLimiter, handler)"
  echo "         router.get('/:id', loopStationLimiter, handler)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 5: client/src/utils/projectSerializer.ts — URL object leak
# Root cause: URL.revokeObjectURL(url) not called if link.click() throws.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[5/8] client/src/utils/projectSerializer.ts — object URL leak"

TARGET="client/src/utils/projectSerializer.ts"
if [ ! -f "$TARGET" ]; then
  warn "$TARGET not found — skipping"
elif ! grep -q 'link\.click()' "$TARGET" 2>/dev/null; then
  warn "link.click() pattern not found — inspect $TARGET manually"
elif grep -q 'finally' "$TARGET" 2>/dev/null; then
  ok "finally block already present"
else
  fail "MANUAL FIX: URL.revokeObjectURL is not guarded by a finally block."
  echo "       In the downloadProject function, change to:"
  echo "         try {"
  echo "           link.click();"
  echo "         } finally {"
  echo "           URL.revokeObjectURL(url);"
  echo "         }"
fi

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 6: server/services/stripe-subscription.ts — logger consistency
# Root cause: console.info / console.warn used instead of the logger module.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[6/8] server/services/stripe-subscription.ts — logger consistency"

TARGET="server/services/stripe-subscription.ts"
if [ ! -f "$TARGET" ]; then
  warn "$TARGET not found — skipping"
elif ! grep -qE 'console\.(info|warn)\b' "$TARGET" 2>/dev/null; then
  ok "No console.info/warn found"
else
  sed -i "s/console\.info(/logger.info(/g" "$TARGET"
  sed -i "s/console\.warn(/logger.warn(/g" "$TARGET"
  if ! grep -q "from '.*logger'" "$TARGET" 2>/dev/null && \
     ! grep -q 'from ".*logger"' "$TARGET" 2>/dev/null; then
    LAST_IMPORT_LINE=""
    LAST_IMPORT_LINE=$(grep -n '^import ' "$TARGET" 2>/dev/null | tail -1 | cut -d: -f1) || true
    if [ -n "$LAST_IMPORT_LINE" ]; then
      sed -i "${LAST_IMPORT_LINE}a import { logger } from '../lib/logger';" "$TARGET"
    else
      sed -i "1s/^/import { logger } from '..\/lib\/logger';\n/" "$TARGET"
    fi
    ok "Replaced console.info/warn → logger; added import"
  else
    ok "Replaced console.info/warn → logger (import already present)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 7: server/middleware/feature-gate.ts — logger consistency
# Root cause: console.error used for AI usage insert failure.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[7/8] server/middleware/feature-gate.ts — logger consistency"

TARGET="server/middleware/feature-gate.ts"
if [ ! -f "$TARGET" ]; then
  warn "$TARGET not found — skipping"
elif ! grep -q 'console\.error\b' "$TARGET" 2>/dev/null; then
  ok "No console.error found"
else
  sed -i "s/console\.error(/logger.error(/g" "$TARGET"
  if ! grep -q "from '.*logger'" "$TARGET" 2>/dev/null && \
     ! grep -q 'from ".*logger"' "$TARGET" 2>/dev/null; then
    LAST_IMPORT_LINE=""
    LAST_IMPORT_LINE=$(grep -n '^import ' "$TARGET" 2>/dev/null | tail -1 | cut -d: -f1) || true
    if [ -n "$LAST_IMPORT_LINE" ]; then
      sed -i "${LAST_IMPORT_LINE}a import { logger } from '../lib/logger';" "$TARGET"
    else
      sed -i "1s/^/import { logger } from '..\/lib\/logger';\n/" "$TARGET"
    fi
    ok "Replaced console.error → logger.error; added import"
  else
    ok "Replaced console.error → logger.error (import already present)"
  fi
fi

# ─────────────────────────────────────────────────────────────────────────────
# PATCH 8: shared/types/ — conflicting type definitions
# Cannot auto-delete: must verify zero live imports first.
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "[8/8] shared/types/ — conflicting type definitions"

ANY_FOUND=0
for f in \
  "shared/types/audio.types.ts" \
  "shared/types/automation.types.ts" \
  "shared/types/meter.types.ts"
do
  if [ -f "$f" ]; then
    BASE=$(basename "$f" .ts)
    fail "$f conflicts with canonical top-level shared/*.types.ts"
    echo "       Verify zero live imports, then delete:"
    echo "         grep -r \"$BASE\" --include='*.ts' --include='*.tsx' . | grep -v node_modules | grep -v dist"
    ANY_FOUND=1
  fi
done

if [ "$ANY_FOUND" -eq 0 ]; then
  ok "No conflicting type files found"
fi

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Patch run complete."
echo "  ✅ = patched or already correct"
echo "  ⚠  = skipped (file not found or pattern unclear)"
echo "  ❌ = requires manual intervention (see above)"
echo "═══════════════════════════════════════════════════"
echo ""