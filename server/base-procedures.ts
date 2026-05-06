import { t } from "./trpc";
import { TRPCError } from "@trpc/server";

export const protectedProcedure = t.procedure.use(async ({ ctx, next }: { ctx: any; next: any }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
