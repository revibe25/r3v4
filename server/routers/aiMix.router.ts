import { z } from "zod";
import { router }             from "../trpc";
import { protectedProcedure } from "../base-procedures";
import { AIMixingService } from "../../services/ai-mix/src/AIMixingService";

const aiService = new AIMixingService();

export const aiMixRouter = router({
  analyze: protectedProcedure
    .input(z.object({
      genre:                z.string().min(1),
      targetLoudness:       z.number().min(-23).max(-6),
      enableStemSeparation: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      const mixerState = ctx.mixerEngine.getState();
      return aiService.analyze({
        mixerState,
        genre:                input.genre,
        targetLoudness:       input.targetLoudness,
        enableStemSeparation: input.enableStemSeparation,
      });
    }),
});

export type AIMixRouter = typeof aiMixRouter;
