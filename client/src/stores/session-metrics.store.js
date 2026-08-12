import { create } from "zustand";
export const useSessionMetricsStore = create((set) => ({
    sessionId: null,
    isActive: false,
    summary: null,
    setSessionId: (id) => set({ sessionId: id }),
    setActive: (active) => set({ isActive: active }),
    setSummary: (summary) => set({ summary }),
    reset: () => set({ sessionId: null, isActive: false, summary: null }),
}));
