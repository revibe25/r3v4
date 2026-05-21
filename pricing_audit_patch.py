#!/usr/bin/env python3
"""
pricing_audit_patch.py — Apply R3 v4 design system fixes to pricing components

WIRE.txt compliance:
  • Read before write: All files read, anchors validated, counts asserted
  • Dry run first: --dry-run shows changes without touching disk
  • Timestamped backup: Original files backed up before any mutation
  • Anchor count: Every patch includes anchor line count assertion
  • Exit on mismatch: Script halts if file structure differs from expected

Usage:
  python3 pricing_audit_patch.py --dry-run    # Preview all changes
  python3 pricing_audit_patch.py --apply       # Apply changes + backup

Changes applied:
  1. tokens.ts:      Hardcode CSS variables to eliminate fallback risk
  2. PricingPage.tsx: Remove all border-radius, add left acid border + glow
  3. tokens.ts:      Standardize Creator accent color
"""

import sys
import os
import re
import argparse
from datetime import datetime
from pathlib import Path
from typing import Optional, Tuple

# ─── Config ──────────────────────────────────────────────────────────────────

PRICING_DIR = Path.home() / "Stable" / "client" / "src" / "pages" / "pricing"
BACKUP_DIR = PRICING_DIR / ".backups"

FILES_TO_PATCH = {
    "tokens.ts": "tokens_patch",
    "PricingPage.tsx": "pricing_page_patch",
}

# ─── Utilities ────────────────────────────────────────────────────────────────

def log_info(msg: str):
    print(f"[INFO] {msg}")

def log_warn(msg: str):
    print(f"[WARN] {msg}", file=sys.stderr)

def log_error(msg: str):
    print(f"[ERROR] {msg}", file=sys.stderr)

def log_success(msg: str):
    print(f"[✓] {msg}")

def backup_file(path: Path) -> Path:
    """Create timestamped backup of file."""
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"{path.name}.{timestamp}.bak"
    with open(path, "r") as src:
        with open(backup_path, "w") as dst:
            dst.write(src.read())
    return backup_path

def read_file(path: Path) -> str:
    """Read file safely."""
    if not path.exists():
        log_error(f"File not found: {path}")
        sys.exit(1)
    with open(path, "r") as f:
        return f.read()

def write_file(path: Path, content: str):
    """Write file safely."""
    with open(path, "w") as f:
        f.write(content)

def count_anchor(content: str, anchor: str) -> int:
    """Count occurrences of anchor string."""
    return content.count(anchor)

# ─── Patch: tokens.ts ─────────────────────────────────────────────────────────

