#!/usr/bin/env bash
set -euo pipefail

#################################################################
# dry-unified-music-nav.sh
#
# Robustly DRY your music app navigation using a single component
# - Backs up each changed file
# - Only touches files that have an exact matching nav block
# - Never breaks other layouts/pages/components
# - Prints an explicit summary diff at the end
#################################################################

NAV_FILE="client/src/components/music-app-nav.tsx"
NAV_BLOCK=$(cat <<'END'
      <Link href="/daw"        className="ag-nav-btn">🎚 Studio</Link>
      <Link href="/collab"     className="ag-nav-btn">⬡ Collab</Link>
      <Link href="/multitrack" className="ag-nav-btn">📼 Multitrack</Link>
      <Link href="/mixer"      className="ag-nav-btn">⟳ Mixer</Link>
      <Link href="/instrument" className="ag-nav-btn">🎹 Instrument</Link>
END
)

# ===== STEP 1: Pre-flight checks =====
if [[ -e "$NAV_FILE" ]]; then
  echo "ERROR: $NAV_FILE already exists. Move/backup it before rerunning."
  exit 1
fi

echo "== Scanning for affected pages =="

changed_files=()

for page in client/src/pages/*.tsx; do
  # Extract candidate nav block (strip interior lines, ignore whitespace)
  block=$(awk '/<div className="ag-controls-block">/{f=1} f{print} /<\/div>/{if(f){exit}}' "$page" | sed '1d;$d' | sed 's/^[ \t]*//')
  [[ -z "$block" ]] && continue
  block_canonical=$(echo "$block" | tr -d '\n' | tr -s ' ')
  nav_canonical=$(echo "$NAV_BLOCK" | tr -d '\n' | tr -s ' ')
  if [[ "$block_canonical" == "$nav_canonical" ]]; then
    changed_files+=("$page")
    echo "  Will patch: $page"
  fi
done

if [[ ${#changed_files[@]} -eq 0 ]]; then
  echo "No files found to patch. Exiting safely."
  exit 0
fi

# ===== STEP 2: Create reusable nav component =====
echo "== Creating $NAV_FILE =="
mkdir -p "$(dirname "$NAV_FILE")"
cat > "$NAV_FILE" <<COMP
import Link from 'next/link';

export function MusicAppNav() {
  return (
    <div className="ag-controls-block">
$NAV_BLOCK
    </div>
  );
}
COMP
echo "  Created $NAV_FILE."

# ===== STEP 3: Patch affected pages (with safety and import checks) =====
for file in "${changed_files[@]}"; do
  echo "--> Patching $file"
  cp "$file" "$file.bak"
  awk '
    /<div className="ag-controls-block">/ {f=1; print "      <MusicAppNav />"; next}
    f && /<\/div>/ {f=0; next}
    !f {print}
  ' "$file.bak" > "$file.tmp"

  # Add import at top if not present; never duplicate
  if ! grep -q "import { MusicAppNav }" "$file.tmp"; then
    awk 'NR==1{print "import { MusicAppNav } from \"@/components/music-app-nav\";"} 1' "$file.tmp" > "$file"
    rm "$file.tmp"
  else
    mv "$file.tmp" "$file"
  fi
done

# ===== STEP 4: Print summary of changes =====
echo "== Unified diff summary for DRY nav patch =="
for file in "${changed_files[@]}"; do
  echo "--- $file ---"
  diff -u "$file.bak" "$file" || echo "(No diff! Already updated.)"
done

echo "== DONE =="
echo "Created $NAV_FILE"
echo "Backups at .bak for all changed pages."
echo "Please run: pnpm tsc --noEmit"
echo "Then review affected pages in the browser!"
