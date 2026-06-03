import { router } from "../trpc";
import { protectedProcedure } from "../base-procedures";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
const TRIAL_DAYS = 14;
export const trialRouter = router({
    status: protectedProcedure.query(async ({ ctx }) => {
        const [user] = await db
            .select({
            trialStartedAt: users.trialStartedAt,
            trialExpiresAt: users.trialExpiresAt,
            tier: users.tier,
        })
            .from(users)
            .where(eq(users.id, ctx.user.id))
            .limit(1);
        if (!user)
            throw new TRPCError({ code: "NOT_FOUND" });
        if (user.tier && user.tier !== "explorer") {
            return { state: "subscribed", expiresAt: null, daysLeft: null };
        }
        if (!user.trialStartedAt || !user.trialExpiresAt) {
            return { state: "not_started", expiresAt: null, daysLeft: null };
        }
        const now = Date.now();
        const exp = new Date(user.trialExpiresAt).getTime();
        const daysLeft = Math.max(0, Math.ceil((exp - now) / 86400000));
        return {
            state: daysLeft > 0 ? "active" : "expired",
            expiresAt: user.trialExpiresAt.toISOString(),
            daysLeft,
        };
    }),
    activate: protectedProcedure.mutation(async ({ ctx }) => {
        const [user] = await db
            .select({ trialStartedAt: users.trialStartedAt, tier: users.tier })
            .from(users)
            .where(eq(users.id, ctx.user.id))
            .limit(1);
        if (!user)
            throw new TRPCError({ code: "NOT_FOUND" });
        if (user.tier && user.tier !== "explorer")
            return { activated: false, reason: "already_subscribed" };
        if (user.trialStartedAt)
            return { activated: false, reason: "already_activated" };
        const now = new Date();
        const expires = new Date(now.getTime() + TRIAL_DAYS * 86400000);
        await db
            .update(users)
            .set({ trialStartedAt: now, trialExpiresAt: expires })
            .where(eq(users.id, ctx.user.id));
        return { activated: true, expiresAt: expires.toISOString() };
    }),
});
