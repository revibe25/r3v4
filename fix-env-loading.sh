#!/bin/bash
set -euo pipefail

FILE="./tests/e2e/setup/auth.setup.ts"

python3 << 'PYTHON'
with open("./tests/e2e/setup/auth.setup.ts", "r") as f:
    lines = f.readlines()

# Find the first import and add dotenv.config() after imports
import_section_end = 0
for i, line in enumerate(lines):
    if line.startswith('import ') or line.startswith('export const AUTH_FILE'):
        import_section_end = i + 1

# Insert dotenv load after imports
insert_idx = import_section_end
for i in range(import_section_end, len(lines)):
    if lines[i].strip() and not lines[i].startswith('import') and not lines[i].startswith('export'):
        insert_idx = i
        break

# Add dotenv import and config call
dotenv_import = "import dotenv from 'dotenv';\n"
dotenv_config = "dotenv.config({ path: '.env.test' });\n"

# Check if dotenv already imported
if "import dotenv" not in ''.join(lines):
    # Find last import line
    last_import = 0
    for i, line in enumerate(lines):
        if line.startswith('import '):
            last_import = i + 1
    
    lines.insert(last_import, dotenv_import)
    lines.insert(last_import + 1, dotenv_config)
    lines.insert(last_import + 2, '\n')

with open("./tests/e2e/setup/auth.setup.ts", "w") as f:
    f.writelines(lines)

print("[OK] Added dotenv.config({ path: '.env.test' })")
PYTHON
