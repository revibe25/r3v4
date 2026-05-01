#!/usr/bin/env python3
"""
patch_vite_config.py
────────────────────
Wire.txt protocol — Read → Verify → Dry-run → Backup → Patch → Confirm

Applies two surgical patches to client/vite.config.ts:

  PATCH 1 — build.target
    Old: ['es2020', 'chrome90', 'firefox88', 'safari14']
    New: ['es2022', 'chrome104', 'firefox102', 'safari15.4']

  PATCH 2 — optimizeDeps.esbuildOptions (dynamic anchor detection)
    Locates the exact `optimizeDeps: {` block, finds the `include: [` line
    that immediately follows it (skipping blank/comment lines), and inserts
    the esbuildOptions stanza before it.
    NO hardcoded line numbers. NO guessing.

Usage:
  python3 patch_vite_config.py              # dry-run (safe, no writes)
  python3 patch_vite_config.py --apply      # write changes + backup

The script exits non-zero on any failure so it can be used in CI/pipelines.
"""

import sys
import re
import difflib
import shutil
import argparse
from pathlib import Path
from datetime import datetime
from typing import NoReturn

# ─── Config ───────────────────────────────────────────────────────────────────

VITE_CONFIG = Path.home() / "Stable" / "client" / "vite.config.ts"

# ─── Patch 1 definition ───────────────────────────────────────────────────────

P1_OLD = "      target: ['es2020', 'chrome90', 'firefox88', 'safari14'],"

P1_NEW = (
    "      // es2022 required: @floating-ui/core ≥1.7 ships native ES2022 syntax\n"
    "      // that esbuild cannot downcompile to es2020. All supported Chromebook\n"
    "      // Chrome versions (≥104) fully support ES2022.\n"
    "      target: ['es2022', 'chrome104', 'firefox102', 'safari15.4'],"
)

# ─── Patch 2 definition ───────────────────────────────────────────────────────
# Inserted BEFORE the first `include: [` line inside the optimizeDeps block.
#
# P2_BASE_INDENT must match the leading spaces on the outermost lines of
# P2_INSERT. The inner `target:` line carries 2 extra spaces of relative
# indent; that delta is preserved during re-indentation (see build_patched).

P2_INSERT = (
    "      // Override the dev pre-bundler target. Vite's internal default (~chrome87)\n"
    "      // cannot compile @floating-ui/core ≥1.7 which ships ES2022 destructuring.\n"
    "      esbuildOptions: {\n"
    "        target: 'es2022',\n"   # 8 spaces: 6 base + 2 inner — delta preserved
    "      },\n"
)

# Minimum indent used in P2_INSERT (all outer lines = 6 spaces).
# Used in build_patched to strip exactly this many leading spaces before
# re-indenting, so the inner `target:` line retains its 2-space relative indent.
P2_BASE_INDENT = 6

# ─── Helpers ──────────────────────────────────────────────────────────────────

RESET  = "\033[0m"
GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
CYAN   = "\033[96m"
BOLD   = "\033[1m"

def ok(msg: str)   -> None: print(f"  {GREEN}✔{RESET}  {msg}")
def warn(msg: str) -> None: print(f"  {YELLOW}⚠{RESET}  {msg}")
def info(msg: str) -> None: print(f"  {CYAN}→{RESET}  {msg}")
def head(msg: str) -> None: print(f"\n{BOLD}{msg}{RESET}")

def fail(msg: str) -> NoReturn:
    """Print error and exit non-zero.
    Annotated NoReturn so callers know execution does not continue past here."""
    print(f"  {RED}✘{RESET}  {msg}")
    sys.exit(1)

# ─── Phase 0 — Read ───────────────────────────────────────────────────────────

def read_file(path: Path) -> str:
    head("PHASE 0 — READ")
    if not path.exists():
        fail(f"File not found: {path}")
    src = path.read_text(encoding="utf-8")
    ok(f"Read {path}  ({len(src.splitlines())} lines, {len(src)} bytes)")
    return src

# ─── Phase 1 — Verify anchors exist ─────────────────────────────────────────

