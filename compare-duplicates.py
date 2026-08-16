#!/usr/bin/env python3
"""
DEEP DUPLICATE COMPARISON

Shows side-by-side diffs of duplicate components to decide which to keep.
Identifies differences in:
- Imports
- Exports
- Implementations
- Hook usage
"""
import os
import re
import difflib
from collections import defaultdict
from pathlib import Path

def extract_component_info(content):
    """Extract structured info from component"""
    info = {
        'imports': [],
        'exports': [],
        'hooks': [],
        'lines': len(content.split('\n')),
        'size': len(content),
    }
    
    # Extract imports
    imports = re.findall(r"^import\s+(?:{[^}]+}|\w+)\s+from\s+['\"]([^'\"]+)['\"]", 
                        content, re.MULTILINE)
    info['imports'] = sorted(set(imports))
    
    # Extract exports
    exports = re.findall(r"export\s+(?:default\s+)?(?:(?:function|const|class)\s+)?(\w+)", content)
    info['exports'] = sorted(set(exports))
    
    # Extract hook usage
    hooks = re.findall(r"(use\w+)\s*\(", content)
    info['hooks'] = sorted(set(hooks))
    
    return info

def find_duplicates():
    """Find all duplicate components"""
    components_by_name = defaultdict(list)
    
    for root, dirs, files in os.walk("client/src"):
        for file in files:
            if file.endswith(".tsx"):
                path = os.path.join(root, file)
                with open(path, 'r') as f:
                    content = f.read()
                
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
                                'content': content,
                                'info': extract_component_info(content),
                            })
    
    duplicates = {k: v for k, v in components_by_name.items() if len(v) > 1}
    return duplicates

def show_diff(content1, content2, title):
    """Show unified diff between two files"""
    lines1 = content1.split('\n')
    lines2 = content2.split('\n')
    
    diff = difflib.unified_diff(lines1, lines2, lineterm='', n=2)
    diff_lines = list(diff)
    
    if not diff_lines or all(line.startswith('---') or line.startswith('+++') 
                             or line.startswith('@@') for line in diff_lines):
        print(f"   ✅ Files are IDENTICAL (or very similar)")
        return True
    
    print(f"   🔄 DIFFERENCES FOUND:")
    for i, line in enumerate(diff_lines[:20]):  # Show first 20 diff lines
        if line.startswith('+'):
            print(f"      \033[92m{line}\033[0m")  # Green
        elif line.startswith('-'):
            print(f"      \033[91m{line}\033[0m")  # Red
        else:
            print(f"      {line}")
    
    if len(diff_lines) > 20:
        print(f"      ... ({len(diff_lines) - 20} more lines)")
    
    return False

def analyze_duplicate(name, locations):
    """Analyze a single duplicate component"""
    print(f"\n{'='*80}")
    print(f"COMPONENT: {name}")
    print(f"{'='*80}")
    print(f"Found {len(locations)} definitions\n")
    
    # Show each version's info
    for i, loc in enumerate(locations, 1):
        info = loc['info']
        print(f"[{i}] {loc['path']}")
        print(f"    Lines: {info['lines']}, Size: {info['size']} bytes")
        print(f"    Imports: {len(info['imports'])} unique")
        print(f"    Exports: {', '.join(info['exports']) if info['exports'] else 'none'}")
        print(f"    Hooks: {', '.join(info['hooks']) if info['hooks'] else 'none'}")
        print()
    
    # Compare imports
    print("📦 IMPORT COMPARISON:")
    all_imports = set()
    for loc in locations:
        all_imports.update(loc['info']['imports'])
    
    for imp in sorted(all_imports):
        print(f"   {imp}")
        for i, loc in enumerate(locations, 1):
            has_it = "✅" if imp in loc['info']['imports'] else "❌"
            print(f"      [{i}] {has_it}")
    
    # Compare hook usage
    if any(loc['info']['hooks'] for loc in locations):
        print("\n🎣 HOOK COMPARISON:")
        all_hooks = set()
        for loc in locations:
            all_hooks.update(loc['info']['hooks'])
        
        for hook in sorted(all_hooks):
            print(f"   {hook}")
            for i, loc in enumerate(locations, 1):
                has_it = "✅" if hook in loc['info']['hooks'] else "❌"
                print(f"      [{i}] {has_it}")
    
    # Compare content
    print("\n📄 CONTENT COMPARISON:")
    if len(locations) == 2:
        identical = show_diff(locations[0]['content'], locations[1]['content'], name)
        if identical:
            print("   RECOMMENDATION: Delete either one (they're identical)")
        else:
            # Compare sizes to recommend which to keep
            if locations[0]['info']['size'] > locations[1]['info']['size']:
                print(f"   RECOMMENDATION: Keep [1] (larger/more complete), delete [2]")
            else:
                print(f"   RECOMMENDATION: Keep [2] (larger/more complete), delete [1]")
    else:
        print(f"   ⚠️  {len(locations)} versions found, recommend manual review")
        best_idx = max(range(len(locations)), 
                      key=lambda i: locations[i]['info']['imports'])
        print(f"   RECOMMENDATION: Keep [{best_idx+1}] (most imports), delete others")

def main():
    print("\n")
    print("╔" + "="*78 + "╗")
    print("║" + " DEEP DUPLICATE COMPONENT COMPARISON ".center(78) + "║")
    print("╚" + "="*78 + "╝")
    
    os.chdir(os.path.expanduser("~/Stable"))
    
    duplicates = find_duplicates()
    
    if not duplicates:
        print("\n✅ No duplicate components found!")
        return
    
    print(f"\nFound {len(duplicates)} components with duplicates:\n")
    for name in sorted(duplicates.keys()):
        print(f"  • {name}: {len(duplicates[name])} definitions")
    
    # Analyze each duplicate
    for name in sorted(duplicates.keys()):
        analyze_duplicate(name, duplicates[name])
    
    # Summary and recommendations
    print(f"\n{'='*80}")
    print("CONSOLIDATION RECOMMENDATIONS")
    print(f"{'='*80}\n")
    
    removals = []
    for name, locations in sorted(duplicates.items()):
        # Find the best one (most imports, larger size)
        best = max(locations, key=lambda x: (len(x['info']['imports']), x['info']['size']))
        best_idx = locations.index(best)
        
        print(f"{name}:")
        for i, loc in enumerate(locations, 1):
            status = "KEEP ✅" if i == best_idx + 1 else "REMOVE ❌"
            print(f"  [{i}] {status} {loc['path']}")
            removals.append((status, loc['path'], name))
        print()
    
    # Generate script
    print(f"{'='*80}")
    print("GENERATED CONSOLIDATION SCRIPT")
    print(f"{'='*80}\n")
    
    script_lines = [
        "#!/bin/bash",
        "# Auto-generated: Remove duplicate components",
        "# Run AFTER reviewing the comparison output above",
        ""
    ]
    
    for status, path, name in removals:
        if "REMOVE" in status:
            script_lines.append(f"# Removing: {name}")
            script_lines.append(f"rm {path}")
    
    script_content = "\n".join(script_lines)
    
    with open("remove-duplicates.sh", "w") as f:
        f.write(script_content)
    
    os.chmod("remove-duplicates.sh", 0o755)
    
    print("✅ Generated: remove-duplicates.sh")
    print("\nTo apply:")
    print("  1. Review recommendations above")
    print("  2. Run: bash ./remove-duplicates.sh")
    print("  3. Run: pnpm tsc --noEmit")

if __name__ == "__main__":
    main()
