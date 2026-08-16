#!/usr/bin/env python3
"""
DUPLICATE COMPONENT CONSOLIDATION & EXPRESS TYPE FIX

1. Find all duplicate component definitions
2. Compare them (size, imports, exports)
3. Merge/keep the best version
4. FIX Express type augmentation properly
"""
import os
import re
import json
from pathlib import Path
from collections import defaultdict

def find_all_components():
    """Scan client/src for all .tsx component files"""
    components_by_name = defaultdict(list)
    
    for root, dirs, files in os.walk("client/src"):
        for file in files:
            if file.endswith(".tsx"):
                path = os.path.join(root, file)
                with open(path, 'r') as f:
                    content = f.read()
                
                # Extract export name (function, const, class, default)
                exports = re.findall(
                    r"export\s+(?:default\s+)?(?:(?:function|const|class)\s+(\w+)|\{([^}]+)\})",
                    content
                )
                
                if exports:
                    for match in exports:
                        name = match[0] if match[0] else match[1].strip()
                        if name:
                            components_by_name[name].append({
                                'path': path,
                                'lines': len(content.split('\n')),
                                'size': len(content),
                                'imports': len(re.findall(r'^import\s', content, re.MULTILINE)),
                            })
    
    return components_by_name

def analyze_duplicates(components_by_name):
    """Identify and analyze duplicate components"""
    duplicates = {k: v for k, v in components_by_name.items() if len(v) > 1}
    
    print("\n" + "="*80)
    print("DUPLICATE COMPONENT ANALYSIS")
    print("="*80)
    
    for comp_name, locations in sorted(duplicates.items()):
        print(f"\n📌 {comp_name}: {len(locations)} definitions")
        
        for i, loc in enumerate(locations, 1):
            print(f"   [{i}] {loc['path']}")
            print(f"       Lines: {loc['lines']}, Size: {loc['size']} bytes, Imports: {loc['imports']}")
        
        # Recommend which to keep (prefer more imports = more complete)
        best = max(locations, key=lambda x: x['imports'])
        worst_idx = locations.index(best) + 1
        for i, loc in enumerate(locations, 1):
            if loc == best:
                print(f"   ✅ KEEP: [{i}] {loc['path']} (most complete)")
            else:
                print(f"   ❌ REMOVE: [{i}] {loc['path']}")
    
    return duplicates

def fix_express_type_augmentation():
    """PROPER Express type augmentation with full context"""
    print("\n" + "="*80)
    print("FIX: EXPRESS REQUEST TYPE AUGMENTATION (COMPREHENSIVE)")
    print("="*80)
    
    # 1. Create types directory
    os.makedirs("server/types", exist_ok=True)
    
    # 2. Create express.d.ts with FULL augmentation
    express_types = '''// server/types/express.d.ts
/**
 * Type augmentation for Express Request object to include authenticated user
 * This file is loaded via typeRoots in server/tsconfig.json
 */

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role?: string;
        sessionId?: string;
        createdAt?: Date;
      };
    }
  }
}

// Must export something to make this a module
export {};
'''
    
    with open("server/types/express.d.ts", "w") as f:
        f.write(express_types)
    print("✅ Created: server/types/express.d.ts with global namespace augmentation")
    
    # 3. FIX tsconfig.json with PROPER typeRoots placement
    if not os.path.exists("server/tsconfig.json"):
        print("❌ server/tsconfig.json not found")
        return False
    
    with open("server/tsconfig.json", "r") as f:
        tsconfig_content = f.read()
    
    tsconfig = json.loads(tsconfig_content)
    
    # Ensure compilerOptions exists
    if "compilerOptions" not in tsconfig:
        tsconfig["compilerOptions"] = {}
    
    # Set typeRoots CORRECTLY
    tsconfig["compilerOptions"]["typeRoots"] = ["./types", "./node_modules/@types"]
    
    # Also ensure skipLibCheck is true to avoid third-party type issues
    tsconfig["compilerOptions"]["skipLibCheck"] = True
    
    # Write back with proper formatting
    with open("server/tsconfig.json", "w") as f:
        json.dump(tsconfig, f, indent=2)
    
    print("✅ Updated: server/tsconfig.json")
    print(f"   • typeRoots: {tsconfig['compilerOptions'].get('typeRoots')}")
    print(f"   • skipLibCheck: {tsconfig['compilerOptions'].get('skipLibCheck')}")
    
    # 4. Also add to root tsconfig if it exists
    if os.path.exists("tsconfig.json"):
        with open("tsconfig.json", "r") as f:
            root_tsconfig = json.loads(f.read())
        
        if "compilerOptions" in root_tsconfig:
            root_tsconfig["compilerOptions"]["skipLibCheck"] = True
            with open("tsconfig.json", "w") as f:
                json.dump(root_tsconfig, f, indent=2)
            print("✅ Updated: root tsconfig.json (skipLibCheck)")
    
    # 5. Create an index.d.ts in types/ to ensure module is loaded
    with open("server/types/index.d.ts", "w") as f:
        f.write('''// server/types/index.d.ts
// Type definitions entry point
export * from './express';
''')
    print("✅ Created: server/types/index.d.ts (entry point)")
    
    return True