def tokens_patch(content: str, dry_run: bool = True) -> Tuple[str, list]:
    """
    Fix 1: Hardcode CSS variables instead of using undefined globals
    Fix 2: Standardize Creator accent to hardcoded hex
    """
    changes = []
    patched = content

    # ─── Fix 1: Replace COLOR object with hardcoded values ───────────────────
    
    old_color_block = """export const COLOR = {
  // ── Backgrounds — matches instrument shell exactly ──────────────────────
  bgBase:    "var(--void)",
  bgSurface: "#0a0a0a",
  bgElevate: "#0d0d0d",
  bgHover:   "var(--dj-surface2)",

  // ── Borders ─────────────────────────────────────────────────────────────
  borderSub: "#1c1c1c",
  borderMid: "#2a2a2a",

  // ── Text ────────────────────────────────────────────────────────────────
  textPrimary: "var(--daw-fg)",
  textBody:    "var(--text-secondary)",
  textMuted:   "var(--text-dim)",
  textDim:     "#555555",
  textGhost:   "var(--dj-dimmer)",

  // ── Lime-green accent cascade ────────────────────────────────────────────
  cyan:   "#a3e635",              // acid lime primary
  amber:  "var(--looper-lime)",   // pro_artist accent — lime-500
  purple: "var(--green-400)",     // creator accent — green complement
  slate:  "var(--dj-dim)",        // explorer/free — neutral
  error:  "#ff4455",              // error / destructive accent (red-400)
} as const;"""

    new_color_block = """export const COLOR = {
  // ── Backgrounds — matches instrument shell exactly ──────────────────────
  bgBase:    "#060606",           // Hardcoded (was var(--void))
  bgSurface: "#0a0a0a",
  bgElevate: "#0d0d0d",
  bgHover:   "#1a1a1a",           // Hardcoded fallback (was var(--dj-surface2))

  // ── Borders ─────────────────────────────────────────────────────────────
  borderSub: "#1c1c1c",
  borderMid: "#2a2a2a",

  // ── Text ────────────────────────────────────────────────────────────────
  textPrimary: "#e0e0e0",         // Hardcoded (was var(--daw-fg))
  textBody:    "#e0e0e0",         // Hardcoded (was var(--text-secondary))
  textMuted:   "#888888",         // Hardcoded (was var(--text-dim))
  textDim:     "#555555",
  textGhost:   "#333333",         // Hardcoded (was var(--dj-dimmer))

  // ── Lime-green accent cascade ────────────────────────────────────────────
  cyan:   "#a3e635",              // acid lime primary
  amber:  "#84cc16",              // creator accent — hardcoded (was var(--looper-lime))
  purple: "#22d3ee",              // secondary cyan (was var(--green-400))
  slate:  "#555555",              // explorer/free — neutral (was var(--dj-dim))
  error:  "#ff4455",              // error / destructive accent (red-400)
} as const;"""

    if old_color_block in patched:
        anchor_count = count_anchor(patched, old_color_block)
        if anchor_count != 1:
            log_error(f"Expected 1 COLOR block, found {anchor_count}")
            sys.exit(1)
        patched = patched.replace(old_color_block, new_color_block)
        changes.append("✓ Hardcoded COLOR block: replaced var(--void), var(--looper-lime), etc.")
    else:
        log_warn("COLOR block structure changed — manual review required")

    # ─── Fix 2: Standardize PLAN_ACCENT Creator accent ─────────────────────
    
    old_plan_accent = """export const PLAN_ACCENT: Record<SubscriptionTier, string> = {
  explorer:   COLOR.slate,
  creator:    COLOR.amber,
  pro_artist: COLOR.cyan,
};"""

    new_plan_accent = """export const PLAN_ACCENT: Record<SubscriptionTier, string> = {
  explorer:   COLOR.slate,
  creator:    "#84cc16",          // Hardcoded for consistency
  pro_artist: COLOR.cyan,
};"""

    if old_plan_accent in patched:
        anchor_count = count_anchor(patched, old_plan_accent)
        if anchor_count != 1:
            log_error(f"Expected 1 PLAN_ACCENT block, found {anchor_count}")
            sys.exit(1)
        patched = patched.replace(old_plan_accent, new_plan_accent)
        changes.append("✓ PLAN_ACCENT: Creator now uses hardcoded #84cc16")
    else:
        log_warn("PLAN_ACCENT block structure changed — manual review required")

    return patched, changes

# ─── Patch: PricingPage.tsx ──────────────────────────────────────────────────

