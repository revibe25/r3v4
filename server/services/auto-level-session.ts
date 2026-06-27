// ============================================================
// AutoLevelSession — server-side session stats persistence
// ============================================================
import type { SessionStats } from "@shared/auto-level.types";

interface StoredSession extends SessionStats {
  endTime?:     number;
  durationSec?: number;
}

const sessions = new Map<string, StoredSession>();

export const autoLevelSessionService = {
  upsert(stats: SessionStats): void {
    sessions.set(stats.sessionId, { ...stats });
  },

  close(sessionId: string): StoredSession | null {
    const session = sessions.get(sessionId);
    if (!session) return null;

    // Single Date.now() so endTime and durationSec are consistent
    const now = Date.now();
    const closed: StoredSession = {
      ...session,
      endTime:     now,
      durationSec: (now - session.startTime) / 1000,
    };
    sessions.set(sessionId, closed);
    return closed;
  },

  get(sessionId: string): StoredSession | undefined {
    return sessions.get(sessionId);
  },

  aggregate(): {
    totalSessions:              number;
    totalTimeSavedSec:          number;
    avgAdjustmentsPerSession:   number;
    avgClipPreventedPerSession: number;
    avgEfficiencyPct:           number;
  } {
    const all = [...sessions.values()];
    if (all.length === 0) {
      return {
        totalSessions:              0,
        totalTimeSavedSec:          0,
        avgAdjustmentsPerSession:   0,
        avgClipPreventedPerSession: 0,
        avgEfficiencyPct:           0,
      };
    }

    const totalTimeSaved = all.reduce((s, r) => s + r.estimatedTimeSavedSeconds, 0);
    const totalAdj       = all.reduce((s, r) => s + r.totalAdjustments, 0);
    const totalClipPrev  = all.reduce((s, r) => s + r.clippingEventsPreventedCount, 0);
    const durations      = all.filter(r => r.durationSec).map(r => r.durationSec!);
    const avgDur         = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 1;

    return {
      totalSessions:              all.length,
      totalTimeSavedSec:          totalTimeSaved,
      avgAdjustmentsPerSession:   totalAdj / all.length,
      avgClipPreventedPerSession: totalClipPrev / all.length,
      avgEfficiencyPct:           Math.min(99, (totalTimeSaved / all.length / avgDur) * 100),
    };
  },
};
