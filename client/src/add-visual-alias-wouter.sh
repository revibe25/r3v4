#!/usr/bin/env bash
set -euo pipefail

APP="App.tsx"
BACKUP="${APP}.bak_visualalias_$(date +%s)"
cp "$APP" "$BACKUP"

# Locate line number of <Route path="/visuals">
VIS_LINE=$(grep -n '<Route path="/visuals">' "$APP" | cut -d: -f1)
if [[ -z "$VIS_LINE" ]]; then
  echo "❌ Could not find <Route path=\"/visuals\"> in $APP."
  exit 1
fi

# Check if /visual already exists
if grep -q '<Route path="/visual">' "$APP"; then
  echo "✅ /visual already present. Nothing changed."
  exit 0
fi

# Find the corresponding </Route> that closes the /visuals block
START="$VIS_LINE"
END="$START"
DEPTH=1

while read -r line; do
  ((END++))
  [[ "$line" == *"<Route"* ]] && ((DEPTH++))
  [[ "$line" == *"</Route>"* ]] && ((DEPTH--))
  if [[ $DEPTH -eq 0 ]]; then
    break
  fi
done < <(tail -n +"$((START + 1))" "$APP")

# Extract the /visuals block and replace with /visual
BLOCK=$(sed -n "$START,${END}p" "$APP")
ALIAS_BLOCK=$(echo "$BLOCK" | sed 's|/visuals|/visual|g')

# Insert alias block after the visuals block
{ 
  sed -n "1,${END}p" "$APP"
  echo "$ALIAS_BLOCK"
  sed -n "$((END + 1)),\$p" "$APP"
} > "${APP}.tmp" && mv "${APP}.tmp" "$APP"

echo
echo "✅ Added /visual alias after /visuals in $APP."
echo "🗄️  Backup saved as $BACKUP."
echo "Reload your dev server and open /visual."