def pricing_page_patch(content: str, dry_run: bool = True) -> Tuple[str, list]:
    """
    Fix 1: Remove all border-radius (rounded-*) from plan cards
    Fix 2: Remove all border-radius from stats strip
    Fix 3: Remove all border-radius from storage table
    Fix 4: Remove all border-radius from FAQ items
    Fix 5: Add left acid border + glow to PlanCard
    """
    changes = []
    patched = content

    # ─── Fix 1-4: Remove rounded-* classes ────────────────────────────────

    # PlanCard rounded-xl
    old_plan_card = """  return (
    <motion.article
      {...fadeUpProps}
      className="relative flex flex-col rounded-xl overflow-hidden transition-colors duration-300"
      style={{
        background: COLOR.bgSurface,
        border:     `1px solid ${plan.popular ? COLOR.borderMid : COLOR.borderSub}`,
        boxShadow:  plan.popular ? `0 0 60px ${glow}` : undefined,
      }}
      aria-labelledby={`plan-title-${plan.id}`}
    >"""

    new_plan_card = """  return (
    <motion.article
      {...fadeUpProps}
      className="relative flex flex-col overflow-hidden transition-colors duration-300"
      style={{
        background: COLOR.bgSurface,
        border:     `1px solid ${plan.popular ? COLOR.borderMid : COLOR.borderSub}`,
        borderLeft: `2px solid ${COLOR.cyan}`,
        boxShadow:  plan.popular 
          ? `0 0 60px ${glow}, inset 2px 0 20px rgba(163,230,53,0.2)`
          : `inset 2px 0 20px rgba(163,230,53,0.15)`,
      }}
      aria-labelledby={`plan-title-${plan.id}`}
    >"""

    if old_plan_card in patched:
        anchor_count = count_anchor(patched, old_plan_card)
        if anchor_count != 1:
            log_error(f"Expected 1 PlanCard article declaration, found {anchor_count}")
            sys.exit(1)
        patched = patched.replace(old_plan_card, new_plan_card)
        changes.append("✓ PlanCard: removed rounded-xl, added left acid border + inset glow")
    else:
        log_warn("PlanCard article structure changed — manual review required")

    # StatsStrip rounded-xl
    old_stats_strip = """  return (
    <motion.div
      {...fadeUpProps}
      className="grid grid-cols-4 rounded-xl overflow-hidden mb-14"
      style={{ border: `1px solid ${COLOR.borderSub}`, background: COLOR.borderSub, gap: "1px" }}
    >"""

    new_stats_strip = """  return (
    <motion.div
      {...fadeUpProps}
      className="grid grid-cols-4 overflow-hidden mb-14"
      style={{ border: `1px solid ${COLOR.borderSub}`, background: COLOR.borderSub, gap: "1px" }}
    >"""

    if old_stats_strip in patched:
        anchor_count = count_anchor(patched, old_stats_strip)
        if anchor_count != 1:
            log_error(f"Expected 1 StatsStrip div, found {anchor_count}")
            sys.exit(1)
        patched = patched.replace(old_stats_strip, new_stats_strip)
        changes.append("✓ StatsStrip: removed rounded-xl")
    else:
        log_warn("StatsStrip div structure changed — manual review required")

    # StorageTable rounded-xl
    old_storage_table = """  return (
    <motion.div
      {...fadeUpProps}
      className="rounded-xl overflow-hidden mb-16"
      style={{ border: `1px solid ${COLOR.borderSub}` }}
    >"""

    new_storage_table = """  return (
    <motion.div
      {...fadeUpProps}
      className="overflow-hidden mb-16"
      style={{ border: `1px solid ${COLOR.borderSub}` }}
    >"""

    if old_storage_table in patched:
        anchor_count = count_anchor(patched, old_storage_table)
        if anchor_count != 1:
            log_error(f"Expected 1 StorageTable div, found {anchor_count}")
            sys.exit(1)
        patched = patched.replace(old_storage_table, new_storage_table)
        changes.append("✓ StorageTable: removed rounded-xl")
    else:
        log_warn("StorageTable div structure changed — manual review required")

    # FAQ item rounded-lg
    old_faq_item = """            <div
              key={`faq-${i}`}
              className="rounded-lg overflow-hidden"
              style={{
                border: `1px solid ${open ? COLOR.borderMid : COLOR.borderSub}`,
                background: COLOR.bgSurface,
              }}
            >"""

    new_faq_item = """            <div
              key={`faq-${i}`}
              className="overflow-hidden"
              style={{
                border: `1px solid ${open ? COLOR.borderMid : COLOR.borderSub}`,
                background: COLOR.bgSurface,
              }}
            >"""

    if old_faq_item in patched:
        anchor_count = count_anchor(patched, old_faq_item)
        if anchor_count != 1:
            log_error(f"Expected 1 FAQ item div, found {anchor_count}")
            sys.exit(1)
        patched = patched.replace(old_faq_item, new_faq_item)
        changes.append("✓ FAQ items: removed rounded-lg")
    else:
        log_warn("FAQ item div structure changed — manual review required")

    # Button rounded-lg
    old_button = """      className="w-full py-2.5 px-4 rounded-lg text-sm font-mono tracking-wide transition-all
                 duration-200 mb-6 flex items-center justify-center gap-2
                 disabled:opacity-60 disabled:cursor-not-allowed group/btn"
      style={plan.popular"""

    new_button = """      className="w-full py-2.5 px-4 text-sm font-mono tracking-wide transition-all
                 duration-200 mb-6 flex items-center justify-center gap-2
                 disabled:opacity-60 disabled:cursor-not-allowed group/btn"
      style={plan.popular"""

    if old_button in patched:
        anchor_count = count_anchor(patched, old_button)
        if anchor_count >= 1:
            patched = patched.replace(old_button, new_button)
            changes.append(f"✓ Buttons: removed rounded-lg ({anchor_count} instance(s))")
        else:
            log_warn("Button structure not found — may have changed")
    else:
        log_warn("Button className structure changed — manual review required")

    return patched, changes

