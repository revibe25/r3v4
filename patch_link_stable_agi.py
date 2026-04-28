#!/usr/bin/env python3
"""
patch_link_stable_agi.py
Wire-protocol: read → verify → dry-run diff → backup → write → post-verify

Fixes:
  F1  ~/Stable/.env            — deduplicate INTERNAL_SECRET (keep de630b7...)
  F2  ~/Agi-Suite/.env         — deduplicate INTERNAL_SECRET (keep de630b7...)
  F3  ~/Agi-Suite/apps/api-server/.env — add R3_INTERNAL_URL if absent
  F4  Add warn log to fetchR3Metrics on non-ok response (metrics.ts)

Security posture (Mythos-skill compliant):
  - INTERNAL_SECRET is a hard barrier (server-validated shared secret).
    Retains value under Mythos-class attacker provided the value stays secret.
  - ACTION REQUIRED BEFORE RUNNING: rotate ANTHROPIC_API_KEY at
    console.anthropic.com — it was exposed in plaintext.
  - Canonical secret = de630b7dc76542de8ee02826ed7df1ed6b36b7d0f9e2aace1d57beee22129224
    (already present in api-server .env — we align Stable to match it).
"""

import sys
import os
import shutil
import difflib
from datetime import datetime
from pathlib import Path

DRY_RUN = "--apply" not in sys.argv
TS      = datetime.now().strftime("%Y%m%d_%H%M%S")
SEP     = "─" * 64

# ── canonical values ──────────────────────────────────────────────────────────
CANON_SECRET  = "de630b7dc76542de8ee02826ed7df1ed6b36b7d0f9e2aace1d57beee22129224"
R3_INTERNAL   = "http://localhost:3000"

HOME          = Path.home()
STABLE_ENV    = HOME / "Stable" / ".env"
AGI_ENV       = HOME / "Agi-Suite" / ".env"
API_ENV       = HOME / "Agi-Suite" / "apps" / "api-server" / ".env"
METRICS_TS    = HOME / "Agi-Suite" / "apps" / "api-server" / "src" / "routes" / "metrics.ts"

mode = "DRY-RUN" if DRY_RUN else "APPLY"
print(f"\n{SEP}")
print(f"  patch_link_stable_agi.py  [{mode}]")
print(SEP)

errors: list[str] = []
patches: list[tuple[Path, list[str], list[str]]] = []   # (path, original, patched)

# ── helpers ───────────────────────────────────────────────────────────────────

def read(p: Path) -> list[str]:
    print(f"\nPHASE 0 — READ  {p}")
    if not p.exists():
        raise FileNotFoundError(f"  ✖  Not found: {p}")
    lines = p.read_text(encoding="utf-8").splitlines(keepends=True)
    print(f"  ✔  {len(lines)} lines")
    return lines


def show_diff(orig: list[str], patched: list[str], name: str) -> None:
    diff = list(difflib.unified_diff(orig, patched, fromfile=f"{name} (original)",
                                     tofile=f"{name} (patched)", lineterm=""))
    if not diff:
        print("  (no changes)")
        return
    for line in diff[:60]:
        print("  " + line.rstrip())


def backup(p: Path) -> None:
    bak = p.with_name(p.name + f".bak_{TS}")
    shutil.copy2(p, bak)
    print(f"  ✔  Backup: {bak.name}")


def write(p: Path, lines: list[str]) -> None:
    p.write_text("".join(lines), encoding="utf-8")
    print(f"  ✔  Written: {p}  ({len(lines)} lines)")

# ── F1 & F2 — deduplicate INTERNAL_SECRET in .env files ──────────────────────

