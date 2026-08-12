import { jsx as _jsx } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// R3 · useSubscription Hook & SubscriptionProvider
// Drop into: client/src/hooks/useSubscription.ts
// Wrap your app:  <SubscriptionProvider> ... </SubscriptionProvider>
// ─────────────────────────────────────────────────────────────────────────────
import { createContext, useContext, useMemo } from 'react';
import { trpc } from '../lib/trpc';
import { useAuthStore } from '../hooks/authStore';
import { tierAtLeast, canUseFeature, checkLimit, TIER_DEFINITIONS, } from '../../../shared/subscription.types';
const SubscriptionContext = createContext(null);
// ── Provider ──────────────────────────────────────────────────────────────────
export function SubscriptionProvider({ children }) {
    // Gate query on Zustand auth store token — avoids a guaranteed 401
    // on every page load for unauthenticated visitors.
    const hasToken = useAuthStore(s => Boolean(s.token));
    const { data, isLoading } = trpc.subscription.getMySubscription.useQuery(undefined, {
        enabled: hasToken,
        staleTime: 1000 * 60 * 5,
        // Never retry on UNAUTHORIZED — user is not logged in, retrying just spams the server
        retry: (count, error) => {
            if (error?.data?.code === 'UNAUTHORIZED')
                return false;
            return count < 1;
        },
    });
    const checkoutMutation = trpc.subscription.createCheckout.useMutation();
    const portalMutation = trpc.subscription.createPortal.useMutation();
    const tier = data?.tier ?? 'explorer';
    const value = useMemo(() => ({
        subscription: data
            ? {
                ...data,
                currentPeriodEnd: data.currentPeriodEnd ? new Date(data.currentPeriodEnd) : null,
                trialEnd: data.trialEnd ? new Date(data.trialEnd) : null,
            }
            : null,
        tier,
        isLoading,
        can: (feature) => canUseFeature(tier, feature),
        atLeast: (required) => tierAtLeast(tier, required),
        checkUsage: (limit, currentUsage) => checkLimit(tier, limit, currentUsage),
        isExplorer: tier === 'explorer',
        isCreator: tier === 'creator',
        isProArtist: tier === 'pro_artist',
        isPaid: tier !== 'explorer',
        isTrialing: data?.status === 'trialing',
        tierDisplayName: TIER_DEFINITIONS[tier].displayName,
        startCheckout: async (targetTier, billingCycle) => {
            const result = await checkoutMutation.mutateAsync({
                tier: targetTier,
                billingCycle,
            });
            window.location.href = result.url;
        },
        openPortal: async () => {
            const result = await portalMutation.mutateAsync({});
            window.location.href = result.url;
        },
    }), [data, tier, isLoading, checkoutMutation, portalMutation]);
    return (_jsx(SubscriptionContext.Provider, { value: value, children: children }));
}
// ── Hook ──────────────────────────────────────────────────────────────────────
export function useSubscription() {
    const ctx = useContext(SubscriptionContext);
    if (!ctx) {
        throw new Error('useSubscription must be used inside <SubscriptionProvider>');
    }
    return ctx;
}
export function parseGateError(error) {
    try {
        const trpcError = error;
        if (!trpcError?.message)
            return null;
        const parsed = JSON.parse(trpcError.message);
        if (!parsed.type)
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
