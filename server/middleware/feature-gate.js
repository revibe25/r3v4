/**
 * server/middleware/feature-gate.ts
 *
 * Item 5 — Guest AI transition counter (was explicitly unenforced)
 *
 * ROOT CAUSE: The guest path in checkAiTransitionLimit contained an explicit
 * comment "we let the request through" — every unauthenticated guest could
 * make unlimited AI transitions regardless of the Explorer tier limit of 3
 * per session. This rendered the entire aiTransitionsPerSession limit on the
 * Explorer tier meaningless for the majority of users who hadn't logged in yet.
 *
 * WHY THIS FIX IS CORRECT:
 * An in-memory Map keyed on sessionId tracks guest usage per server process.
 * This is appropriate because:
 *   1. Sessions are short-lived. A guest sessionId is valid only for the
 *      duration of a browser tab — it doesn't persist across restarts.
 *   2. We cannot write to the DB for guests (no userId to key on).
 *   3. The worst-case bypass is a server restart or a new sessionId, which
 *      is acceptable for a soft limit on a free tier.
 *
 * MEMORY SAFETY:
 * The counter map is bounded by a MAX_GUEST_SESSIONS ceiling and a TTL-based
 * eviction via a 1-hour periodic cleanup. Without this, a long-running server
 * could accumulate unbounded sessionId entries from crawlers and abandoned tabs.
 *
 * For production at scale: replace the in-memory Map with a Redis INCR/EXPIRE
 * call. The interface contract (sessionId → count) is identical.
 *
 * TS2742 FIX: Added explicit return type using tRPC middleware builder pattern
 * The middleware() function returns a type that tRPC knows internally
 * By chaining it in the export, we avoid the inference issue
 */
import { TRPCError } from '@trpc/server';
import { middleware } from '../trpc';
import { getUserSubscription } from '../services/stripe-subscription';
import { tierAtLeast, canUseFeature, TIER_DEFINITIONS, } from '../../shared/subscription.types';
import { db } from '../db';
import { aiTransitionUsage } from '../../shared/schema-subscription';
import { eq, and, sql } from 'drizzle-orm';
const MAX_GUEST_SESSIONS = 10000;
const GUEST_TTL_MS = 60 * 60 * 1000;
const guestCounters = new Map();
const evictionInterval = setInterval(() => {
    const cutoff = Date.now() - GUEST_TTL_MS;
    for (const [key, entry] of guestCounters) {
        if (entry.lastSeen < cutoff)
            guestCounters.delete(key);
    }
}, GUEST_TTL_MS);
if (evictionInterval.unref)
    evictionInterval.unref();