def verify_anchors(src: str) -> dict:
    """
    Returns a dict with location metadata for each patch anchor.
    Exits non-zero if any anchor is missing or irrecoverably wrong.
    No file writes occur in this phase.
    """
    head("PHASE 1 — VERIFY ANCHORS (no writes yet)")
    result: dict = {}

    # ── Patch 1: build.target line ────────────────────────────────────────────
    if P1_OLD not in src:
        if "chrome104" in src:
            warn("Patch 1 anchor not found — already applied (chrome104 detected). Skipping.")
            result["p1_skip"] = True
        else:
            fail(
                "Patch 1 anchor not found and target does not appear patched.\n"
                f"    Expected: {P1_OLD}\n"
                "    The file may have changed. Inspect manually."
            )
    else:
        # Safe: P1_OLD confirmed present above, so .index() will not raise.
        line_no = src.splitlines().index(P1_OLD) + 1
        ok(f"Patch 1 anchor found at line {line_no}: build.target")
        result["p1_skip"] = False

    # ── Patch 2: optimizeDeps block + include: [ ──────────────────────────────
    # Already-patched guard: require BOTH markers together.
    # "target: 'es2022'" (scalar, single-quoted) only appears in esbuildOptions.
    # The build.target array uses ['es2022', ...] — different syntax, no match.
    if "esbuildOptions:" in src and "target: 'es2022'" in src:
        warn("Patch 2 appears already applied (esbuildOptions/target detected). Skipping.")
        result["p2_skip"] = True
        result["p2_include_line"] = None
        return result

    result["p2_skip"] = False
    lines = src.splitlines()

    # Step 1: Find `optimizeDeps: {` as a live config key.
    # FIX: check the ORIGINAL (indented) line for comment markers via lstrip(),
    # NOT `stripped`. The `stripped` form starts with "optimizeDeps:" and can
    # never also start with "//" or "*" — checking it for comments is dead logic.
    optdeps_idx = None
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("optimizeDeps:") and "{" in stripped:
            lstripped = line.lstrip()
            if not lstripped.startswith("//") and not lstripped.startswith("*"):
                optdeps_idx = i
                break

    if optdeps_idx is None:
        fail(
            "Could not locate `optimizeDeps: {` block in vite.config.ts.\n"
            "    The file structure may have changed. Inspect manually."
        )

    ok(f"optimizeDeps block found at line {optdeps_idx + 1}: {lines[optdeps_idx].rstrip()!r}")

    # Step 2: Within the optimizeDeps block, find the first `include: [` line
    # that is NOT a comment. Skip blank lines and comment lines.
    # FIX: brace-depth tracking replaces the simple `} == closing brace` check
    # so that a `}` inside a future nested block does not trigger a false exit.
    include_idx = None
    depth = 1  # we entered the opening `{` on optdeps_idx
    search_limit = min(optdeps_idx + 60, len(lines))

    for i in range(optdeps_idx + 1, search_limit):
        stripped = lines[i].strip()

        # Track depth so we know when we've genuinely left the optimizeDeps block.
        depth += stripped.count("{") - stripped.count("}")

        # Skip blank lines and comment lines.
        if not stripped or stripped.startswith("//") or stripped.startswith("*"):
            continue

        if stripped.startswith("include:"):
            include_idx = i
            break

        # Only bail if depth has returned to 0 — we've truly exited the block.
        if depth <= 0:
            fail(
                f"Exited optimizeDeps block at line {i + 1} without finding `include:`.\n"
                "    Cannot safely insert esbuildOptions. Inspect manually."
            )

    if include_idx is None:
        fail(
            f"Found optimizeDeps at line {optdeps_idx + 1} but could not locate "
            f"`include: [` within the next {search_limit - optdeps_idx - 1} lines.\n"
            "    The block may be structured differently. Inspect manually."
        )

    ok(f"Patch 2 insertion point: line {include_idx + 1} → before `{lines[include_idx].strip()}`")
    result["p2_include_line"] = include_idx
    return result

# ─── Phase 2 — Build patched content ─────────────────────────────────────────

