import { z } from "zod";
import { router, publicProc } from "../trpc";

const ChannelIdSchema = z.string().min(1);
const FaderDbSchema   = z.number().max(12);

export const mixerRouter = router({
  getState: publicProc
    .query(({ ctx }) => ctx.mixerEngine.getState()),

  setFader: publicProc
    .input(z.object({ channelId: ChannelIdSchema, value: FaderDbSchema }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({
        type: "FADER_CHANGE",
        channelId: input.channelId,
        value: input.value,
      });
      return { ok: true };
    }),

  setPan: publicProc
    .input(z.object({ channelId: ChannelIdSchema, value: z.number().min(-1).max(1) }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({ type: "PAN_CHANGE", channelId: input.channelId, value: input.value });
      return { ok: true };
    }),

  toggleMute: publicProc
    .input(z.object({ channelId: ChannelIdSchema }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({ type: "MUTE_TOGGLE", channelId: input.channelId });
      return { ok: true };
    }),

  toggleSolo: publicProc
    .input(z.object({ channelId: ChannelIdSchema }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({ type: "SOLO_TOGGLE", channelId: input.channelId });
      return { ok: true };
    }),

  setMasterFader: publicProc
    .input(z.object({ value: FaderDbSchema }))
    .mutation(({ ctx, input }) => {
      ctx.mixerEngine.dispatch({ type: "MASTER_FADER", value: input.value });
      return { ok: true };
    }),
});

export type MixerRouter = typeof mixerRouter;
