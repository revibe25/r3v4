import { trpc } from "../lib/trpc";

/**
 * Centralised billing hook — wraps subscription tRPC procedures.
 * The router is named `subscription` (not `billing`).
 * Import this instead of calling trpc.subscription.* directly.
 */
export function useBilling() {
  const utils = trpc.useUtils();

  const { data: subscription, isLoading: loadingSubscription } =
    trpc.subscription.getMySubscription.useQuery(undefined, {
      // Only fire when user is logged in
      enabled: Boolean(
        typeof window !== "undefined" &&
        (() => {
          try {
            const { useAuthStore } = require("../store/auth-store");
            return Boolean(useAuthStore.getState().token);
          } catch { return false; }
        })()
      ),
      retry: (count: number, error: any) => {
        if (error?.data?.code === "UNAUTHORIZED") return false;
        return count < 1;
      },
    });

  const { mutateAsync: createCheckout, isPending: creatingCheckout } =
    trpc.subscription.createCheckout.useMutation({
      onSuccess: ({ url }: { url: string }) => {
        window.location.href = url;
      },
    });

  const { mutateAsync: openPortal, isPending: openingPortal } =
    trpc.subscription.createPortal.useMutation({
      onSuccess: ({ url }: { url: string }) => {
        window.location.href = url;
      },
    });

  const isActive    = subscription?.status === "active";
  const isTrialing  = subscription?.status === "trialing";
  const isCancelled = subscription?.status === "canceled";

  return {
    subscription,
    isActive,
    isTrialing,
    isCancelled,
    loadingSubscription,
    // Checkout: pass { tier, billingCycle }
    createCheckout,
    creatingCheckout,
    // Portal: pass {} or { returnPath }
    openPortal,
    openingPortal,
    // Invalidate subscription cache manually if needed
    invalidate: () => utils.subscription.getMySubscription.invalidate(),
  };
}
