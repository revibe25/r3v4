// ─────────────────────────────────────────────────────────────────────────────
// R3 · useSubscription Hook & SubscriptionProvider
// Drop into: client/src/hooks/useSubscription.ts
// Wrap your app:  <SubscriptionProvider> ... </SubscriptionProvider>
// ─────────────────────────────────────────────────────────────────────────────

import React, { createContext, useContext, useMemo } from 'react';
import { trpc } from '../lib/trpc';
import { useAuthStore } from '../stores/authStore';                      // adjust to your trpc client path
import {
  UserSubscription,
  SubscriptionTier,
  TierFeatures,
  TierLimits,
  tierAtLeast,
  canUseFeature,
  checkLimit,
  TIER_DEFINITIONS,
} from '../../../shared/subscription.types';

// ── Context ───────────────────────────────────────────────────────────────────

interface SubscriptionContextValue {
  subscription: UserSubscription | null;
  tier: SubscriptionTier;
  isLoading: boolean;
  // Feature checks
  can: (feature: keyof TierFeatures) => boolean;
  atLeast: (tier: SubscriptionTier) => boolean;
  checkUsage: (
    limit: keyof TierLimits,
    currentUsage: number,
  ) => ReturnType<typeof checkLimit>;
  // Upgrade helpers
  isExplorer: boolean;
  isCreator: boolean;
  isProArtist: boolean;
  isPaid: boolean;
  isTrialing: boolean;
  tierDisplayName: string;
  // Actions
  startCheckout: (
    tier: Exclude<SubscriptionTier, 'explorer'>,
    billingCycle: 'monthly' | 'annual',
  ) => Promise<void>;
  openPortal: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  // Gate query on Zustand auth store token — avoids a guaranteed 401
  // on every page load for unauthenticated visitors.
  const hasToken = Boolean(useAuthStore.getState().token);

  const { data, isLoading } = trpc.subscription.getMySubscription.useQuery(undefined, {
    enabled: hasToken,
    staleTime: 1000 * 60 * 5,
    // Never retry on UNAUTHORIZED — user is not logged in, retrying just spams the server
    retry: (count, error: any) => {
      if (error?.data?.code === 'UNAUTHORIZED') return false;
      return count < 1;
    },
  });

  const checkoutMutation = trpc.subscription.createCheckout.useMutation();
  const portalMutation = trpc.subscription.createPortal.useMutation();

  const tier: SubscriptionTier = data?.tier ?? 'explorer';

  const value = useMemo<SubscriptionContextValue>(
    () => ({
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
    }),
    [data, tier, isLoading, checkoutMutation, portalMutation],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  }
  return ctx;
}

// ── Convenience hook: parse tRPC FORBIDDEN errors into gate results ───────────

export interface GateError {
  type: 'UPGRADE_REQUIRED' | 'FEATURE_GATED' | 'LIMIT_REACHED';
  userTier: SubscriptionTier;
  requiredTier: SubscriptionTier;
  requiredTierDisplay: string;
  upgradeUrl: string;
  message: string;
  limitType?: string;
  used?: number;
  limit?: number;
}

export function parseGateError(error: unknown): GateError | null {
  try {
    const trpcError = error as { message?: string; data?: { code?: string } };
    if (!trpcError?.message) return null;
    const parsed = JSON.parse(trpcError.message) as GateError;
    if (!parsed.type) return null;
    return parsed;
  } catch {
    return null;
  }
}
