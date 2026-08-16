#!/usr/bin/env bash
set -e

echo "🔧 Applying fixes..."
echo ""

# Make sure we're operating from the project root
cd "$(dirname "$0")"

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1: auth.ts
# ─────────────────────────────────────────────────────────────────────────────

echo "📝 Fix 1: server/routes/auth.ts"

python3 - <<'PY'
from pathlib import Path

path = Path("server/routes/auth.ts")
text = path.read_text()

old = "  return _dummyHash;"
new = "  return _dummyHash!;"

if new in text:
    print("   ✓ Already fixed")
elif old in text:
    text = text.replace(old, new, 1)
    path.write_text(text)
    print("   ✓ Changed return _dummyHash; → return _dummyHash!;")
else:
    raise SystemExit("   ❌ Expected _dummyHash return statement was not found")
PY

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: agent-ws-handler.ts
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "📝 Fix 2: server/ws/agent-ws-handler.ts"

python3 - <<'PY'
from pathlib import Path

path = Path("server/ws/agent-ws-handler.ts")
text = path.read_text()

old_import = "import { WebSocketServer, WebSocket } from 'ws';"
new_import = "import { WebSocketServer, WebSocket as WSWebSocket } from 'ws';"

old_interface = "interface AuthedSocket extends WebSocket {"
new_interface = "interface AuthedSocket extends WSWebSocket {"

changed = False

if new_import in text:
    print("   ✓ WebSocket import already aliased")
elif old_import in text:
    text = text.replace(old_import, new_import, 1)
    print("   ✓ Aliased ws WebSocket")
    changed = True
else:
    raise SystemExit("   ❌ Expected WebSocket import was not found")

if new_interface in text:
    print("   ✓ AuthedSocket already uses WSWebSocket")
elif old_interface in text:
    text = text.replace(old_interface, new_interface, 1)
    print("   ✓ Updated AuthedSocket")
    changed = True
else:
    raise SystemExit("   ❌ Expected AuthedSocket interface was not found")

if changed:
    path.write_text(text)

PY

# ─────────────────────────────────────────────────────────────────────────────
# VERIFY SOURCE
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "🔍 Verifying source changes..."
echo ""

echo "--- auth.ts ---"
grep -n "_dummyHash" server/routes/auth.ts

echo ""
echo "--- agent-ws-handler.ts ---"
grep -n "WebSocket" server/ws/agent-ws-handler.ts

echo ""
echo "🏗️ Running pnpm build..."
echo ""

pnpm build

echo ""
echo "✅ BUILD SUCCEEDED"
echo "✨ Atomic fixes complete."
