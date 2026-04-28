#!/usr/bin/env bash
set -euo pipefail

# ==== Configuration (edit these if your structure changes) ====
NAV_FILE="client/src/components/music-app-nav.tsx"
NAV_BLOCK=$(cat <<'EOF'
      <Link href="/daw"        className="ag-nav-btn">🎚 Studio</Link>
      <Link href="/collab"     className="ag-nav-btn">⬡ Collab</Link>
      <Link href="/multitrack" className="ag-nav-btn">📼 Multitrack</Link>
      <Link href="/mixer"      className="ag-nav-btn">⟳ Mixer</Link>
      <Link href="/instrument" className="ag-nav-btn">🎹 Instrument</Link>
EOF
)

# ==== Step 1: Preflight checks ====
if [[ -e $NAV_FILE ]]; then
  echo "ERROR: $NAV_FILE already exists. Move or delete it before running this script."
  exit 1
fi

# ==== Step 2: Scan for pages to patch ====
echo "== STEP 2: Scanning pages for nav-blocks to DRY =="

changed_files=()  # <-- This line fixes the array bug!

for page in client/src/pages/*.tsx; do
  # Get all lines inside the nav block
  block=$(awk '/<div className="ag-controls-block">/{f=1} f{print} /<\/div>/{if(f){exit}}' "$page" | sed '1d;$d' | sed 's/^[ \t]*//')
  if [[ -z $block ]]; then continue; fi
  # Collapse to canonical one-liner for safe compare
  block_canonical=$(echo "$block" | tr -d '\n' | tr -s ' ')
  nav_canonical=$(echo "$NAV_BLOCK" | tr -d '\n' | tr -s ' ')
  if [[ $block_canonical == "$nav_canonical" ]]; then
    changed_files+=("$page")
    echo "Will patch: $page"
  fi
done

if [[ ${#changed_files[@]} -eq 0 ]]; then
  echo "No files found with nav block matching DRY target; nothing to patch. Exiting cleanly."
  exit 0
fi

# ==== Step 3: Create the MusicAppNav component ====
echo "== STEP 3: Creating $NAV_FILE =="
cat > "$NAV_FILE" <<END
import Link from 'next/link';

export function MusicAppNav() {
  return (
    <div className="ag-controls-block">
$NAV_BLOCK
    </div>
  );
}
END

echo "Created: $NAV_FILE"

# ==== Step 4: Patch matched pages with backup, replacement, and idempotent import ====

for file in "${changed_files[@]}"; do
  echo "== Patching $file =="
  cp "$file" "$file.bak"
  # Replace the full nav block with <MusicAppNav />
  awk '
    /<div className="ag-controls-block">/ {f=1; print "      <MusicAppNav />"; next}
    f && /<\/div>/ {f=0; next}
    !f {print}
  ' "$file.bak" > "$file.tmp"

  # Add import if not present
  if ! grep -q "import { MusicAppNav }" "$file.tmp"; then
    awk 'NR==1{print "import { MusicAppNav } from \"@/components/music-app-nav\";"} 1' "$file.tmp" > "$file"
    rm "$file.tmp"
  else
    mv "$file.tmp" "$file"
  fi
done

# ==== Step 5: Summary ====
echo "== SUMMARY (diffs vs .bak) =="
for file in "${changed_files[@]}"; do
  echo "--- $file ---"
  diff -u "$file.bak" "$file" || echo "(No diff! Maybe already up-to-date.)"
done

echo "== Done. Backups with .bak. Run 'pnpm tsc --noEmit' and check your UI =="
exit 0
