import { create } from "zustand";

export interface SessionMetricsSummary {
  sessionId: string;
  durationSeconds: number;
  timeSavedSeconds: number;
  peakEnergyScore: number;
  mixQualityScore: number;
  bpm: number;
  startedAt: string;
  endedAt: string | null;
}

interface SessionMetricsState {
  sessionId: string | null;
  isActive: boolean;
  summary: SessionMetricsSummary | null;
  setSessionId: (id: string | null) => void;
  setActive: (active: boolean) => void;
  setSummary: (summary: SessionMetricsSummary | null) => void;
  reset: () => void;
}

export const _useSessionMetricsStore = create<SessionMetricsState>((set) => ({
  sessionId: null,
  isActive: false,
  summary: null,
  setSessionId: (id) => set({ sessionId: id }),
  setActive: (active) => set({ isActive: active }),
  setSummary: (summary) => set({ summary }),
  reset: () => set({ sessionId: null, isActive: false, summary: null }),
}));
