import { trpc } from "../lib/trpc";
import { useAuthStore } from "../hooks/authStore";

/**
 * Centralised billing hook — wraps subscription tRPC procedures.
 * The router is named `subscription` (not `billing`).
 * Import this instead of calling trpc.subscription.* directly.
 *
 * FIX: Replaced require() IIFE with reactive useAuthStore selector.
 * ROOT CAUSE: frozen IIFE captured token=null at mount, never re-evaluated
 * post-login. require() is unsupported in Vite ESM. Both caused 401s.
 */
export function useBilling() {
  const utils = trpc.useUtils();

  // Reactive selector — flips enabled=true the moment initAuth() sets the token
  const token = useAuthStore((s) => s.token);

  const { data: subscription, isLoading: loadingSubscription } =
    trpc.subscription.getMySubscription.useQuery(undefined, {
      enabled: Boolean(token),
      retry: (count: number, error: unknown) => {
        if ((error as { data?: { code?: string } })?.data?.code === "UNAUTHORIZED")
          return false;
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
