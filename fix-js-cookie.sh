#!/bin/bash
# Direct patch for CVE-2026-46625 in js-cookie

ASSIGN_FILE=$(find node_modules -name "assign.mjs" -path "*/js-cookie/*" 2>/dev/null | head -1)

if [[ -z "$ASSIGN_FILE" ]]; then
  echo "ERROR: Could not find js-cookie/src/assign.mjs"
  exit 1
fi

echo "Patching: $ASSIGN_FILE"
cp "$ASSIGN_FILE" "${ASSIGN_FILE}.bak"

cat > "$ASSIGN_FILE" << 'FIX'
export default function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i]
    for (var key in source) {
      // CVE-2026-46625: skip prototype pollution keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        continue
      }
      // Use Object.defineProperty to avoid __proto__ setter
      Object.defineProperty(target, key, {
        value: source[key],
        writable: true,
        enumerable: true,
        configurable: true,
      })
    }
  }
  return target
}
FIX

echo "✓ Patched: $ASSIGN_FILE"
echo "  Backup: ${ASSIGN_FILE}.bak"
