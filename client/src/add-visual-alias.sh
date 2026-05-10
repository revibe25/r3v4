#!/usr/bin/env bash
set -euo pipefail

# Discover the router/root file (look for most likely ones)
ROOTDIR="$(pwd)"
CANDIDATES=("App.tsx" "App.jsx" "routes.tsx" "routes.jsx" "main.tsx" "main.jsx")
ROUTER_FILE=""
for f in "${CANDIDATES[@]}"; do
  if [[ -f "$ROOTDIR/$f" ]]; then
    ROUTER_FILE="$ROOTDIR/$f"
    break
  fi
done

if [[ -z "$ROUTER_FILE" ]]; then
  echo "ERROR: Could not find a router file (tried: ${CANDIDATES[*]}) in $ROOTDIR"
  exit 1
fi

echo "[*] Using router file: $ROUTER_FILE"

# Make a backup
cp "$ROUTER_FILE" "${ROUTER_FILE}.bak_visual_alias_$(date +%s)"

# Check if /visual exists already
if grep -q 'path=[[:space:]]*["'\'']/visual["'\'']' "$ROUTER_FILE"; then
  echo "[!] /visual route already exists. No changes made."
  exit 0
fi

# Detect the /visuals route
VISUALS_LINE=0
ROUTE_IMPORT=""
ROUTE_COMPONENT=""
IMPORT_COMPONENT_LINE=0

# Try to find the <Route path="/visuals" ... line
while IFS= read -r line; do
  ((++VISUALS_LINE))
  if [[ "$line" =~ path=[\"\']?/visuals[\"\']? ]]; then
    ROUTE_IMPORT="$line"
    break
  fi
done < "$ROUTER_FILE"

if [[ -z "$ROUTE_IMPORT" ]]; then
  echo "ERROR: No <Route path=\"/visuals\" ...> found in $ROUTER_FILE. Please add it first."
  exit 2
fi

# Extract the element/component to use for duplication
# e.g. <Route path="/visuals" element={<VisualsPage />} />
ROUTE_REGEXP='<Route[^>]+path=.?[\"\x27]/visuals[\"\x27][^>]*element={(<[^ >]+) ?/?>'
ROUTE_DUP=""
if [[ "$ROUTE_IMPORT" =~ element={[\<\ ]*([A-Za-z0-9_]+) ]]; then
  ROUTE_COMPONENT="${BASH_REMATCH[1]}"
  ROUTE_DUP="  <Route path=\"/visual\" element={<$ROUTE_COMPONENT />} />"
elif [[ "$ROUTE_IMPORT" =~ element=\{([^\}]+)\} ]]; then
  ROUTE_DUP="  <Route path=\"/visual\" element={${BASH_REMATCH[1]}} />"
else
  # Fallback: duplicate the line and change /visuals to /visual
  ROUTE_DUP="${ROUTE_IMPORT/\/visuals/\/visual}"
fi

# Insert immediately after the /visuals route
awk -v ins="$ROUTE_DUP" -v target="$ROUTE_IMPORT" '
  BEGIN{done=0}
  {print}
  if (!done && index($0, target) > 0) {print ins; done=1}
' "$ROUTER_FILE" > "$ROUTER_FILE.tmp" && mv "$ROUTER_FILE.tmp" "$ROUTER_FILE"

echo "[*] /visual route added as an alias for /visuals in $ROUTER_FILE"
echo "  + $ROUTE_DUP"
echo
echo "Done! Please test http://localhost:5174/visual in your browser."
echo "If your dev server is running, you may need to save/restart for hot reload."
echo "If you need a more complex pattern (e.g. nested router), paste your router's <Route ...> code and we'll tailor it further."
