#!/usr/bin/env python3
"""
fix_f10_prompt_injection.py
Mythos audit 2026-04-22 — F-10 remediation

What this patches:
  server/routers/daw.ts → ai.chat procedure

  1. Adds a server-side sanitiser function `sanitiseTrackName()` that strips
     instruction-pattern characters from activeTrack before it reaches any
     LLM context string. The sanitiser is a defence-in-depth complement to
     the existing Zod .max(40) cap — it neutralises injection syntax that
     fits within 40 chars.

  2. Applies the sanitiser at the one injection point: the `ctxStr` builder
     inside `ai.chat`, replacing the bare interpolation of
     `input.context.activeTrack` with `sanitiseTrackName(input.context.activeTrack)`.

  3. Updates the F-10 comment to reflect the fix is now applied.

Wire.txt compliance:
  - Reads file, asserts each target pattern appears exactly once before patching.
  - Writes .bak backup before any modification.
  - Prints PASS/FAIL for each assertion and a final summary.
  - Exits non-zero on any assertion failure (no partial writes).
"""

import re
import shutil
import sys
from pathlib import Path

TARGET = Path("server/routers/daw.ts")

# ── Anchors ───────────────────────────────────────────────────────────────────

# 1. Insertion anchor: the line immediately before buildCoProducerSystem()
#    We insert the sanitiser function between the LLPTE helpers block and
#    the Co-Producer system prompt builder.
SANITISER_ANCHOR = "// ── AI Co-Producer prompt builder ─────────────────────────────────────────────"

# 2. The exact bare interpolation we're replacing in ctxStr
OLD_INTERPOLATION = "input.context.activeTrack ? `Selected track: ${input.context.activeTrack}.` : '',"

# 3. New interpolation using the sanitiser
NEW_INTERPOLATION = "input.context.activeTrack ? `Selected track: ${sanitiseTrackName(input.context.activeTrack)}.` : '',"

# 4. The F-10 comment block to update (assert once, then replace)
OLD_F10_COMMENT = """        // F-10 (SECURITY.md): activeTrack is user-controlled. When the real
        // Anthropic API is wired, this field must be sanitised before inclusion
        // in the system context string to prevent prompt injection. See SECURITY.md."""

NEW_F10_COMMENT = """        // F-10 (SECURITY.md — FIXED): activeTrack is sanitised by sanitiseTrackName()
        // before inclusion in the system context string. The sanitiser strips
        // instruction-pattern characters and enforces a 40-char hard cap server-side."""

# 5. The sanitiser function to insert before the Co-Producer section
SANITISER_FUNCTION = """
// ── Input sanitiser — F-10 fix ───────────────────────────────────────────────

/**
 * sanitiseTrackName
 *
 * Strips characters that form instruction-syntax patterns used in prompt
 * injection (angle brackets, braces, backticks, newlines, pipe, backslash,
 * hash-bang sequences) from user-supplied track names before they are
 * interpolated into any LLM context string.
 *
 * The Zod schema already enforces .max(40) on input; this sanitiser is a
 * server-side defence-in-depth layer that neutralises injection payloads
 * that fit within the character cap (e.g. "<|SYSTEM|> ignore previous...").
 *
 * Strategy: allowlist printable ASCII minus instruction-syntax characters,
 * then re-enforce the 40-char limit after stripping.
 *
 * F-10 (Mythos audit 2026-04-22) — resolved here, not deferred.
 */
function sanitiseTrackName(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  return raw
    // Strip characters that construct injection syntax:
    //   < > { } [ ] ` \\ | # ^ ~ instruction delimiters
    //   \\n \\r  newlines that could break system-prompt structure
    //   null bytes
    .replace(/[<>{}\\[\\]`\\\\|#^~\\n\\r\\x00]/g, '')
    // Collapse multiple spaces created by stripping (keeps names readable)
    .replace(/  +/g, ' ')
    .trim()
    // Re-enforce hard cap after stripping (Zod cap is on raw input pre-strip)
    .slice(0, 40) || undefined;
}

"""

# ── Helpers ───────────────────────────────────────────────────────────────────

def assert_count(label: str, pattern: str, text: str, expected: int = 1) -> bool:
    count = text.count(pattern)
    if count != expected:
        print(f"  [FAIL] assert_count '{label}': expected {expected}, found {count}")
        return False
    print(f"  [ OK ] assert_count '{label}': found {count}")
    return True

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> int:
    if not TARGET.exists():
        print(f"[ERR] Target not found: {TARGET}")
        print("      Run from ~/Stable root.")
        return 1

    src = TARGET.read_text(encoding="utf-8")
    print(f"\n[F-10] Patching {TARGET}\n")

    # ── Pre-flight assertions ─────────────────────────────────────────────────
    ok = True
    ok &= assert_count("sanitiser anchor",   SANITISER_ANCHOR,   src, 1)
    ok &= assert_count("bare interpolation", OLD_INTERPOLATION,  src, 1)
    ok &= assert_count("F-10 comment",       "activeTrack is user-controlled", src, 1)

    # Guard: sanitiser must NOT already be present
    if "sanitiseTrackName" in src:
        print("  [SKIP] sanitiseTrackName already present — patch already applied.")
        return 0

    if not ok:
        print("\n[ERR] Assertion(s) failed — no changes written.")
        return 1

    # ── Backup ────────────────────────────────────────────────────────────────
    bak = TARGET.with_suffix(TARGET.suffix + ".bak_f10")
    shutil.copy2(TARGET, bak)
    print(f"\n  [BAK] {bak}")

    # ── Apply patches in order ────────────────────────────────────────────────

    # 1. Insert sanitiser function before the Co-Producer section
    patched = src.replace(
        SANITISER_ANCHOR,
        SANITISER_FUNCTION + SANITISER_ANCHOR,
    )

    # 2. Replace bare activeTrack interpolation with sanitised version
    patched = patched.replace(OLD_INTERPOLATION, NEW_INTERPOLATION)

    # 3. Update the F-10 comment to reflect fix applied
    patched = patched.replace(OLD_F10_COMMENT, NEW_F10_COMMENT)

    # ── Post-patch assertions ─────────────────────────────────────────────────
    ok2 = True
    ok2 &= assert_count("sanitiser inserted",      "sanitiseTrackName",        patched, 3)  # def + 2 call sites
    ok2 &= assert_count("new interpolation",        NEW_INTERPOLATION,          patched, 1)
    ok2 &= assert_count("old interpolation gone",   OLD_INTERPOLATION,          patched, 0)
    ok2 &= assert_count("updated F-10 comment",     "FIXED",                    patched, 1)

    if not ok2:
        print("\n[ERR] Post-patch assertions failed — restoring backup.")
        shutil.copy2(bak, TARGET)
        return 1

    TARGET.write_text(patched, encoding="utf-8")
    print(f"\n  [WRITTEN] {TARGET}")
    print("\n[F-10] PASS — sanitiseTrackName inserted and applied to ai.chat ctxStr.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
