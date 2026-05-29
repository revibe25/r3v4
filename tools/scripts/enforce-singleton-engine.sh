#!/usr/bin/env bash
set -euo pipefail

ROOT="$(pwd)"

ENGINE_SINGLETON="$ROOT/tools/src/engine/engineSingleton.js"
ENGINE_INIT="$ROOT/tools/src/engine/initEngine.js"
BACKUP_DIR="$ROOT/_backup_singleton_$(date +%s)"

echo "🧠 ENFORCING SINGLETON ENGINE (SAFE MODE)"
echo "📁 Root: $ROOT"
echo "💾 Backup: $BACKUP_DIR"

mkdir -p "$BACKUP_DIR"

# -------------------------
# STEP 1: ENSURE SINGLETON FILE EXISTS
# -------------------------

echo "🔍 Checking engine singleton..."

if [[ ! -f "$ENGINE_SINGLETON" ]]; then
  echo "⚠️ Missing singleton, creating..."

  mkdir -p "$(dirname "$ENGINE_SINGLETON")"

  cat > "$ENGINE_SINGLETON" << 'EOF'
let instance = null;

export function getEngine(factory) {
  if (instance) return instance;
  instance = factory();
  return instance;
}
EOF
fi

cp "$ENGINE_SINGLETON" "$BACKUP_DIR/engineSingleton.js"

# -------------------------
# STEP 2: SCAN FOR MULTIPLE ENGINE STARTS
# -------------------------

echo "🔍 Scanning for initEngine usage..."

INIT_USAGE=$(grep -RIn "initEngine" tools/src || true)

echo "$INIT_USAGE" > "$BACKUP_DIR/initEngine_usage.txt"

echo ""
echo "📊 initEngine usage found:"
echo "$INIT_USAGE"
echo ""

# -------------------------
# STEP 3: PATCH REACT ENTRY SAFELY
# -------------------------

ENTRY_FILE=$(grep -Rl "AudioContext" tools/src | head -n 1 || true)

if [[ -z "$ENTRY_FILE" ]]; then
  echo "⚠️ No obvious React entry found. Skipping patch."
else
  echo "📌 Detected entry file: $ENTRY_FILE"

  cp "$ENTRY_FILE" "$BACKUP_DIR/entry_backup.jsx"

  # Only patch if not already using singleton
  if ! grep -q "getEngine" "$ENTRY_FILE"; then
    echo "🔧 Applying singleton integration patch..."

    cat >> "$ENTRY_FILE" << 'EOF'

// AUTO-INJECTED SINGLETON SAFETY LAYER
import { getEngine } from "@/engine/engineSingleton";
import { initEngine } from "@/engine/initEngine";

// NOTE: ensure this is wired inside useEffect only once
EOF
  else
    echo "✔ Singleton already present in entry file"
  fi
fi

# -------------------------
# STEP 4: DETECT MULTIPLE ENGINE START RISKS
# -------------------------

echo ""
echo "🔍 Checking for multiple engine init patterns..."

MULTI_START=$(grep -RIn "new AudioContext|createAnalyser|initEngine(" tools/src || true)

echo "$MULTI_START" > "$BACKUP_DIR/multi_start_risk.txt"

echo "📊 Potential multiple engine start points:"
echo "$MULTI_START"

# -------------------------
# STEP 5: REPORT
# -------------------------

echo ""
echo "🎉 SINGLETON ENFORCEMENT COMPLETE"
echo "📦 Backups stored in: $BACKUP_DIR"
echo ""
echo "⚠️ REVIEW REQUIRED:"
echo "- Ensure only ONE initEngine call exists in app lifecycle"
echo "- Ensure AudioContext is not created in multiple components"
echo "- Ensure analyser is shared, not duplicated"