def dedup_secret(env_path: Path) -> None:
    orig = read(env_path)
    seen = False
    patched: list[str] = []
    changed = False
    for line in orig:
        key = line.split("=", 1)[0].strip()
        if key == "INTERNAL_SECRET":
            if seen:
                # remove duplicate
                changed = True
                continue
            # replace with canonical value regardless of which dup we kept
            canonical_line = f"INTERNAL_SECRET={CANON_SECRET}\n"
            if line.rstrip("\n") != canonical_line.rstrip("\n"):
                changed = True
            patched.append(canonical_line)
            seen = True
        else:
            patched.append(line)

    if not seen:
        # secret absent entirely — append
        patched.append(f"INTERNAL_SECRET={CANON_SECRET}\n")
        changed = True

    print(f"\nPHASE 1 — VERIFY  {env_path.name}")
    secret_lines = [l for l in patched if l.startswith("INTERNAL_SECRET=")]
    assert len(secret_lines) == 1, f"  ✖  Expected 1 INTERNAL_SECRET, got {len(secret_lines)}"
    val = secret_lines[0].split("=", 1)[1].strip()
    assert val == CANON_SECRET, f"  ✖  Secret value mismatch: {val!r}"
    print(f"  ✔  Exactly 1 INTERNAL_SECRET, value correct")

    if not changed:
        print(f"  ✔  {env_path.name} already correct — skipping")
        return

    print(f"\nPHASE 2 — DIFF  {env_path.name}")
    show_diff(orig, patched, env_path.name)

    patches.append((env_path, orig, patched))


# ── F3 — add R3_INTERNAL_URL to api-server .env ───────────────────────────────

def ensure_r3_url(env_path: Path) -> None:
    orig = read(env_path)
    has_url = any(l.startswith("R3_INTERNAL_URL=") for l in orig)
    if has_url:
        print(f"  ✔  R3_INTERNAL_URL already present — skipping")
        return
    patched = orig + [f"R3_INTERNAL_URL={R3_INTERNAL}\n"]
    print(f"\nPHASE 2 — DIFF  {env_path.name}")
    show_diff(orig, patched, env_path.name)
    patches.append((env_path, orig, patched))


# ── F4 — add warn log to fetchR3Metrics on non-ok response ───────────────────

OLD_FETCH = '''\
    if (res.ok) {
      r3Metrics = (await res.json()) as R3TimeSavings;
      broadcast();
    }
  } catch {'''

NEW_FETCH = '''\
    if (res.ok) {
      r3Metrics = (await res.json()) as R3TimeSavings;
      broadcast();
    } else {
      logger.warn(
        { status: res.status, url: `${R3_URL}/api/internal/metrics/time-savings` },
        "fetchR3Metrics: non-ok response — check INTERNAL_SECRET alignment",
      );
    }
  } catch {'''

LOGGER_IMPORT = 'import { logger } from "../lib/logger";'

def patch_metrics_ts(ts_path: Path) -> None:
    orig_lines = read(ts_path)
    orig_text  = "".join(orig_lines)

    print(f"\nPHASE 1 — VERIFY  {ts_path.name}")

    # Check anchor exists exactly once
    count = orig_text.count(OLD_FETCH)
    if count == 0:
        print(f"  ⚠  Fetch anchor not found — already patched or changed. Skipping F4.")
        return
    if count > 1:
        errors.append(f"  ✖  Fetch anchor appears {count}× in {ts_path.name} — manual review required")
        return
    print(f"  ✔  Fetch anchor found exactly once")

    # Check logger import
    has_logger = LOGGER_IMPORT in orig_text
    patched_text = orig_text

    if not has_logger:
        # Insert after first import line
        first_import_end = orig_text.index("\n", orig_text.index("import ")) + 1
        patched_text = (
            patched_text[:first_import_end]
            + LOGGER_IMPORT + "\n"
            + patched_text[first_import_end:]
        )
        print(f"  ✔  logger import will be added")
    else:
        print(f"  ✔  logger import already present")

    patched_text = patched_text.replace(OLD_FETCH, NEW_FETCH, 1)

    # Verify anchor appears 0 times in patched (replaced) and new block once
    assert patched_text.count(OLD_FETCH) == 0, "  ✖  Old anchor still present after replace"
    assert patched_text.count(NEW_FETCH) == 1, "  ✖  New block not found after replace"
    print(f"  ✔  Replacement verified")

    patched_lines = [l + "\n" for l in patched_text.splitlines()]
    # splitlines drops trailing newline — restore if original had it
    if orig_text.endswith("\n") and not patched_text.endswith("\n"):
        patched_lines[-1] = patched_lines[-1]  # already has \n from above

    print(f"\nPHASE 2 — DIFF  {ts_path.name}")
    show_diff(orig_lines, patched_lines, ts_path.name)
    patches.append((ts_path, orig_lines, patched_lines))


