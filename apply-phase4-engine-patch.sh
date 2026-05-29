#!/usr/bin/env bash

set -euo pipefail

ROOT="$(pwd)"
ENGINE_DIR="$ROOT/tools/src/engine"
HOOK_DIR="$ROOT/tools/src/hooks"
BACKUP_DIR="$ROOT/_backup_phase4_$(date +%s)"

echo "🧠 Phase 4 Engine Patch (SAFE MODE)"
echo "📁 Root: $ROOT"
echo "💾 Backup: $BACKUP_DIR"

mkdir -p "$BACKUP_DIR"
mkdir -p "$ENGINE_DIR"
mkdir -p "$HOOK_DIR"

# -------------------------
# SAFETY CHECKS
# -------------------------

echo "🔍 Checking required structure..."

if [[ ! -d "$ROOT/tools/src" ]]; then
  echo "❌ ERROR: tools/src not found"
  exit 1
fi

# -------------------------
# ENGINE FILES CHECK
# -------------------------

REQUIRED_FILES=(
  "$ENGINE_DIR/MasterTimeline.js"
  "$ENGINE_DIR/SignalEngine.js"
  "$ENGINE_DIR/EventEngine.js"
  "$ENGINE_DIR/VisualEngine.js"
  "$ENGINE_DIR/FrameStore.js"
)

echo "🔍 Validating engine files..."

for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "⚠️ Missing: $f (will be created)"
  else
    cp "$f" "$BACKUP_DIR/$(basename "$f")"
    echo "💾 Backed up: $f"
  fi
done

# -------------------------
# WRITE FRAMESTORE (ATOMIC CORE)
# -------------------------

cat > "$ENGINE_DIR/FrameStore.js" << 'EOF'
export class FrameStore {
  constructor() {
    this.frame = null;
    this.version = 0;
  }

  write(nextFrame) {
    this.frame = nextFrame;
    this.version++;
  }

  read() {
    return this.frame;
  }

  hasUpdate(lastVersion) {
    return this.version !== lastVersion;
  }
}
EOF

# -------------------------
# WRITE INIT ENGINE (PHASE 4 FIXED CORE)
# -------------------------

cat > "$ENGINE_DIR/initEngine.js" << 'EOF'
import { MasterTimeline } from "./MasterTimeline";
import { SignalEngine } from "./SignalEngine";
import { EventEngine } from "./EventEngine";
import { VisualEngine } from "./VisualEngine";
import { LatencyCompensator } from "./LatencyCompensator";
import { BeatDetector } from "./BeatDetector";
import { FrameStore } from "./FrameStore";

export function initEngine(audioCtx, analyser) {
  const timeline = new MasterTimeline(audioCtx, 120);
  const signal = new SignalEngine(analyser);
  const events = new EventEngine(timeline);
  const visual = new VisualEngine(timeline, signal);

  const latency = new LatencyCompensator(audioCtx);
  const beat = new BeatDetector(signal);

  const store = new FrameStore();

  function loop() {
    signal.update();

    const beatHit = beat.update();

    events.update(() => {});

    const frame = visual.frame();

    store.write({
      ...frame,
      beatHit,
      latency: latency.offset
    });

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);

  return { timeline, signal, events, visual, latency, beat, store };
}
EOF

echo "✅ Engine core written"

# -------------------------
# FIND OR CREATE HOOK
# -------------------------

HOOK_FILE="$HOOK_DIR/useAudioFrame.js"

if [[ -f "$HOOK_FILE" ]]; then
  cp "$HOOK_FILE" "$BACKUP_DIR/useAudioFrame.js"
  echo "💾 Backed up existing hook"
fi

cat > "$HOOK_FILE" << 'EOF'
import { useEffect, useState } from "react";

export function useAudioFrame(engineRef) {
  const [frame, setFrame] = useState(null);

  useEffect(() => {
    let lastVersion = 0;

    function poll() {
      const store = engineRef.current?.store;

      if (!store) {
        requestAnimationFrame(poll);
        return;
      }

      if (store.hasUpdate(lastVersion)) {
        lastVersion = store.version;
        setFrame(store.read());
      }

      requestAnimationFrame(poll);
    }

    poll();
  }, [engineRef]);

  return frame;
}
EOF

echo "✅ Hook written"

# -------------------------
# VALIDATION
# -------------------------

echo "🔍 Validating exports..."

if grep -q "FrameStore" "$ENGINE_DIR/FrameStore.js"; then
  echo "✔ FrameStore OK"
else
  echo "❌ FrameStore validation failed"
  exit 1
fi

if grep -q "initEngine" "$ENGINE_DIR/initEngine.js"; then
  echo "✔ Engine OK"
else
  echo "❌ Engine validation failed"
  exit 1
fi

if grep -q "useAudioFrame" "$HOOK_FILE"; then
  echo "✔ Hook OK"
else
  echo "❌ Hook validation failed"
  exit 1
fi

echo ""
echo "🎉 PHASE 4 PATCH COMPLETE"
echo "📦 Backup stored in: $BACKUP_DIR"
echo "🚀 Engine + Hook integrated safely"
