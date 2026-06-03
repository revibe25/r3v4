import { logger } from "../utils/logger";
/**
 * server/services/stripe-subscription.ts
 *
 * Fix 1 — apiVersion '2024-04-10' rejected by stripe@20.3.1
 *
 * ROOT CAUSE: stripe@20.3.1 ships types for API version 2026-02-25.clover only.
 * Passing '2024-04-10' is a literal type mismatch.
 *
 * Fix 2 — sub.current_period_start/end don't exist on Stripe.Subscription
 * in 2026-02-25.clover
 *
 * ROOT CAUSE: These fields were removed from the top-level Subscription object
 * in the 2026-02-25.clover API. They now live on each subscription item:
 * sub.items.data[n].current_period_start / current_period_end.
 *
 * Fix 3 — Invoice.subscription doesn't exist on Stripe.Invoice in 2026-02-25.clover
 *
 * ROOT CAUSE: invoice.subscription replaced by
 * invoice.parent.subscription_details.subscription in 2026-02-25.clover.
 * An intersection type covers both the new location and a compatibility fallback.
 */
import Stripe from 'stripe';
import { db } from '../db';
import { subscriptions, stripeEvents } from '../../shared/schema-subscription';
import { eq } from 'drizzle-orm';
import { TIER_DEFINITIONS, } from '../../shared/subscription.types';
/**
 * Lazy Stripe client — instantiated on first use, not at module load.
 *
 * ROOT CAUSE: ESM evaluates all imported modules before the importing
 * module's body runs. A top-level throw fires before dotenv.config()
 * in index.ts populates process.env, crashing startup even when
 * STRIPE_SECRET_KEY is correctly set in .env.
 *
 * WHY THIS IS CORRECT: The getter runs inside request handlers, which
 * execute after the full module graph is loaded and dotenv has run.
 * The error still throws — but now at call time with a clear message,
 * not at import time with a misleading startup crash.
 */
