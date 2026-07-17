#!/bin/bash
set -e

# r3v4 Build Fix — Path Resolution & Dependency Ordering
# Issue: llpte-ai can't find @llpte/llpte-signal during build
# Root: pnpm workspace dependency resolution + missing path aliases

cd ~/r3v4

echo "=== R3V4 BUILD FIX ==="
echo ""

# STEP 1: Verify all llpte packages have path aliases configured
echo "[1/6] Checking path alias configuration..."

for pkg in packages/llpte-*; do
  name=$(basename "$pkg")
  echo "  Checking $name..."
  
  if ! grep -q '"paths"' "$pkg/tsconfig.json"; then
    echo "  ⚠ $name missing 'paths' — adding..."
    
    # Add paths config after compilerOptions
    sed -i '/^  "compilerOptions": {/a\    "paths": {\n      "@llpte\\/*": ["../../packages\/*\/src"]\n    },' "$pkg/tsconfig.json"
  fi
done
echo "✓ Path aliases verified"
echo ""

# STEP 2: Verify all packages have compositeReferences
echo "[2/6] Checking composite references..."

for pkg in packages/llpte-*; do
  name=$(basename "$pkg")
  if ! grep -q '"references"' "$pkg/tsconfig.json"; then
    echo "  ⚠ $name missing references — adding..."
    
    # Add references before end of compilerOptions
    sed -i '/^  }/i\  "references": [\n    { "path": "../../shared" },\n    { "path": "../../packages/llpte-signal" }\n  ],' "$pkg/tsconfig.json"
  fi
done
echo "✓ Composite references verified"
echo ""

# STEP 3: Delete build artifacts + cache
echo "[3/6] Cleaning build cache..."
rm -rf packages/*/dist server/dist shared/dist
rm -rf .turbo
rm -rf node_modules/.pnpm-store
# Do NOT delete pnpm-lock.yaml — it's authoritative
echo "✓ Cache cleaned"
echo ""

# STEP 4: Clean install
echo "[4/6] Reinstalling dependencies..."
pnpm install --force
echo "✓ Dependencies installed"
echo ""

# STEP 5: Build in correct order (shared, signal, then rest)
echo "[5/6] Building packages (sequential order)..."

# Build shared first (no deps)
echo "  Building @r3vibe/shared..."
pnpm --filter @r3vibe/shared build

# Build signal (depends on shared)
echo "  Building @llpte/llpte-signal..."
pnpm --filter @llpte/llpte-signal build

# Build core (depends on signal)
echo "  Building @llpte/llpte-core..."
pnpm --filter @llpte/llpte-core build

# Build ai (depends on signal, core)
echo "  Building @llpte/llpte-ai..."
pnpm --filter @llpte/llpte-ai build

# Build rest in parallel
echo "  Building remaining packages..."
pnpm --filter @llpte/llpte-adapters build
pnpm --filter @llpte/llpte-execution build
pnpm --filter @llpte/llpte-transition-graph build
pnpm --filter @r3vibe/server build

echo "✓ Build complete"
echo ""

# STEP 6: Verify TSC
echo "[6/6] Running TypeScript verification..."
if pnpm tsc --noEmit; then
  echo "✓ TSC passed — 0 errors"
else
  echo "❌ TSC failed — see errors above"
  exit 1
fi

echo ""
echo "=== BUILD SUCCESS ==="
echo ""
echo "Next steps:"
echo "  git status"
echo "  git add ."
echo "  git commit -m 'chore: fix build configuration (path aliases, composite refs)'"
echo "  git push origin main"
