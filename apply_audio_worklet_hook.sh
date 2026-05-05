#!/usr/bin/env bash
set -euo pipefail

echo "⚛️ Applying AudioWorklet Hook + Vite Path Fix"

ROOT="$(pwd)"
AUDIO_DIR="$ROOT/client/src/audio"
ENGINE_FILE="$AUDIO_DIR/engine/AudioEngine.ts"
HOOK_FILE="$AUDIO_DIR/hooks/useAudioEngine.ts"
UI_EXAMPLE="$ROOT/client/src/pages/AudioTest.tsx"

TS=$(date +"%Y%m%d_%H%M%S")
BACKUP="$ROOT/.audio_hook_backup_$TS"
mkdir -p "$BACKUP"

backup_if_exists () {
  if [ -f "$1" ]; then
    cp "$1" "$BACKUP/"
    echo "✔ backup: $1"
  fi
}

write_if_changed () {
  local file="$1"
  local tmp="$file.tmp"

  cat > "$tmp"

  if [ -f "$file" ]; then
    if cmp -s "$file" "$tmp"; then
      rm "$tmp"
      echo "↺ unchanged: $file"
      return
    fi
  fi

  backup_if_exists "$file"
  mv "$tmp" "$file"
  echo "✔ wrote: $file"
}

mkdir -p "$AUDIO_DIR/hooks"

# -----------------------------------
# 1. Write React Hook
# -----------------------------------
write_if_changed "$HOOK_FILE" << 'EOF'
import { useState } from 'react';
import { AudioEngine } from '../engine/AudioEngine';

export function useAudioEngine() {
  const [engine] = useState(() => new AudioEngine());
  const [ready, setReady] = useState(false);
  const [energy, setEnergy] = useState(0);

  const start = async () => {
    await engine.init();

    engine.getVIL().subscribe((data: any) => {
      setEnergy(data.energy ?? 0);
    });

    setReady(true);
  };

  return { start, ready, energy };
}
EOF

# -----------------------------------
# 2. Patch AudioEngine Worklet Path
# -----------------------------------
if [ -f "$ENGINE_FILE" ]; then
  backup_if_exists "$ENGINE_FILE"

  if grep -q "audioWorklet.addModule" "$ENGINE_FILE"; then
    echo "🔧 Patching AudioWorklet path (Vite-safe)..."

    sed -i.bak \
      "s|audioWorklet.addModule([^)]*)|audioCtx.audioWorklet.addModule(new URL('./worklet/processor.ts', import.meta.url))|g" \
      "$ENGINE_FILE"

    echo "✔ AudioEngine.ts patched for Vite worklet path"
  else
    echo "⚠ No worklet loader found in AudioEngine.ts (skipping patch)"
  fi
else
  echo "⚠ AudioEngine.ts not found, skipping"
fi

# -----------------------------------
# 3. Optional UI Example (non-destructive)
# -----------------------------------
if [ ! -f "$UI_EXAMPLE" ]; then
  write_if_changed "$UI_EXAMPLE" << 'EOF'
import { useAudioEngine } from '../audio/hooks/useAudioEngine';

export default function AudioTest() {
  const { start, ready, energy } = useAudioEngine();

  if (!ready) {
    return (
      <div style={{ padding: 20 }}>
        <button onClick={start}>Start Audio</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Audio Engine Running</h2>
      <p>Energy: {energy.toFixed(4)}</p>
    </div>
  );
}
EOF
else
  echo "↺ UI example already exists, skipping"
fi

echo ""
echo "✅ AudioWorklet Hook + UI Applied"
echo "📦 Backup: $BACKUP"
echo ""
echo "Next steps:"
echo "1. pnpm dev"
echo "2. Click 'Start Audio'"
echo "3. Verify energy updates in UI"
echo ""
echo "If audio fails:"
echo "- Ensure HTTPS or localhost"
echo "- Ensure Vite is serving /src correctly"
