import { publicProcedure } from "./trpc";
import { TRPCError } from "@trpc/server";
import { attachSubscription } from "./middleware/feature-gate";

export const protectedProcedure = publicProcedure
  .use(async ({ ctx, next }: { ctx: any; next: any }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({ ctx: { ...ctx, user: ctx.user } });
  })
  .use(attachSubscription);
