#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════════
# WIRE-CLOCKDISPLAY-AUDIT-V2.sh
# 
# Quadruple-check with smart prop replacement (handles existing props)
# ═══════════════════════════════════════════════════════════════════════════════

set -e

WORKDIR="$HOME/Projects/r3v4/client/src/features/multitrack-v130"
MAINFILE="$WORKDIR/MultitrackV130.tsx"
HOOKFILE="$WORKDIR/hooks/useAudioGraphState.ts"
BACKUP_BEFORE="$MAINFILE.pre-clockdisplay-wire-v2-$(date +%s)"

echo "🔧 WIRE CLOCKDISPLAY WITH QUADRUPLE-CHECK AUDIT (V2)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ─── PRE-FLIGHT ─────────────────────────────────────────────────────────────────
echo "✓ PRE-FLIGHT: Validating files..."

if [[ ! -f "$MAINFILE" ]]; then
  echo "❌ ERROR: $MAINFILE not found"
  exit 1
fi

if [[ ! -f "$HOOKFILE" ]]; then
  echo "❌ ERROR: Hook file $HOOKFILE not found"
  exit 1
fi

echo "   ✅ MultitrackV130.tsx exists ($(wc -l < "$MAINFILE") lines)"
echo "   ✅ useAudioGraphState.ts exists ($(wc -l < "$HOOKFILE") lines)"

# ─── BACKUP ─────────────────────────────────────────────────────────────────────
echo "✓ BACKUP: Creating pre-wire snapshot..."
cp "$MAINFILE" "$BACKUP_BEFORE"
echo "   ✅ Backed up to: $BACKUP_BEFORE"

# ─── CHANGE 1: Add import ───────────────────────────────────────────────────────
echo "✓ CHANGE 1: Adding hook import..."

if ! grep -q "useAudioGraphState" "$MAINFILE"; then
  IMPORT_LINE=$(grep -n "import { getAudioGraph }" "$MAINFILE" | cut -d: -f1)
  if [[ -z "$IMPORT_LINE" ]]; then
    echo "   ❌ ERROR: Could not find getAudioGraph import"
    exit 1
  fi
  
  INSERT_LINE=$((IMPORT_LINE + 1))
  sed -i "${INSERT_LINE}i import { useAudioGraphState } from './hooks/useAudioGraphState';" "$MAINFILE"
  echo "   ✅ Inserted at line $INSERT_LINE"
else
  echo "   ⚠️  Already present, skipping"
fi

# ─── AUDIT 1 ────────────────────────────────────────────────────────────────────
echo "✓ AUDIT 1: Verify import..."
if grep -q "import { useAudioGraphState }" "$MAINFILE"; then
  echo "   ✅ Import found"
else
  echo "   ❌ FAILED: Import not found"
  exit 1
fi

# ─── CHANGE 2: Add hook call ────────────────────────────────────────────────────
echo "✓ CHANGE 2: Adding hook call..."

if ! grep -q "const audioState = useAudioGraphState()" "$MAINFILE"; then
  LAYOUT_EFFECT_LINE=$(grep -n "useLayoutEffect(() => {" "$MAINFILE" | head -1 | cut -d: -f1)
  if [[ -z "$LAYOUT_EFFECT_LINE" ]]; then
    echo "   ❌ ERROR: Could not find useLayoutEffect"
    exit 1
  fi
  
  CLOSING_LINE=$(tail -n +$LAYOUT_EFFECT_LINE "$MAINFILE" | grep -n "}, \[\]);" | head -1 | cut -d: -f1)
  CLOSING_LINE=$((LAYOUT_EFFECT_LINE + CLOSING_LINE - 1))
  
  INSERT_HOOK_LINE=$((CLOSING_LINE + 2))
  sed -i "${INSERT_HOOK_LINE}i \ \ // Wire ClockDisplay with live audio + DAW state\n  const audioState = useAudioGraphState();" "$MAINFILE"
  echo "   ✅ Inserted at line $INSERT_HOOK_LINE"
