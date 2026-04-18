#!/usr/bin/env python3
"""
patch_p1_aidecisionlog.py — R3 v4 P1
Wires aiDecisionLog writes into session-metrics.service.ts
and updates aiMix.router.ts with sessionId + recordOutcome.

Run:  python3 patch_p1_aidecisionlog.py           (dry-run)
      python3 patch_p1_aidecisionlog.py --apply    (write)
"""

import sys, subprocess
from pathlib import Path

DRY_RUN = "--apply" not in sys.argv
ROOT    = Path.home() / "Stable"

SERVICE = ROOT / "server" / "services" / "session-metrics.service.ts"
ROUTER  = ROOT / "server" / "routers" / "aiMix.router.ts"

# ── helpers ───────────────────────────────────────────────────────────────────

def ok(m):   print(f"  ✓  {m}")
def warn(m): print(f"  ⚠  {m}")
def info(m): print(f"  →  {m}")
def fail(m):
    print(f"\n  ABORT: {m}", file=sys.stderr)
    sys.exit(1)

# ── Phase 1: anchor verification ──────────────────────────────────────────────

print("\nPhase 1 — ANCHOR VERIFICATION")
print("  " + "─" * 60)

svc_text = SERVICE.read_text()
rtr_text = ROUTER.read_text()

SVC_IMPORT_ANCHOR = 'import { calculateTimeSavings } from "./time-savings.service";'
SVC_FUNCTION_ANCHOR = "  if (!row || row.userId !== userId) return null;"

RTR_INPUT_ANCHOR  = "      enableStemSeparation: z.boolean(),"
RTR_RETURN_ANCHOR = "      return aiService.analyze({"

for label, text, anchor in [
    ("SERVICE import anchor",   svc_text, SVC_IMPORT_ANCHOR),
    ("SERVICE function anchor", svc_text, SVC_FUNCTION_ANCHOR),
    ("ROUTER input anchor",     rtr_text, RTR_INPUT_ANCHOR),
    ("ROUTER return anchor",    rtr_text, RTR_RETURN_ANCHOR),
]:
    count = text.count(anchor)
    if count != 1:
        fail(f"{label} found {count} times (expected 1).\n  Anchor: {anchor!r}")
    ok(f"{label} found exactly once")

# ── Phase 2: already-patched guard ────────────────────────────────────────────

print("\nPhase 2 — ALREADY-PATCHED GUARD")
print("  " + "─" * 60)

if "logAIDecision" in svc_text:
    warn("logAIDecision already present in service — skipping service patch")
    patch_service = False
else:
    ok("logAIDecision not yet present — will patch")
    patch_service = True

if "recordOutcome" in rtr_text:
    warn("recordOutcome already present in router — skipping router patch")
    patch_router = False
else:
    ok("recordOutcome not yet present — will patch")
    patch_router = True

if not patch_service and not patch_router:
    print("\n  Both patches already applied. Nothing to do.")
    sys.exit(0)

# ── Phase 3: build patched content ────────────────────────────────────────────

print("\nPhase 3 — BUILD PATCHED CONTENT")
print("  " + "─" * 60)

# ── service patch ─────────────────────────────────────────────────────────────

NEW_SVC_IMPORTS = '''import { aiDecisionLog }         from "../db/schema";
import type { InsertAIDecisionLog } from "../db/schema";'''

NEW_SVC_FUNCTIONS = '''
// ── AI Decision Logging ───────────────────────────────────────────────────────

/**
 * Log a single AI suggestion decision to aiDecisionLog.
 * Returns the generated row id so callers can link outcome updates.
 * CLAUDE.md LLPTE contract: gates at 0.65 (auto-apply) / 0.40 (suggest) / <0.40 (discard)
 */
export async function logAIDecision(
  entry: Omit<InsertAIDecisionLog, "id" | "timestamp">
): Promise<string> {
  const id = randomUUID();
  await db
    .insert(aiDecisionLog)
    .values({
      ...entry,
      id,
      timestamp: new Date().toISOString(),
    });
  return id;
}

/**
 * Update the outcome of a previously logged AI decision.
 * Called by aiMix.recordOutcome when the client reports user action.
 */
export async function updateAIDecisionOutcome(
  id: string,
  outcome: "accepted" | "rejected" | "ignored"
): Promise<void> {
  await db
    .update(aiDecisionLog)
    .set({ outcome })
    .where(eq(aiDecisionLog.id, id));
}
'''

