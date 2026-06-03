#!/usr/bin/env python3
"""
asi-audit-register.py
Expert-level script for Mythos ARIS compliance:
- Extracts surfaces from MYTHOS-SKILL-v2.md
- Ensures every surface is registered at the top of SECURITY.md (Reviewed surface: ...)
- Verifies every surface also occurs (case-insensitive) in a Finding section
- Reports missing, duplicate, or non-registered surfaces with detailed output
- Optionally can auto-insert a Finding template for missing surfaces (--add-templates)
"""

import re
import sys
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).absolute().parent
MYTHOS_SKILL = PROJECT_ROOT / 'MYTHOS-SKILL-v2.md'
SECURITY_MD = PROJECT_ROOT / 'SECURITY.md'
REGISTER_PREFIX = "Reviewed surface: "
FINDING_HEADER_PREFIX = "### Finding: "

def error(msg):
    print(f"\033[1;31mERROR:\033[0m {msg}")

def warn(msg):
    print(f"\033[1;33mWARNING:\033[0m {msg}")

def info(msg):
    print(f"\033[1;32mINFO:\033[0m {msg}")

def get_all_surfaces(skill_path):
    """
    Parses MYTHOS-SKILL-v2.md surface table and returns a set of all audit surfaces.
    """
    if not skill_path.exists():
        error(f"{skill_path} not found.")
        sys.exit(1)
    # Matches | `server/thing.ts` | in markdown tables
    surfaces = set()
    for line in skill_path.open(encoding='utf-8'):
        for m in re.findall(r'\|\s*`([^`]+)`\s*\|', line):
            surfaces.add(m.strip())
    return surfaces

def parse_security_md(security_path):
    """
    Parses SECURITY.md for:
      - Registered surfaces at the top block
      - Existing Finding headers
      - Existing Surface fields in Finding sections
    Returns (header_lines:list, surface_register:list, finding_surfaces:set, finding_blocks:dict)
    """
    if not security_path.exists():
        error(f"{security_path} not found.")
        sys.exit(1)
    # Read all lines
    with security_path.open(encoding='utf-8') as f:
        all_lines = [line.rstrip('\n\r') for line in f]

    # Find register block: block of contiguous 'Reviewed surface:' lines at the very top
    surface_register = []
    header_lines = []
    found = False
    for i, line in enumerate(all_lines):
        if line.startswith(REGISTER_PREFIX):
            surface_register.append(line[len(REGISTER_PREFIX):].strip())
            found = True
        elif not found and (line.strip() == "" or line.startswith("<!--")):
            # Still within header comment, skip
            pass
        elif found and not line.startswith(REGISTER_PREFIX):
            # End of the contiguous block
            header_lines = all_lines[:i]
            break
    if not header_lines:
        # No reviewed block found, or it's at EOF
        header_lines = all_lines[:len(surface_register)]
    if not surface_register:
        warn("No Reviewed surface register found at file top! Will be inserted.")

    # Find all finding headers (case-insensitive, robust to invisible Unicode, audits for duplications)
    finding_surfaces = set()
    finding_blocks = {}

    for idx, line in enumerate(all_lines):
        m = re.match(r"^\s*###\s*Finding:\s*(.+)$", line, re.IGNORECASE)
        if m:
            surface = m.group(1).strip()
            finding_surfaces.add(surface)
            # For triple checking, keep full block (not just surface)
            block_lines = [line]
            j = idx + 1
            while j < len(all_lines) and (all_lines[j].strip() != "" and not all_lines[j].startswith("### Finding:")):
                block_lines.append(all_lines[j])
                j += 1
            finding_blocks[surface] = block_lines

    return header_lines, surface_register, finding_surfaces, finding_blocks, all_lines

