#!/usr/bin/env bash
set -uo pipefail

PROJECT_DIR="$HOME/Stable"
SERVER_PORT=3000
CLIENT_PORT_RANGE=(5173 5174 5175 5176 5177 5178 5179 5180)

cd "$PROJECT_DIR" || { echo "Could not cd into $PROJECT_DIR"; exit 1; }

if ! command -v lsof >/dev/null 2>&1; then
  echo "WARNING: 'lsof' not installed — port cleanup will be skipped."
  echo "Install it with: sudo apt install lsof"
  HAVE_LSOF=0
else
  HAVE_LSOF=1
fi

kill_port() {
  local PORT=$1
  [ "$HAVE_LSOF" -eq 1 ] || return 0
  local PIDS
  PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  [ -n "$PIDS" ] || return 0

  echo "Stopping process(es) on port $PORT: $PIDS"
  kill -15 $PIDS 2>/dev/null || true
  sleep 0.5

  PIDS=$(lsof -ti tcp:"$PORT" 2>/dev/null || true)
  if [ -n "$PIDS" ]; then
    echo "Force-killing stubborn process(es) on port $PORT: $PIDS"
    kill -9 $PIDS 2>/dev/null || true
  fi
}

echo "== Cleaning up stale processes =="
kill_port "$SERVER_PORT"
for PORT in "${CLIENT_PORT_RANGE[@]}"; do
  kill_port "$PORT"
done

# Scoped to this project's path — won't touch Agent-OS's Vite or anything else
pkill -f "tsx watch.*${PROJECT_DIR}/index.ts" 2>/dev/null || true
pkill -f "${PROJECT_DIR}.*vite" 2>/dev/null || true

sleep 1

echo "== Ensuring client build exists (server requires client/dist on init) =="
if [ ! -f "$PROJECT_DIR/client/dist/index.html" ]; then
  echo "client/dist missing or incomplete — building once"
  pnpm --filter @r3vibe/client build
fi

CLEANED_UP=0
cleanup() {
  [ "$CLEANED_UP" -eq 1 ] && return 0
  CLEANED_UP=1
  echo
  echo "== Shutting down, freeing ports =="
  kill_port "$SERVER_PORT"
  for PORT in "${CLIENT_PORT_RANGE[@]}"; do
    kill_port "$PORT"
  done
}
trap cleanup EXIT INT TERM

echo "== Starting dev (server + client) =="
pnpm dev
