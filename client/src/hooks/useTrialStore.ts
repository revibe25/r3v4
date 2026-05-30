import { create } from "zustand";
import { trpcVanilla } from "@/lib/trpc";

type TrialState = "not_started" | "active" | "expired" | "subscribed" | "loading";

interface TrialStore {
  state: TrialState;
  daysLeft: number | null;
  expiresAt: string | null;
  setStatus: (s: Omit<TrialStore, "setStatus" | "activateTrial">) => void;
  activateTrial: () => Promise<void>;
}

export const useTrialStore = create<TrialStore>((set) => ({
  state: "loading",
  daysLeft: null,
  expiresAt: null,

  setStatus: (s) => set(s),

  activateTrial: async () => {
    await trpcVanilla.trial.activate.mutate();
    const status = await trpcVanilla.trial.status.query();
    set({ state: status.state, daysLeft: status.daysLeft, expiresAt: status.expiresAt });
  },
}));

export async function syncTrialStatus(): Promise<void> {
  const status = await trpcVanilla.trial.status.query();
  useTrialStore.getState().setStatus({
    state: status.state,
    daysLeft: status.daysLeft,
    expiresAt: status.expiresAt,
  });
}
