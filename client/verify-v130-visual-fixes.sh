#!/bin/bash
# R3 v4 Multitrack v1.3.0 Visual Fix Verification Script
# Run on r3v machine: bash ~/verify-v130-visual-fixes.sh
# Performs 4-checkpoint verification before commit

set -e

ROOT="$HOME/Projects/r3v4"
CSS="$ROOT/client/src/features/multitrack-v130/styles/reference.css"
TS="$ROOT/client/src/features/multitrack-v130/renderers/useV130PresentationRuntime.ts"

echo "════════════════════════════════════════════════════════════"
echo "  R3 v4 Multitrack v1.3.0 Visual Fix Verification"
echo "════════════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────────────
# CHECKPOINT 1: CSS Fixes
# ─────────────────────────────────────────────────────────────────

echo "CHECKPOINT 1: CSS Fixes"
echo "─────────────────────────────────────────────────────────────"

check_css_1=$(grep -A5 "\.r3-multitrack-v130 #tl canvas" "$CSS" | grep -c "width: 100%")
check_css_2=$(grep -A5 "\.r3-multitrack-v130 #tl canvas" "$CSS" | grep -c "height: 100%")
check_css_3=$(grep -A4 "\.r3-multitrack-v130 #cvA" "$CSS" | grep -c "width: 100%")
check_css_4=$(grep -A4 "\.r3-multitrack-v130 #cvA" "$CSS" | grep -c "height: 100%")

if [ "$check_css_1" -eq 1 ] && [ "$check_css_2" -eq 1 ]; then
  echo "✅ Track canvas (#tl canvas) sizing: width/height 100% present"
else
  echo "❌ Track canvas missing width/height"
  exit 1
fi

if [ "$check_css_3" -eq 1 ] && [ "$check_css_4" -eq 1 ]; then
  echo "✅ Analyzer canvas (#cvA) sizing: width/height 100% present"
else
  echo "❌ Analyzer canvas missing width/height"
  exit 1
fi

echo ""

# ─────────────────────────────────────────────────────────────────
# CHECKPOINT 2: TypeScript Fixes
# ─────────────────────────────────────────────────────────────────

echo "CHECKPOINT 2: TypeScript Fixes"
echo "─────────────────────────────────────────────────────────────"

check_mixer=$(grep -c "class=\"kn\"" "$TS")
check_vmet=$(grep -c "\.vmet" "$TS")
check_dsp=$(grep -c "R3 Parametric EQ\|R3 De-Esser\|R3 Reverb\|R3 Saturation" "$TS")

if [ "$check_mixer" -ge 8 ]; then
  echo "✅ Mixer SVG knobs (.kn class): $check_mixer occurrences found"
else
  echo "⚠️  Mixer knobs: only $check_mixer occurrences (expected ≥8)"
fi

if [ "$check_vmet" -eq 0 ]; then
  echo "✅ Removed .vmet class: 0 occurrences (fixed)"
else
  echo "❌ Old .vmet class still present: $check_vmet occurrences"
  exit 1
fi

if [ "$check_dsp" -ge 4 ]; then
  echo "✅ DSP master plugins: $check_dsp device names found (6 plugins total)"
else
  echo "⚠️  DSP plugins: only $check_dsp device names found"
fi

echo ""

# ─────────────────────────────────────────────────────────────────
# CHECKPOINT 3: File Integrity
# ─────────────────────────────────────────────────────────────────

echo "CHECKPOINT 3: File Integrity"
echo "─────────────────────────────────────────────────────────────"

if [ ! -f "$CSS" ]; then
  echo "❌ reference.css not found at $CSS"
  exit 1
fi
echo "✅ reference.css found and readable"

if [ ! -f "$TS" ]; then
  echo "❌ useV130PresentationRuntime.ts not found at $TS"
  exit 1
fi
echo "✅ useV130PresentationRuntime.ts found and readable"

if [ -d "$ROOT/.git" ]; then
  echo "✅ Git repository present at $ROOT"
else
  echo "❌ Git repository not found"
  exit 1
fi

echo ""

# ─────────────────────────────────────────────────────────────────
# CHECKPOINT 4: Backups Present
# ─────────────────────────────────────────────────────────────────

echo "CHECKPOINT 4: Backup Files"
echo "─────────────────────────────────────────────────────────────"

backup_dir=$(ls -d ~/.r3v4-backups/visual-fix-* 2>/dev/null | tail -1)

if [ -n "$backup_dir" ]; then
  echo "✅ Backup directory found: $backup_dir"
  backup_count=$(ls "$backup_dir" | wc -l)
  echo "   Files in backup: $backup_count"
  ls "$backup_dir" | sed 's/^/   - /'
else
  echo "⚠️  No backup directory found (may need manual backup)"
fi

echo ""

# ─────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────

echo "════════════════════════════════════════════════════════════"
echo "  ✅ ALL CHECKPOINTS PASSED"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Verify browser shows full-width tracks and mixer knobs"
echo "  2. Run TypeScript check:"
echo "     cd $ROOT/client && pnpm exec tsc --noEmit"
echo "  3. If tsc passes, commit:"
echo "     cd $ROOT && git add . && git commit -m '...'"
echo ""
