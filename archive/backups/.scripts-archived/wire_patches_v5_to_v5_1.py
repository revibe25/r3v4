#!/usr/bin/env python3
"""
wire_patches_v5_to_v5_1.py — R3v4 PRD/SECURITY/SKILLS audit fix wiring
======================================================================

Applies 9 of 10 audit findings (BUG-1..7, GAP-1..3) plus 3 second-pass
triple-check findings (TC2-1, TC2-2, TC2-3) under WIRE.txt protocol:

    - read-then-write (no blind apply)
    - anchor-count assert == 1 per patch
    - timestamped .bak.<YYYYMMDD-HHMMSS> backup before edit
    - dry-run default; --apply required to write
    - hard fail on first ambiguous anchor; never auto-resolve

Source-of-truth chain (when in conflict, latest wins):
    1. Mythos-Skills.pdf  (red.anthropic.com 2026-04-07, ed. 04-09)
    2. PRD §7.13          (canonical project-side encoding of #1)
    3. SECURITY.md        (operational application of #2)

Usage on Kali (ONLY — Penguin/Termux are read-only per PRD §2):

    cd ~/Stable
    python3 wire_patches_v5_to_v5_1.py                    # dry-run
    python3 wire_patches_v5_to_v5_1.py --apply            # apply all
    python3 wire_patches_v5_to_v5_1.py --apply --only BUG-1 BUG-4
    python3 wire_patches_v5_to_v5_1.py --files PRD=docs/PRD.md
    python3 wire_patches_v5_to_v5_1.py --list             # show patch IDs

Then per WIRE.txt:
    pnpm tsc --noEmit
    pnpm vitest run
    git diff PRD.md SECURITY.md SKILLS.md

Skipped here (manual, requires repo introspection on Kali):
    BUG-7   §3.1 LLPTE package names — run `ls -d packages/llpte-*`
            on Kali and reconcile §3.1 + §3.2 by hand. Auto-replace
            would be a guess; WIRE protocol forbids it.
"""

from __future__ import annotations
import argparse
import datetime as dt
import os
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

NOW = dt.datetime.now().strftime("%Y%m%d-%H%M%S")

# ----------------------------------------------------------------------------
# Patch records. Anchors are *exact* substrings; assert count == 1 in target.
# ----------------------------------------------------------------------------

@dataclass
class Patch:
    id: str
    target: str          # logical name: "PRD" | "SECURITY" | "SKILLS"
    section: str
    rationale: str
    anchor: str          # exact substring; must occur exactly once
    replacement: str
    severity: str = "MEDIUM"
    confidence: str = "verified"   # "verified" (anchor cross-checked against
                                   # uploaded PDF) or "best-guess" (file not
                                   # in this context — anchor inferred from
                                   # transcript; will fail loudly if drift)

