#!/usr/bin/env python3
"""
R3 v4 — Mix Suggestion System: Gap-close + AIMixingService wire-in
====================================================================

Phase 1 — latencyMs gap-close + deprecate orphan router (~12 lines)
  1. server/routers/daw.ts        — measure t0/latencyMs in 'ai.suggestions'
                                     return { suggestions, latencyMs }
  2. client/src/hooks/useMixSuggestions.ts
                                  — read data.latencyMs in onSuccess,
                                     pass to recordDecision instead of 0
  3. server/routers/aiMix.router.ts
                                  — @deprecated JSDoc + module-load warn

Phase 2 — Path C hybrid: AIMixingService for channels + heuristic for rest
  1. services/ai-mix/src/genreInference.ts (NEW)
                                  — inferGenreFromBpm() with explicit profile table
  2. services/ai-mix/src/index.ts — re-export inferGenreFromBpm
  3. server/routers/daw.ts        — call AIMixingService.analyze() with
                                     ctx.mixerEngine.getState(),
                                     map AIMixSuggestion[] → MixSuggestion[],
                                     merge with runLLPTEAnalysis() output

Apply logic for channel suggestions is DEFERRED to a later commit (commit 3)
per architectural decision — touching useDAWStore without auditing its
contract surface is the same trap that produced failed patches earlier.

Usage:
    python3 r3_mix_suggest.py                      # dry run, both phases
    python3 r3_mix_suggest.py --phase=1            # dry-run phase 1 only
    python3 r3_mix_suggest.py --phase=1 --apply    # apply phase 1
    python3 r3_mix_suggest.py --phase=both --apply # apply both phases

Run from: ~/Stable/
"""

import sys
import shutil
import argparse
from pathlib import Path
from datetime import datetime

parser = argparse.ArgumentParser(description="R3 Mix Suggestion delivery")
parser.add_argument(
    "--phase",
    choices=["1", "2", "both"],
    default="both",
    help="Which phase to run (default: both)",
)
parser.add_argument("--apply", action="store_true", help="Apply (default: dry run)")
args = parser.parse_args()
DRY = not args.apply
PHASES = {"1": [1], "2": [2], "both": [1, 2]}[args.phase]

ROOT = Path.home() / "Stable"
BACKUP_DIR = ROOT / ".patch-backups" / datetime.now().strftime(
    "r3-mix-suggest-%Y%m%dT%H%M%S"
)
APPLIED: list[str] = []
ERRORS: list[str] = []
SKIPPED: list[str] = []


# ─── Helpers ──────────────────────────────────────────────────────────────────

def section(title: str) -> None:
    print(f"\n{'═' * 72}")
    print(f"  {title}")
    print(f"{'═' * 72}")


def _backup(path: Path) -> None:
    if DRY or not path.exists():
        return
    rel = path.relative_to(ROOT)
    dest = BACKUP_DIR / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)


