import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
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
});