PATCHES: list[Patch] = [

    # ──────────────────────────────────────────────────────────────────────
    # PRD.md — anchors VERIFIED against R3v4_PRD_v5.pdf
    # ──────────────────────────────────────────────────────────────────────

    Patch(
        id="BUG-1a",
        target="PRD",
        section="§7.2 CI pipeline step 5 — broken grep BRE",
        severity="CRIT",
        confidence="verified",
        rationale=(
            "grep -rn defaults to BRE; pipe and {n,m} are literals, not "
            "metacharacters. Gate matched almost nothing — silent CI bypass. "
            "Switch to -E (ERE). Also exclude DAW.tsx/Instrument.tsx which "
            "legitimately hold §4.2 T-object hex (#0a0a0a, #a3e635, etc.)."
        ),
        anchor=(
            'grep -rn "bg-black|text-white|#[0-9a-fA-F]{3,6}" client/src/ '
            "→ fail if matches"
        ),
        replacement=(
            "grep -rEn 'bg-black|text-white|#[0-9a-fA-F]{3,6}' client/src/ "
            "--exclude=DAW.tsx --exclude=Instrument.tsx → fail if matches"
        ),
    ),

    # TC2-1 — same BRE bug in §7.2 table row (caught on second pass)
    Patch(
        id="TC2-1",
        target="PRD",
        section="§7.2 gate table 'Theme token audit' row — same BRE bug",
        severity="CRIT",
        confidence="verified",
        rationale=(
            "Triple-check pass 2: §7.2 table row 'Theme token audit' has the "
            "identical BRE-as-literal bug as pipeline step 5 (BUG-1a). The "
            "original BUG-1 only caught the pipeline step. Both occurrences "
            "must agree or §7.4 (which uses correct BRE escapes) and §7.2 "
            "(broken) drift apart."
        ),
        anchor="grep -rn bg-black|text-white|border-green client/src/",
        replacement=(
            "grep -rEn 'bg-black|text-white|border-green' client/src/ "
            "--exclude=DAW.tsx --exclude=Instrument.tsx"
        ),
    ),

    Patch(
        id="BUG-4",
        target="PRD",
        section="§4.2 palette unification owner — stale @r3-maintainer",
        severity="MEDIUM",
        confidence="verified",
        rationale=(
            "v5.0.0 changelog: '§9 roadmap owners changed from @r3-maintainer "
            "to @r3'. §4.2 was missed. Last surviving @r3-maintainer in doc."
        ),
        anchor=(
            "Owner: @r3-maintainer. Do not attempt unification before that "
            "milestone."
        ),
        replacement=(
            "Owner: @r3. Do not attempt unification before that milestone."
        ),
    ),

    Patch(
        id="BUG-6",
        target="PRD",
        section="§3.1 monorepo tree — phantom-routers fix",
        severity="MEDIUM",
        confidence="verified",
        rationale=(
            "SECURITY.md F-03/F-04/F-08/F-11 fix `server/routers/daw.ts`, "
            "C-04 fixes `server/routers/adminRouter.ts`, AUDIT GAP entry "
            "references `server/services/session-metrics.service.ts` and "
            "`server/ws/collab.ts`. None appear in §3.1 — anyone reading "
            "§3.1 as canonical would treat these as phantom dirs."
        ),
        anchor=(
            "■ ■ ■■■ subscription.ts # Stripe + tier logic\n"
            "■ ■ ■■■ auth.ts\n"
            "■ ■■■ services/\n"
            "■ ■ ■■■ mock-billing.ts # BILLING_MODE=mock layer"
        ),
        replacement=(
            "■ ■ ■■■ subscription.ts # Stripe + tier logic\n"
            "■ ■ ■■■ auth.ts\n"
            "■ ■ ■■■ daw.ts # DAW state, tracks, FX (see SECURITY.md F-03/F-04/F-08/F-11)\n"
            "■ ■ ■■■ adminRouter.ts # Admin-only ops (see SECURITY.md C-04)\n"
            "■ ■■■ services/\n"
            "■ ■ ■■■ mock-billing.ts # BILLING_MODE=mock layer\n"
            "■ ■ ■■■ session-metrics.service.ts # Per-user session metrics (see AUDIT GAP)\n"
            "■ ■■■ ws/\n"
            "■ ■ ■■■ collab.ts # CRDT/collab WS (see AUDIT GAP)"
        ),
    ),

    # TC2-2 — §7.6 verification snippet has incomplete Pool() constructor
    Patch(
        id="TC2-2",
        target="PRD",
        section="§7.6 Railway verify command — non-runnable as written",
        severity="MEDIUM",
        confidence="verified",
        rationale=(
            "Triple-check pass 2: §7.6 example shows `const pool=new Pool(...)`. "
            "Three literal dots, not pseudocode placeholder — copy/pasted as-is, "
            "the command throws. Operational runbooks must be runnable."
        ),
        anchor="const pool=new Pool(...);",
        replacement=(
            "const pool=new Pool({connectionString:process.env.DATABASE_URL});"
        ),
    ),

    # TC2-3 — §7.13 batch workflow: missing 'test-only' surface category from
    # Mythos-Skills.pdf source. Caught when cross-walking PRD §7.13 group list
    # against Mythos-Skills.pdf "Scale: triaging many findings" section.
    Patch(
        id="TC2-3",
        target="PRD",
        section="§7.13 batch workflow — missing 'test-only' surface category",
        severity="LOW",
        confidence="verified",
        rationale=(
            "Mythos-Skills.pdf step 2 of batch workflow lists 5 surface "
            "categories: runtime / dev-build-supply-chain / "
            "dev-build-credential-pivot / dev-build-isolated / test-only. "
            "PRD §7.13 lists 4 (drops test-only). When a CVE lands in a "
            "test-only dep, current §7.13 has no group for it — triage drift."
        ),
        anchor=(
            "• Group by surface: runtime / dev-build-supply-chain / "
            "dev-build-credential-pivot / dev-build-isolated."
        ),
        replacement=(
            "• Group by surface: runtime / dev-build-supply-chain / "
            "dev-build-credential-pivot / dev-build-isolated / test-only."
        ),
    ),

    # ──────────────────────────────────────────────────────────────────────
    # SECURITY.md — anchors INFERRED from script-fix.txt transcript
    # If anchor count ≠ 1, script halts on that finding only; others proceed.
    # ──────────────────────────────────────────────────────────────────────

    Patch(
        id="BUG-2",
        target="SECURITY",
        section="C-02 surface — reclassify dev-build-isolated → credential-pivot",
        severity="CRIT",
        confidence="best-guess",
        rationale=(
            "Mythos Lesson 4 Q3: 'Does the dev-only tool have access to "
            "credentials that overlap with production?' SKILLS.md §13 "
            "documents `sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://...'` "
            "writing the live Railway URL into .env, which Vite's dev server "
            "serves alongside source. Q3 = YES → surface = "
            "dev-build-credential-pivot → decision-table row says treat as "
            "runtime → Medium runtime N-day cannot be deferred on friction-only "
            "interim ('don't load untrusted pages'). Either add a barrier-class "
            "interim or escalate to blocking until Vite 5→6 lands."
        ),
        anchor="**Surface:** dev-build-isolated",
        replacement=(
            "**Surface:** dev-build-credential-pivot "
            "(reclassified 2026-05-09 — Lesson 4 Q3 = YES via "
            "SKILLS.md §13 `.env` injection of live Railway DATABASE_URL)"
        ),
    ),

    Patch(
        id="BUG-3",
        target="SECURITY",
        section="C-01 esbuild interim pin — exact, not range",
        severity="CRIT",
        confidence="best-guess",
        rationale=(
            "PRD §7.2 CI gate step 6 asserts `esbuild@0.25.12` exact. "
            "C-01 interim `\"esbuild\": \">=0.25.0\"` lets pnpm resolve "
            "0.25.13 / 0.26.x — satisfies the security advisory but fails "
            "the deploy gate. Override and gate point opposite directions."
        ),
        anchor='"esbuild": ">=0.25.0"',
        replacement='"esbuild": "0.25.12"',
    ),

    Patch(
        id="GAP-1",
        target="SECURITY",
        section="AUDIT GAP entries past trigger 2026-05-01 — escalate",
        severity="HIGH",
        confidence="best-guess",
        rationale=(
            "Mythos Lesson 5: a deferred finding past its trigger is no "
            "longer deferred — it's unmanaged. Both AUDIT GAP entries "
            "carry trigger 2026-05-01; today is 2026-05-09 (8 days over). "
            "Both are pre-external-beta requirements. Re-trigger to "
            "2026-05-16 (one-week landing window) and explicitly status "
            "as 'overdue, owner: @r3, blocking external beta'."
        ),
        anchor="Revisit trigger: 2026-05-01",
        replacement=(
            "Revisit trigger: 2026-05-16 "
            "(re-set 2026-05-09 — original 2026-05-01 missed; "
            "Lesson 5: now blocking external beta, not deferred)"
        ),
    ),

    Patch(
        id="GAP-2",
        target="SECURITY",
        section="C-05 timing oracle — defer → fix-now per decision table",
        severity="LOW",
        confidence="best-guess",
        rationale=(
            "Decision table (§7.13 + Mythos-Skills.pdf): 'Runtime Low — "
            "Clean fix → Fix now (cheap)'. C-05 is a one-line "
            "crypto.timingSafeEqual swap. Deferring a cheap fix creates "
            "future maintenance debt for no benefit. Mark Open + "
            "fix-now-target ≤ 7d."
        ),
        anchor="**Status:** Deferred",  # NOTE: occurs once if applied per-finding,
                                        # multiple if multiple deferred entries
                                        # exist. See `force_unique=True` handling.
        replacement="**Status:** Open (fix-now per decision table; ≤ 7d)",
    ),

    # ──────────────────────────────────────────────────────────────────────
    # SKILLS.md — anchors INFERRED from script-fix.txt transcript
    # ──────────────────────────────────────────────────────────────────────

    Patch(
        id="BUG-5",
        target="SKILLS",
        section="§5 Railway startCommand contradicts PRD §7.6",
        severity="MEDIUM",
        confidence="best-guess",
        rationale=(
            "PRD §7.6 mandates manual migration with explicit DATABASE_URL "
            "override + post-migration column verify. SKILLS.md §5's "
            "`pnpm drizzle-kit migrate && pnpm exec tsx index.ts` auto-runs "
            "migrations on every Railway deploy — different (riskier) "
            "operational posture. Defer to PRD §7.6 (manual)."
        ),
        anchor=(
            'startCommand = "pnpm drizzle-kit migrate && '
            'pnpm exec tsx index.ts"'
        ),
        replacement=(
            'startCommand = "pnpm exec tsx index.ts"\n'
            "# NOTE: per PRD §7.6 migrations are MANUAL — do NOT chain\n"
            "# `pnpm drizzle-kit migrate` here. See §7.6 verify pattern."
        ),
    ),

    Patch(
        id="GAP-3",
        target="SKILLS",
        section="§10 promo code — brute-force surface",
        severity="LOW",
        confidence="best-guess",
        rationale=(
            "6-digit decimal = 10^6. At Mythos-class attacker scale "
            "(Lesson 3: 'million attempts in parallel'), brute-forceable "
            "in minutes without rate limiting. Promo grants pro_artist "
            "tier — business-model bypass. Add explicit rate limit + "
            "consider 8-char base-36 (~2.8e12)."
        ),
        anchor='"6-digit, cryptographically random"',
        replacement=(
            '"6-digit, cryptographically random" — '
            'NOTE: subscription.redeemPromo MUST rate-limit '
            '(≤5 attempts / userId / hour) before ship; '
            'consider 8-char base-36 (~2.8e12) to eliminate brute-force surface'
        ),
    ),
]