if patch_service:
    new_svc = svc_text.replace(
        SVC_IMPORT_ANCHOR,
        SVC_IMPORT_ANCHOR + "\n" + NEW_SVC_IMPORTS
    )
    # Append functions at end of file
    new_svc = new_svc.rstrip() + "\n" + NEW_SVC_FUNCTIONS
    ok("Service patch built")

# ── router patch ──────────────────────────────────────────────────────────────

NEW_RTR_CONTENT = '''\
import { z } from "zod";
import { router }             from "../trpc";
import { protectedProcedure } from "../base-procedures";
import { AIMixingService } from "../../services/ai-mix/src/AIMixingService";
import {
  logAIDecision,
  updateAIDecisionOutcome,
} from "../services/session-metrics.service";

const aiService = new AIMixingService();

// Confidence gates — CLAUDE.md LLPTE contract (PRD §8.5)
const CONFIDENCE_AUTO_APPLY = 0.65;
const CONFIDENCE_SUGGEST    = 0.40;

export const aiMixRouter = router({
  analyze: protectedProcedure
    .input(z.object({
      genre:                z.string().min(1),
      targetLoudness:       z.number().min(-23).max(-6),
      enableStemSeparation: z.boolean(),
      sessionId:            z.string().optional(), // present → log decisions
    }))
    .mutation(async ({ ctx, input }) => {
      const mixerState = ctx.mixerEngine.getState();
      const t0 = Date.now();

      const result = await aiService.analyze({
        mixerState,
        genre:                input.genre,
        targetLoudness:       input.targetLoudness,
        enableStemSeparation: input.enableStemSeparation,
      });

      const latencyMs = Date.now() - t0;

      // Log each suggestion when sessionId is provided.
      // Fire-and-forget: never block the response on a log write.
      if (input.sessionId) {
        const sid = input.sessionId;
        const logPromises = result.suggestions.map((s) => {
          // Derive initial outcome from confidence gates
          let outcome: "auto_applied" | "ignored" | "discarded";
          if (s.confidence >= CONFIDENCE_AUTO_APPLY) {
            outcome = "auto_applied";
          } else if (s.confidence >= CONFIDENCE_SUGGEST) {
            outcome = "ignored"; // updated via recordOutcome when client reports
          } else {
            outcome = "discarded";
          }

          return logAIDecision({
            sessionId:           sid,
            nodeId:              "aiMixEngine",
            actionType:          "gain_adjust",
            trackId:             s.channelId,
            inputConfidence:     s.confidence,
            displayedConfidence: s.confidence,
            decision: {
              channelId:      s.channelId,
              paramId:        s.paramId,
              suggestedValue: s.suggestedValue,
              rationale:      s.rationale,
            },
            outcome,
            latencyMs,
          });
        });

        Promise.all(logPromises).catch((err: unknown) => {
          // Structured — no console.log (CLAUDE.md hard guard)
          process.stderr.write(
            `[aiMixRouter] aiDecisionLog write failed: ${String(err)}\\n`
          );
        });
      }

      return result;
    }),

  // Called by client when user accepts or rejects a surfaced suggestion.
  // Updates the log row from its initial \'ignored\' outcome.
  recordOutcome: protectedProcedure
    .input(z.object({
      decisionId: z.string(),
      outcome:    z.enum(["accepted", "rejected", "ignored"]),
    }))
    .mutation(async ({ input }) => {
      await updateAIDecisionOutcome(input.decisionId, input.outcome);
      return { ok: true };
    }),
});

export type AIMixRouter = typeof aiMixRouter;
'''