def build_patched(src: str, anchors: dict) -> str:
    head("PHASE 2 — BUILD PATCHED CONTENT (in memory)")

    lines = src.splitlines(keepends=True)

    # ── Apply Patch 2 first (index-based) ────────────────────────────────────
    # Runs before Patch 1 because Patch 2 uses a line index computed from the
    # original source. Patch 1 is text-based and is unaffected by the order.
    if not anchors.get("p2_skip"):
        idx = anchors["p2_include_line"]

        # Detect actual indentation of the `include:` line.
        include_line  = lines[idx]
        actual_indent = len(include_line) - len(include_line.lstrip())
        indent_str    = " " * actual_indent

        # Re-indent P2_INSERT preserving relative indentation.
        # FIX: strip exactly P2_BASE_INDENT spaces via slicing (not lstrip) so
        # the inner `target:` line keeps its 2-space delta inside esbuildOptions.
        # The previous lstrip() stripped ALL leading spaces, collapsing every
        # line to the same indent and producing malformed TypeScript.
        insert_lines = []
        for raw_line in P2_INSERT.splitlines(keepends=True):
            if raw_line.strip():
                stripped_of_base = (
                    raw_line[P2_BASE_INDENT:]
                    if raw_line.startswith(" " * P2_BASE_INDENT)
                    else raw_line.lstrip()  # fallback: indent mismatch
                )
                insert_lines.append(indent_str + stripped_of_base)
            else:
                insert_lines.append(raw_line)  # blank line — preserve as-is

        lines = lines[:idx] + insert_lines + lines[idx:]
        ok(f"Patch 2 staged: inserted {len(insert_lines)} lines before original line {idx + 1}")

    # ── Apply Patch 1 (text substitution) ─────────────────────────────────────
    patched = "".join(lines)
    if not anchors.get("p1_skip"):
        if P1_OLD not in patched:
            fail("Patch 1 anchor disappeared after Patch 2 was staged. This should not happen.")
        patched = patched.replace(P1_OLD, P1_NEW, 1)
        ok("Patch 1 staged: build.target → es2022/chrome104/firefox102/safari15.4")

    ok(f"Patched content built ({len(patched.splitlines())} lines)")
    return patched

# ─── Phase 3 — Dry-run diff ───────────────────────────────────────────────────

def dry_run_diff(original: str, patched: str) -> None:
    """
    Renders a proper unified diff via difflib.
    FIX: the previous set-arithmetic approach lost line ordering, collapsed
    duplicate lines, and produced an alphabetically sorted list with no context.
    difflib.unified_diff preserves position, context, and line counts correctly.
    """
    head("PHASE 3 — DRY-RUN DIFF")
    orig_lines  = original.splitlines(keepends=True)
    patch_lines = patched.splitlines(keepends=True)

    info(
        f"Lines before: {len(orig_lines)}  →  after: {len(patch_lines)}  "
        f"(+{len(patch_lines) - len(orig_lines)})"
    )
    print()

    diff = list(difflib.unified_diff(
        orig_lines, patch_lines,
        fromfile="vite.config.ts (original)",
        tofile  ="vite.config.ts (patched)",
        lineterm="",
        n=2,  # 2 lines of context around each change
    ))

    if not diff:
        warn("unified_diff produced no output — files may be identical.")
        return

    for line in diff:
        line_out = line.rstrip("\n")
        if line_out.startswith("---") or line_out.startswith("+++"):
            print(f"  {BOLD}{line_out}{RESET}")
        elif line_out.startswith("@@"):
            print(f"  {CYAN}{line_out}{RESET}")
        elif line_out.startswith("-"):
            print(f"  {RED}{line_out}{RESET}")
        elif line_out.startswith("+"):
            print(f"  {GREEN}{line_out}{RESET}")
        else:
            print(f"  {line_out}")

# ─── Phase 4 — Backup ─────────────────────────────────────────────────────────

def backup(path: Path) -> Path:
    head("PHASE 4 — BACKUP")
    ts  = datetime.now().strftime("%Y%m%d_%H%M%S")
    bak = path.with_suffix(f".ts.bak_{ts}")
    shutil.copy2(path, bak)
    ok(f"Backup written: {bak.name}")
    return bak

# ─── Phase 5 — Write ──────────────────────────────────────────────────────────

def write(path: Path, content: str) -> None:
    head("PHASE 5 — WRITE")
    path.write_text(content, encoding="utf-8")
    ok(f"Written: {path}  ({len(content.splitlines())} lines)")

# ─── Phase 6 — Post-write verification ───────────────────────────────────────

