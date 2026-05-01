#!/usr/bin/env bash
# fix-unused-vars.sh
# Master Bash script to auto-prefix unused vars with _ to fix @typescript-eslint/no-unused-vars
# and @typescript-eslint/consistent-type-imports where possible.

set -euo pipefail

errlog="fix-unused-vars.errs"
backupdir=".fix-unused-vars-backup_$(date +%Y%m%d_%H%M%S)"

echo "# Running pnpm lint (collect errors)..."
pnpm lint > "$errlog" 2>&1 || true

echo "# Searching for unused variable errors..."
# get all lines with "is defined but never used."
grep "is defined but never used" "$errlog" | while read -r line; do
  # Example: /path/foo.ts  11:3   error  'integer' is defined but never used. Allowed unused vars must match /^_/u  @typescript-eslint/no-unused-vars
  file=$(echo "$line" | cut -d' ' -f1)
  var=$(echo "$line" | grep -o "'[^']\+'" | head -1 | tr -d "'")
  
  if [[ -z "$file" || -z "$var" ]]; then continue; fi
  echo "  Will fix: $file  (variable: $var)"

  # Back up the file first
  mkdir -p "$backupdir"
  cp -p "$file" "$backupdir/"

  # Sed: (1) Any standalone 'const var', 'let var', 'var var' -> prefix with _ if not already.
  #      (2) Any function declaration parameters
  sed -i -E "s/(const|let|var)[[:space:]]+$var([[:space:]=:,;})])/\1 _${var}\2/g" "$file"
  # For import type { integer } etc (less likely)
  sed -i -E "s/({|,)[[:space:]]*$var([[:space:]],|\})/\1 _${var}\2/g" "$file"
  # Function arguments
  sed -i -E "s/function[[:space:]]+[a-zA-Z0-9_]+\([^)]*\)/$(sed "s/\($var\)/_\1/g")/g" "$file"
done

# Also attempt to convert "import { X } from" to "import type { X } from" where that import is only used as a type
echo "# Attempting to fix import type issues..."
grep "All imports in the declaration are only used as types" "$errlog" | while read -r line; do
  file=$(echo "$line" | cut -d' ' -f1)
  importline=$(grep -m1 "^import \{" "$file" || true)
  if [[ -n "$file" && -n "$importline" ]]; then
    # Only if not already 'import type'
    if ! echo "$importline" | grep -q "import type"; then
      sed -i "s/^import \{/import type \{/g" "$file"
      echo "  Patched import type in $file"
    fi
  fi
done

echo
echo "# All candidate fixes applied."
echo "# Backup of all changed files is in: $backupdir"
echo

echo "# Re-running pnpm lint to verify..."
pnpm lint || true
echo
echo "# For any remaining errors, manually inspect the file(s)."
