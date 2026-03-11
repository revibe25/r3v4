/**
 * server/routers/subscription.ts
 *
 * Fix H1 — ctx.user.name → ctx.user.username (from prior round)
 * Fix     — ctx.user possibly undefined (20 errors from prior round)
 * Fix     — email type: string | null not assignable to string
 *
 * ROOT CAUSE (ctx.user undefined):
 * TRPCContext.user was typed as AuthPayload | undefined. Even though requireAuth
 * throws UNAUTHORIZED when user is absent, TypeScript's type narrowing did not
 * propagate through the tRPC middleware chain in the previous trpc.ts definition.
 * After requireAuth now casts to AuthenticatedContext (user: AuthPayload), the
 * type flows through and ctx.user is non-optional here. The non-null assertions
 * (!) below are a belt-and-suspenders safety net — they will never fire because
 * requireAuth has already thrown before this code runs.
 *
 * ROOT CAUSE (email string | null):
 * AuthPayload.email is `string | null`. CreateCheckoutOptions.email is `string`.
 * A user who registered without an email will have null. A null email passed
 * to Stripe.customers.create is rejected by the Stripe SDK types. The fallback
 * to an empty string is intentional — getOrCreateStripeCustomer passes `email`
 * to Stripe only for customer creation; an empty string is accepted by Stripe
 * and the customer can update it later in the portal.
 */

import { z } from 'zod';
import { router } from '../trpc';
import { protectedProcedure } from '../procedures';
import {
  createCheckoutSession,
  createPortalSession,
  getUserSubscription,
} from '../services/stripe-subscription';
import { BILLING_CYCLES } from '../../shared/subscription.types';

export const subscriptionRouter = router({
  getMySubscription: protectedProcedure.query(async ({ ctx }) => {
    return getUserSubscription(ctx.user!.id);
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
        userId: ctx.user!.id,
        // Fix: email is string | null; Stripe accepts empty string for optional email
        email: ctx.user!.email ?? '',
        // Fix H1: was ctx.user.name (undefined) — field is username
        name: ctx.user!.username,
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
      const url = await createPortalSession(ctx.user!.id, `${baseUrl}${input.returnPath}`);
      return { url };
    }),
});

export type SubscriptionRouter = typeof subscriptionRouter;