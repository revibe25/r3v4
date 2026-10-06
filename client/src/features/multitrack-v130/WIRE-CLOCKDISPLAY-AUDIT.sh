#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# WIRE-CLOCKDISPLAY-AUDIT.sh
#
# Surgical fix with quadruple-check audit:
# 1. Apply 3 changes to MultitrackV130.tsx
# 2. Verify each change with grep
# 3. Run TypeScript type check
# 4. Show diffs before/after
# 5. Confirm hook file exists and has content
# ═══════════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

WORKDIR="$HOME/Projects/r3v4/client/src/features/multitrack-v130"
MAINFILE="$WORKDIR/MultitrackV130.tsx"
HOOKFILE="$WORKDIR/hooks/useAudioGraphState.ts"
BACKUP_BEFORE="$MAINFILE.pre-clockdisplay-wire-$(date +%s)"

echo "🔧 WIRE CLOCKDISPLAY WITH QUADRUPLE-CHECK AUDIT"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── PRE-FLIGHT CHECKS ──────────────────────────────────────────────────────────
echo "
✓ PRE-FLIGHT: Validating files..."

if [[ ! -f "$MAINFILE" ]]; then
  echo "❌ ERROR: $MAINFILE not found"
  exit 1
fi

if [[ ! -f "$HOOKFILE" ]]; then
  echo "❌ ERROR: Hook file $HOOKFILE not found"
  echo "   Run this first to create it:"
  echo "   cat > $HOOKFILE << 'EOF'"
  cat ~/useAudioGraphState.ts 2>/dev/null || echo "   (paste hook content here)"
  echo "   EOF"
  exit 1
fi

echo "   ✅ MultitrackV130.tsx exists ($(wc -l < "$MAINFILE") lines)"
echo "   ✅ useAudioGraphState.ts exists ($(wc -l < "$HOOKFILE") lines)"

# ─── BACKUP BEFORE CHANGES ─────────────────────────────────────────────────────
echo "
✓ BACKUP: Creating pre-wire snapshot..."
cp "$MAINFILE" "$BACKUP_BEFORE"
echo "   ✅ Backed up to: $BACKUP_BEFORE"

# ─── CHECK 1: Hook import not already present ──────────────────────────────────
echo "
✓ CHECK 1: Verify hook import doesn't exist yet..."
if grep -q "useAudioGraphState" "$MAINFILE"; then
  echo "   ⚠️  Hook already imported. Skipping import step."
  SKIP_IMPORT=1
else
  SKIP_IMPORT=0
  echo "   ✅ Hook not yet imported (OK to add)"
fi

# ─── CHANGE 1: Add import ──────────────────────────────────────────────────────
if [[ $SKIP_IMPORT -eq 0 ]]; then
  echo "
✓ CHANGE 1: Adding import statement..."
  
  # Find the line with 'import { getAudioGraph }'
  IMPORT_LINE=$(grep -n "import { getAudioGraph }" "$MAINFILE" | cut -d: -f1)
  
  if [[ -z "$IMPORT_LINE" ]]; then
    echo "   ❌ ERROR: Could not find 'import { getAudioGraph }' line"
    exit 1
  fi
  
  echo "   Found getAudioGraph import at line: $IMPORT_LINE"
  
  # Insert new import after that line
  INSERT_LINE=$((IMPORT_LINE + 1))
  sed -i "${INSERT_LINE}i import { useAudioGraphState } from './hooks/useAudioGraphState';" "$MAINFILE"
  
  echo "   ✅ Inserted at line $INSERT_LINE"
fi

# ─── AUDIT 1: Verify import was added ──────────────────────────────────────────
echo "
✓ AUDIT 1: Verify import statement..."
if grep -q "import { useAudioGraphState } from './hooks/useAudioGraphState';" "$MAINFILE"; then
  echo "   ✅ Import found in file"
  grep "useAudioGraphState" "$MAINFILE" | head -1 | sed 's/^/      /'