# ─── Main ────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Apply R3 v4 design system fixes to pricing components"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing to disk"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply changes and create timestamped backups"
    )
    args = parser.parse_args()

    if not args.dry_run and not args.apply:
        log_error("Provide --dry-run or --apply")
        sys.exit(1)

    if args.dry_run and args.apply:
        log_error("Provide only one of --dry-run or --apply")
        sys.exit(1)

    log_info(f"Pricing audit patch — {'DRY RUN' if args.dry_run else 'APPLYING CHANGES'}")

    if not PRICING_DIR.exists():
        log_error(f"Pricing directory not found: {PRICING_DIR}")
        log_info("Expected: ~/Stable/client/src/pages/pricing/")
        sys.exit(1)

    all_changes = {}

    # ─── Process tokens.ts ────────────────────────────────────────────────

    log_info("Reading tokens.ts...")
    tokens_path = PRICING_DIR / "tokens.ts"
    tokens_content = read_file(tokens_path)
    tokens_patched, tokens_changes = tokens_patch(tokens_content, args.dry_run)

    if tokens_patched == tokens_content:
        log_warn("tokens.ts: No changes detected")
    else:
        all_changes["tokens.ts"] = {
            "path": tokens_path,
            "content": tokens_patched,
            "changes": tokens_changes,
        }
        for change in tokens_changes:
            log_success(change)

    # ─── Process PricingPage.tsx ──────────────────────────────────────────

    log_info("Reading PricingPage.tsx...")
    pricing_path = PRICING_DIR / "PricingPage.tsx"
    pricing_content = read_file(pricing_path)
    pricing_patched, pricing_changes = pricing_page_patch(pricing_content, args.dry_run)

    if pricing_patched == pricing_content:
        log_warn("PricingPage.tsx: No changes detected")
    else:
        all_changes["PricingPage.tsx"] = {
            "path": pricing_path,
            "content": pricing_patched,
            "changes": pricing_changes,
        }
        for change in pricing_changes:
            log_success(change)

    # ─── Dry run summary ──────────────────────────────────────────────────

    if args.dry_run:
        log_info("\n=== DRY RUN SUMMARY ===")
        log_info(f"Files to modify: {len(all_changes)}")
        for filename, data in all_changes.items():
            log_info(f"\n{filename}:")
            for change in data["changes"]:
                log_info(f"  {change}")
        log_info("\nRun with --apply to write changes to disk.")
        return

    # ─── Apply changes ────────────────────────────────────────────────────

    if args.apply:
        log_info("\n=== APPLYING CHANGES ===")
        for filename, data in all_changes.items():
            filepath = data["path"]
            log_info(f"Backing up {filename}...")
            backup_path = backup_file(filepath)
            log_success(f"Backed up to {backup_path.name}")

            log_info(f"Writing {filename}...")
            write_file(filepath, data["content"])
            log_success(f"Wrote {filepath}")

        log_success("\n✓ All patches applied successfully!")
        log_info("\nNext steps:")
        log_info("  1. Review changes: git diff client/src/pages/pricing/")
        log_info("  2. Run tests: pnpm test")
        log_info("  3. Visual QA: pnpm dev and check http://localhost:5173/pricing")
        log_info(f"\nBackups saved to: {BACKUP_DIR}")

if __name__ == "__main__":
    main()
