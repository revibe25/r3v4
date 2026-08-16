#!/usr/bin/env bash
set -euo pipefail

echo "=========================================="
echo " 1. Updating Vitest Configs"
echo "=========================================="

PACKAGES=(
  "llpte-adapters"
  "llpte-ai"
  "llpte-core"
  "llpte-execution"
  "llpte-signal"
  "llpte-transition-graph"
)

for pkg in "${PACKAGES[@]}"; do
  CFG_PATH="packages/${pkg}/vitest.config.ts"
  if [ -f "$CFG_PATH" ]; then
    echo "  [+] Updating $CFG_PATH"
    cat << 'EOF' > "$CFG_PATH"
/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
  },
});
EOF
  else
    echo "  [-] Warning: $CFG_PATH not found"
  fi
done

echo ""
echo "=========================================="
echo " 2. Updating DAW Router & Procedures Types"
echo "=========================================="

DAW_ROUTER="server/routers/daw.ts"
PROCEDURES="server/procedures.ts"

if [ -f "$DAW_ROUTER" ]; then
  echo "  [+] Ensuring LLPTESignal and MixSuggestion are exported in $DAW_ROUTER"
  sed -i -E 's/^([[:space:]]*)(type|interface)[[:space:]]+LLPTESignal/\1export \2 LLPTESignal/g' "$DAW_ROUTER"
  sed -i -E 's/^([[:space:]]*)(type|interface)[[:space:]]+MixSuggestion/\1export \2 MixSuggestion/g' "$DAW_ROUTER"
else
  echo "  [!] Error: $DAW_ROUTER does not exist"
  exit 1
fi

if [ -f "$PROCEDURES" ]; then
  if ! grep -q "LLPTESignal" "$PROCEDURES"; then
    echo "  [+] Adding explicit type import to top of $PROCEDURES"
    sed -i '1i import type { LLPTESignal, MixSuggestion } from '\''./routers/daw'\'';' "$PROCEDURES"
  else
    echo "  [=] Type import already present in $PROCEDURES"
  fi
else
  echo "  [!] Error: $PROCEDURES does not exist"
  exit 1
fi

echo ""
echo "=========================================="
echo " 3. Clearing Cache and Rebuilding"
echo "=========================================="

echo "  [+] Cleaning TS build cache..."
./node_modules/.bin/tsc -b --clean

echo "  [+] Running TypeScript project build..."
./node_modules/.bin/tsc -b

echo ""
echo "✅ Build completed successfully with 0 errors!"
