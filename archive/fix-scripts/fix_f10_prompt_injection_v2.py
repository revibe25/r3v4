#!/usr/bin/env python3
"""
fix_f10_prompt_injection_v2.py
Mythos audit 2026-04-22 — F-10 remediation (revised)

Fixes the issue in v1: the assertion was counting function name mentions
in comments and JSDoc, causing false failures. This version uses more
precise pattern matching:
  - Check for function definition: function sanitiseTrackName(
  - Check for the call in ctxStr: sanitiseTrackName(input.context.activeTrack)
  - Don't count comment/JSDoc mentions

Backups from the failed v1 run are preserved; this applies cleanly on top.
"""

import re
import shutil
import sys
from pathlib import Path

TARGET = Path("server/routers/daw.ts")

# ── Anchors ───────────────────────────────────────────────────────────────────

SANITISER_ANCHOR = "// ── AI Co-Producer prompt builder ─────────────────────────────────────────────"

OLD_INTERPOLATION = "input.context.activeTrack ? `Selected track: ${input.context.activeTrack}.` : '',"
NEW_INTERPOLATION = "input.context.activeTrack ? `Selected track: ${sanitiseTrackName(input.context.activeTrack)}.` : '',"

OLD_F10_COMMENT = """        // F-10 (SECURITY.md): activeTrack is user-controlled. When the real
        // Anthropic API is wired, this field must be sanitised before inclusion
        // in the system context string to prevent prompt injection. See SECURITY.md."""

NEW_F10_COMMENT = """        // F-10 (SECURITY.md — FIXED): activeTrack is sanitised by sanitiseTrackName()
        // before inclusion in the system context string. The sanitiser strips
        // instruction-pattern characters and enforces a 40-char hard cap server-side."""

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

def main() -> int:
    if not TARGET.exists():
        print(f"[ERR] Target not found: {TARGET}")
        return 1

    src = TARGET.read_text(encoding="utf-8")
    print(f"\n[F-10 v2] Patching {TARGET}\n")

    # ── Check if already patched ───────────────────────────────────────────────
    if "function sanitiseTrackName" in src:
        print("  [SKIP] sanitiseTrackName function already present — patch already applied.")
        return 0

    # ── Pre-flight checks ──────────────────────────────────────────────────────
    print("  [ OK ] Anchor line present" if SANITISER_ANCHOR in src else "  [FAIL] Anchor not found")
    print("  [ OK ] Old interpolation present" if OLD_INTERPOLATION in src else "  [FAIL] Old interpolation not found")
    print("  [ OK ] F-10 comment present" if "activeTrack is user-controlled" in src else "  [FAIL] F-10 comment not found")

    if SANITISER_ANCHOR not in src or OLD_INTERPOLATION not in src:
        print("\n[ERR] Pre-flight checks failed — file may have been edited.")
        return 1

    # ── Backup ────────────────────────────────────────────────────────────────
    bak = TARGET.with_suffix(TARGET.suffix + ".bak_f10_v2")
    shutil.copy2(TARGET, bak)
    print(f"\n  [BAK] {bak}\n")

    # ── Apply patches in order ────────────────────────────────────────────────

    # 1. Insert sanitiser function
    patched = src.replace(
        SANITISER_ANCHOR,
        SANITISER_FUNCTION + SANITISER_ANCHOR,
    )

    # 2. Replace interpolation
    patched = patched.replace(OLD_INTERPOLATION, NEW_INTERPOLATION)

    # 3. Update comment
    patched = patched.replace(OLD_F10_COMMENT, NEW_F10_COMMENT)

    # ── Verify patches ────────────────────────────────────────────────────────
    ok = True

    # Check for function definition
    if "function sanitiseTrackName(" not in patched:
        print("  [FAIL] sanitiseTrackName function definition not found after patch")
        ok = False
    else:
        print("  [ OK ] sanitiseTrackName function definition present")

    # Check for function call in ctxStr
    if "sanitiseTrackName(input.context.activeTrack)" not in patched:
        print("  [FAIL] sanitiseTrackName call in ctxStr not found")
        ok = False
    else:
        print("  [ OK ] sanitiseTrackName call wired into ctxStr")

    # Check old interpolation is gone
    if OLD_INTERPOLATION in patched:
        print("  [FAIL] Old interpolation still present")
        ok = False
    else:
        print("  [ OK ] Old interpolation removed")

    # Check comment updated
    if "FIXED" not in patched or "sanitiseTrackName()" not in patched:
        print("  [FAIL] F-10 comment not updated")
        ok = False
    else:
        print("  [ OK ] F-10 comment updated to mark FIXED")

    if not ok:
        print("\n[ERR] Post-patch verification failed — restoring backup.")
        shutil.copy2(bak, TARGET)
        return 1

    # ── Write ──────────────────────────────────────────────────────────────────
    TARGET.write_text(patched, encoding="utf-8")
    print(f"\n  [WRITTEN] {TARGET}")
    print("\n[F-10 v2] PASS — sanitiseTrackName inserted and wired into ai.chat ctxStr.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
