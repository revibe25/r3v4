import { z } from "zod";
import { router, publicProc } from "../trpc";

const DeckIdSchema = z.enum(["A", "B", "C", "D"]);

export const djRouter = router({
  getSession: publicProc
    .query(({ ctx }) => ctx.djEngine.getSession()),

  play: publicProc
    .input(z.object({ deckId: DeckIdSchema }))
    .mutation(({ ctx, input }) => {
      ctx.djEngine.dispatch({ type: "PLAY", deckId: input.deckId });
      return { ok: true };
    }),

  pause: publicProc
    .input(z.object({ deckId: DeckIdSchema }))
    .mutation(({ ctx, input }) => {
      ctx.djEngine.dispatch({ type: "PAUSE", deckId: input.deckId });
      return { ok: true };
    }),

  cue: publicProc
    .input(z.object({ deckId: DeckIdSchema, cueId: z.string() }))
    .mutation(({ ctx, input }) => {
      ctx.djEngine.dispatch({ type: "CUE", deckId: input.deckId, cueId: input.cueId });
      return { ok: true };
    }),

  crossfade: publicProc
    .input(z.object({ value: z.number().min(-1).max(1) }))
    .mutation(({ ctx, input }) => {
      ctx.djEngine.dispatch({ type: "CROSSFADE", value: input.value });
      return { ok: true };
    }),

  sync: publicProc
    .input(z.object({ deckId: DeckIdSchema, targetBpm: z.number().min(20).max(250) }))
    .mutation(({ ctx, input }) => {
      ctx.djEngine.dispatch({ type: "SYNC", deckId: input.deckId, targetBpm: input.targetBpm });
      return { ok: true };
    }),

  pitch: publicProc
    .input(z.object({ deckId: DeckIdSchema, semitones: z.number().min(-12).max(12) }))
    .mutation(({ ctx, input }) => {
      ctx.djEngine.dispatch({ type: "PITCH", deckId: input.deckId, semitones: input.semitones });
      return { ok: true };
    }),
});

export type DJRouter = typeof djRouter;
