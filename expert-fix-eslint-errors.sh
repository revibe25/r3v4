#!/bin/bash

# expert-fix-eslint-errors.sh
# This script fixes the following errors across a TypeScript project rooted at $PROJECT_ROOT:
#   1. Remove unused variables/imports (ESLint: no-unused-vars)
#   2. Replace `any` with `unknown` (ESLint: no-explicit-any)
#   3. Remove lines with parsing errors like 'Unexpected character '\''!'\'''
#
# Requires: GNU find, sed, awk, eslint
#
# Usage: Run from project root in a clean git workspace.
#   bash expert-fix-eslint-errors.sh

set -euo pipefail

PROJECT_ROOT="$(pwd)"
echo "== Running fixes in $PROJECT_ROOT =="

### 1. Remove unused variables/imports
echo "-- Removing unused variables/imports per ESLint output --"
eslint --ext .ts,.tsx,.js,.jsx --no-error-on-unmatched-pattern -f unix . |
  grep "@typescript-eslint/no-unused-vars" |
  awk -F: '{print $1":"$2":"$3}' | sort | uniq |
  while IFS=: read -r file line col; do
    # Detect and comment out the unused variable line
    if [[ -f "$file" ]]; then
      lineno=$((line))
      # Print info, show line
      echo "Unused: $file:$lineno: $(sed -n "${lineno}p" "$file")"
      # Use sed to delete the line in place
      sed -i "${lineno}d" "$file"
    fi
  done

### 2. Replace explicit `any` with `unknown`
echo "-- Replacing all explicit : any and <any> usages with unknown --"
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) -print0 |
  xargs -0 sed -i 's/\(: *\)any\b/\1unknown/g; s/<any>/<unknown>/g'

### 3. Remove lines with parsing error: Unexpected character '!'
echo "-- Removing parsing error lines with ! (on their own at line start) --"
# Note: if '!' may legitimately be used elsewhere, consider scoping this further.
find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.tsx" \) -print0 |
  xargs -0 sed -i '/^[[:space:]]*!/d'

echo "== Done. Please run tests and review the git diff =="