def write_file(relpath: str, content: str, label: str = "") -> bool:
    path = ROOT / relpath
    tag = label or relpath
    if DRY:
        print(f"  [DRY] Would write: {relpath}")
        return True
    _backup(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    print(f"  WROTE   {relpath}")
    APPLIED.append(tag)
    return True


def patch_file(
    relpath: str,
    old: str,
    new: str,
    label: str = "",
    marker: str = "",
) -> bool:
    """Exact-match patch with idempotency marker.

    `marker` is a string unique to the new content; if found in the file,
    the patch is skipped (already applied).
    """
    path = ROOT / relpath
    tag = label or relpath
    if not path.exists():
        msg = f"File not found: {relpath}"
        print(f"  ✗ FAIL  {msg}")
        ERRORS.append(msg)
        return False
    content = path.read_text(encoding="utf-8")

    if marker and marker in content:
        skipmsg = f"{relpath} — already applied ({marker[:60]!r})"
        print(f"  ~       {skipmsg}")
        SKIPPED.append(skipmsg)
        return True

    count = content.count(old)
    if count == 0:
        msg = (
            f"Patch target not found in {relpath}\n"
            f"             Looking for: {old[:120]!r}"
        )
        print(f"  ✗ FAIL  {msg}")
        ERRORS.append(msg)
        return False
    if count > 1:
        msg = f"Ambiguous ({count}×) in {relpath}: {old[:80]!r}"
        print(f"  ✗ FAIL  {msg}")
        ERRORS.append(msg)
        return False
    if DRY:
        print(f"  [DRY] Would patch: {relpath}")
        return True
    _backup(path)
    path.write_text(content.replace(old, new, 1), encoding="utf-8")
    print(f"  PATCHED {relpath}")
    APPLIED.append(tag)
    return True


# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 1 — latencyMs gap-close + deprecate orphan router
# ══════════════════════════════════════════════════════════════════════════════

# ── 1A. server/routers/daw.ts: 'ai.suggestions' returns latencyMs ─────────────
#
# Anchor verified against real file content (sed -n 200,496p):
#
#   'ai.suggestions': protectedProcedure
#     .input(z.object({
#       tracks:   z.array(TrackSchema),
#       bpm:      z.number().min(40).max(240),
#       position: z.number().min(0),
#     }))
#     .mutation(async ({ ctx, input }) => {
#       requireTier(ctx, 'creator');
#       const { suggestions } = await runLLPTEAnalysis(input.tracks, input.bpm);
#       return { suggestions };
#     }),
#
# Replace the whole mutation body with a t0-measured version that returns
# both suggestions and latencyMs. The anchor below is the full handler
# body (3 lines) — uniquely contextualized so we don't accidentally match
# the very similar 'ai.analyse' handler above it.

DAW_LATENCY_BEFORE = """\
  // ── ai.suggestions ───────────────────────────────────────────────────────────
  'ai.suggestions': protectedProcedure
    .input(z.object({
      tracks:   z.array(TrackSchema),
      bpm:      z.number().min(40).max(240),
      position: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      requireTier(ctx, 'creator');
      const { suggestions } = await runLLPTEAnalysis(input.tracks, input.bpm);
      return { suggestions };
    }),"""

DAW_LATENCY_AFTER = """\
  // ── ai.suggestions ───────────────────────────────────────────────────────────
  // PRD §8.5 — latencyMs returned so the client can log it to aiDecisionLog
  // for performance tracking. Previously hardcoded to 0 in the hook.
  'ai.suggestions': protectedProcedure
    .input(z.object({
      tracks:   z.array(TrackSchema),
      bpm:      z.number().min(40).max(240),
      position: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      requireTier(ctx, 'creator');
      const t0 = Date.now();
      const { suggestions } = await runLLPTEAnalysis(input.tracks, input.bpm);
      const latencyMs = Date.now() - t0;
      return { suggestions, latencyMs };
    }),"""

# ── 1B. client/src/hooks/useMixSuggestions.ts: pass real latencyMs ────────────
#
# Anchor verified against the 185-line hook. The line `latencyMs:  0,`
# appears once inside the recordDecision mutateAsync call. We change it to
# read from the response object, which is now `{ suggestions, latencyMs }`.
#
# Strategy: replace the const declaration `const newSuggestions = data.suggestions as MixSuggestion[];`
# to also grab latencyMs, then change the hardcoded `latencyMs: 0` to use it.
#
# Two patches because they're at different positions in the function.

HOOK_LATENCY_DESTRUCTURE_BEFORE = """\
    onSuccess: async (data) => {
      const newSuggestions = data.suggestions as MixSuggestion[];
      setSuggestions(newSuggestions);"""

HOOK_LATENCY_DESTRUCTURE_AFTER = """\
    onSuccess: async (data) => {
      const newSuggestions = data.suggestions as MixSuggestion[];
      // PRD §8.5 — server returns real measured latency for aiDecisionLog
      const latencyMs      = (data as { latencyMs?: number }).latencyMs ?? 0;
      setSuggestions(newSuggestions);"""

HOOK_LATENCY_FIELD_BEFORE = """\
              outcome:    "ignored",
              latencyMs:  0,
            })"""

HOOK_LATENCY_FIELD_AFTER = """\
              outcome:    "ignored",
              latencyMs:  latencyMs,
            })"""

# ── 1C. server/routers/aiMix.router.ts: @deprecated JSDoc + warn ──────────────
#
# Anchor: the export keyword. `export const aiMixRouter = router({` is unique.
# We add a JSDoc block before it AND a one-time runtime warn on module load.
#
# We don't delete the router — that would be destructive without a migration
# plan for INTERNAL_SECRET callers. We just signal deprecation clearly.

AIMIX_DEPRECATE_BEFORE = """\
const aiService = new AIMixingService();

// Confidence gates — CLAUDE.md LLPTE contract (PRD §8.5)
const CONFIDENCE_AUTO_APPLY = 0.65;
const CONFIDENCE_SUGGEST    = 0.40;

export const aiMixRouter = router({"""

AIMIX_DEPRECATE_AFTER = """\
const aiService = new AIMixingService();

// Confidence gates — CLAUDE.md LLPTE contract (PRD §8.5)
const CONFIDENCE_AUTO_APPLY = 0.65;
const CONFIDENCE_SUGGEST    = 0.40;

// ── DEPRECATION ──────────────────────────────────────────────────────────────
// This router is unused. The active mix suggestion path is `daw.ai.suggestions`
// (server/routers/daw.ts) which the client hook calls directly. Decision logging
// for that path happens client-side via `sessionMetrics.recordDecision`.
//
// Kept for now because:
//   - aiMix.recordOutcome may have INTERNAL_SECRET callers we haven't audited
//   - AIMixingService is wired into daw.ai.suggestions (Phase 2) and will
//     evolve from this surface
//
// Do not add new procedures here. Migrate any new client work to daw.* router.
process.stderr.write(
  "[deprecation] server/routers/aiMix.router.ts is loaded but unused. " +
  "Use daw.ai.suggestions instead.\\n",
);

/** @deprecated Use `dawRouter` (`daw.ai.suggestions`) instead. */
export const aiMixRouter = router({"""

# ══════════════════════════════════════════════════════════════════════════════
#  PHASE 2 — Path C hybrid: AIMixingService for channels + heuristic for rest
# ══════════════════════════════════════════════════════════════════════════════

# ── 2A. services/ai-mix/src/genreInference.ts (NEW) ──────────────────────────
#
# Mastery-level: BPM-driven genre profile table that is swappable later
# when sessionMetrics gains a `genre` column. Same call site, different source.
# Profile table is data-driven and easy to extend without code changes.

GENRE_INFERENCE_TS = '''\
/**
 * services/ai-mix/src/genreInference.ts
 *
 * BPM-based genre inference for AIMixingService.
 *
 * This is a transitional component. Once sessionMetrics gains a `genre`
 * column, callers should prefer `session.genre ?? inferGenreFromBpm(bpm)`.
 * The function is data-driven (profile table at the top of the file) so
 * adjustments don't require code review of the inference logic itself.
 *
 * Genre keys match AIMixingService's `genreHeadroom` table:
 *   electronic | hiphop | jazz | classical | rock
 *
 * Profile boundaries informed by:
 *   - Beatport BPM ranges per subgenre (techno 125-135, house 118-130)
 *   - DJ TechTools tempo charts
 *   - Common DAW tempo conventions
 */

export type Genre = "electronic" | "hiphop" | "jazz" | "classical" | "rock";

interface GenreProfile {
  /** Inclusive BPM range */
  readonly minBpm: number;
  readonly maxBpm: number;
  readonly genre: Genre;
  /** Documentation only — not used at runtime */
  readonly description: string;
}

/**
 * Profile table — order matters: first matching range wins.
 * Designed so the most common DAW tempos (120-140) resolve to "electronic"
 * which is the safest default for R3's primary user (techno/house DJs).
 */
const GENRE_PROFILES: readonly GenreProfile[] = [
  { minBpm:   0, maxBpm:  69, genre: "classical",  description: "Slow / orchestral / ambient" },
  { minBpm:  70, maxBpm:  99, genre: "hiphop",     description: "Hip-hop / trap / R&B"        },
  { minBpm: 100, maxBpm: 114, genre: "rock",       description: "Rock / pop / mid-tempo"      },
  { minBpm: 115, maxBpm: 145, genre: "electronic", description: "House / techno / DnB low end"},
  { minBpm: 146, maxBpm: 175, genre: "electronic", description: "DnB / hardcore / fast techno"},
  { minBpm: 176, maxBpm: 999, genre: "electronic", description: "Speedcore / gabber"          },
];

/** Default genre when BPM is invalid or unmatched (shouldn't happen with the table above) */
const FALLBACK_GENRE: Genre = "electronic";

/**
 * Infer genre from BPM using the static profile table.
 *
 * @param bpm  Beats per minute. Clamped to >= 0; non-finite values fall back.
 * @returns    A Genre string matching AIMixingService's headroom table.
 *
 * @example
 *   inferGenreFromBpm(128)  // "electronic"  (techno)
 *   inferGenreFromBpm(85)   // "hiphop"
 *   inferGenreFromBpm(60)   // "classical"
 *   inferGenreFromBpm(NaN)  // "electronic"  (fallback)
 */
export function inferGenreFromBpm(bpm: number): Genre {
  if (!Number.isFinite(bpm) || bpm < 0) return FALLBACK_GENRE;
  for (const profile of GENRE_PROFILES) {
    if (bpm >= profile.minBpm && bpm <= profile.maxBpm) {
      return profile.genre;
    }
  }
  return FALLBACK_GENRE;
}

/** Exposed for testing — readonly view of the profile table */
export const GENRE_PROFILE_TABLE: readonly GenreProfile[] = GENRE_PROFILES;
'''

# ── 2B. services/ai-mix/src/index.ts: add export ──────────────────────────────
#
# The current index.ts is 138 bytes — small enough to safely append. We don't
# overwrite it; we read existing content and append our new export only if
# not already present. Idempotency: checked by patch_file's marker.
#
# Anchor: end of file. Since we don't know the exact contents, we use a
# trailing-newline anchor that's guaranteed to be present in any well-formed
# TS file. Better strategy: read it and append.

# We'll read the existing index.ts dynamically in main(). For now define the
# line we need to add:
INDEX_EXPORT_LINE = (
    'export { inferGenreFromBpm, GENRE_PROFILE_TABLE } from "./genreInference";\n'
)

# ── 2C. server/routers/daw.ts: hybrid path in 'ai.suggestions' ────────────────
#
# This MUST be applied AFTER Phase 1A (which already changed the mutation body
# to include latencyMs). The Phase 2 anchor is the Phase-1-modified version.
#
# We add:
#   1. Two imports at the top (AIMixingService + inferGenreFromBpm)
#   2. A module-level singleton `aiMixService = new AIMixingService()`
#   3. New mutation body that runs both engines and merges results
#
# Idempotency markers ensure we don't double-apply.

# Step 2C-i: Add imports after the existing drizzle-orm import
DAW_IMPORTS_BEFORE = """\
import { eq, and, desc, isNull } from 'drizzle-orm';"""

DAW_IMPORTS_AFTER = """\
import { eq, and, desc, isNull } from 'drizzle-orm';

// Phase 2 — AIMixingService hybrid path for channel-level suggestions.
// runLLPTEAnalysis() (defined below) still produces mix-wide suggestions
// (mastering / rhythm / pan); AIMixingService produces per-channel gain
// suggestions from the live mixer state.
import { AIMixingService }    from '../../services/ai-mix/src/AIMixingService';
import { inferGenreFromBpm }  from '../../services/ai-mix/src/genreInference';

const aiMixService = new AIMixingService();"""

# Step 2C-ii: Replace the latency-ified mutation body with the hybrid version.
# Anchor is the EXACT body produced by Phase 1A. If Phase 1 hasn't run, this
# patch will fail with a clear "target not found" message — that's correct.

DAW_HYBRID_BEFORE = """\
  // ── ai.suggestions ───────────────────────────────────────────────────────────
  // PRD §8.5 — latencyMs returned so the client can log it to aiDecisionLog
  // for performance tracking. Previously hardcoded to 0 in the hook.
  'ai.suggestions': protectedProcedure
    .input(z.object({
      tracks:   z.array(TrackSchema),
      bpm:      z.number().min(40).max(240),
      position: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      requireTier(ctx, 'creator');
      const t0 = Date.now();
      const { suggestions } = await runLLPTEAnalysis(input.tracks, input.bpm);
      const latencyMs = Date.now() - t0;
      return { suggestions, latencyMs };
    }),"""

DAW_HYBRID_AFTER = """\
  // ── ai.suggestions ───────────────────────────────────────────────────────────
  // PRD §8.5 — latencyMs returned so the client can log it to aiDecisionLog
  // for performance tracking. Previously hardcoded to 0 in the hook.
  //
  // Phase 2 hybrid: TWO engines produce suggestions in parallel, merged at the
  // end. Both run safely concurrent (no shared mutable state):
  //   1. runLLPTEAnalysis()       — heuristic, mix-wide (mastering/rhythm/pan)
  //                                  consumes the hook's flat track payload
  //   2. AIMixingService.analyze() — genre-aware engine, channel-level gain
  //                                  consumes ctx.mixerEngine.getState()
  //
  // If the AIMixingService call fails (model endpoint down, missing channels,
  // etc.), the heuristic suggestions still ship — the user sees a degraded but
  // functional response. The service itself never throws (see its docstring).
  'ai.suggestions': protectedProcedure
    .input(z.object({
      tracks:   z.array(TrackSchema),
      bpm:      z.number().min(40).max(240),
      position: z.number().min(0),
    }))
    .mutation(async ({ ctx, input }) => {
      requireTier(ctx, 'creator');
      const t0 = Date.now();

      // Run both engines in parallel
      const [heuristicResult, aiResult] = await Promise.all([
        runLLPTEAnalysis(input.tracks, input.bpm),
        (async () => {
          try {
            return await aiMixService.analyze({
              mixerState:           ctx.mixerEngine.getState(),
              genre:                inferGenreFromBpm(input.bpm),
              targetLoudness:       -14, // streaming default; UI-controllable later
              enableStemSeparation: false,
            });
          } catch (err) {
            // Defence in depth — service is documented as non-throwing, but
            // we never want a model endpoint glitch to fail the whole call.
            process.stderr.write(
              `[ai.suggestions] AIMixingService failed (heuristic still served): ${String(err)}\\n`,
            );
            return null;
          }
        })(),
      ]);

      // Map AIMixingService output (channel-level) → MixSuggestion shape
      const aiSuggestions = (aiResult?.suggestions ?? []).map((s) => ({
        type:        'mix' as const,
        confidence:  Math.max(0, Math.min(1, s.confidence)),
        description: `${s.channelId}: ${s.paramId} → ${s.suggestedValue.toFixed(2)} (${s.rationale})`,
        params: {
          source:         'ai-mix' as const,
          channelId:      s.channelId,
          paramId:        s.paramId,
          suggestedValue: s.suggestedValue,
          rationale:      s.rationale,
        },
      }));

      // Merge: heuristic suggestions first (mix-wide context), then per-channel
      const suggestions = [...heuristicResult.suggestions, ...aiSuggestions];
      const latencyMs   = Date.now() - t0;

      return { suggestions, latencyMs };
    }),"""

# ══════════════════════════════════════════════════════════════════════════════
#  Main
# ══════════════════════════════════════════════════════════════════════════════

def run_phase_1() -> None:
    section("PHASE 1 — latencyMs gap-close + deprecate orphan router")

    print("\n── 1A. server/routers/daw.ts: 'ai.suggestions' returns latencyMs ─")
    patch_file(
        "server/routers/daw.ts",
        DAW_LATENCY_BEFORE,
        DAW_LATENCY_AFTER,
        label="daw.ts — ai.suggestions returns latencyMs",
        marker="const t0 = Date.now();\n      const { suggestions } = await runLLPTEAnalysis",
    )

    print("\n── 1B. client/src/hooks/useMixSuggestions.ts: read & forward latencyMs ─")
    patch_file(
        "client/src/hooks/useMixSuggestions.ts",
        HOOK_LATENCY_DESTRUCTURE_BEFORE,
        HOOK_LATENCY_DESTRUCTURE_AFTER,
        label="useMixSuggestions.ts — destructure latencyMs",
        marker="const latencyMs      = (data as { latencyMs?: number }).latencyMs ?? 0;",
    )
    patch_file(
        "client/src/hooks/useMixSuggestions.ts",
        HOOK_LATENCY_FIELD_BEFORE,
        HOOK_LATENCY_FIELD_AFTER,
        label="useMixSuggestions.ts — pass latencyMs to recordDecision",
        marker="latencyMs:  latencyMs,",
    )

    print("\n── 1C. server/routers/aiMix.router.ts: deprecation marker + warn ─")
    patch_file(
        "server/routers/aiMix.router.ts",
        AIMIX_DEPRECATE_BEFORE,
        AIMIX_DEPRECATE_AFTER,
        label="aiMix.router.ts — @deprecated + runtime warn",
        marker="@deprecated Use `dawRouter`",
    )


def run_phase_2() -> None:
    section("PHASE 2 — Path C hybrid: AIMixingService + heuristic merge")

    # ── Precondition: Phase 1A must have been applied to daw.ts ──────────────
    # Otherwise the Phase 2 imports would be added with no consumer (dead code)
    # and the hybrid body anchor (which is the Phase 1A output) would fail.
    daw_ts = ROOT / "server/routers/daw.ts"
    if daw_ts.exists():
        content = daw_ts.read_text(encoding="utf-8")
        phase_1_marker = (
            "const t0 = Date.now();\n      "
            "const { suggestions } = await runLLPTEAnalysis"
        )
        if phase_1_marker not in content:
            msg = (
                "Phase 2 requires Phase 1A applied to daw.ts first.\n"
                "             Run: python3 r3_mix_suggest.py --phase=1 --apply"
            )
            print(f"  ✗ ABORT  {msg}")
            ERRORS.append(msg)
            return
        print("  ✓       Precondition met: Phase 1A is applied")

    print("\n── 2A. services/ai-mix/src/genreInference.ts (NEW) ─")
    write_file(
        "services/ai-mix/src/genreInference.ts",
        GENRE_INFERENCE_TS,
        label="genreInference.ts (new file)",
    )

    print("\n── 2B. services/ai-mix/src/index.ts: re-export inferGenreFromBpm ─")
    index_path = ROOT / "services/ai-mix/src/index.ts"
    if not index_path.exists():
        ERRORS.append(f"Missing: {index_path.relative_to(ROOT)}")
        print(f"  ✗ FAIL  Missing: services/ai-mix/src/index.ts")
    else:
        existing = index_path.read_text(encoding="utf-8")
        if "genreInference" in existing:
            msg = "services/ai-mix/src/index.ts — already re-exports genreInference"
            print(f"  ~       {msg}")
            SKIPPED.append(msg)
        else:
            new_content = existing.rstrip() + "\n\n" + INDEX_EXPORT_LINE
            if DRY:
                print("  [DRY] Would append re-export to services/ai-mix/src/index.ts")
            else:
                _backup(index_path)
                index_path.write_text(new_content, encoding="utf-8")
                print("  PATCHED services/ai-mix/src/index.ts")
                APPLIED.append("ai-mix index.ts — appended re-export")

    print("\n── 2C-i. server/routers/daw.ts: import AIMixingService + inferGenreFromBpm ─")
    patch_file(
        "server/routers/daw.ts",
        DAW_IMPORTS_BEFORE,
        DAW_IMPORTS_AFTER,
        label="daw.ts — add AIMixingService imports",
        marker="import { AIMixingService }    from '../../services/ai-mix/src/AIMixingService';",
    )

    print("\n── 2C-ii. server/routers/daw.ts: hybrid mutation body ─")
    patch_file(
        "server/routers/daw.ts",
        DAW_HYBRID_BEFORE,
        DAW_HYBRID_AFTER,
        label="daw.ts — hybrid AIMixingService + heuristic merge",
        marker="// Phase 2 hybrid: TWO engines produce suggestions in parallel",
    )


def main() -> int:
    if DRY:
        print(f"\n[DRY RUN] No files written. Pass --apply to execute.")
        print(f"[DRY RUN] Phases: {PHASES}\n")
    else:
        print(f"\n[APPLY] Root: {ROOT}")
        print(f"[APPLY] Backups: {BACKUP_DIR}")
        print(f"[APPLY] Phases: {PHASES}\n")

    if not (ROOT / "package.json").exists():
        print(f"\n  ✗  ABORT: {ROOT}/package.json not found. Run from ~/Stable.\n")
        return 1

    if 1 in PHASES:
        run_phase_1()
    if 2 in PHASES:
        run_phase_2()

    section("Summary")

    if APPLIED:
        print(f"\n  ✓  Applied ({len(APPLIED)}):")
        for a in APPLIED:
            print(f"       {a}")
    if SKIPPED:
        print(f"\n  ~  Skipped ({len(SKIPPED)}):")
        for s in SKIPPED:
            print(f"       {s}")
    if ERRORS:
        print(f"\n  ✗  Failed ({len(ERRORS)}):")
        for e in ERRORS:
            print(f"       {e}")
        print()
        print("  Patch failures mean the target file has drifted from")
        print("  the expected state. Review the diff and apply manually.")
        print("  Other changes above were still applied successfully.")

    if DRY:
        print("\n[DRY RUN complete] Pass --apply to execute.\n")
        return 0

    print()
    if ERRORS:
        print("[Completed with errors — see Failed list above]")
    else:
        print("[All patches applied cleanly]")

    print("""
Next steps — verify before committing:

  1. Typecheck (must pass — Phase 2 added imports across packages):
       pnpm --filter ./services/ai-mix tsc --noEmit  # ai-mix package
       pnpm typecheck                                 # full repo

     If you see "Cannot find module './genreInference'", the package
     export resolution may need a `.js` extension under ESM. Try:
       sed -i 's|"./genreInference"|"./genreInference.js"|' \\
         services/ai-mix/src/index.ts

  2. Lint:
       pnpm lint

  3. Test (Phase 1 only adds latency — minimal blast radius):
       pnpm dev
       # In the DAW, click ANALYSE on a session and verify:
       #   - Network tab: response includes { suggestions, latencyMs: <number> }
       #   - DB: aiDecisionLog rows have non-zero latency_ms after Phase 1
       #   - DB: rows exist beyond the 4 heuristic types after Phase 2
       #         (look for params.source === "ai-mix" entries)

  4. Commit each phase separately:
       git add server/routers/daw.ts \\
               client/src/hooks/useMixSuggestions.ts \\
               server/routers/aiMix.router.ts
       git commit -m "feat(mix-suggest): return latencyMs from ai.suggestions; deprecate orphan aiMix router"

       git add services/ai-mix/src/genreInference.ts \\
               services/ai-mix/src/index.ts
       git add server/routers/daw.ts  # Phase 2 imports + hybrid body
       git commit -m "feat(mix-suggest): wire AIMixingService into ai.suggestions (Path C hybrid)"

  5. Phase 3 (apply logic) — separate session.
     Audit useDAWStore action surface first; do not build blind.
""")
    return 1 if ERRORS else 0


if __name__ == "__main__":
    sys.exit(main())
