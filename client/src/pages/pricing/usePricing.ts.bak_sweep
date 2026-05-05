/**
 * usePricing.ts — Billing cycle state + checkout intent
 *
 * plan.id is now SubscriptionTier ("explorer"|"creator"|"pro_artist") —
 * aligned with the server-side tier enum. The prior PlanId type was wrong.
 *
 * tRPC checkout call: NOT yet activated.
 * BLOCKER: paste contents of shared/types/trpc.ts to confirm:
 *   - Exact procedure path (likely trpc.subscription.createCheckoutSession)
 *   - Input shape ({ tier: SubscriptionTier, billingCycle: BillingCycle })
 *   - Response shape ({ checkoutUrl: string })
 * Once confirmed, uncomment the three lines marked TODO below.
 *
 * Explorer (free) tier: skips checkout entirely — just redirects to app.
 * Double-submission guarded via inFlightRef (not useState — avoids re-render
 * on the guard check itself).
 */

import { useState, useCallback, useRef } from "react";
import type { BillingCycle, Plan } from "./pricing.data";
import { resolvePrice, isFree } from "./pricing.data";
import type { SubscriptionTier } from '../../../../shared/subscription.types';
import { trpc } from "../../lib/trpc";

export type CheckoutStatus =
  | { type: "idle"    }
  | { type: "pending"; planId: SubscriptionTier }
  | { type: "error";   message: string           };

export interface UsePricingReturn {
  cycle:            BillingCycle;
  setCycle:         (c: BillingCycle) => void;
  toggleCycle:      () => void;
  checkoutStatus:   CheckoutStatus;
  initiateCheckout: (plan: Plan) => Promise<void>;
  clearError:       () => void;
}

export function usePricing(): UsePricingReturn {
  const [cycle, setCycle]           = useState<BillingCycle>("annual");
  const [checkoutStatus, setStatus] = useState<CheckoutStatus>({ type: "idle" });
  const inFlightRef                 = useRef(false);
  const _checkoutMutation = trpc.subscription.createCheckout.useMutation();

  const _toggleCycle = useCallback(() =>
    setCycle(p => p === "monthly" ? "annual" : "monthly"), []);

  const _clearError = useCallback(() => setStatus({ type: "idle" }), []);

  const _initiateCheckout = useCallback(async (plan: Plan): Promise<void> => {
    // Explorer is always free — no checkout flow
    if (isFree(plan)) {
      window.location.href = "/";
      return;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setStatus({ type: "pending", planId: plan.id });

    try {
      const _result = await checkoutMutation.mutateAsync({
        tier: plan.id as 'creator' | 'pro_artist',
        billingCycle: cycle,
      });
      window.location.href = result.url;

    } catch (err) {
      setStatus({
        type: "error",
        message: err instanceof Error ? err.message : "An unexpected error occurred.",
      });
    } finally {
      inFlightRef.current = false;
    }
  }, [cycle, checkoutMutation]);

  return { cycle, setCycle, toggleCycle, checkoutStatus, initiateCheckout, clearError };
}