def verify_post_write(path: Path, anchors: dict) -> None:
    head("PHASE 6 — POST-WRITE VERIFICATION")
    result   = path.read_text(encoding="utf-8")
    failures: list[str] = []

    # ── Patch 1 checks ────────────────────────────────────────────────────────
    if not anchors.get("p1_skip"):
        if P1_OLD in result:
            failures.append("Patch 1: OLD anchor still present — replace did not apply")
        else:
            ok("Patch 1: old target string absent ✓")

        if "chrome104" in result:
            ok("Patch 1: chrome104 present ✓")
        else:
            failures.append("Patch 1: chrome104 not found in output")

    # ── Patch 2 checks ────────────────────────────────────────────────────────
    if not anchors.get("p2_skip"):
        if "esbuildOptions:" not in result:
            failures.append("Patch 2: esbuildOptions block not found")
        else:
            ok("Patch 2: esbuildOptions block present ✓")

        # Scalar 'es2022' (single-quoted, no array bracket) — only in esbuildOptions.
        if "target: 'es2022'" not in result:
            failures.append("Patch 2: esbuildOptions.target not found")
        else:
            ok("Patch 2: esbuildOptions.target = 'es2022' ✓")

        # Ordering check: regex-based, indent-agnostic.
        # FIX: the previous result.find("      include: [") used hardcoded
        # 6-space indent — it returned -1 silently on any indent variation,
        # making the entire ordering assertion a silent no-op.
        ebo_match = re.search(r'\besbuildOptions\s*:', result)
        inc_match = re.search(r'\binclude\s*:\s*\[', result)
        if ebo_match and inc_match:
            if ebo_match.start() < inc_match.start():
                ok("Patch 2: esbuildOptions precedes include: ✓")
            else:
                failures.append(
                    "Patch 2: esbuildOptions appears AFTER include: — wrong order"
                )
        else:
            failures.append(
                "Patch 2: could not locate esbuildOptions or include: for ordering check"
            )

    # ── Structural sanity ─────────────────────────────────────────────────────
    if "optimizeDeps: {" not in result:
        failures.append("Structural: optimizeDeps block missing")
    else:
        ok("Structural: optimizeDeps block intact ✓")

    if "export default defineConfig" not in result:
        failures.append("Structural: defineConfig export missing")
    else:
        ok("Structural: defineConfig export intact ✓")

    # ── Result ────────────────────────────────────────────────────────────────
    if failures:
        print()
        for f in failures:
            warn(f"FAIL: {f}")
        fail("One or more post-write checks failed. Review the .bak backup.")

    print()
    ok("All post-write checks passed.")

# ─── Phase 7 — Next steps ─────────────────────────────────────────────────────

def next_steps() -> None:
    head("PHASE 7 — NEXT STEPS")
    print(f"""
  Run in your Stable terminal:

  {CYAN}rm -rf ~/Stable/client/node_modules/.vite{RESET}
  {CYAN}cd ~/Stable && pnpm dev{RESET}

  The 1,155 @floating-ui/core esbuild errors will be gone.
  Vite re-bundles all deps against es2022 — ~30s on first run.
""")

# ─── Entry point ──────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Surgical vite.config.ts patcher — Wire.txt protocol"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write the patch to disk (default: dry-run only)",
    )
    args = parser.parse_args()

    mode = "APPLY" if args.apply else "DRY-RUN"
    print(f"\n{BOLD}{'─' * 60}{RESET}")
    print(f"{BOLD}  patch_vite_config.py  [{mode}]{RESET}")
    print(f"{BOLD}  Target: {VITE_CONFIG}{RESET}")
    print(f"{BOLD}{'─' * 60}{RESET}")

    # ── Phase 0: Read first (Wire.txt protocol) ───────────────────────────────
    original = read_file(VITE_CONFIG)

    # ── Phase 1: Verify anchors — no writes ───────────────────────────────────
    anchors = verify_anchors(original)

    if anchors.get("p1_skip") and anchors.get("p2_skip"):
        warn("Both patches already applied. Nothing to do.")
        sys.exit(0)

    # ── Phase 2: Build patched content in memory ──────────────────────────────
    patched = build_patched(original, anchors)

    # ── Phase 3: Diff preview ─────────────────────────────────────────────────
    dry_run_diff(original, patched)

    if not args.apply:
        print(f"\n{YELLOW}  DRY-RUN complete — no files written.{RESET}")
        print(f"  Re-run with {BOLD}--apply{RESET} to commit the patch.\n")
        sys.exit(0)

    # ── Phase 4: Backup ───────────────────────────────────────────────────────
    backup(VITE_CONFIG)

    # ── Phase 5: Write ────────────────────────────────────────────────────────
    write(VITE_CONFIG, patched)

    # ── Phase 6: Post-write verification ──────────────────────────────────────
    verify_post_write(VITE_CONFIG, anchors)

    # ── Phase 7: Next steps ───────────────────────────────────────────────────
    next_steps()
    print(f"{GREEN}{BOLD}  Patch complete.{RESET}\n")


if __name__ == "__main__":
    main()