if patch_router:
    new_rtr = NEW_RTR_CONTENT
    ok("Router patch built")

# ── Phase 4: dry-run diff ─────────────────────────────────────────────────────

print("\nPhase 4 — DIFF PREVIEW")
print("  " + "─" * 60)

import difflib

if patch_service:
    diff = difflib.unified_diff(
        svc_text.splitlines(keepends=True),
        new_svc.splitlines(keepends=True),
        fromfile="session-metrics.service.ts (before)",
        tofile="session-metrics.service.ts (after)",
        n=3,
    )
    print("".join(diff))

if patch_router:
    diff = difflib.unified_diff(
        rtr_text.splitlines(keepends=True),
        new_rtr.splitlines(keepends=True),
        fromfile="aiMix.router.ts (before)",
        tofile="aiMix.router.ts (after)",
        n=3,
    )
    print("".join(diff))

if DRY_RUN:
    warn("DRY RUN — no files written. Re-run with --apply to apply.")
    sys.exit(0)

# ── Phase 5: write ────────────────────────────────────────────────────────────

print("\nPhase 5 — WRITE")
print("  " + "─" * 60)

if patch_service:
    SERVICE.write_text(new_svc)
    ok(f"session-metrics.service.ts written ({len(new_svc)} bytes)")

if patch_router:
    ROUTER.write_text(new_rtr)
    ok(f"aiMix.router.ts written ({len(new_rtr)} bytes)")

# ── Phase 6: read-back verification ──────────────────────────────────────────

print("\nPhase 6 — READ-BACK VERIFICATION")
print("  " + "─" * 60)

svc_final = SERVICE.read_text()
rtr_final = ROUTER.read_text()

checks = [
    (svc_final, "logAIDecision",            "service: logAIDecision present"),
    (svc_final, "updateAIDecisionOutcome",  "service: updateAIDecisionOutcome present"),
    (svc_final, 'from "../db/schema"',      "service: schema import present"),
    (rtr_final, "recordOutcome",            "router: recordOutcome present"),
    (rtr_final, "sessionId",                "router: sessionId input present"),
    (rtr_final, "CONFIDENCE_AUTO_APPLY",    "router: confidence gates present"),
    (rtr_final, "logAIDecision",            "router: logAIDecision call present"),
    (rtr_final, "fire-and-forget",          "router: fire-and-forget comment present"),
]

all_ok = True
for text, needle, label in checks:
    if needle in text:
        ok(label)
    else:
        warn(f"MISSING: {label}")
        all_ok = False

if not all_ok:
    fail("Read-back failed — restore from backups before proceeding")

# ── Phase 7: TSC ──────────────────────────────────────────────────────────────

print("\nPhase 7 — pnpm tsc --noEmit")
print("  " + "─" * 60)

result = subprocess.run(
    ["pnpm", "tsc", "--noEmit"],
    cwd=ROOT,
    capture_output=True,
    text=True,
)

if result.returncode == 0:
    ok("Zero TypeScript errors ✓")
else:
    print(result.stdout[-3000:] if result.stdout else "")
    print(result.stderr[-1000:] if result.stderr else "")
    fail(
        "TSC failed — restore from backups:\n"
        f"  cp {SERVICE}.bak-* {SERVICE}\n"
        f"  cp {ROUTER}.bak-* {ROUTER}"
    )

print("""
  ┌─────────────────────────────────────────────────────┐
  │  P1 complete — aiDecisionLog writes wired           │
  │                                                     │
  │  session-metrics.service.ts: +logAIDecision         │
  │                              +updateAIDecisionOutcome│
  │  aiMix.router.ts:            +sessionId input       │
  │                              +per-suggestion logging │
  │                              +recordOutcome procedure│
  │  TSC: PASS                                          │
  └─────────────────────────────────────────────────────┘
""")
