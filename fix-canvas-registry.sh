#!/bin/bash

###############################################################################
# Fix useV130CanvasRegistry.ts — Add MutationObserver for DOM changes
# This script adds a MutationObserver to watch for newly added canvas elements
###############################################################################

set -e

FILE="client/src/features/multitrack-v130/renderers/useV130CanvasRegistry.ts"

if [ ! -f "$FILE" ]; then
    echo "❌ ERROR: File not found: $FILE"
    echo "Make sure you're in the r3v4 project root directory"
    exit 1
fi

echo "📦 Creating backup..."
BACKUP="${FILE}.backup-$(date +%Y%m%d-%H%M%S)"
cp "$FILE" "$BACKUP"
echo "✅ Backup created: $BACKUP"

echo ""
echo "🔧 Applying MutationObserver fix..."
echo ""

# Use sed with -i flag to edit in-place
# Replace the old code with new code that includes MutationObserver
cat > /tmp/canvas_registry_patch.txt << 'EOF'
    const resizeObserver =
      new ResizeObserver(sync);

    resizeObserver.observe(root);

    // Watch for new canvases being added to DOM (e.g., Master Analyzer)
    const mutationObserver =
      new MutationObserver(sync);

    mutationObserver.observe(root, {
      childList: true,  // Watch for added/removed elements
      subtree: true,    // Watch all descendants
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      registry.removeDetached();
    };
EOF

# Find and replace the observer setup
python3 << 'PYTHON_SCRIPT'
import sys

FILE = "client/src/features/multitrack-v130/renderers/useV130CanvasRegistry.ts"

with open(FILE, 'r') as f:
    content = f.read()

old_code = """    const observer =
      new ResizeObserver(sync);

    observer.observe(root);

    return () => {
      observer.disconnect();
      registry.removeDetached();
    };"""

new_code = """    const resizeObserver =
      new ResizeObserver(sync);

    resizeObserver.observe(root);

    // Watch for new canvases being added to DOM (e.g., Master Analyzer)
    const mutationObserver =
      new MutationObserver(sync);

    mutationObserver.observe(root, {
      childList: true,  // Watch for added/removed elements
      subtree: true,    // Watch all descendants
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      registry.removeDetached();
    };"""

if old_code not in content:
    print("❌ ERROR: Could not find the code to replace!")
    print("\nExpected to find this pattern:")
    print(old_code)
    print("\nFile content around line 60-75:")
    lines = content.split('\n')
    for i, line in enumerate(lines[55:75], start=56):
        print(f"{i}: {line}")
    sys.exit(1)

new_content = content.replace(old_code, new_code)

with open(FILE, 'w') as f:
    f.write(new_content)

print("✅ Code replaced successfully!")
PYTHON_SCRIPT

if [ $? -ne 0 ]; then
    echo "❌ Patch failed! Restoring from backup..."
    cp "$BACKUP" "$FILE"
    exit 1
fi

echo ""
echo "🔍 Verifying fix..."
echo ""

# Verify the changes
grep -q "resizeObserver" "$FILE" && echo "✅ resizeObserver renamed" || echo "❌ resizeObserver not found"
grep -q "mutationObserver" "$FILE" && echo "✅ mutationObserver added" || echo "❌ mutationObserver not found"
grep -q "childList: true" "$FILE" && echo "✅ childList: true configured" || echo "❌ childList not found"
grep -q "subtree: true" "$FILE" && echo "✅ subtree: true configured" || echo "❌ subtree not found"
grep -q "mutationObserver.disconnect()" "$FILE" && echo "✅ mutationObserver cleanup added" || echo "❌ cleanup not found"

echo ""
echo "================================================================================"
echo "✅ Fix applied successfully!"
echo "================================================================================"
echo ""
echo "Next steps:"
echo "  1. npm run typecheck          # Verify TypeScript"
echo "  2. npm run dev                # Start dev server"
echo "  3. Navigate to /multitrack    # Load the page"
echo "  4. Check browser console      # Verify no errors"
echo "  5. Master Analyzer graphs     # Should now display!"
echo ""
echo "If something goes wrong, restore from backup:"
echo "  cp $BACKUP $FILE"
echo ""
