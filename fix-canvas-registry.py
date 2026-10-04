#!/usr/bin/env python3
"""
Fix useV130CanvasRegistry.ts to watch for newly added canvas elements.
Adds MutationObserver to re-scan DOM when canvases are added/removed.

This fixes the issue where Master Analyzer canvases render AFTER the 
initial registry scan, so they never get registered.
"""

import sys
import os
from pathlib import Path
from datetime import datetime

# File path
REPO_ROOT = Path(__file__).parent
FILE_PATH = REPO_ROOT / "client/src/features/multitrack-v130/renderers/useV130CanvasRegistry.ts"

def backup_file():
    """Create a backup before modifying."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = FILE_PATH.with_stem(f"{FILE_PATH.stem}.backup-{timestamp}")
    with open(FILE_PATH, 'r') as src:
        with open(backup_path, 'w') as dst:
            dst.write(src.read())
    print(f"✅ Backup created: {backup_path}")
    return backup_path

def apply_fix():
    """Apply the MutationObserver fix."""
    
    # Read the file
    with open(FILE_PATH, 'r') as f:
        content = f.read()
    
    # The old code to find and replace
    old_code = """    const observer =
      new ResizeObserver(sync);

    observer.observe(root);

    return () => {
      observer.disconnect();
      registry.removeDetached();
    };"""

    # The new code with MutationObserver
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

    # Check if the old code exists
    if old_code not in content:
        print("❌ ERROR: Could not find the expected code pattern.")
        print("\nExpected to find:")
        print(old_code)
        print("\nPlease check the file manually.")
        return False

    # Replace
    new_content = content.replace(old_code, new_code)
    
    # Write back
    with open(FILE_PATH, 'w') as f:
        f.write(new_content)
    
    print("✅ File updated successfully!")
    print("\nChanges:")
    print("  1. Renamed 'observer' → 'resizeObserver' for clarity")
    print("  2. Added new 'mutationObserver' to watch for DOM changes")
    print("  3. Updated cleanup to disconnect both observers")
    
    return True

def verify_fix():
    """Verify the fix was applied correctly."""
    with open(FILE_PATH, 'r') as f:
        content = f.read()
    
    # Check for key markers
    checks = [
        ("resizeObserver" in content, "✅ resizeObserver renamed"),
        ("mutationObserver" in content, "✅ mutationObserver added"),
        ("childList: true" in content, "✅ childList: true configured"),
        ("subtree: true" in content, "✅ subtree: true configured"),
        ("mutationObserver.disconnect()" in content, "✅ mutationObserver cleanup added"),
    ]
    
    all_pass = True
    for passed, message in checks:
        print(message if passed else message.replace("✅", "❌"))
        if not passed:
            all_pass = False
    
    return all_pass

def main():
    """Main execution."""
    print("=" * 70)
    print("Fix useV130CanvasRegistry.ts — Add MutationObserver for DOM changes")
    print("=" * 70)
    
    if not FILE_PATH.exists():
        print(f"❌ ERROR: File not found at {FILE_PATH}")
        sys.exit(1)
    
    print(f"\nFile: {FILE_PATH}")
    
    # Create backup
    print("\n📦 Creating backup...")
    backup_file()
    
    # Apply fix
    print("\n🔧 Applying fix...")
    if not apply_fix():
        print("\n⚠️  Restoring from backup...")
        sys.exit(1)
    
    # Verify
    print("\n🔍 Verifying fix...")
    if verify_fix():
        print("\n✅ All checks passed!")
    else:
        print("\n⚠️  Some checks failed. Please review the file.")
        sys.exit(1)
    
    print("\n" + "=" * 70)
    print("🚀 Fix applied successfully!")
    print("\nNext steps:")
    print("  1. npm run typecheck          # Verify TypeScript")
    print("  2. npm run dev                # Start dev server")
    print("  3. Navigate to /multitrack    # Load the page")
    print("  4. Check browser console      # Verify no errors")
    print("  5. Master Analyzer graphs     # Should now display!")
    print("=" * 70)

if __name__ == "__main__":
    main()