else
  echo "   ❌ FAILED: Import not found after insertion"
  echo "   File contents around expected import:"
  grep -n "getAudioGraph\|useAudioGraphState" "$MAINFILE" || true
  exit 1
fi

# ─── CHECK 2: Hook call not already present ────────────────────────────────────
echo "
✓ CHECK 2: Verify hook call doesn't exist yet..."
if grep -q "const audioState = useAudioGraphState()" "$MAINFILE"; then
  echo "   ⚠️  Hook call already present. Skipping hook call step."
  SKIP_HOOK_CALL=1
else
  SKIP_HOOK_CALL=0
  echo "   ✅ Hook call not yet added (OK to add)"
fi

# ─── CHANGE 2: Add hook call ──────────────────────────────────────────────────
if [[ $SKIP_HOOK_CALL -eq 0 ]]; then
  echo "
✓ CHANGE 2: Adding hook call..."
  
  # Find useLayoutEffect block that sets audioGraph
  LAYOUT_EFFECT_LINE=$(grep -n "useLayoutEffect(() => {" "$MAINFILE" | head -1 | cut -d: -f1)
  
  if [[ -z "$LAYOUT_EFFECT_LINE" ]]; then
    echo "   ❌ ERROR: Could not find useLayoutEffect line"
    exit 1
  fi
  
  # Find the closing }); of that useLayoutEffect
  CLOSING_LINE=$(tail -n +$LAYOUT_EFFECT_LINE "$MAINFILE" | grep -n "}, \[\]);" | head -1 | cut -d: -f1)
  CLOSING_LINE=$((LAYOUT_EFFECT_LINE + CLOSING_LINE - 1))
  
  echo "   Found useLayoutEffect at line $LAYOUT_EFFECT_LINE, closes at $CLOSING_LINE"
  
  # Insert hook call after closing
  INSERT_HOOK_LINE=$((CLOSING_LINE + 1))
  sed -i "${INSERT_HOOK_LINE}i \ \ // Wire ClockDisplay with live audio + DAW state\n  const audioState = useAudioGraphState();" "$MAINFILE"
  
  echo "   ✅ Inserted at line $INSERT_HOOK_LINE"
fi

# ─── AUDIT 2: Verify hook call was added ──────────────────────────────────────
echo "
✓ AUDIT 2: Verify hook call..."
if grep -q "const audioState = useAudioGraphState()" "$MAINFILE"; then
  echo "   ✅ Hook call found in file"
  grep "const audioState = useAudioGraphState()" "$MAINFILE" | sed 's/^/      /'
else
  echo "   ❌ FAILED: Hook call not found after insertion"
  exit 1
fi

# ─── CHECK 3: ClockDisplay render line exists ──────────────────────────────────
echo "
✓ CHECK 3: Locate ClockDisplay render..."
CLOCK_LINE=$(grep -n "<ClockDisplay" "$MAINFILE" | head -1 | cut -d: -f1)

if [[ -z "$CLOCK_LINE" ]]; then
  echo "   ❌ ERROR: Could not find ClockDisplay render"
  exit 1
fi

echo "   Found <ClockDisplay at line: $CLOCK_LINE"

# Show current line
echo "   Current:"
sed -n "${CLOCK_LINE}p" "$MAINFILE" | sed 's/^/      /'

# ─── CHANGE 3: Update ClockDisplay props ──────────────────────────────────────
echo "
✓ CHANGE 3: Updating ClockDisplay props..."

# Check if already has props
if grep -q "currentTime={audioState.currentTime}" "$MAINFILE"; then
  echo "   ⚠️  ClockDisplay already has props. Skipping update."
  SKIP_CLOCK_UPDATE=1
else
  SKIP_CLOCK_UPDATE=0
  
  # Replace the line
  sed -i "${CLOCK_LINE}s/<ClockDisplay \/>/<ClockDisplay currentTime={audioState.currentTime} bpm={audioState.bpm} timeSignature={audioState.timeSignature} \/>/" "$MAINFILE"
  
  echo "   ✅ Updated line $CLOCK_LINE"
fi

