#!/bin/bash
set -euo pipefail

FILE="./tests/e2e/setup/auth.setup.ts"

python3 << 'PYTHON'
with open("./tests/e2e/setup/auth.setup.ts", "r") as f:
    lines = f.readlines()

# Remove duplicate "import path from 'path';" on line 24
# Keep the one on line 20, remove the second occurrence after fileURLToPath
new_lines = []
seen_path_import = False
skip_next = False

for i, line in enumerate(lines):
    if "import path from 'path'" in line and not seen_path_import:
        seen_path_import = True
        new_lines.append(line)
    elif "import path from 'path'" in line and seen_path_import:
        # Skip duplicate
        continue
    else:
        new_lines.append(line)

with open("./tests/e2e/setup/auth.setup.ts", "w") as f:
    f.writelines(new_lines)

print("[OK] Removed duplicate path import")
PYTHON
