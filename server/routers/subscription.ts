/**
 * server/routers/subscription.ts
 *
 * Fix H1 — ctx.user.name → ctx.user.username (from prior round)
 * Fix     — ctx.user possibly undefined (resolved by AuthenticatedContext in trpc.ts)
 * Fix     — email type: string | null not assignable to string
 * Fix     — Removed all ctx.user! non-null assertions. requireAuth narrows ctx to
 *            AuthenticatedContext (user: AuthPayload, non-optional) before any
 *            handler runs. Assertions were redundant noise that obscured intent.
 *
 * ROOT CAUSE (ctx.user undefined — now resolved upstream):
 * TRPCContext.user was typed as AuthPayload | undefined. requireAuth in trpc.ts
 * now casts to AuthenticatedContext, propagating user: AuthPayload (non-optional)
 * through the full middleware chain. ctx.user is safe to access directly.
 *
 * ROOT CAUSE (email string | null):
 * AuthPayload.email is `string | null`. CreateCheckoutOptions.email is `string`.
 * A user who registered without an email will have null. The fallback to an empty
 * string is intentional — Stripe accepts '' for optional email on customer creation.
 */

import { z } from 'zod';
import { router }              from '../trpc';
import { protectedProcedure } from '../base-procedures';
import {
  createCheckoutSession,
  createPortalSession,
  getUserSubscription,
} from '../services/stripe-subscription';
import { BILLING_CYCLES } from '@shared/subscription.types';

export const subscriptionRouter = router({
  getMySubscription: protectedProcedure.query(async ({ ctx }) => {
    return getUserSubscription(ctx.user.id);
  }),

  createCheckout: protectedProcedure
    .input(z.object({
      tier: z.enum(['creator', 'pro_artist']),
      billingCycle: z.enum(BILLING_CYCLES),
      successPath: z.string().default('/dashboard?upgraded=true'),
      cancelPath: z.string().default('/pricing'),
    }))
    .mutation(async ({ ctx, input }) => {
      const baseUrl = process.env.APP_URL ?? 'http://localhost:5173';
      const url = await createCheckoutSession({
        userId: ctx.user.id,
        // email is string | null on AuthPayload; Stripe accepts '' for optional email
        email: ctx.user.email ?? '',
        // Fix H1: was ctx.user.name (undefined) — correct field is username
        name: ctx.user.username,
        tier: input.tier,
        billingCycle: input.billingCycle,
        successUrl: `${baseUrl}${input.successPath}`,
        cancelUrl: `${baseUrl}${input.cancelPath}`,
        trialDays: 14,
      });
      return { url };
    }),

  createPortal: protectedProcedure
    .input(z.object({ returnPath: z.string().default('/account') }))
    .mutation(async ({ ctx, input }) => {
      const baseUrl = process.env.APP_URL ?? 'http://localhost:5173';
      const url = await createPortalSession(ctx.user.id, `${baseUrl}${input.returnPath}`);
      return { url };
    }),
});

export type SubscriptionRouter = typeof subscriptionRouter;