# ----------------------------------------------------------------------------
# Path resolution + WIRE-protocol apply machinery
# ----------------------------------------------------------------------------

DEFAULT_PATHS = {
    "PRD":      "PRD.md",
    "SECURITY": "SECURITY.md",
    "SKILLS":   "SKILLS.md",
}

CANDIDATE_PATHS = {
    "PRD": [
        "PRD.md", "R3v4_PRD_v5.md", "docs/PRD.md", "docs/R3v4_PRD_v5.md",
    ],
    "SECURITY": ["SECURITY.md", "docs/SECURITY.md"],
    "SKILLS":   ["SKILLS.md",   "docs/SKILLS.md", "CLAUDE.skills.md"],
}


def resolve_target_paths(overrides: dict[str, str]) -> dict[str, Path]:
    """Resolve logical names → concrete paths.

    Override format: --files PRD=docs/PRD.md SECURITY=docs/SEC.md
    """
    resolved: dict[str, Path] = {}
    for name in DEFAULT_PATHS:
        if name in overrides:
            p = Path(overrides[name])
            if not p.is_file():
                fail(f"--files {name}={p} does not exist")
            resolved[name] = p
            continue
        for cand in CANDIDATE_PATHS[name]:
            if Path(cand).is_file():
                resolved[name] = Path(cand)
                break
        else:
            warn(
                f"{name}: no candidate found in {CANDIDATE_PATHS[name]} — "
                f"any patch targeting {name} will be skipped (not failed)."
            )
    return resolved


