import { z } from "zod";
import { router, publicProcedure } from "../trpc";

const ChannelIdSchema = z.string().min(1);
const FaderDbSchema   = z.number().max(12);

export const mixerRouter = router({
  getState: publicProcedure
    .query(({ ctx }) => ctx.mixerEngine.getState()),

  setFader: publicProcedure
    .input(z.object({ channelId: ChannelIdSchema, value: FaderDbSchema }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({
        type: "FADER_CHANGE",
        channelId: input.channelId as any,
        value: input.value as any,
      });
      return { ok: true };
    }),

  setPan: publicProcedure
    .input(z.object({ channelId: ChannelIdSchema, value: z.number().min(-1).max(1) }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({ type: "PAN_CHANGE", channelId: input.channelId as any, value: input.value });
      return { ok: true };
    }),

  toggleMute: publicProcedure
    .input(z.object({ channelId: ChannelIdSchema }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({ type: "MUTE_TOGGLE", channelId: input.channelId as any });
      return { ok: true };
    }),

  toggleSolo: publicProcedure
    .input(z.object({ channelId: ChannelIdSchema }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({ type: "SOLO_TOGGLE", channelId: input.channelId as any });
      return { ok: true };
    }),

  setMasterFader: publicProcedure
    .input(z.object({ value: FaderDbSchema }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({ type: "MASTER_FADER", value: input.value as any });
      return { ok: true };
    }),
});

export type MixerRouter = typeof mixerRouter;