function getGuestCount(sessionId) {
    return guestCounters.get(sessionId)?.count ?? 0;
}
function incrementGuestCount(sessionId) {
    const existing = guestCounters.get(sessionId);
    if (existing) {
        existing.count += 1;
        existing.lastSeen = Date.now();
    }
    else {
        if (guestCounters.size >= MAX_GUEST_SESSIONS) {
            const oldestKey = guestCounters.keys().next().value;
            if (oldestKey)
                guestCounters.delete(oldestKey);
        }
        guestCounters.set(sessionId, { count: 1, lastSeen: Date.now() });
    }
}
// TS2742 FIX: Explicitly name the return type using ReturnType
export const attachSubscription = middleware(async ({ ctx, next }) => {
    if (!ctx.user?.id) {
        return next({ ctx: { ...ctx, subscription: null } });
    }
    const subscription = await getUserSubscription(ctx.user.id);
    return next({ ctx: { ...ctx, subscription } });
});
export function requireTier(required) {
    return middleware(async ({ ctx, next }) => {
        const tier = ctx.subscription?.tier ?? 'explorer';
        if (!tierAtLeast(tier, required)) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: JSON.stringify({
                    type: 'UPGRADE_REQUIRED',
                    userTier: tier,
                    requiredTier: required,
                    requiredTierDisplay: TIER_DEFINITIONS[required].displayName,
                    upgradeUrl: '/pricing',
                    message: `This feature requires ${TIER_DEFINITIONS[required].displayName} or above.`,
                }),
            });
        }
        return next();
    });
}
export function requireFeature(feature) {
    return middleware(async ({ ctx, next }) => {
        const tier = ctx.subscription?.tier ?? 'explorer';
        if (!canUseFeature(tier, feature)) {
            const tiers = ['explorer', 'creator', 'pro_artist'];
            const requiredTier = tiers.find((t) => canUseFeature(t, feature)) ?? 'pro_artist';
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: JSON.stringify({
                    type: 'FEATURE_GATED',
                    feature,
                    userTier: tier,
                    requiredTier,
                    requiredTierDisplay: TIER_DEFINITIONS[requiredTier].displayName,
                    upgradeUrl: '/pricing',
                    message: `Upgrade to ${TIER_DEFINITIONS[requiredTier].displayName} to unlock this feature.`,
                }),
            });
        }
        return next();
    });
}
export const checkAiTransitionLimit = middleware(async ({ ctx, next }) => {
    const tier = ctx.subscription?.tier ?? 'explorer';
    const limit = TIER_DEFINITIONS[tier].limits.aiTransitionsPerSession;
    if (limit === 'unlimited')
        return next();
    const sessionId = ctx.sessionId;
    if (!sessionId)
        return next();
    const numericLimit = limit;
    const userId = ctx.user?.id;
    if (userId) {
        // C-03 FIX: query by (userId, usageDate) — sessionId column was removed
        // from aiTransitionUsage by the C-03 audit. Rate limit is now daily (UTC).
        const usageDate = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
        const [row] = await db
            .select({ total: aiTransitionUsage.transitionCount })
            .from(aiTransitionUsage)
            .where(and(eq(aiTransitionUsage.userId, userId), eq(aiTransitionUsage.usageDate, usageDate)));
        const used = Number(row?.total ?? 0);
        if (used >= numericLimit) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: JSON.stringify({
                    type: 'LIMIT_REACHED',
                    limitType: 'aiTransitionsPerSession',
                    used,
                    limit: numericLimit,
                    userTier: tier,
                    requiredTier: 'creator',
                    upgradeUrl: '/pricing',
                    message: `You've used all ${numericLimit} AI transitions for this session. Upgrade to Creator for unlimited.`,
                }),
            });
        }
        const result = await next();
        try {
            // Upsert — composite PK (userId, usageDate) makes this atomic.
            // No id column; no sessionId column.
            await db
                .insert(aiTransitionUsage)
                .values({ userId, usageDate, transitionCount: 1 })
                .onConflictDoUpdate({
                target: [aiTransitionUsage.userId, aiTransitionUsage.usageDate],
                set: {
                    transitionCount: sql `${aiTransitionUsage.transitionCount} + 1`,
                    updatedAt: new Date(),
                },
            });
        }
        catch (err) {
            process.stderr.write(`[feature-gate] failed to record AI usage: ${String(err)}\n`);
        }
        return result;
    }
    else {
        const used = getGuestCount(sessionId);
        if (used >= numericLimit) {
            throw new TRPCError({
                code: 'FORBIDDEN',
                message: JSON.stringify({
                    type: 'LIMIT_REACHED',
                    limitType: 'aiTransitionsPerSession',
                    used,
                    limit: numericLimit,
                    userTier: 'explorer',
                    requiredTier: 'creator',
                    upgradeUrl: '/pricing',
                    message: `You've used all ${numericLimit} AI transitions for this session. Sign up or upgrade to Creator for unlimited.`,
                }),
            });
        }
        const result = await next();
        incrementGuestCount(sessionId);
        return result;
    }
});
export async function assertTrackUploadAllowed(currentTrackCount, tier) {
    const limit = TIER_DEFINITIONS[tier].limits.trackUploads;
    if (limit === 'unlimited')
        return;
    if (currentTrackCount >= limit) {
        throw new TRPCError({
            code: 'FORBIDDEN',
            message: JSON.stringify({
                type: 'LIMIT_REACHED',
                limitType: 'trackUploads',
                used: currentTrackCount,
                limit,
                userTier: tier,
                requiredTier: 'creator',
                upgradeUrl: '/pricing',
                message: `You've reached your ${limit}-track limit. Upgrade to Creator for up to 200 tracks.`,
            }),
        });
    }
}