else
  echo "   ⚠️  Already present, skipping"
fi

# ─── AUDIT 2 ────────────────────────────────────────────────────────────────────
echo "✓ AUDIT 2: Verify hook call..."
if grep -q "const audioState = useAudioGraphState()" "$MAINFILE"; then
  echo "   ✅ Hook call found"
else
  echo "   ❌ FAILED: Hook call not found"
  exit 1
fi

# ─── CHANGE 3: Update ClockDisplay (smart replacement) ──────────────────────────
echo "✓ CHANGE 3: Updating ClockDisplay props (smart replacement)..."

CLOCK_LINE=$(grep -n "<ClockDisplay" "$MAINFILE" | head -1 | cut -d: -f1)

if [[ -z "$CLOCK_LINE" ]]; then
  echo "   ❌ ERROR: Could not find ClockDisplay"
  exit 1
fi

echo "   Found ClockDisplay at line $CLOCK_LINE"
CURRENT=$(sed -n "${CLOCK_LINE}p" "$MAINFILE")
echo "   Current: $CURRENT"

# Smart replacement: replace anything between <ClockDisplay and />
# This handles: <ClockDisplay playheadPosition={0} tempo={120} format="both" />
# Or:           <ClockDisplay />

if grep -q "currentTime={audioState.currentTime}" "$MAINFILE"; then
  echo "   ⚠️  Props already correct, skipping"
else
  # Replace the line with new props
  sed -i "${CLOCK_LINE}s/<ClockDisplay[^>]*\/>/<ClockDisplay currentTime={audioState.currentTime} bpm={audioState.bpm} timeSignature={audioState.timeSignature} \/>/" "$MAINFILE"
  
  UPDATED=$(sed -n "${CLOCK_LINE}p" "$MAINFILE")
  echo "   ✅ Updated to: $UPDATED"
fi

# ─── AUDIT 3 ────────────────────────────────────────────────────────────────────
echo "✓ AUDIT 3: Verify ClockDisplay props..."
if grep -q "currentTime={audioState.currentTime}" "$MAINFILE"; then
  echo "   ✅ ClockDisplay props found"
  grep "<ClockDisplay" "$MAINFILE" | head -1
else
  echo "   ❌ FAILED: ClockDisplay props not correct"
  echo "   Line $CLOCK_LINE contains:"
  sed -n "${CLOCK_LINE}p" "$MAINFILE"
  exit 1
fi

# ─── QUADRUPLE-CHECK ────────────────────────────────────────────────────────────
echo "
✓ QUADRUPLE-CHECK: All 3 changes verified..."
echo "   1. Import:"
grep "useAudioGraphState.*import" "$MAINFILE"
echo "   2. Hook call:"
grep "const audioState = useAudioGraphState()" "$MAINFILE"
echo "   3. ClockDisplay:"
grep "<ClockDisplay" "$MAINFILE" | head -1

# ─── SYNTAX CHECK ───────────────────────────────────────────────────────────────
echo "
✓ SYNTAX CHECK: Running TypeScript..."
cd "$HOME/Projects/r3v4/client" || exit 1

if pnpm exec tsc --noEmit 2>&1 | grep -q "error TS"; then
  echo "   ❌ TypeScript errors found:"
  pnpm exec tsc --noEmit 2>&1 | grep "error TS"
  exit 1
else
  echo "   ✅ No TypeScript errors"
fi

# ─── SUCCESS ─────────────────────────────────────────────────────────────────────
echo "
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SUCCESS: ClockDisplay wired with quadruple-check pass"
echo ""
echo "Backup saved: $BACKUP_BEFORE"
echo ""
echo "Next: Test in browser and commit"
echo "  cd ~/Projects/r3v4"
echo "  # Test at http://localhost:5174/multitrack"
echo "  git add client/src/features/multitrack-v130/MultitrackV130.tsx"
echo "  git add client/src/features/multitrack-v130/hooks/useAudioGraphState.ts"
echo "  git commit -m 'feat(clockdisplay): wire live AudioGraph + DAW state'"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
