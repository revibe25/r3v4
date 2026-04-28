#!/usr/bin/env bash
set -euo pipefail

nav_file="client/src/components/music-app-nav.tsx"
nav_block='      <Link href="/daw"        className="ag-nav-btn">🎚 Studio</Link>
      <Link href="/collab"     className="ag-nav-btn">⬡ Collab</Link>
      <Link href="/multitrack" className="ag-nav-btn">📼 Multitrack</Link>
      <Link href="/mixer"      className="ag-nav-btn">⟳ Mixer</Link>
      <Link href="/instrument" className="ag-nav-btn">🎹 Instrument</Link>'

echo "== STEP 1: Pre-flight checks =="
# 1. Must not overwrite nav file unintentionally
if [[ -e $nav_file ]]; then
  echo "ERROR: $nav_file already exists. If you want to recreate, move or delete it first."
  exit 1
fi

# 2. Find all locations of the nav block in pages (triple-check by awk), skip pages that don't match
echo "== STEP 2: Scanning pages for nav-blocks to DRY =="
declare -a changed_files
for page in client/src/pages/*.tsx; do
  # Find nav block and check for parity (ignores whitespace)
  block=$(awk '/<div className="ag-controls-block">/{f=1} f{print} /<\/div>/{if(f){exit}}' "$page" | sed '1d;$d' | sed 's/^[ \t]*//' )
  if [[ $block == '' ]]; then continue; fi
  # Collapse multiple consecutive spaces to one; check for DRY block
  block_canonical=$(echo "$block" | tr -d '\n' | tr -s ' ')
  nav_canonical=$(echo "$nav_block" | tr -d '\n' | tr -s ' ')
  # Only if they are the same (after space collapse): allow replacement
  if [[ $block_canonical == *'/daw"'* && $block_canonical == "$nav_canonical" ]]; then
    changed_files+=("$page")
    echo "Will patch: $page"
  fi
done

if [[ ${#changed_files[@]} == 0 ]]; then echo "No files found with nav block matching DRY target. Exiting cleanly."; exit 0; fi

# 3. Create the DRY nav component, with tripled-checked syntax
echo "== STEP 3: Creating $nav_file =="
cat > "$nav_file" <<END
import Link from 'next/link';

export function MusicAppNav() {
  return (
    <div className="ag-controls-block">
$nav_block
    </div>
  );
}
END

echo "Created: $nav_file"

# 4. Patch each changed page safely
for file in "${changed_files[@]}"; do
  echo "== Patching $file =="
  cp "$file" "$file.bak"
  # replace the whole nav block with <MusicAppNav />
  awk '
    /<div className="ag-controls-block">/ {f=1; print "      <MusicAppNav />"; next}
    f && /<\/div>/ {f=0; next}
    !f {print}
  ' "$file.bak" > "$file.tmp"

  # idempotently add the import if not already present
  grep -q "import { MusicAppNav }" "$file.tmp" || \
    awk 'NR==1{print "import { MusicAppNav } from \"@/components/music-app-nav\";"} 1' "$file.tmp" > "$file"
  # if the import line is already present, just move the .tmp to live
  if grep -q "import { MusicAppNav }" "$file.tmp"; then mv "$file.tmp" "$file"; else rm "$file.tmp"; fi
done

echo "== STEP 5: Patch Summary =="
for file in "${changed_files[@]}"; do
  echo "--- $file ---"
  diff -u "$file.bak" "$file" || echo "(No diff! Already up-to-date?)"
done

echo "== All done; backups at .bak. Sanity-check, then run pnpm tsc --noEmit =="
