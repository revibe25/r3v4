#!/usr/bin/env python3
"""
QUADRUPLE-CHECK FIX:
1. Verify and create Express Request type augmentation (with proper placement)
2. Ensure tsconfig.json includes type definitions
3. Verify all studio components are imported in instrument.tsx
4. Remove duplicate imports and fix component references
"""
import os
import re
import sys

def fix_1_express_types():
    """Fix 1: Create Express Request type augmentation in CORRECT location"""
    print("\n" + "="*70)
    print("FIX 1: Express Request Type Augmentation")
    print("="*70)
    
    # Create types directory if it doesn't exist
    os.makedirs("server/types", exist_ok=True)
    
    express_d_ts = """// server/types/express.d.ts
// Type augmentation for Express Request with user property
declare namespace Express {
  interface Request {
    user?: {
      id: string;
      email: string;
      role?: string;
      sessionId?: string;
    };
  }
}

export {};
"""
    
    with open("server/types/express.d.ts", "w") as f:
        f.write(express_d_ts)
    print("✅ Created: server/types/express.d.ts")
    
    # Verify tsconfig includes types
    if not os.path.exists("server/tsconfig.json"):
        print("❌ server/tsconfig.json not found")
        return False
    
    with open("server/tsconfig.json") as f:
        tsconfig = f.read()
    
    # Check if typeRoots is configured
    if '"typeRoots"' not in tsconfig:
        # Add typeRoots to compilerOptions
        tsconfig = tsconfig.replace(
            '"compilerOptions": {',
            '"compilerOptions": {\n    "typeRoots": ["./types", "./node_modules/@types"],'
        )
        with open("server/tsconfig.json", "w") as f:
            f.write(tsconfig)
        print("✅ Updated server/tsconfig.json with typeRoots")
    else:
        print("✅ server/tsconfig.json already has typeRoots")
    
    return True

def fix_2_instrument_imports():
    """Fix 2: Import all studio components in instrument.tsx (remove duplicates)"""
    print("\n" + "="*70)
    print("FIX 2: Import Studio Components in instrument.tsx")
    print("="*70)
    
    if not os.path.exists("client/src/pages/instrument.tsx"):
        print("❌ instrument.tsx not found")
        return False
    
    with open("client/src/pages/instrument.tsx") as f:
        inst_content = f.read()
    
    # Define required components
    required_components = {
        "DrumWorkstation": "../components/studio/DrumWorkstation",
        "VisualizerCanvas": "../components/studio/VisualizerCanvas",
        "StudioHeader": "../components/studio/StudioHeader",
        "TransportBar": "../components/studio/TransportBar",
        "StudioFooter": "../components/studio/StudioFooter",
    }
    
    # Remove old/duplicate imports
    for comp in required_components.keys():
        # Remove any existing imports for this component (duplicates)
        inst_content = re.sub(
            rf"import.*{comp}.*from.*['\"].*['\"];?\n?",
            "",
            inst_content
        )
    
    # Find where to add imports (after existing imports)
    import_match = re.search(r"(import.*?from.*?['\"].*?['\"];)", inst_content)
    if import_match:
        last_import_end = import_match.end()
        
        # Build import lines
        import_lines = []
        for comp, path in required_components.items():
            import_lines.append(f'import {{ {comp} }} from "{path}";')
        
        new_imports = "\n".join(import_lines) + "\n"
        
        # Insert imports after last existing import
        inst_content = inst_content[:last_import_end] + "\n" + new_imports + inst_content[last_import_end:]
        
        with open("client/src/pages/instrument.tsx", "w") as f:
            f.write(inst_content)
        
        print(f"✅ Added {len(required_components)} studio component imports")
        for comp in required_components.keys():
            print(f"   • {comp}")
    else:
        print("⚠️  Could not find import section in instrument.tsx")
        return False
    
    return True

def fix_3_verify_auth_middleware():
    """Fix 3: Verify auth middleware properly initializes req.user"""
    print("\n" + "="*70)
    print("FIX 3: Verify Auth Middleware req.user Initialization")
    print("="*70)
    
    # Check multiple possible auth file locations
    auth_paths = [
        "server/middleware/auth.ts",
        "server/middleware/auth.middleware.ts",
        "server/lib/auth.ts",
    ]
    
    found_auth = None
    for path in auth_paths:
        if os.path.exists(path):
            found_auth = path
            break
    
    if not found_auth:
        print("❌ No auth middleware found. Checked:")
        for path in auth_paths:
            print(f"   • {path}")
        return False
    
    with open(found_auth) as f:
        auth_content = f.read()
    
    # Count req.user assignments
    user_assignments = len(re.findall(r"req\.user\s*=", auth_content))
    user_checks = len(re.findall(r"req\.user", auth_content))
    
    print(f"✅ Found auth at: {found_auth}")
    print(f"   • req.user assignments: {user_assignments}")
    print(f"   • req.user references: {user_checks}")
    
    if user_assignments == 0:
        print("⚠️  No req.user assignments found — auth may not be setting user")
    
    return True

def fix_4_check_duplicates():
    """Fix 4: Scan client/src for duplicate component definitions"""
    print("\n" + "="*70)
    print("FIX 4: Scan for Duplicate Component Definitions")
    print("="*70)
    
    if not os.path.exists("client/src"):
        print("❌ client/src not found")
        return False
    
    component_counts = {}
    
    # Search for component definitions
    for root, dirs, files in os.walk("client/src"):
        for file in files:
            if file.endswith(".tsx"):
                path = os.path.join(root, file)
                with open(path) as f:
                    content = f.read()
                
                # Find export statements
                exports = re.findall(r"export\s+(?:default\s+)?(?:function|const|class)\s+(\w+)", content)
                for exp in exports:
                    component_counts[exp] = component_counts.get(exp, 0) + 1
    
    duplicates = {k: v for k, v in component_counts.items() if v > 1}
    
    if duplicates:
        print("⚠️  Found duplicate component definitions:")
        for comp, count in duplicates.items():
            print(f"   • {comp}: {count} definitions")
    else:
        print("✅ No duplicate component definitions found")
    
    return True

def main():
    print("\n")
    print("╔" + "="*78 + "╗")
    print("║" + " QUADRUPLE-CHECK COMPREHENSIVE FIX ".center(78) + "║")
    print("╚" + "="*78 + "╝")
    
    results = {
        "Express Types": fix_1_express_types(),
        "Component Imports": fix_2_instrument_imports(),
        "Auth Middleware": fix_3_verify_auth_middleware(),
        "Duplicate Check": fix_4_check_duplicates(),
    }
    
    print("\n" + "="*70)
    print("SUMMARY")
    print("="*70)
    for check, result in results.items():
        status = "✅" if result else "⚠️ "
        print(f"{status} {check}")
    
    print("\n" + "="*70)
    print("NEXT STEPS:")
    print("="*70)
    print("1. Run: pnpm tsc --noEmit")
    print("2. If errors persist, check that server/types/express.d.ts is in typeRoots")
    print("3. Verify instrument.tsx imports are NOT at top-level module scope")
    print("="*70 + "\n")

if __name__ == "__main__":
    os.chdir(os.path.expanduser("~/Stable"))
    main()
