/**
 * client/src/hooks/useMixSuggestions.ts
 * Wraps trpc.daw["ai.suggestions"] — creator+ tier only.
 * Wire.txt §7 — all client-server comms through tRPC.
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";

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

export function useMixSuggestions() {
  const [suggestions, setSuggestions] = useState<MixSuggestion[]>([]);
  const [status, setStatus]           = useState<SuggestionStatus>("idle");
  const [acceptedIds, setAcceptedIds] = useState<Set<number>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<number>>(new Set());

  const mutation = trpc.daw["ai.suggestions"].useMutation({
    onMutate: () => {
      setStatus("loading");
      setSuggestions([]);
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions as MixSuggestion[]);
      setStatus("done");
      setAcceptedIds(new Set());
      setRejectedIds(new Set());
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
        label:       String((t as Record<string, unknown>).id ?? ''),
        armed:       false    as const,
        fxChain:     [] as Array<{ id: string; type: string; params: Record<string, unknown>; enabled: boolean }>,
        sends:       [] as Array<{ id: string; gain: number }>,
        inputSource: '',
        ...t,
      })),
      bpm,
      position,
    });
  }, [mutation]);

  const accept = useCallback((idx: number) => {
    setAcceptedIds(prev => new Set(prev).add(idx));
    setRejectedIds(prev => { const s = new Set(prev); s.delete(idx); return s; });
  }, []);

  const reject = useCallback((idx: number) => {
    setRejectedIds(prev => new Set(prev).add(idx));
    setAcceptedIds(prev => { const s = new Set(prev); s.delete(idx); return s; });
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