let _stripe = null;
export function getStripe() {
    if (!_stripe) {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            throw new Error('STRIPE_SECRET_KEY is not set. Add it to .env before using Stripe.');
        }
        _stripe = new Stripe(key, {
            apiVersion: '2026-02-25.clover',
            typescript: true,
        });
    }
    return _stripe;
}
/** @deprecated Use getStripe() — kept for callers that destructure `stripe` */
export const stripe = new Proxy({}, {
    get(_target, prop) {
        return Reflect.get(getStripe(), prop);
    },
});
export async function getOrCreateStripeCustomer(userId, email, name) {
    const existing = await db
        .select({ stripeCustomerId: subscriptions.stripeCustomerId })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
    if (existing[0]?.stripeCustomerId)
        return existing[0].stripeCustomerId;
    const customer = await stripe.customers.create({ email, name, metadata: { r3UserId: userId } });
    await db
        .insert(subscriptions)
        .values({ id: `free_${userId}`, userId, tier: 'explorer', status: 'active', stripeCustomerId: customer.id })
        .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { stripeCustomerId: customer.id, updatedAt: new Date() },
    });
    return customer.id;
}
export async function createCheckoutSession(opts) {
    const { tier, billingCycle } = opts;
    const tierDef = TIER_DEFINITIONS[tier];
    const priceId = billingCycle === 'annual' ? tierDef.stripePriceIdAnnual : tierDef.stripePriceIdMonthly;
    if (!priceId)
        throw new Error(`No Stripe price configured for ${tier} ${billingCycle}`);
    const customerId = await getOrCreateStripeCustomer(opts.userId, opts.email, opts.name);
    const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
            trial_period_days: opts.trialDays ?? 7,
            metadata: { r3UserId: opts.userId, r3Tier: tier },
        },
        metadata: { r3UserId: opts.userId, r3Tier: tier },
        success_url: opts.successUrl,
        cancel_url: opts.cancelUrl,
        allow_promotion_codes: true,
    });
    return session.url;
}
export async function createPortalSession(userId, returnUrl) {
    const row = await db
        .select({ stripeCustomerId: subscriptions.stripeCustomerId })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
    if (!row[0]?.stripeCustomerId)
        throw new Error('No Stripe customer found for this user');
    const session = await stripe.billingPortal.sessions.create({
        customer: row[0].stripeCustomerId,
        return_url: returnUrl,
    });
    return session.url;
}
export async function getUserSubscription(userId) {
    const row = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId))
        .limit(1);
    if (!row[0]) {
        return {
            tier: 'explorer',
            status: 'active',
            billingCycle: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            trialEnd: null,
            stripeCustomerId: null,
        };
    }
    const s = row[0];
    return {
        tier: s.tier,
        status: s.status,
        billingCycle: s.billingCycle ?? null,
        currentPeriodEnd: s.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        trialEnd: s.trialEnd ?? null,
        stripeCustomerId: s.stripeCustomerId ?? null,
    };
}
export async function handleStripeWebhook(rawBody, signature) {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret)
        throw new Error('STRIPE_WEBHOOK_SECRET is not set');
    let event;
    try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    }
    catch (err) {
        throw new Error(`Webhook signature verification failed: ${err.message}`);
    }
    // Idempotency guard
    const already = await db
        .select({ id: stripeEvents.id })
        .from(stripeEvents)
        .where(eq(stripeEvents.id, event.id))
        .limit(1);
    if (already.length > 0)
        return;
    await db.insert(stripeEvents).values({
        id: event.id,
        type: event.type,
        payload: JSON.stringify(event),
    });
    switch (event.type) {
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
            await syncSubscription(event.data.object);
            break;
        case 'customer.subscription.deleted':
            await cancelSubscription(event.data.object);
            break;
        case 'invoice.payment_failed': {
            const inv = event.data.object;
            const subscriptionId = inv.parent?.subscription_details?.subscription ?? inv.subscription;
            if (subscriptionId)
                await markPastDue(subscriptionId);
            break;
        }
        default:
            logger.info('unhandled stripe event type', { eventType: event.type });
    }
}
async function syncSubscription(sub) {
    const userId = sub.metadata?.r3UserId;
    if (!userId) {
        logger.warn('subscription missing r3UserId metadata', { subscriptionId: sub.id });
        return;
    }
    const tier = sub.metadata?.r3Tier ?? 'explorer';
    const priceId = sub.items.data[0]?.price.id ?? null;
    const billingCycle = detectBillingCycle(sub);
    const status = sub.status;
    // Fix 2: current_period_start/end removed from top-level Subscription in
    // 2026-02-25.clover; now on subscription items.
    const periodStart = sub.items.data[0]?.current_period_start ?? 0;
    const periodEnd = sub.items.data[0]?.current_period_end ?? 0;
    await db
        .insert(subscriptions)
        .values({
        id: sub.id,
        userId,
        tier,
        status,
        billingCycle,
        stripeCustomerId: sub.customer,
        stripeSubscriptionId: sub.id,
        stripePriceId: priceId,
        currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
        currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
        trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    })
        .onConflictDoUpdate({
        target: subscriptions.userId,
        set: {
            tier, status, billingCycle,
            stripeCustomerId: sub.customer,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            currentPeriodStart: periodStart ? new Date(periodStart * 1000) : null,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
            trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
            updatedAt: new Date(),
        },
    });
}
async function cancelSubscription(sub) {
    const userId = sub.metadata?.r3UserId;
    if (!userId)
        return;
    await db
        .update(subscriptions)
        .set({ tier: 'explorer', status: 'canceled', canceledAt: new Date(), cancelAtPeriodEnd: false, updatedAt: new Date() })
        .where(eq(subscriptions.userId, userId));
}
async function markPastDue(subscriptionId) {
    await db
        .update(subscriptions)
        .set({ status: 'past_due', updatedAt: new Date() })
        .where(eq(subscriptions.stripeSubscriptionId, subscriptionId));
}
function detectBillingCycle(sub) {
    const interval = sub.items.data[0]?.price.recurring?.interval;
    return interval === 'year' ? 'annual' : 'monthly';
}