# ── run all patches ───────────────────────────────────────────────────────────

try:
    dedup_secret(STABLE_ENV)
    dedup_secret(AGI_ENV)
    ensure_r3_url(API_ENV)
    patch_metrics_ts(METRICS_TS)
except FileNotFoundError as e:
    print(f"\n  ✖  {e}")
    sys.exit(1)

if errors:
    print("\n\nERRORS — aborting:")
    for e in errors:
        print(e)
    sys.exit(1)

if DRY_RUN:
    print(f"\n\n{'─'*64}")
    print("  DRY-RUN complete — no files written.")
    print("  Re-run with --apply to commit.\n")
    sys.exit(0)

# ── apply ─────────────────────────────────────────────────────────────────────

print(f"\n\nPHASE 3 — BACKUP + WRITE")
for path, orig, patched in patches:
    backup(path)
    write(path, patched)

# ── post-verify ───────────────────────────────────────────────────────────────

print(f"\nPHASE 4 — POST-VERIFY")

def assert_single_secret(p: Path, expected: str) -> None:
    text = p.read_text(encoding="utf-8")
    hits = [l for l in text.splitlines() if l.startswith("INTERNAL_SECRET=")]
    assert len(hits) == 1, f"  ✖  {p.name}: {len(hits)} INTERNAL_SECRET lines"
    val = hits[0].split("=", 1)[1].strip()
    assert val == expected, f"  ✖  {p.name}: secret value wrong: {val!r}"
    print(f"  ✔  {p.name}: INTERNAL_SECRET correct, exactly once")

assert_single_secret(STABLE_ENV, CANON_SECRET)
assert_single_secret(AGI_ENV,    CANON_SECRET)
assert_single_secret(API_ENV,    CANON_SECRET)

api_text = API_ENV.read_text(encoding="utf-8")
assert f"R3_INTERNAL_URL={R3_INTERNAL}" in api_text, "  ✖  R3_INTERNAL_URL missing from api-server .env"
print(f"  ✔  api-server .env: R3_INTERNAL_URL present")

metrics_text = METRICS_TS.read_text(encoding="utf-8")
if NEW_FETCH in metrics_text:
    print(f"  ✔  metrics.ts: warn log present")
    assert OLD_FETCH not in metrics_text, "  ✖  metrics.ts: old fetch block still present"

# verify secrets match across all three
s_stable = [l.split("=",1)[1].strip() for l in STABLE_ENV.read_text().splitlines() if l.startswith("INTERNAL_SECRET=")][0]
s_api    = [l.split("=",1)[1].strip() for l in API_ENV.read_text().splitlines()    if l.startswith("INTERNAL_SECRET=")][0]
assert s_stable == s_api, f"  ✖  Secret still mismatched: Stable={s_stable[:8]}… api={s_api[:8]}…"
print(f"  ✔  Stable ↔ api-server secrets match: {s_stable[:8]}…")

print(f"\n  ✔  All post-write checks passed.")

print(f"""
PHASE 5 — NEXT STEPS

  !! IMMEDIATE: Rotate ANTHROPIC_API_KEY at console.anthropic.com
     Then update ~/Agi-Suite/apps/api-server/.env with the new key.

  Restart both services (clean ports first):

    lsof -ti:3000,3001,5173,5174 | xargs kill -9 2>/dev/null
    sleep 1
    cd ~/Stable   && pnpm dev &
    cd ~/Agi-Suite && pnpm dev

  Verify no more 401s:

    # Should be silent (no 401/500):
    sleep 10 && curl -s -o /dev/null -w "%{{http_code}}" \\
      -H "x-internal-secret: {CANON_SECRET[:8]}..." \\
      http://localhost:3000/api/internal/metrics/time-savings

  Verify SSE stream delivers R3 data:

    curl -N http://localhost:3001/api/metrics/stream

  Patch complete.
""")