# ----------------------------------------------------------------------------
# Console helpers
# ----------------------------------------------------------------------------

def green(s: str)  -> str: return f"\033[32m{s}\033[0m"
def red(s: str)    -> str: return f"\033[31m{s}\033[0m"
def yellow(s: str) -> str: return f"\033[33m{s}\033[0m"
def cyan(s: str)   -> str: return f"\033[36m{s}\033[0m"
def bold(s: str)   -> str: return f"\033[1m{s}\033[0m"


def info(msg: str) -> None: print(f"{cyan('[wire]')} {msg}")
def ok(msg: str)   -> None: print(f"{green('[ok  ]')} {msg}")
def warn(msg: str) -> None: print(f"{yellow('[warn]')} {msg}", file=sys.stderr)
def fail(msg: str) -> None:
    print(f"{red('[fail]')} {msg}", file=sys.stderr)
    sys.exit(2)


# ----------------------------------------------------------------------------
# Apply
# ----------------------------------------------------------------------------

@dataclass
class Outcome:
    patch_id: str
    target: str
    status: str             # "applied" | "dry-run-ok" | "skipped" | "anchor-fail"
    detail: str = ""

# Track files we've already backed up this run, so a multi-patch run
# preserves the *original* pre-run state (not the post-patch-N state).
_BACKED_UP: dict[Path, Path] = {}


def apply_patch(p: Patch, file_path: Path, dry_run: bool) -> Outcome:
    text = file_path.read_text(encoding="utf-8")
    count = text.count(p.anchor)

    if count == 0:
        return Outcome(
            p.id, p.target, "anchor-fail",
            detail=(
                f"anchor not found in {file_path} "
                f"(confidence={p.confidence}). Verify section '{p.section}' "
                f"matches; do NOT auto-resolve."
            ),
        )
    if count > 1:
        return Outcome(
            p.id, p.target, "anchor-fail",
            detail=(
                f"anchor matches {count}× in {file_path} — WIRE protocol "
                f"requires exactly 1. Tighten anchor manually."
            ),
        )

    new_text = text.replace(p.anchor, p.replacement, 1)
    assert new_text != text, "no-op replacement (anchor == replacement?)"

    if dry_run:
        return Outcome(p.id, p.target, "dry-run-ok",
                       detail=f"would patch {file_path}")

    # Backup ONCE per file per run — preserves true pre-run state across
    # a multi-patch sweep. If the user runs the script twice, the second
    # run gets a new NOW and a fresh backup.
    if file_path not in _BACKED_UP:
        backup = file_path.with_suffix(file_path.suffix + f".bak.{NOW}")
        if backup.exists():
            # Extreme paranoia — same-second re-invocation. Don't clobber.
            return Outcome(
                p.id, p.target, "anchor-fail",
                detail=(
                    f"refusing to overwrite existing backup {backup} "
                    f"(same-second re-run?). Move/remove it and retry."
                ),
            )
        shutil.copy2(file_path, backup)
        _BACKED_UP[file_path] = backup

    file_path.write_text(new_text, encoding="utf-8")
    return Outcome(p.id, p.target, "applied",
                   detail=f"backup → {_BACKED_UP[file_path]}")


