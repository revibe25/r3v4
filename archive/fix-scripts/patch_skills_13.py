#!/usr/bin/env python3
"""
Patch SKILLS.md §13 — replace sed -i credential-pivot recipe with subshell-only override.
TC2-6 fix. Triple-check: assert count == 1, verify before write, verify after write.
"""

import shutil
import sys

FILE = "SKILLS.md"
BAK = "SKILLS.md.bak." + __import__('datetime').datetime.now().strftime("%Y%m%d_%H%M%S")

# Read
with open(FILE, "r") as f:
    original = f.read()

# ── Anchor: the exact old text to replace ──
OLD = """### For local dev connecting to Railway
When no local PostgreSQL is available (Termux, Penguin), update `.env` directly:
```bash
sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:PASSWORD@ballast.proxy.rlwy.net:25291/railway|' .env
```
Type the real password in the terminal — never in chat."""

# ── Verify anchor exists exactly once ──
count = original.count(OLD)
assert count == 1, f"[ABORT] Expected 1 match for TC2-6 anchor, found {count}. File may have drifted."

# ── Replacement ──
NEW = """### For local dev connecting to Railway
When no local PostgreSQL is available (Termux, Penguin), use a subshell-only override:
```bash
# Correct — password exists only in this shell process, never written to disk
DATABASE_URL="postgresql://postgres:PASSWORD@ballast.proxy.rlwy.net:25291/railway" \
  pnpm drizzle-kit migrate
```
Type the real password in the terminal — never in chat.
**Hard rule:** production `DATABASE_URL` never lands in `.env` on dev machines."""

patched = original.replace(OLD, NEW, 1)
assert patched != original, "[ABORT] Replacement produced no change."

# ── Also harden the Rule section ──
OLD_RULE = "**Never trust the `.env` DATABASE_URL for Railway operations.**"
NEW_RULE = "**Never trust the `.env` DATABASE_URL for Railway operations.**
**Hard rule:** production `DATABASE_URL` never lands in `.env` on dev machines — subshell-only override or Railway dashboard only."

if OLD_RULE in patched:
    patched = patched.replace(OLD_RULE, NEW_RULE, 1)

# ── Backup → Write → Verify ──
shutil.copy2(FILE, BAK)
with open(FILE, "w") as f:
    f.write(patched)

with open(FILE, "r") as f:
    verify = f.read()

assert NEW in verify, "[ABORT] Post-write verification failed — new text not found."
assert OLD not in verify, "[ABORT] Post-write verification failed — old text still present."

print(f"[OK] SKILLS.md patched. Backup: {BAK}")
print(f"[OK] TC2-6 sed -i recipe removed. Subshell-only override promoted.")
