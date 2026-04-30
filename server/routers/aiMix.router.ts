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
  "Use daw.ai.suggestions instead.\n",
);

/** @deprecated Use `dawRouter` (`daw.ai.suggestions`) instead. */
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
            `[aiMixRouter] aiDecisionLog write failed: ${String(err)}\n`
          );
        });
      }

      return result;
    }),

  // Called by client when user accepts or rejects a surfaced suggestion.
  // Updates the log row from its initial 'ignored' outcome.
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
