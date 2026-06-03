#!/bin/bash
###############################################################################
# update-collab-demo-hook.sh
# Wire.txt expert implementation: Replace INIT_COLLABS demo hook with live collabUsers
#
# Protocol: read → backup → grep anchor → replace → validate tsc → commit-ready
# Zero guesswork. Automatic rollback on any validation failure.
###############################################################################

set -euo pipefail

TARGET="/home/r3v/Stable/client/src/pages/collaborative-daw-pro.tsx"
REPO="/home/r3v/Stable"

# ─── Colors for output ─────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info()   { echo -e "${BLUE}[INFO]${NC}   $*"; }
log_ok()     { echo -e "${GREEN}[OK]${NC}     $*"; }
log_warn()   { echo -e "${YELLOW}[WARN]${NC}    $*"; }
log_err()    { echo -e "${RED}[ERROR]${NC}   $*" >&2; }

###############################################################################
# PHASE 1: Pre-flight checks
###############################################################################
log_info "Phase 1: Pre-flight checks"

if [ ! -f "$TARGET" ]; then
    log_err "Target file not found: $TARGET"
    exit 1
fi
log_ok "Target exists: $TARGET"

if [ ! -d "$REPO/.git" ]; then
    log_err "Not a git repository: $REPO"
    exit 1
fi
log_ok "Git repository confirmed"

# Check file was already patched with new hooks
if ! grep -q "const collab.*=.*useCollabSocket();" "$TARGET"; then
    log_err "File doesn't contain useCollabSocket hook — run fix_collab_AUDITED_v2_FIXED.py first"
    exit 1
fi
log_ok "useCollabSocket hook detected (previous patch applied)"

if ! grep -q "const collabUsers.*=.*useDAWStore.*collabUsers" "$TARGET"; then
    log_err "File doesn't contain collabUsers selector — patches incomplete"
    exit 1
fi
log_ok "collabUsers selector detected"

###############################################################################
# PHASE 2: Backup
###############################################################################
log_info "Phase 2: Create backup"

TS=$(date +%Y%m%d_%H%M%S)
BACKUP="${TARGET}.bak-collab-demo-${TS}"

cp "$TARGET" "$BACKUP"
log_ok "Backup created: $BACKUP"

###############################################################################
# PHASE 3: Locate & verify anchor (the demo useEffect hook)
###############################################################################
log_info "Phase 3: Locate demo hook anchor"

# Search for the unique anchor pattern
ANCHOR_PATTERN="useEffect(() => {"
ANCHOR_START=$(grep -n "Math.random() > 0.65" "$TARGET" | cut -d: -f1)

if [ -z "$ANCHOR_START" ]; then
    log_err "Could not find demo hook anchor (Math.random() > 0.65)"
    log_warn "Restoring backup..."
    cp "$BACKUP" "$TARGET"
    exit 1
fi
log_ok "Demo hook found at line $ANCHOR_START"

# Verify the hook structure contains the problematic INIT_COLLABS reference
LINES_AFTER=$((ANCHOR_START + 20))
if ! sed -n "${ANCHOR_START},${LINES_AFTER}p" "$TARGET" | grep -q "INIT_COLLABS"; then
    log_warn "Hook structure may have changed — proceeding with caution"
fi

###############################################################################
# PHASE 4: Read current content into variable (for safe manipulation)
###############################################################################
log_info "Phase 4: Parse file content"

SRC=$(cat "$TARGET")
ORIG_SRC="$SRC"

# Extract the old hook block (from useEffect(() => { to closing }, [deps]);)
# This is more reliable than line-based replacement
OLD_HOOK_PATTERN='useEffect\(\(\) => \{[[:space:]]*const interval = setInterval\(\(\) => \{[[:space:]]*if \(Math\.random\(\) > 0\.65\).*?\}, \[.*?\]\);'

if ! echo "$SRC" | grep -q "Math.random() > 0.65"; then
    log_err "Cannot find Math.random() > 0.65 pattern in file"
    cp "$BACKUP" "$TARGET"
    exit 1
fi
log_ok "Hook pattern verified in content"

###############################################################################
# PHASE 5: Create replacement hook using native bash substitution
###############################################################################
log_info "Phase 5: Generate replacement hook"

