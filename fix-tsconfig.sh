#!/usr/bin/env bash
set -euo pipefail

TSCONFIG="~/Stable/tsconfig.json"

echo "[INFO] Checking tsconfig.json syntax..."
if ! node -c "$TSCONFIG" 2>&1 | grep -q "SyntaxError"; then
  echo "[✓] tsconfig.json is valid JSON"
else
  echo "[✗] tsconfig.json has syntax errors"
  echo ""
  echo "First 20 lines:"
  head -20 "$TSCONFIG"
fi
