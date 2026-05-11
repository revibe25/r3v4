#!/usr/bin/env python3
"""
Fix eslint.config.mjs by removing react-hooks plugin (never installed).
Wire.txt protocol: read → backup → verify → patch → verify.
"""

import sys
import shutil
from pathlib import Path
from datetime import datetime

CONFIG_FILE = Path.home() / "Stable" / "eslint.config.mjs"
BACKUP_FILE = CONFIG_FILE.with_suffix(f".mjs.bak_{datetime.now().strftime('%Y%m%d_%H%M%S')}")

def read_file():
    """Read current config."""
    try:
        return CONFIG_FILE.read_text()
    except FileNotFoundError:
        print(f"ERROR: {CONFIG_FILE} not found")
        sys.exit(1)

def backup_file(content):
    """Backup original."""
    BACKUP_FILE.write_text(content)
    print(f"✅ Backup: {BACKUP_FILE}")

def fix_config(content):
    """Remove react-hooks lines."""
    lines = content.split("\n")
    fixed = []
    skip_next_blank = False
    
    for i, line in enumerate(lines):
        # Skip the import line
        if 'import reactHooksPlugin from "eslint-plugin-react-hooks"' in line:
            print(f"  Removing: {line.strip()}")
            continue
        
        # Skip the plugin registration
        if '"react-hooks": reactHooksPlugin' in line:
            print(f"  Removing: {line.strip()}")
            skip_next_blank = True
            continue
        
        # Skip react-hooks rules section comment
        if '// ── React Hooks rules' in line:
            print(f"  Removing: {line.strip()}")
            # Skip next 2 lines (comment + blank)
            for j in range(i+1, min(i+4, len(lines))):
                if lines[j].strip() in ['', '"react-hooks/rules-of-hooks": "error",', '"react-hooks/exhaustive-deps": "warn",']:
                    print(f"  Removing: {lines[j].strip()}")
                else:
                    break
            # After skipping, continue from where we stopped
            skip_next_blank = False
            continue
        
        # Skip the actual rules if not already skipped
        if 'react-hooks/rules-of-hooks' in line or 'react-hooks/exhaustive-deps' in line:
            print(f"  Removing: {line.strip()}")
            skip_next_blank = True
            continue
        
        # Skip blank line after rules if marked
        if skip_next_blank and line.strip() == '':
            skip_next_blank = False
            continue
        
        fixed.append(line)
    
    return "\n".join(fixed)

def main():
    print("🔧 Fixing eslint.config.mjs...\n")
    
    # 1. READ
    content = read_file()
    print(f"✅ Read {len(content)} chars from {CONFIG_FILE}\n")
    
    # 2. BACKUP
    backup_file(content)
    
    # 3. VERIFY OLD CONTENT
    has_import = 'import reactHooksPlugin' in content
    has_plugin = '"react-hooks": reactHooksPlugin' in content
    has_rules = 'react-hooks/rules-of-hooks' in content
    
    print(f"Current state:")
    print(f"  - Has react-hooks import: {has_import}")
    print(f"  - Has react-hooks plugin: {has_plugin}")
    print(f"  - Has react-hooks rules: {has_rules}\n")
    
    if not (has_import or has_plugin or has_rules):
        print("⚠️  No react-hooks found—already clean. Nothing to do.\n")
        sys.exit(0)
    
    # 4. PATCH
    fixed = fix_config(content)
    
    # 5. VERIFY NEW CONTENT
    print(f"\n✅ Changes:")
    has_import_after = 'import reactHooksPlugin' in fixed
    has_plugin_after = '"react-hooks": reactHooksPlugin' in fixed
    has_rules_after = 'react-hooks/rules-of-hooks' in fixed
    
    print(f"  - Has react-hooks import: {has_import_after} (was {has_import})")
    print(f"  - Has react-hooks plugin: {has_plugin_after} (was {has_plugin})")
    print(f"  - Has react-hooks rules: {has_rules_after} (was {has_rules})")
    
    if has_import_after or has_plugin_after or has_rules_after:
        print("\n❌ FAILED: react-hooks still present after patch")
        sys.exit(1)
    
    # 6. WRITE
    CONFIG_FILE.write_text(fixed)
    print(f"\n✅ Wrote fixed config to {CONFIG_FILE}\n")
    
    # 7. SANITY CHECK: file is valid JavaScript
    if "export default" not in fixed:
        print("❌ FAILED: 'export default' not found—config is broken")
        sys.exit(1)
    
    print("✅ All checks passed. eslint.config.mjs is ready.\n")

if __name__ == "__main__":
    main()