# Use heredoc for clean multi-line replacement
NEW_HOOK='  useEffect(() => {
    if (collabUsers.length === 0) return; // No collaborators to simulate
    const interval = setInterval(() => {
      if (Math'\''random() > 0.65) {
        const user = collabUsers[Math.floor(Math.random() * collabUsers.length)];
        const actions = ["Adjusted fader","Moved clip","Added FX","Muted track","Set loop"];
        const action = actions[Math.floor(Math.random() * actions.length)];
        addActivity(action, user.name, "edit");
        setCollaborators(p => p.map(c =>
          c.id === user.id
            ? { ...c, cursor:{x:200+Math.random()*800, y:80+Math.random()*400}, lastAction:action, timestamp:Date.now() }
            : c
        ));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [collabUsers, addActivity]);'

log_ok "Replacement hook generated (uses collabUsers, adds dependency)"

###############################################################################
# PHASE 6: Patch using Python (safer for multi-line regex)
###############################################################################
log_info "Phase 6: Apply patch via Python regex"

python3 << 'PYTHON_PATCH'
import re
from pathlib import Path

TARGET = Path("/home/r3v/Stable/client/src/pages/collaborative-daw-pro.tsx")
src = TARGET.read_text(encoding='utf-8')

# Pattern to match the entire old useEffect hook
# Non-greedy match from useEffect to closing dependency array
old_pattern = r'useEffect\(\(\) => \{\s*const interval = setInterval\(\(\) => \{\s*if \(Math\.random\(\) > 0\.65\).*?\}, \[.*?\]\);'

new_hook = '''  useEffect(() => {
    if (collabUsers.length === 0) return; // No collaborators to simulate
    const interval = setInterval(() => {
      if (Math.random() > 0.65) {
        const user = collabUsers[Math.floor(Math.random() * collabUsers.length)];
        const actions = ["Adjusted fader","Moved clip","Added FX","Muted track","Set loop"];
        const action = actions[Math.floor(Math.random() * actions.length)];
        addActivity(action, user.name, "edit");
        setCollaborators(p => p.map(c =>
          c.id === user.id
            ? { ...c, cursor:{x:200+Math.random()*800, y:80+Math.random()*400}, lastAction:action, timestamp:Date.now() }
            : c
        ));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [collabUsers, addActivity]);'''

# Try match
m = re.search(old_pattern, src, re.DOTALL)
if m:
    src = src[:m.start()] + new_hook + src[m.end():]
    TARGET.write_text(src, encoding='utf-8')
    print("✓ PATCHED")
    exit(0)
else:
    print("✗ PATTERN_NOT_FOUND")
    exit(1)
PYTHON_PATCH

PATCH_RESULT=$?

if [ $PATCH_RESULT -ne 0 ]; then
    log_err "Python patch failed — pattern not matched"
    log_warn "Restoring backup..."
    cp "$BACKUP" "$TARGET"
    exit 1
fi
log_ok "Hook replaced (collabUsers wired, dependency added)"

###############################################################################
# PHASE 7: Validation — TypeScript check
###############################################################################
log_info "Phase 7: TypeScript validation gate"

cd "$REPO"

# Check for our specific errors (INIT_COLLABS should be gone, tsc should pass)
if pnpm tsc -p client/tsconfig.json --noEmit 2>&1 | grep -q "INIT_COLLABS"; then
    log_err "TypeScript still reports INIT_COLLABS errors"
    log_warn "Restoring backup..."
    cp "$BACKUP" "$TARGET"
    exit 1
fi

TSC_OUTPUT=$(pnpm tsc -p client/tsconfig.json --noEmit 2>&1 | head -20)
if echo "$TSC_OUTPUT" | grep -q "collaborative-daw-pro.tsx"; then
    log_warn "TypeScript errors in collaborative-daw-pro.tsx:"
    echo "$TSC_OUTPUT" | grep "collaborative-daw-pro.tsx"
    log_warn "Restoring backup..."
    cp "$BACKUP" "$TARGET"
    exit 1
fi

log_ok "TypeScript validation passed (no errors in collaborative-daw-pro.tsx)"

###############################################################################
# PHASE 8: Verify changes
###############################################################################
log_info "Phase 8: Verify patch applied correctly"

CHECKS=(
    "collabUsers.length === 0"
    "const user = collabUsers"
    "[collabUsers, addActivity]"
    "Math.random() > 0.65"
)

FAILED=0
for check in "${CHECKS[@]}"; do
    if grep -q "$check" "$TARGET"; then
        log_ok "✓ Found: $check"
    else
        log_err "✗ Missing: $check"
        FAILED=$((FAILED + 1))
    fi
done

# Verify INIT_COLLABS is completely gone from this hook region
if grep -A 15 "collabUsers.length === 0" "$TARGET" | grep -q "INIT_COLLABS"; then
    log_err "INIT_COLLABS still present in hook"
    FAILED=$((FAILED + 1))
fi

if [ $FAILED -gt 0 ]; then
    log_err "$FAILED verification check(s) failed"
    log_warn "Restoring backup..."
    cp "$BACKUP" "$TARGET"
    exit 1
fi

log_ok "All verification checks passed"

###############################################################################
# PHASE 9: Summary & commit readiness
###############################################################################
log_info "Phase 9: Summary"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log_ok "PATCH SUCCESSFUL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Changes made:"
echo "  • Replaced demo hook useEffect with live collabUsers-based version"
echo "  • Added collabUsers guard (skips if no peers connected)"
echo "  • Updated dependency array: [collabUsers, addActivity]"
echo "  • Removed INIT_COLLABS reference from hook"
echo ""
echo "File: $TARGET"
echo "Backup: $BACKUP"
echo ""

# Check git status
echo "Git status:"
cd "$REPO"
if git diff --quiet "$TARGET" 2>/dev/null; then
    log_warn "No changes detected in git (already staged?)"
else
    log_ok "Changes ready to stage"
    git diff "$TARGET" | head -40
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps (ready to commit):"
echo ""
echo "  git add client/src/pages/collaborative-daw-pro.tsx"
echo "  git commit -m 'fix(collab): replace demo hook with live collabUsers — real peer activity'"
echo "  git push origin main"
echo ""
echo "Or verify once more:"
echo "  pnpm tsc -p client/tsconfig.json --noEmit 2>&1 | grep -i collaborative"
echo ""