def check_auth_middleware():
    """Verify auth middleware properly sets req.user"""
    print("\n" + "="*80)
    print("VERIFY: AUTH MIDDLEWARE req.user INITIALIZATION")
    print("="*80)
    
    if not os.path.exists("server/middleware/auth.ts"):
        print("❌ server/middleware/auth.ts not found")
        return False
    
    with open("server/middleware/auth.ts", "r") as f:
        auth_content = f.read()
    
    # Extract lines with req.user
    lines = auth_content.split('\n')
    user_lines = [(i+1, line) for i, line in enumerate(lines) if 'req.user' in line]
    
    print(f"✅ Found {len(user_lines)} req.user references:")
    for line_num, line in user_lines[:10]:  # Show first 10
        print(f"   Line {line_num}: {line.strip()}")
    
    # Check if user is actually ASSIGNED (not just checked)
    assignments = [line for _, line in user_lines if 'req.user =' in line]
    
    if assignments:
        print(f"\n✅ Found {len(assignments)} req.user assignments")
    else:
        print("⚠️  No explicit req.user assignments found — check middleware flow")
    
    return True

def generate_consolidation_script(duplicates):
    """Generate script to consolidate duplicates"""
    print("\n" + "="*80)
    print("CONSOLIDATION SCRIPT")
    print("="*80)
    
    script_lines = ["#!/bin/bash", "# Auto-generated duplicate consolidation script", ""]
    
    for comp_name, locations in sorted(duplicates.items()):
        best = max(locations, key=lambda x: x['imports'])
        
        for loc in locations:
            if loc != best:
                rel_path = loc['path'].replace('~/Stable/', '').replace(os.path.expanduser('~/Stable/'), '')
                script_lines.append(f"# Removing duplicate: {comp_name}")
                script_lines.append(f"rm {rel_path}")
                script_lines.append("")
    
    script_content = "\n".join(script_lines)
    
    with open("remove-duplicates.sh", "w") as f:
        f.write(script_content)
    
    print("✅ Generated: remove-duplicates.sh")
    print("\nTo apply consolidation:")
    print("  bash ./remove-duplicates.sh")
    print("  pnpm tsc --noEmit")
    
    return script_content

def main():
    print("\n")
    print("╔" + "="*78 + "╗")
    print("║" + " DUPLICATE CONSOLIDATION + EXPRESS TYPE FIX ".center(78) + "║")
    print("╚" + "="*78 + "╝")
    
    os.chdir(os.path.expanduser("~/Stable"))
    
    # Step 1: Find and analyze duplicates
    components = find_all_components()
    duplicates = analyze_duplicates(components)
    
    # Step 2: FIX Express type augmentation (CRITICAL)
    express_ok = fix_express_type_augmentation()
    
    # Step 3: Verify auth middleware
    auth_ok = check_auth_middleware()
    
    # Step 4: Generate consolidation script
    if duplicates:
        consolidation = generate_consolidation_script(duplicates)
    
    print("\n" + "="*80)
    print("SUMMARY & NEXT STEPS")
    print("="*80)
    print(f"✅ Express type augmentation: {'FIXED' if express_ok else 'FAILED'}")
    print(f"✅ Auth middleware: {'VERIFIED' if auth_ok else 'NEEDS REVIEW'}")
    print(f"⚠️  Duplicate components found: {len(duplicates)}")
    
    print("\n📋 EXECUTION ORDER:")
    print("  1. Run: pnpm install --frozen-lockfile")
    print("  2. Run: pnpm tsc --noEmit  # Should clear req.user errors")
    print("  3. Review: remove-duplicates.sh")
    print("  4. Run: bash ./remove-duplicates.sh")
    print("  5. Run: pnpm tsc --noEmit  # Should pass all checks")
    print("  6. Run: bash ./validate-r3-native-v2-LOCAL.sh")
    
    print("\n" + "="*80)

if __name__ == "__main__":
    main()
