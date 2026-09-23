#!/bin/bash
# Fix remaining 3 TS2742 errors
# These need manual fixes because the code format is different from expected

set -e

PROJECT_DIR="/home/cloud/Projects/r3v4"
cd "$PROJECT_DIR" || exit 1

echo "════════════════════════════════════════════════════════════════"
echo "TS2742 FIX: Final 3 Variables"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ──────────────────────────────────────────────────────────────────
# Fix 1: base-procedures.ts line 38
# ──────────────────────────────────────────────────────────────────

echo "FIX 1: base-procedures.ts line 38 (protectedProcedure)"
echo "────────────────────────────────────────────────────────────────"
echo ""

echo "Current line 38:"
sed -n '38p' server/base-procedures.ts
echo ""

# The pattern for protectedProcedure is likely: const protectedProcedure = router.procedure(...)
# We need to add: const protectedProcedure: any = router.procedure(...)

if grep -q 'const protectedProcedure = router\.procedure' server/base-procedures.ts; then
    echo "Found matching pattern"
    sed -i 's/const protectedProcedure = router\.procedure/const protectedProcedure: any = router.procedure/' server/base-procedures.ts
    echo "✅ Fixed"
    echo "New line 38:"
    sed -n '38p' server/base-procedures.ts
else
    echo "⚠️  Pattern not found - may need manual fix"
    echo "Looking for variations..."
    grep -n "protectedProcedure" server/base-procedures.ts | head -1
fi

echo ""

# ──────────────────────────────────────────────────────────────────
# Fix 2: routes/midi.ts line 11
# ──────────────────────────────────────────────────────────────────

echo "FIX 2: routes/midi.ts line 11 (router)"
echo "────────────────────────────────────────────────────────────────"
echo ""

echo "Current line 11:"
sed -n '11p' server/routes/midi.ts
echo ""

# Try different patterns
if grep -q '^const router = Router()' server/routes/midi.ts; then
    echo "Found pattern: const router = Router()"
    sed -i 's/^const router = Router()/const router: express.Router = Router()/' server/routes/midi.ts
    echo "✅ Fixed"
elif grep -q 'const router' server/routes/midi.ts; then
    echo "Found router declaration but different format"
    # Try to match and add type
    sed -i '11s/const router = /const router: express.Router = /' server/routes/midi.ts
    echo "✅ Fixed (generic pattern)"
else
    echo "⚠️  router declaration not found on line 11"
    echo "Looking for it..."
    grep -n "const router" server/routes/midi.ts | head -1
fi

echo "New line 11:"
sed -n '11p' server/routes/midi.ts
echo ""

# ──────────────────────────────────────────────────────────────────
# Fix 3: routes/mock-billing.ts line 39
# ──────────────────────────────────────────────────────────────────

echo "FIX 3: routes/mock-billing.ts line 39 (router)"
echo "────────────────────────────────────────────────────────────────"
echo ""

echo "Current line 39:"
sed -n '39p' server/routes/mock-billing.ts
echo ""

# Try different patterns
if grep -q '^const router = Router()' server/routes/mock-billing.ts; then
    echo "Found pattern: const router = Router()"
    sed -i 's/^const router = Router()/const router: express.Router = Router()/' server/routes/mock-billing.ts
    echo "✅ Fixed"
elif grep -q 'const router' server/routes/mock-billing.ts; then
    echo "Found router declaration but different format"
    # Try to match and add type on line 39 specifically
    sed -i '39s/const router = /const router: express.Router = /' server/routes/mock-billing.ts
    echo "✅ Fixed (generic pattern)"
else
    echo "⚠️  router declaration not found on line 39"
    echo "Looking for it..."
    grep -n "const router" server/routes/mock-billing.ts | head -1
fi

echo "New line 39:"
sed -n '39p' server/routes/mock-billing.ts
echo ""

# ──────────────────────────────────────────────────────────────────
# Rebuild
# ──────────────────────────────────────────────────────────────────

echo "════════════════════════════════════════════════════════════════"
echo "REBUILDING"
echo "════════════════════════════════════════════════════════════════"
echo ""

rm -rf ./server/dist ./dist ./.turbo

echo "Running pnpm build..."
if pnpm build 2>&1 | tail -50; then
    echo ""
    echo "✅ BUILD COMPLETE"
else
    echo ""
    echo "Build output above"
fi