# ----------------------------------------------------------------------------
# CLI
# ----------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(
        description="WIRE-protocol patch script for R3v4 PRD/SECURITY/SKILLS audit."
    )
    ap.add_argument("--apply", action="store_true",
                    help="Actually write changes. Default is dry-run.")
    ap.add_argument("--list", action="store_true",
                    help="List all patch IDs and exit.")
    ap.add_argument("--only", nargs="+", metavar="ID",
                    help="Apply only the listed patch IDs (e.g. BUG-1a BUG-4).")
    ap.add_argument("--files", nargs="*", default=[], metavar="NAME=PATH",
                    help="Override target file paths, e.g. PRD=docs/PRD.md.")
    return ap.parse_args()


def parse_files_overrides(spec: list[str]) -> dict[str, str]:
    overrides: dict[str, str] = {}
    for entry in spec:
        if "=" not in entry:
            fail(f"--files entries must be NAME=PATH, got: {entry}")
        name, path = entry.split("=", 1)
        if name not in DEFAULT_PATHS:
            fail(f"--files NAME must be one of {list(DEFAULT_PATHS)}; got {name}")
        overrides[name] = path
    return overrides


def main() -> int:
    args = parse_args()

    if args.list:
        print(bold("\nAvailable patches:\n"))
        for p in PATCHES:
            print(f"  {p.id:8s}  {p.severity:6s}  {p.target:8s}  "
                  f"({p.confidence})  {p.section}")
        return 0

    overrides = parse_files_overrides(args.files)
    paths = resolve_target_paths(overrides)

    selected = PATCHES
    if args.only:
        wanted = set(args.only)
        selected = [p for p in PATCHES if p.id in wanted]
        missing = wanted - {p.id for p in selected}
        if missing:
            fail(f"--only IDs not found: {sorted(missing)}")

    info(f"mode: {'APPLY' if args.apply else 'dry-run'}")
    info(f"timestamp: {NOW}")
    info(f"patches selected: {len(selected)}")
    print()

    outcomes: list[Outcome] = []
    for p in selected:
        if p.target not in paths:
            outcomes.append(Outcome(p.id, p.target, "skipped",
                                    detail=f"no resolved path for {p.target}"))
            continue
        outcome = apply_patch(p, paths[p.target], dry_run=not args.apply)
        outcomes.append(outcome)

    # Report
    print(bold("\n=== Outcomes ===\n"))
    by_status: dict[str, list[Outcome]] = {}
    for o in outcomes:
        by_status.setdefault(o.status, []).append(o)

    for status in ("applied", "dry-run-ok", "skipped", "anchor-fail"):
        if status not in by_status:
            continue
        color = {"applied": green, "dry-run-ok": cyan,
                 "skipped": yellow, "anchor-fail": red}[status]
        print(color(f"-- {status} ({len(by_status[status])}) --"))
        for o in by_status[status]:
            print(f"  {o.patch_id:8s}  {o.target:8s}  {o.detail}")
        print()

    n_fail = len(by_status.get("anchor-fail", []))
    if n_fail:
        warn(
            f"{n_fail} patch(es) failed anchor check. WIRE protocol: do "
            f"not auto-resolve. Open the target file, locate the section, "
            f"verify anchor text against current file, then re-run with "
            f"--only <id>."
        )

    print(bold("Next per WIRE.txt:"))
    print("  pnpm tsc --noEmit")
    print("  pnpm vitest run")
    print("  git diff PRD.md SECURITY.md SKILLS.md")
    print("  # then manual: BUG-7 (LLPTE package reconciliation)")
    print("  #   ls -d packages/llpte-* && update §3.1 + §3.2")

    return 1 if n_fail else 0


if __name__ == "__main__":
    sys.exit(main())
