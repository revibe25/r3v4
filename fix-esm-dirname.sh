#!/bin/bash
set -euo pipefail

FILE="./tests/e2e/setup/auth.setup.ts"

if [[ ! -f "$FILE" ]]; then
  echo "[FAIL] $FILE not found"
  exit 1
fi

# Backup
cp "$FILE" "${FILE}.bak"

# Replace __dirname pattern with ESM-compatible version
python3 << 'PYTHON'
import re

with open("./tests/e2e/setup/auth.setup.ts", "r") as f:
    content = f.read()

# Check if already has fileURLToPath
if "fileURLToPath" in content:
    print("[INFO] Already ESM-compatible, skipping")
    exit(0)

# Add imports after existing imports
import_section = """import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);"""

# Find the last import statement
lines = content.split('\n')
last_import_idx = -1
for i, line in enumerate(lines):
    if line.startswith('import '):
        last_import_idx = i

if last_import_idx >= 0:
    # Insert after last import
    lines.insert(last_import_idx + 1, '')
    lines.insert(last_import_idx + 2, import_section)
    content = '\n'.join(lines)

with open("./tests/e2e/setup/auth.setup.ts", "w") as f:
    f.write(content)

print("[OK] Fixed __dirname ESM scope")
PYTHON

echo "[ OK ] Backup: ${FILE}.bak"
echo "[ OK ] Patched: $FILE"
