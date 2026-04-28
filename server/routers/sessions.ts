import { z } from "zod";
import { count, eq, and } from "drizzle-orm";
import { router }             from "../trpc";
import { protectedProcedure } from "../base-procedures";
import { db }                 from "../db";
import { aiDecisionLog }      from "../db/schema";
import { sessionMetrics }     from "../../shared/schema-session-metrics";
import {
  startSession,
  stopSession,
  getSessionSummary,
} from "../services/session-metrics.service";

export const sessionsRouter = router({
  start: protectedProcedure
    .input(
      z.object({
        trackIds: z.array(z.string().uuid()).min(1),
        bpm: z.number().int().min(40).max(300),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return startSession(ctx.user.id, input);
    }),

  stop: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return stopSession(ctx.user.id, input);
    }),

  summary: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return getSessionSummary(ctx.user.id, input.sessionId);
    }),

  // ── Live chip data — polled every 30s by SessionChip ─────────────────────
  // Returns AI action count + estimated time saved for an active session.
  // timeSavedSeconds is only written on sessions.stop; for live sessions
  // we return 0 and let the chip show action count only until session ends.
  liveSummary: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Verify session belongs to this user
      const [session] = await db
        .select({ timeSavedSeconds: sessionMetrics.timeSavedSeconds })
        .from(sessionMetrics)
        .where(and(eq(sessionMetrics.id, input.sessionId), eq(sessionMetrics.userId, ctx.user.id)))
        .limit(1);

      if (!session) throw new Error(`Session not found: ${input.sessionId}`);

      const [{ value: aiActionsCount }] = await db
        .select({ value: count() })
        .from(aiDecisionLog)
        .where(eq(aiDecisionLog.sessionId, input.sessionId));

      return {
        aiActionsCount,
        estimatedTimeSavedMs: (session.timeSavedSeconds ?? 0) * 1_000,
      };
    }),
});