def triple_check_and_update(skill_surfaces, header_lines, surface_register, finding_surfaces, all_lines, add_templates=False):
    """
    - Ensures all skill_surfaces are in the surface_register (adds if missing)
    - Ensures all skill_surfaces have a Finding block (warns/reports if missing)
    - Reports extra, duplicate, or mismatched surfaces
    - Optionally adds missing Finding templates
    - Returns the updated content of SECURITY.md as a list of lines
    """
    updated = False
    # Normalize for literal matching
    skill_surfaces_set = set(skill_surfaces)
    reg_set = set(surface_register)
    find_set = set(finding_surfaces)

    missing_in_register = skill_surfaces_set - reg_set
    extra_in_register = reg_set - skill_surfaces_set
    missing_findings = skill_surfaces_set - find_set
    duplicate_registers = [item for item in surface_register if surface_register.count(item) > 1]
    duplicate_findings = [item for item in finding_surfaces if list(finding_surfaces).count(item) > 1]

    if missing_in_register:
        for s in sorted(missing_in_register):
            warn(f"Surface '{s}' present in skill policy but not registered at file top. Will add.")
            updated = True

    if extra_in_register:
        for s in sorted(extra_in_register):
            warn(f"Surface '{s}' registered at file top but NOT present in skill policy.")

    if duplicate_registers:
        for s in set(duplicate_registers):
            warn(f"Surface '{s}' is registered MULTIPLE TIMES at file top.")

    if missing_findings:
        for s in sorted(missing_findings):
            error(f"Surface '{s}' does not have a Finding section. You MUST review/audit or defer this surface!")
            if add_templates:
                info(f"Auto-adding Finding template for '{s}' ...")
                updated = True

    if duplicate_findings:
        for s in set(duplicate_findings):
            warn(f"Surface '{s}' has MULTIPLE findings in this doc (may signal copy/paste error).")

    # Rebuild updated register
    new_lines = []
    new_lines.extend(header_lines)
    # Always write clear comment for CI/automation
    new_lines.append("<!--")
    new_lines.append("  AUDIT SURFACE REGISTER (automation anchor)")
    new_lines.append("  These lines are required for CI audit tooling.")
    new_lines.append("-->")
    for s in sorted(skill_surfaces):
        new_lines.append(f"{REGISTER_PREFIX}{s}")
    while all_lines and all_lines[0].startswith(REGISTER_PREFIX):
        all_lines.pop(0)
    # Find where non-header content starts
    start_idx = len(header_lines)
    while start_idx < len(all_lines) and any(all_lines[start_idx].startswith(REGISTER_PREFIX) or all_lines[start_idx].strip() == "" for start_idx in range(start_idx, len(all_lines))):
        start_idx += 1
    # Append the body minus any prior register
    new_lines.extend(all_lines[start_idx:])
    # Optionally add missing Finding templates at the BOTTOM
    if add_templates and missing_findings:
        for s in sorted(missing_findings):
            new_lines.append("\n---\n")
            new_lines.append(f"### Finding: {s}\n")
            new_lines.append(f"- **Surface:** {s}")
            new_lines.append("- **Severity:** [Low/Medium/High]")
            new_lines.append("- **Status:** [Reviewed/Deferred/Open gap]")
            new_lines.append("- **Risk Summary:** [Describe the main security risk or concern posed by this file/functionality.]")
            new_lines.append("- **Mitigations:** [State how you are mitigating (tests, reviews, guards, input validation...)]")
            new_lines.append("- **Owner:** [Team or individual]")
            new_lines.append("- **Notes:** [When last reviewed, open TODOs, related tickets.]")
        updated = True

    # Print summary for triple-check
    print("\n\033[1;34m=== COMPLIANCE AUDIT SUMMARY ===\033[0m")
    print(f"Audit surfaces in skill doc: {len(skill_surfaces)}")
    print(f"Registered at file top: {len(surface_register)}")
    print(f"Findings in doc: {len(finding_surfaces)}")
    if not missing_in_register and not missing_findings and not duplicate_registers and not duplicate_findings:
        print("\033[1;32mAll surfaces are registered at the top AND have findings. CI/automation will pass!\033[0m")
    print("================================\n")

    return new_lines, updated

def main():
    import argparse

    parser = argparse.ArgumentParser(description="Master ASI Security Audit Surface Register Sync Tool")
    parser.add_argument('--add-templates', action='store_true', help='Auto-add finding templates for missing surfaces at bottom')
    parser.add_argument('--write', action='store_true', help='Actually write SECURITY.md with updates (otherwise, dry-run)')
    args = parser.parse_args()

    skill_surfaces = get_all_surfaces(MYTHOS_SKILL)
    header_lines, surface_register, finding_surfaces, finding_blocks, all_lines = parse_security_md(SECURITY_MD)
    updated_lines, updated = triple_check_and_update(skill_surfaces, header_lines, surface_register, finding_surfaces, all_lines, add_templates=args.add_templates)

    if updated:
        if args.write:
            with open(SECURITY_MD, 'w', encoding='utf-8', newline='\n') as f:
                f.write('\n'.join(updated_lines) + '\n')
            print("\033[1;32mSECURITY.md was updated. You should review any new Finding templates or warnings above.\033[0m")
        else:
            print("\033[1;33m(Dry-run: No changes written. Use --write to save updates.)\033[0m")
    else:
        print("\033[1;32mNo changes needed. Everything is in sync!\033[0m")

if __name__ == '__main__':
    main()
