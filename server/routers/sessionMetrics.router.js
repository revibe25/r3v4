/**
 * server/routers/sessionMetrics.router.ts
 * Wire.txt §7 — all client-server comms through tRPC.
 * Wire.txt §8 — protectedProcedure, userId FK on every query.
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../trpc";
import { protectedProcedure } from "../base-procedures";
import { startSession, stopSession, getSessionSummary, logAIDecision, updateAIDecisionOutcome, } from "../services/session-metrics.service";
import { db } from "../db";
import { sessionMetrics } from "../../shared/schema-session-metrics";
import { aiDecisionLog } from "../db/schema";
import { eq, desc, inArray } from "drizzle-orm";
export const sessionMetricsRouter = router({
    /** Start a new session — returns sessionId */
    start: protectedProcedure
        .input(z.object({
        trackIds: z.array(z.string()).min(1),
        bpm: z.number().int().min(60).max(220).default(128),
    }))
        .mutation(({ ctx, input }) => startSession(ctx.user.id, input)),
    /** Stop session — persists duration + time savings, returns summary */
    stop: protectedProcedure
        .input(z.object({ sessionId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
        try {
            return await stopSession(ctx.user.id, input);
        }
        catch (err) {
            throw new TRPCError({
                code: "NOT_FOUND",
                message: err instanceof Error ? err.message : "Session error",
            });
        }
    }),
    /** Get summary for a single session */
    summary: protectedProcedure
        .input(z.object({ sessionId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
        const result = await getSessionSummary(ctx.user.id, input.sessionId);
        if (!result)
            throw new TRPCError({ code: "NOT_FOUND" });
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
            sessionId: r.id,
            durationSeconds: r.durationSeconds,
            timeSavedSeconds: r.timeSavedSeconds,
            peakEnergyScore: r.peakEnergyScore ?? 0,
            mixQualityScore: r.mixQualityScore ?? 0,
            bpm: r.bpm,
            startedAt: r.startedAt.toISOString(),
            endedAt: r.endedAt?.toISOString() ?? null,
        }));
    }),
    /** Log an AI suggestion decision to aiDecisionLog (PRD §15) */
    recordDecision: protectedProcedure
        .input(z.object({
        sessionId: z.string(),
        nodeId: z.string(),
        actionType: z.string(),
        trackId: z.string().optional(),
        inputConfidence: z.number().min(0).max(1),
        displayedConfidence: z.number().min(0).max(1),
        decision: z.record(z.unknown()),
        outcome: z.enum(["auto_applied", "accepted", "rejected", "ignored", "discarded"]),
        latencyMs: z.number().int().min(0),
    }))
        .output(z.string())
        .mutation(({ input }) => logAIDecision(input)),
    /** Update outcome of a previously logged decision */
    recordOutcome: protectedProcedure
        .input(z.object({
        id: z.string(),
        outcome: z.enum(["accepted", "rejected", "ignored"]),
    }))
        .mutation(({ input }) => updateAIDecisionOutcome(input.id, input.outcome)),
    /** Aggregate totals for the current user — investor demo metric */
    totals: protectedProcedure
        .query(async ({ ctx }) => {
        const rows = await db
            .select()
            .from(sessionMetrics)
            .where(eq(sessionMetrics.userId, ctx.user.id));
        const totalSessions = rows.length;
        const totalTimeSavedS = rows.reduce((s, r) => s + r.timeSavedSeconds, 0);
        const totalDurationS = rows.reduce((s, r) => s + r.durationSeconds, 0);
        const avgMixQuality = totalSessions > 0
            ? rows.reduce((s, r) => s + (r.mixQualityScore ?? 0), 0) / totalSessions
            : 0;
        // Pull acceptance counts from aiDecisionLog (PRD §15 demo metric)
        let acceptedSuggestions = 0;
        let rejectedSuggestions = 0;
        if (rows.length > 0) {
            const sessionIds = rows.map(r => r.id);
            const decisions = await db
                .select({ outcome: aiDecisionLog.outcome })
                .from(aiDecisionLog)
                .where(inArray(aiDecisionLog.sessionId, sessionIds));
            acceptedSuggestions = decisions.filter(d => d.outcome === "accepted").length;
            rejectedSuggestions = decisions.filter(d => d.outcome === "rejected").length;
        }
        return {
            totalSessions,
            totalMinutesSaved: Math.round(totalTimeSavedS / 60),
            totalHoursMixed: Math.round(totalDurationS / 3600 * 10) / 10,
            avgMixQualityScore: Math.round(avgMixQuality * 100) / 100,
            acceptedSuggestions,
            rejectedSuggestions,
        };
    }),
});
