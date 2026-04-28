#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(pwd)"

echo "========================================"
echo " R3 FRONTEND AUDIT DUMP"
echo "========================================"
echo "Working Dir: $ROOT_DIR"
echo ""

print_file () {
  local file="$1"

  if [[ -f "$file" ]]; then
    echo "----------------------------------------"
    echo "FILE: $file"
    echo "REALPATH: $(realpath "$file")"
    echo "----------------------------------------"
    cat "$file"
    echo -e "\n"
  else
    echo "⚠️  MISSING: $file"
    echo ""
  fi
}

echo "🔍 CHECKING ENTRY POINTS"
echo ""

# Core entry files
print_file "index.html"
print_file "vite.config.ts"
print_file "vite.config.js"

echo "🔍 CHECKING ROOT SRC"
echo ""

print_file "src/main.tsx"
print_file "src/main.js"
print_file "src/index.ts"
print_file "src/App.tsx"

echo "🔍 CHECKING CLIENT SRC (POTENTIAL DUPLICATE)"
echo ""

print_file "client/src/main.tsx"
print_file "client/src/main.js"
print_file "client/src/index.ts"
print_file "client/src/App.tsx"

echo "🔍 CHECKING AUDIO INIT"
echo ""

print_file "src/audio-init.js"

echo "🔍 CHECKING SESSION HOOK (CRITICAL)"
echo ""

print_file "hooks/useSessionLifecycle.ts"
print_file "src/hooks/useSessionLifecycle.ts"
print_file "client/hooks/useSessionLifecycle.ts"

echo "🔍 CHECKING STORES"
echo ""

find src/store src/stores stores -type f 2>/dev/null | while read -r file; do
  print_file "$file"
done

echo "🔍 CHECKING LAYOUT / PANELS"
echo ""

find src/components -type f -iname "*layout*" -o -iname "*panel*" 2>/dev/null | while read -r file; do
  print_file "$file"
done

echo "🔍 CHECKING ROUTING"
echo ""

grep -R "react-router" -n src 2>/dev/null || true
grep -R "createBrowserRouter" -n src 2>/dev/null || true

echo ""
echo "========================================"
echo " AUDIT DUMP COMPLETE"
echo "========================================"
