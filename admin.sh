#!/usr/bin/env bash
set -euo pipefail

BASE="${HOME}/Stable/client/src"

echo "[*] --- Typescript Fixes ---"

# Patch TrackState type to include 'empty'
grep -rl --include='*.ts' 'type TrackState' "$BASE/features/loopstation/state" | while read -r f; do
  echo "    - $f"
  cp "$f" "$f.bak_fixts"
  sed -i "s/\('playing' *| *'recording' *| *'overdubbing'\)/\1 | 'empty'/" "$f"
done

# Set overdubLayers to 0 instead of unknown[] in initialState.ts
INIT="${BASE}/features/loopstation/state/initialState.ts"
if grep -q "overdubLayers: \[\] as unknown\[\]," "$INIT"; then
  echo "[*] Patching overdubLayers type..."
  cp "$INIT" "$INIT.bak_fixts"
  sed -i "s/overdubLayers: \[\] as unknown\[\],/overdubLayers: 0,/" "$INIT"
fi

# Fix VIL.ts stub
VIL="${BASE}/audio/engine/VIL.ts"
echo "[*] Patching VIL.ts stub..."
cp "$VIL" "$VIL.bak_fixts"
cat > "$VIL" << 'EOF'
// VIL.ts — Visual Intelligence Layer stub (auto-generated)
export class VisualIntelligenceLayer {
  constructor(..._args: unknown[]) {}
  emit(_data: unknown): void {}
  subscribe(_cb: (data: unknown) => void): () => void { return () => {}; }
  connect(_ctx: unknown): void {}
  disconnect(): void {}
}
export default VisualIntelligenceLayer;
EOF

# Collapse duplicate "|| track.state === 'empty'" in TrackPad.tsx
TPAD="${BASE}/features/loopstation/components/TrackPad.tsx"
if grep -q "track.state === 'empty' || track.state === 'empty'" "$TPAD"; then
  echo "[*] Collapsing duplicate empty-state checks in TrackPad.tsx..."
  cp "$TPAD" "$TPAD.bak_fixts"
  sed -i "s/track.state === 'empty' || track.state === 'empty'/track.state === 'empty'/g" "$TPAD"
fi

# Use let resizeTimer: number in login.tsx
LOGIN="${BASE}/pages/login.tsx"
if grep -q "let resizeTimer: ReturnType<" "$LOGIN"; then
  echo "[*] Fixing resizeTimer type in login.tsx..."
  cp "$LOGIN" "$LOGIN.bak_fixts"
  sed -i "s/let resizeTimer: ReturnType<[^>]\+>/let resizeTimer: number/" "$LOGIN"
fi

echo
echo "Backups made (*.bak_fixts). Types fixed."

cat << REMINDER

====================================================
🟩  ADMIN RESTORE REMAINS MANUAL  🟩
====================================================

Your stack stores the admin password in the DATABASE.

To ensure login with:
  username: r3admin
  password: r3admin2024

Run this in your PostgreSQL database (adjust if hashed!):

  UPDATE users SET password='r3admin2024' WHERE username='r3admin';

If your app expects a hash, either:
  - Set password from the UI as an admin, or
  - Insert the correct hash generated from your code

If you want this step scripted, paste:
  - Your exact seed file (cat ~/Stable/server/db/seed)
  - Or, your users table schema and password hashing details

====================================================
REMINDER

echo "Next:  cd ~/Stable/client && npx tsc --noEmit"
