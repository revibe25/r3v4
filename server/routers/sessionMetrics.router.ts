/**
 * server/routers/sessionMetrics.router.ts
 * Wire.txt §7 — all client-server comms through tRPC.
 * Wire.txt §8 — protectedProcedure, userId FK on every query.
 */
import { z }              from "zod";
import { TRPCError }      from "@trpc/server";
import { router }         from "../trpc";
import { protectedProcedure } from "../base-procedures";
import {
  startSession,
  stopSession,
  getSessionSummary,
} from "../services/session-metrics.service";
import { db }             from "../db";
import { sessionMetrics } from "../../shared/schema-session-metrics";
import { eq, desc }       from "drizzle-orm";

export const sessionMetricsRouter = router({
  /** Start a new session — returns sessionId */
  start: protectedProcedure
    .input(z.object({
      trackIds: z.array(z.string()).min(1),
      bpm:      z.number().int().min(60).max(220).default(128),
    }))
    .mutation(({ ctx, input }) =>
      startSession(ctx.user.id, input)
    ),

  /** Stop session — persists duration + time savings, returns summary */
  stop: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await stopSession(ctx.user.id, input);
      } catch (err) {
        throw new TRPCError({
          code:    "NOT_FOUND",
          message: err instanceof Error ? err.message : "Session error",
        });
      }
    }),

  /** Get summary for a single session */
  summary: protectedProcedure
    .input(z.object({ sessionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const result = await getSessionSummary(ctx.user.id, input.sessionId);
      if (!result) throw new TRPCError({ code: "NOT_FOUND" });
      return result;
    }),

  /** Last N sessions for history / dashboard */
  history: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(20) }))
    .query(async ({ ctx, input }) => {
      const rows = await db
        .select()
        .from(sessionMetrics)
        .where(eq(sessionMetrics.userId, ctx.user.id))
        .orderBy(desc(sessionMetrics.startedAt))
        .limit(input.limit);

      return rows.map(r => ({
        sessionId:        r.id,
        durationSeconds:  r.durationSeconds,
        timeSavedSeconds: r.timeSavedSeconds,
        peakEnergyScore:  r.peakEnergyScore ?? 0,
        mixQualityScore:  r.mixQualityScore ?? 0,
        bpm:              r.bpm,
        startedAt:        r.startedAt.toISOString(),
        endedAt:          r.endedAt?.toISOString() ?? null,
      }));
    }),

  /** Aggregate totals for the current user — investor demo metric */
  totals: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await db
        .select()
        .from(sessionMetrics)
        .where(eq(sessionMetrics.userId, ctx.user.id));

      const totalSessions    = rows.length;
      const totalTimeSavedS  = rows.reduce((s, r) => s + r.timeSavedSeconds, 0);
      const totalDurationS   = rows.reduce((s, r) => s + r.durationSeconds, 0);
      const avgMixQuality    = totalSessions > 0
        ? rows.reduce((s, r) => s + (r.mixQualityScore ?? 0), 0) / totalSessions
        : 0;

      return {
        totalSessions,
        totalMinutesSaved: Math.round(totalTimeSavedS / 60),
        totalHoursMixed:   Math.round(totalDurationS / 3600 * 10) / 10,
        avgMixQualityScore: Math.round(avgMixQuality * 100) / 100,
      };
    }),
});
