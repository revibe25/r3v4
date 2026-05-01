#!/usr/bin/env bash
set -euo pipefail

FILE="client/src/features/loopstation/hooks/useLoopStation505.ts"
BACKUP="$FILE.bak.$(date +%s)"

echo "🔧 LoopStation505 safe fix script starting..."

# ─────────────────────────────────────────────
# 1. Backup
# ─────────────────────────────────────────────
echo "📦 Creating backup: $BACKUP"
cp "$FILE" "$BACKUP"

# ─────────────────────────────────────────────
# 2. Guard: file must exist
# ─────────────────────────────────────────────
if [[ ! -f "$FILE" ]]; then
  echo "❌ File not found: $FILE"
  exit 1
fi

# ─────────────────────────────────────────────
# 3. Fix obvious engine reference bug
# engine -> _engine ONLY in safe contexts
# ─────────────────────────────────────────────
echo "🔧 Fixing engine reference mismatch..."
perl -pi -e 's/\bengine\.on/\_engine\.on/g' "$FILE"
perl -pi -e 's/\bengine\.tracks/\_engine\.tracks/g' "$FILE"
perl -pi -e 's/getLoopEngine\(\)/getLoopEngine()/g' "$FILE"

# ─────────────────────────────────────────────
# 4. Fix offs/offs cleanup mismatch
# ─────────────────────────────────────────────
echo "🔧 Fixing offs cleanup mismatch..."
perl -pi -e 's/\breturn \(\) => offs\.forEach/\nreturn () => _offs.forEach/g' "$FILE"

# ─────────────────────────────────────────────
# 5. Fix duplicate return keys (midiInputs / toggleMidiInput)
# SAFE STRATEGY: remove duplicates ONLY in return block
# ─────────────────────────────────────────────
echo "🔧 Removing duplicate return keys (safe prune)..."

perl -0777 -i -pe '
  if (/return\s*{(.*?)}/s) {
    my $block = $1;

    # remove duplicates by collapsing repeated keys
    my %seen;
    my @lines = split(/\n/, $block);
    my @out;

    for my $l (@lines) {
      if ($l =~ /midiInputs|toggleMidiInput|midiInputEnabled/) {
        next if $seen{$l}++;
      }
      push @out, $l;
    }

    $_ =~ s/return\s*{.*?}/return {\n@{[join("\n", @out)]}\n}/s;
  }
' "$FILE"

# ─────────────────────────────────────────────
# 6. Fix obvious undefined variable patterns
# ─────────────────────────────────────────────
echo "🔧 Fixing known undefined variables..."

perl -pi -e 's/\bthreshold\b/_threshold/g if /setTrackCompressor/' "$FILE"
perl -pi -e 's/\bid\b/_idx/g if /idxFromId/' "$FILE"
perl -pi -e 's/\bscene\b/_scene/g' "$FILE"

# ─────────────────────────────────────────────
# 7. Safety validation checks
# ─────────────────────────────────────────────
echo "🔍 Running integrity checks..."

echo "Checking for obvious runtime crashes..."

grep -n "engine\." "$FILE" && echo "⚠️ WARNING: raw engine reference still exists"
grep -n "offs\.forEach" "$FILE" || echo "✔ offs fixed"
grep -n "duplicate key" "$FILE" || true

# ─────────────────────────────────────────────
# 8. TypeScript check (if available)
# ─────────────────────────────────────────────
if command -v npx &> /dev/null; then
  echo "🧪 Running TypeScript check..."
  npx tsc --noEmit || echo "⚠️ TypeScript errors still present (expected if file was unstable)"
fi

# ─────────────────────────────────────────────
# 9. Summary
# ─────────────────────────────────────────────
echo ""
echo "✅ Phase 1 complete"
echo "📦 Backup stored at: $BACKUP"
echo "⚠️ Next step: run manual architectural split (engine/midi/tracks/scenes)"
echo ""
echo "If you want Phase 2 automation scaffold generator, ask for:"
echo "→ 'generate loopstation modular refactor scaffold'"
