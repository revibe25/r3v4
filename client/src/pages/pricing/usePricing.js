/**
 * usePricing.ts — Billing cycle state + checkout intent
 *
 * plan.id is SubscriptionTier ("explorer"|"creator"|"pro_artist") —
 * aligned with the server-side tier enum.
 *
 * Explorer (free) tier: skips checkout entirely — redirects to app.
 * Unauthenticated users: redirected to /login?redirect=/pricing before
 * any mutation is attempted — prevents guaranteed 401 from the server.
 * Double-submission guarded via inFlightRef (not useState — avoids
 * re-render on the guard check itself).
 */
import { useState, useCallback, useRef } from "react";
import { useAuthStore } from "../../hooks/authStore";
import { isFree } from "./pricing.data";
import { trpc } from "../../lib/trpc";
// ─── Hook ─────────────────────────────────────────────────────────────────────
export function usePricing() {
    const [cycle, setCycle] = useState("annual");
    const [checkoutStatus, setStatus] = useState({ type: "idle" });
    const inFlightRef = useRef(false);
    const hasToken = useAuthStore(s => Boolean(s.token));
    const { mutateAsync: checkout } = trpc.subscription.createCheckout.useMutation();
    const toggleCycle = useCallback(() => setCycle(p => p === "monthly" ? "annual" : "monthly"), []);
    const clearError = useCallback(() => setStatus({ type: "idle" }), []);
    const initiateCheckout = useCallback(async (plan) => {
        // Explorer is always free — skip checkout, go straight to app
        if (isFree(plan)) {
            window.location.href = "/";
            return;
        }
        // Guard: unauthenticated users go to login first
        if (!hasToken) {
            window.location.href = "/login?redirect=/pricing";
            return;
        }
        // Guard: prevent double-submission
        if (inFlightRef.current)
            return;
        inFlightRef.current = true;
        setStatus({ type: "pending", planId: plan.id });
        try {
            const result = await checkout({
                tier: plan.id,
                billingCycle: cycle,
            });
            window.location.href = result.url;
        }
        catch (err) {
            setStatus({
                type: "error",
                message: err instanceof Error ? err.message : "An unexpected error occurred.",
            });
        }
        finally {
            inFlightRef.current = false;
        }
    }, [cycle, hasToken, checkout]);
    return { cycle, setCycle, toggleCycle, checkoutStatus, initiateCheckout, clearError };
}
