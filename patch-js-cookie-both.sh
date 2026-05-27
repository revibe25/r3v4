#!/bin/bash
set -euo pipefail

# Patch both js-cookie versions
for VERSION in "2.2.1" "3.0.7"; do
  FILE="node_modules/.pnpm/js-cookie@${VERSION}/node_modules/js-cookie/dist/js.cookie.mjs"
  
  if [[ ! -f "$FILE" ]]; then
    echo "⚠  Skipping js-cookie@$VERSION (not found)"
    continue
  fi
  
  echo "Patching: $FILE"
  cp "$FILE" "${FILE}.bak"
  
  # Replace the vulnerable assign function with the patched version
  # The vulnerable pattern: for (var key in source) { target[key] = source[key] }
  # The fix: skip __proto__, constructor, prototype keys
  
  sed -i 's/for (var key in source) {/for (var key in source) {\n      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;/' "$FILE"
  
  echo "✓ Patched: js-cookie@$VERSION"
  echo "  Backup: ${FILE}.bak"
done

echo ""
echo "Verification:"
grep -n "__proto__" node_modules/.pnpm/js-cookie@3.0.7/node_modules/js-cookie/dist/js.cookie.mjs | head -2 || echo "(patch verification)"
