import { eq } from "drizzle-orm";
import { db } from "../db";
import { sessionMetrics } from "../../shared/schema-session-metrics";
import { calculateTimeSavings } from "./time-savings.service";
import type {
  SessionStartInput,
  SessionStopInput,
  SessionMetricsSummary,
} from "../../shared/session-metrics.types";

export async function startSession(
  userId: string,
  input: SessionStartInput
): Promise<{ sessionId: string }> {
  const [row] = await db
    .insert(sessionMetrics)
    .values({
      userId,
      bpm: input.bpm,
      trackIds: input.trackIds,
      startedAt: new Date(),
    })
    .returning({ sessionId: sessionMetrics.id });

  if (!row) throw new Error("Failed to create session metrics row");
  return { sessionId: row.sessionId };
}

export async function stopSession(
  userId: string,
  input: SessionStopInput
): Promise<SessionMetricsSummary> {
  const [existing] = await db
    .select()
    .from(sessionMetrics)
    .where(eq(sessionMetrics.id, input.sessionId))
    .limit(1);

  if (!existing) throw new Error(`Session not found: ${input.sessionId}`);
  if (existing.userId !== userId) throw new Error("Unauthorized");

  const endedAt = new Date();
  const durationSeconds = Math.floor(
    (endedAt.getTime() - existing.startedAt.getTime()) / 1000
  );

  const savings = calculateTimeSavings({
    durationSeconds,
    trackCount: (existing.trackIds as string[]).length,
    bpm: existing.bpm,
  });

  const [updated] = await db
    .update(sessionMetrics)
    .set({
      endedAt,
      durationSeconds,
      timeSavedSeconds: savings.totalSavedSeconds,
    })
    .where(eq(sessionMetrics.id, input.sessionId))
    .returning();

  if (!updated) throw new Error("Failed to update session metrics");

  return {
    sessionId: updated.id,
    durationSeconds: updated.durationSeconds,
    timeSavedSeconds: updated.timeSavedSeconds,
    peakEnergyScore: updated.peakEnergyScore ?? 0,
    mixQualityScore: updated.mixQualityScore ?? 0,
    bpm: updated.bpm,
    startedAt: updated.startedAt.toISOString(),
    endedAt: updated.endedAt?.toISOString() ?? null,
  };
}

export async function getSessionSummary(
  userId: string,
  sessionId: string
): Promise<SessionMetricsSummary | null> {
  const [row] = await db
    .select()
    .from(sessionMetrics)
    .where(eq(sessionMetrics.id, sessionId))
    .limit(1);

  if (!row || row.userId !== userId) return null;

  return {
    sessionId: row.id,
    durationSeconds: row.durationSeconds,
    timeSavedSeconds: row.timeSavedSeconds,
    peakEnergyScore: row.peakEnergyScore ?? 0,
    mixQualityScore: row.mixQualityScore ?? 0,
    bpm: row.bpm,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
  };
}
