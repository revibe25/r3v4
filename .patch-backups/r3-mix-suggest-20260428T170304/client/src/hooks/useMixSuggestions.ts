/**
 * client/src/hooks/useMixSuggestions.ts
 * Wraps trpc.daw["ai.suggestions"] — creator+ tier only.
 * Wire.txt §7 — all client-server comms through tRPC.
 *
 * aiDecisionLog write wiring (PRD §15 demo gate):
 *   1. On suggestions arrival   → write N rows with outcome "ignored"
 *   2. On accept(idx)            → update row to "accepted"
 *   3. On reject(idx)            → update row to "rejected"
 *
 * All writes guarded by sessionId from useSessionMetricsStore — no-op when
 * no session is active. The LLPTE pipeline can run pre-session (e.g. while
 * the user is browsing samples), so the guard is intentional.
 */
import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { useSessionMetricsStore } from "../stores/session-metrics.store";

export interface MixSuggestion {
  type:        "mix" | "arrangement" | "mastering" | "harmony" | "rhythm";
  confidence:  number;
  description: string;
  params:      Record<string, unknown>;
}

export interface TrackInput {
  id:     string;
  gain:   number;   // 0–1.5
  pan:    number;   // -1 to 1
  mute:   boolean;
  solo:   boolean;
}

export type SuggestionStatus = "idle" | "loading" | "done" | "error" | "tier_locked";

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function useMixSuggestions() {
  const [suggestions, setSuggestions] = useState<MixSuggestion[]>([]);
  const [status, setStatus]           = useState<SuggestionStatus>("idle");
  const [acceptedIds, setAcceptedIds] = useState<Set<number>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<number>>(new Set());

  // Parallel array — decisionIdsRef.current[idx] is the aiDecisionLog row id
  // for suggestions[idx]. null entries indicate the row write failed or the
  // session was inactive at surface time. Ref (not state) because click
  // handlers must read the latest value without re-rendering on every write.
  const decisionIdsRef = useRef<(string | null)[]>([]);

  const recordDecisionMut = trpc.sessionMetrics.recordDecision.useMutation();
  const recordOutcomeMut  = trpc.sessionMetrics.recordOutcome.useMutation();

  // Capture mutation refs — keeps accept/reject closures stable (empty deps).
  const recordDecisionMutRef = useRef(recordDecisionMut);
  const recordOutcomeMutRef  = useRef(recordOutcomeMut);
  recordDecisionMutRef.current = recordDecisionMut;
  recordOutcomeMutRef.current  = recordOutcomeMut;

  const mutation = trpc.daw["ai.suggestions"].useMutation({
    onMutate: () => {
      setStatus("loading");
      setSuggestions([]);
      decisionIdsRef.current = [];
    },
    onSuccess: async (data) => {
      const newSuggestions = data.suggestions as MixSuggestion[];
      // PRD §8.5 — server returns real measured latency for aiDecisionLog
      const latencyMs      = (data as { latencyMs?: number }).latencyMs ?? 0;
      setSuggestions(newSuggestions);
      setStatus("done");
      setAcceptedIds(new Set());
      setRejectedIds(new Set());

      // Surface-event logging: one row per suggestion with outcome "ignored".
      // Click handlers later update each row to "accepted" or "rejected".
      // Suggestions left untouched stay "ignored" — that's the desired signal.
      const sessionId = useSessionMetricsStore.getState().sessionId;
      if (!sessionId || newSuggestions.length === 0) {
        decisionIdsRef.current = newSuggestions.map(() => null);
        return;
      }

      const ids = await Promise.all(
        newSuggestions.map((s) =>
          recordDecisionMutRef.current
            .mutateAsync({
              sessionId,
              nodeId:              "aiMixEngine",
              actionType:          "mix_suggestion",
              // No trackId — Mix Suggestions are mix-wide
              inputConfidence:     clamp01(s.confidence),
              displayedConfidence: clamp01(s.confidence),
              decision: {
                type:        s.type,
                description: s.description,
                params:      s.params,
                confidence:  s.confidence,
              },
              outcome:    "ignored",
              latencyMs:  0,
            })
            .catch((err: unknown) => {
              console.error("[useMixSuggestions] surface log failed:", err);
              return null;
            })
        )
      );
      decisionIdsRef.current = ids;
    },
    onError: (err) => {
      if (err.data?.code === "FORBIDDEN") {
        setStatus("tier_locked");
      } else {
        setStatus("error");
      }
    },
  });

  const analyse = useCallback((
    tracks: TrackInput[],
    bpm: number,
    position: number = 0,
  ) => {
    mutation.mutate({
      tracks: tracks.map(t => ({
        type:        'audio'  as const,
        color:       '#a3e635',
        label:       t.id,
        armed:       false    as const,
        fxChain:     [] as Array<{ id: string; type: 'eq' | 'compressor' | 'reverb' | 'delay' | 'filter' | 'distortion'; params: Record<string, number>; enabled: boolean }>,
        sends:       [] as Array<{ busId: string; level: number }>,
        inputSource: null as string | null,
        ...t,
      })),
      bpm,
      position,
    });
  }, [mutation]);

  const accept = useCallback((idx: number) => {
    setAcceptedIds(prev => new Set(prev).add(idx));
    setRejectedIds(prev => { const s = new Set(prev); s.delete(idx); return s; });

    // Update the corresponding aiDecisionLog row to "accepted".
    // No-op if surface write failed (id === null) or session was inactive.
    const id = decisionIdsRef.current[idx];
    if (id) {
      recordOutcomeMutRef.current.mutate(
        { id, outcome: "accepted" },
        { onError: (err: unknown) =>
          console.error("[useMixSuggestions] accept update failed:", err)
        }
      );
    }
  }, []);

  const reject = useCallback((idx: number) => {
    setRejectedIds(prev => new Set(prev).add(idx));
    setAcceptedIds(prev => { const s = new Set(prev); s.delete(idx); return s; });

    const id = decisionIdsRef.current[idx];
    if (id) {
      recordOutcomeMutRef.current.mutate(
        { id, outcome: "rejected" },
        { onError: (err: unknown) =>
          console.error("[useMixSuggestions] reject update failed:", err)
        }
      );
    }
  }, []);

  const acceptRate = suggestions.length > 0
    ? Math.round((acceptedIds.size / suggestions.length) * 100)
    : 0;

  return {
    suggestions,
    status,
    acceptedIds,
    rejectedIds,
    acceptRate,
    isLoading: status === "loading",
    analyse,
    accept,
    reject,
  };
}
