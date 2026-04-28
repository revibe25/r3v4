#!/usr/bin/env bash
set -euo pipefail

# Directory where script runs must contain client/src/pages/instrument.tsx and DAW.tsx
i="client/src/pages/instrument.tsx"
d="client/src/pages/DAW.tsx"

echo "== Running PATCH: instrument.tsx and DAW.tsx layout/nav/height enhancements =="

# Safety: Ensure files exist
if [[ ! -f "$i" ]]; then echo "ERROR: $i not found! Aborting."; exit 1; fi
if [[ ! -f "$d" ]]; then echo "ERROR: $d not found! Aborting."; exit 1; fi

#### --- PATCH 1: instrument.tsx ---

# (1a) Confirm the .ag-shell height still uses 100vh (patch only if present)
if ! grep -qE '\.ag-shell[[:space:]]*\{[^}]*height:\s*100vh;' "$i"; then
  echo "ERROR: instrument.tsx does not contain ag-shell height: 100vh anchor. (Already patched or source changed.) Aborting."
  exit 1
fi

# (1b) Confirm the nav block hasn't already been updated (idempotence check)
if grep -qE '<Link href="/collab".*className="ag-nav-btn">' "$i"; then
  echo "instrument.tsx nav block already contains Collab button. Skipping nav patch."
  nav_patch_i=0
else
  nav_patch_i=1
fi

# (1c) Confirm the nav block matches expected original form
if (( nav_patch_i )); then
  if ! grep -qE '<div className="ag-controls-block">\s*<Link href="/multitrack" className="ag-nav-btn">🎚 DAW</Link>' "$i"; then
    echo "ERROR: instrument.tsx nav block not in expected pre-patch state. Aborting. Review manually."
    exit 1
  fi
fi

# (1d) Make .bak backup
cp "$i" "$i.bak"

# (1e) PATCH text: height and nav
perl -i -0777 -pe '
  # Replace ag-shell height line
  s/(\.ag-shell\s*\{\s*[^}]*?)height:\s*100vh;/$1height: calc(100vh - var(--nav-h, 0px));/s;

  # Replace the ag-controls-block nav
  s{<div className="ag-controls-block">\s*<Link href="/multitrack" className="ag-nav-btn">🎚 DAW</Link>\s*</div>}{
<div className="ag-controls-block">
  <Link href="/daw"        className="ag-nav-btn">🎚 Studio</Link>
  <Link href="/collab"     className="ag-nav-btn">⬡ Collab</Link>
  <Link href="/multitrack" className="ag-nav-btn">📼 Multitrack</Link>
  <Link href="/mixer"      className="ag-nav-btn">⟳ Mixer</Link>
</div>
}s
' "$i"

#### --- PATCH 2: DAW.tsx ---

# (2a) Confirm .r3-daw-shell height: 100vh line exists
if ! grep -qE '\.r3-daw-shell[[:space:]]*\{[^}]*height:\s*100vh;' "$d"; then
  echo "ERROR: DAW.tsx does not contain r3-daw-shell height: 100vh anchor. (Already patched or source changed.) Aborting."
  exit 1
fi

# (2b) Make .bak backup
cp "$d" "$d.bak"

# (2c) PATCH height only
perl -i -0777 -pe '
  s/(\.r3-daw-shell\s*\{\s*[^}]*?)height:\s*100vh;/$1height: calc(100vh - var(--nav-h, 0px));/s;
' "$d"

#### --- REPORT PATCH DIFFS ---
echo "== instrument.tsx changes =="
diff -u "$i.bak" "$i" || echo "(No change -- already patched)"
echo "== DAW.tsx changes =="
diff -u "$d.bak" "$d"   || echo "(No change -- already patched)"

echo '== PATCH COMPLETE =='
echo "Backup files: $i.bak, $d.bak"
echo 'Sanity-check your app visually, then run: pnpm tsc --noEmit'

exit 0
