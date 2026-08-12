import { create } from "zustand";
import { trpcVanilla } from "@/lib/trpc";
export const useTrialStore = create((set) => ({
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
export async function syncTrialStatus() {
    const status = await trpcVanilla.trial.status.query();
    useTrialStore.getState().setStatus({
        state: status.state,
        daysLeft: status.daysLeft,
        expiresAt: status.expiresAt,
    });
}