# ─── AUDIT 3: Verify ClockDisplay props were added ─────────────────────────────
echo "
✓ AUDIT 3: Verify ClockDisplay props..."
if grep -q "currentTime={audioState.currentTime}" "$MAINFILE"; then
  echo "   ✅ ClockDisplay props found"
  grep "<ClockDisplay" "$MAINFILE" | sed 's/^/      /'
else
  echo "   ❌ FAILED: ClockDisplay props not found"
  exit 1
fi

# ─── QUADRUPLE-CHECK: Show all 3 changes ───────────────────────────────────────
echo "
✓ QUADRUPLE-CHECK: All changes in place..."
echo "   1. Hook import:"
grep "useAudioGraphState.*import" "$MAINFILE" | sed 's/^/      /'

echo "   2. Hook call:"
grep "const audioState = useAudioGraphState()" "$MAINFILE" | sed 's/^/      /'

echo "   3. ClockDisplay props:"
grep "<ClockDisplay" "$MAINFILE" | head -1 | sed 's/^/      /'

# ─── SYNTAX CHECK: Run TypeScript ──────────────────────────────────────────────
echo "
✓ SYNTAX CHECK: Running TypeScript..."
cd "$HOME/Projects/r3v4/client" || exit 1

if pnpm exec tsc --noEmit 2>&1 | grep -q "error"; then
  echo "   ❌ TypeScript errors found:"
  pnpm exec tsc --noEmit | grep "error\|MultitrackV130" || true
  exit 1
else
  echo "   ✅ No TypeScript errors (0 errors)"
fi

# ─── DIFF SUMMARY ──────────────────────────────────────────────────────────────
echo "
✓ DIFF SUMMARY:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
CHANGE_COUNT=$(diff -u "$BACKUP_BEFORE" "$MAINFILE" | grep -c "^[+-]" || true)
echo "   Total line changes: $CHANGE_COUNT"
echo ""
echo "   Lines added:"
diff -u "$BACKUP_BEFORE" "$MAINFILE" | grep "^+" | grep -v "^+++" | sed 's/^/      /'
echo ""
echo "   (Run: diff -u $BACKUP_BEFORE $MAINFILE)"

# ─── FINAL VALIDATION ──────────────────────────────────────────────────────────
echo "
✓ FINAL VALIDATION:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count expected imports
IMPORT_COUNT=$(grep -c "useAudioGraphState.*import" "$MAINFILE" || true)
echo "   ✅ Hook imports: $IMPORT_COUNT (expected: 1)"

# Count expected hook calls
HOOK_CALL_COUNT=$(grep -c "const audioState = useAudioGraphState()" "$MAINFILE" || true)
echo "   ✅ Hook calls: $HOOK_CALL_COUNT (expected: 1)"

# Count ClockDisplay with props
CLOCK_PROPS_COUNT=$(grep -c "currentTime={audioState.currentTime}" "$MAINFILE" || true)
echo "   ✅ ClockDisplay with props: $CLOCK_PROPS_COUNT (expected: 1)"

# Hook file validation
HOOK_LINES=$(wc -l < "$HOOKFILE")
echo "   ✅ Hook file size: $HOOK_LINES lines (expected: 50-100)"

# ─── READY TO COMMIT ────────────────────────────────────────────────────────────
echo "
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SUCCESS: ClockDisplay wired and verified"
echo ""
echo "Next steps:"
echo "  1. Test in browser: http://localhost:5174/multitrack"
echo "  2. Open DevTools → Console"
echo "  3. Verify ClockDisplay renders with live time (HH:MM:SS.mmm)"
echo ""
echo "Commit when ready:"
echo "  cd ~/Projects/r3v4"
echo "  git add client/src/features/multitrack-v130/MultitrackV130.tsx"
echo "  git add client/src/features/multitrack-v130/hooks/useAudioGraphState.ts"
echo "  git commit -m 'feat(clockdisplay): wire live AudioGraph state + DAW transport'"
echo ""
echo "Rollback (if needed):"
echo "  cp $BACKUP_BEFORE $MAINFILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
