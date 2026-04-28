#!/usr/bin/env python3
"""
wire-aidecisionlog.py — R3 v4
==============================
PRD §15 demo gate: aiDecisionLog write wiring.

Wires aiDecisionLog writes into the two live click paths:
  1. useMixSuggestions  — surface-time + accept/reject (3 write modes)
  2. useAutoLeveling    — accept/reject only (auto-apply path is P1)

Both hooks read sessionId from useSessionMetricsStore (Zustand). All writes
guarded by sessionId — silently no-op when no session is active.

Files patched:
  client/src/hooks/useMixSuggestions.ts        (full rewrite)
  client/src/hooks/useAutoLeveling.ts          (full rewrite)
  server/routers/sessionMetrics.router.ts      (surgical: add .output(z.string()))

Why the server patch:
  recordDecision currently has no .output() schema. tRPC 11 infers from the
  implementation, but without a Zod output schema the response is not runtime-
  validated, and IDE type display can be lossy. logAIDecision returns the
  inserted row id (Promise<string>) — useMixSuggestions needs that id to later
  update the row's outcome on accept/reject click. Adding .output(z.string())
  guarantees the type + validates at runtime.

Pre-conditions verified before any write:
  - All three files exist
  - All contain expected anchor strings (proves they are the read versions)
  - Backup directory writable

Rollback:
  Backups at ~/.aidecisionlog-bak/. To restore:
    cp ~/.aidecisionlog-bak/useMixSuggestions.ts.bak ~/Stable/client/src/hooks/useMixSuggestions.ts
    cp ~/.aidecisionlog-bak/useAutoLeveling.ts.bak   ~/Stable/client/src/hooks/useAutoLeveling.ts

Usage:
  python3 wire-aidecisionlog.py
  cd ~/Stable/client && tsc --noEmit
  # if 0 errors:
  cd ~/Stable && git add -A && git commit -m \\
    "feat(P0): wire aiDecisionLog writes — useMixSuggestions + useAutoLeveling"
"""

import os
import shutil
import sys

# ── Paths ─────────────────────────────────────────────────────────────────────

STABLE = os.path.expanduser("~/Stable")
HOOKS  = os.path.join(STABLE, "client/src/hooks")

MIXSUGG_PATH  = os.path.join(HOOKS, "useMixSuggestions.ts")
AUTOLVL_PATH  = os.path.join(HOOKS, "useAutoLeveling.ts")
ROUTER_PATH   = os.path.join(STABLE, "server/routers/sessionMetrics.router.ts")

BAK_DIR = os.path.expanduser("~/.aidecisionlog-bak")

# ── Output helpers ────────────────────────────────────────────────────────────

def die(msg):
    print(f"\n[FATAL] {msg}", file=sys.stderr)
    sys.exit(1)

def ok(msg):   print(f"[OK]    {msg}")
def info(msg): print(f"[INFO]  {msg}")

# ─────────────────────────────────────────────────────────────────────────────
# NEW FILE CONTENTS
# ─────────────────────────────────────────────────────────────────────────────

NEW_MIXSUGG = r'''/**
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
'''

NEW_AUTOLVL = r'''// ─────────────────────────────────────────────────────────────
// client/src/hooks/useAutoLeveling.ts
//
// React hook that wraps AutoLevelPipeline and exposes a clean
// API for the MixerWithAI / AILevelAssist components.
//
// aiDecisionLog wiring (PRD §15 demo gate):
//   - accept(trackId) → write row with outcome "accepted"
//   - reject(trackId) → write row with outcome "rejected"
//   - Auto-apply (≥0.65 confidence) is NOT yet logged here — requires
//     AutoLevelPipeline event-shape changes (P1 follow-up).
// All writes guarded by sessionId from useSessionMetricsStore.
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  TrackId,
  TrackAILevelState,
  AutoLevelSessionStats,
  AutoLevelRecommendation,
  AutoLevelEvent,
} from '../../../shared/auto-level.types';
import type { PipelineNodeState } from '../../../packages/llpte-core/src/AutoLevelPipeline';
import { AutoLevelPipeline } from '../../../packages/llpte-core/src/AutoLevelPipeline';
import { TrackAnalyzer } from '../../../packages/llpte-signal/src/analyzers/TrackAnalyzer';
import { trpc } from '@/lib/trpc';
import { useSessionMetricsStore } from '../stores/session-metrics.store';

// ── Public types ───────────────────────────────────────────────

export interface TrackAudioRef {
  trackId:      string;
  analyserNode: AnalyserNode;
  gainNode:     GainNode;
  eqNodes?:     BiquadFilterNode[];
}

interface UseAutoLevelingOptions {
  autoStart?:  boolean;
  analysisHz?: number;
}

interface UseAutoLevelingResult {
  enabled:             boolean;
  toggle:              () => void;
  trackStates:         Map<TrackId, TrackAILevelState>;
  accept:              (trackId: TrackId) => void;
  reject:              (trackId: TrackId) => void;
  notifyFaderMove:     (trackId: TrackId, newGainLinear: number) => void;
  nodeState:           PipelineNodeState;
  sessionStats:        AutoLevelSessionStats;
  latestRecommendation: AutoLevelRecommendation | null;
}

const DEFAULT_NODE_STATE: PipelineNodeState = {
  inputRouter:     'idle',
  spectralAnalyzer:'idle',
  aiMixEngine:     'idle',
  transitionGraph: 'idle',
  outputBus:       'idle',
  lastInferenceMs: 0,
  analysisFrameRate: 0,
};

const DEFAULT_STATS: AutoLevelSessionStats = {
  sessionStartedAt:             Date.now(),
  totalAIAdjustments:           0,
  totalManualAdjustments:       0,
  clippingEventsPreventedCount: 0,
  acceptedSuggestions:          0,
  rejectedSuggestions:          0,
  estimatedMinutesSaved:        0,
};

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ── Hook ───────────────────────────────────────────────────────

export function useAutoLeveling(
  audioContext:   AudioContext | null,
  masterAnalyser: AnalyserNode | null,
  trackRefs:      TrackAudioRef[],
  options:        UseAutoLevelingOptions = {},
): UseAutoLevelingResult {
  const { autoStart = false, analysisHz = 30 } = options;

  const pipelineRef = useRef<AutoLevelPipeline | null>(null);

  const [enabled,             setEnabled]             = useState(false);
  const [trackStates,         setTrackStates]         = useState<Map<TrackId, TrackAILevelState>>(new Map());
  const [nodeState,           setNodeState]           = useState<PipelineNodeState>(DEFAULT_NODE_STATE);
  const [sessionStats,        setSessionStats]        = useState<AutoLevelSessionStats>(DEFAULT_STATS);
  const [latestRecommendation,setLatestRecommendation]= useState<AutoLevelRecommendation | null>(null);

  // ── aiDecisionLog wiring ─────────────────────────────────────
  // Refs sync state into the accept/reject closures without forcing them to
  // re-create on every recommendation (which arrives at analysisHz, e.g. 30Hz).
  // Stable callbacks prevent <AILevelAssist /> from re-rendering 30 times/sec.
  const recordDecisionMut    = trpc.sessionMetrics.recordDecision.useMutation();
  const recordDecisionMutRef = useRef(recordDecisionMut);
  const latestRecRef         = useRef<AutoLevelRecommendation | null>(latestRecommendation);
  const nodeStateRef         = useRef<PipelineNodeState>(nodeState);
  recordDecisionMutRef.current = recordDecisionMut;
  useEffect(() => { latestRecRef.current = latestRecommendation; }, [latestRecommendation]);
  useEffect(() => { nodeStateRef.current = nodeState; },           [nodeState]);

  useEffect(() => {
    if (!audioContext || !masterAnalyser) return;

    const pipeline = new AutoLevelPipeline(masterAnalyser, audioContext.sampleRate, { analysisHz });
    pipelineRef.current = pipeline;

    for (const ref of trackRefs) {
      const analyzer = new TrackAnalyzer({ trackId: ref.trackId, analyserNode: ref.analyserNode });
      pipeline.registerTrack(analyzer, ref.gainNode, audioContext, ref.eqNodes);
    }

    const unsubEvents = pipeline.subscribe((event: AutoLevelEvent) => {
      if (event.type === 'recommendation') {
        const rec = event.data as AutoLevelRecommendation;
        setLatestRecommendation(rec);
        setSessionStats({ ...pipeline.stats });

        setTrackStates(prev => {
          const next = new Map(prev);
          for (const adj of rec.gainAdjustments) {
            const existing = next.get(adj.trackId);
            next.set(adj.trackId, {
              trackId:       adj.trackId,
              currentGain:   1,
              suggestedGain: Math.pow(10, adj.deltaDb / 20),
              confidence:    adj.confidence,
              isClipping:    rec.clippingAlerts.includes(adj.trackId),
              userOverride:  existing?.userOverride ?? false,
              eqSuggestions: rec.eqSuggestions.filter(eq => eq.trackId === adj.trackId),
            });
          }
          for (const trackId of rec.clippingAlerts) {
            if (!next.has(trackId)) {
              next.set(trackId, {
                trackId, currentGain: 1, suggestedGain: null,
                confidence: null, isClipping: true,
                userOverride: false, eqSuggestions: [],
              });
            }
          }
          return next;
        });
      }

      if (event.type === 'override_set' && event.trackId) {
        setTrackStates(prev => {
          const next = new Map(prev);
          const ex   = next.get(event.trackId!);
          if (ex) next.set(event.trackId!, { ...ex, userOverride: true });
          return next;
        });
      }

      if (event.type === 'adjustment_accepted' && event.trackId) {
        setTrackStates(prev => {
          const next = new Map(prev);
          const ex   = next.get(event.trackId!);
          if (ex) next.set(event.trackId!, { ...ex, userOverride: false });
          return next;
        });
      }
    });

    const unsubNodeState = pipeline.subscribeNodeState(setNodeState);

    if (autoStart) { pipeline.start(); setEnabled(true); }

    return () => {
      unsubEvents();
      unsubNodeState();
      pipeline.dispose();
      pipelineRef.current = null;
    };
  }, [audioContext, masterAnalyser]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(() => {
    const p = pipelineRef.current;
    if (!p) return;
    if (p.running) { p.stop(); setEnabled(false); }
    else           { p.start(); setEnabled(true);  }
  }, []);

  const accept = useCallback((trackId: TrackId) => {
    pipelineRef.current?.acceptSuggestion(trackId);
    setSessionStats(s => ({ ...s, acceptedSuggestions: s.acceptedSuggestions + 1 }));

    // Log to aiDecisionLog if a session is active.
    // Reads sessionId via Zustand getState — no re-render dependency.
    const sessionId = useSessionMetricsStore.getState().sessionId;
    const rec       = latestRecRef.current;
    if (sessionId && rec) {
      const adj = rec.gainAdjustments.find(g => g.trackId === trackId);
      if (adj) {
        recordDecisionMutRef.current.mutate(
          {
            sessionId,
            nodeId:              'aiMixEngine',
            actionType:          'gain_adjust',
            trackId,
            inputConfidence:     clamp01(adj.confidence),
            displayedConfidence: clamp01(adj.confidence),
            decision: {
              deltaDb:       adj.deltaDb,
              confidence:    adj.confidence,
              eqSuggestions: rec.eqSuggestions.filter(eq => eq.trackId === trackId),
            },
            outcome:   'accepted',
            latencyMs: Math.max(0, Math.round(nodeStateRef.current.lastInferenceMs)),
          },
          { onError: (err: unknown) =>
            console.error('[useAutoLeveling] accept log failed:', err)
          }
        );
      }
    }
  }, []);

  const reject = useCallback((trackId: TrackId) => {
    pipelineRef.current?.rejectSuggestion(trackId);
    setSessionStats(s => ({ ...s, rejectedSuggestions: s.rejectedSuggestions + 1 }));

    const sessionId = useSessionMetricsStore.getState().sessionId;
    const rec       = latestRecRef.current;
    if (sessionId && rec) {
      const adj = rec.gainAdjustments.find(g => g.trackId === trackId);
      if (adj) {
        recordDecisionMutRef.current.mutate(
          {
            sessionId,
            nodeId:              'aiMixEngine',
            actionType:          'gain_adjust',
            trackId,
            inputConfidence:     clamp01(adj.confidence),
            displayedConfidence: clamp01(adj.confidence),
            decision: {
              deltaDb:       adj.deltaDb,
              confidence:    adj.confidence,
              eqSuggestions: rec.eqSuggestions.filter(eq => eq.trackId === trackId),
            },
            outcome:   'rejected',
            latencyMs: Math.max(0, Math.round(nodeStateRef.current.lastInferenceMs)),
          },
          { onError: (err: unknown) =>
            console.error('[useAutoLeveling] reject log failed:', err)
          }
        );
      }
    }
  }, []);

  const notifyFaderMove = useCallback((trackId: TrackId, newGainLinear: number) => {
    pipelineRef.current?.notifyUserFaderMove(trackId, newGainLinear);
    setSessionStats(s => ({ ...s, totalManualAdjustments: s.totalManualAdjustments + 1 }));
  }, []);

  return { enabled, toggle, trackStates, accept, reject, notifyFaderMove, nodeState, sessionStats, latestRecommendation };
}
'''

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 1 — Pre-flight
# ─────────────────────────────────────────────────────────────────────────────

print("=" * 60)
print("PHASE 1 — Pre-flight")
print("=" * 60)

for path in (MIXSUGG_PATH, AUTOLVL_PATH, ROUTER_PATH):
    if not os.path.isfile(path):
        die(f"File not found: {path}")
    ok(f"Found: {os.path.relpath(path, STABLE)}")

# Read current contents
with open(MIXSUGG_PATH, "r", encoding="utf-8") as f:
    old_mixsugg = f.read()
with open(AUTOLVL_PATH, "r", encoding="utf-8") as f:
    old_autolvl = f.read()
with open(ROUTER_PATH, "r", encoding="utf-8") as f:
    old_router = f.read()

# Anchor checks — confirm these are the read versions, not something else
MIXSUGG_ANCHORS = [
    'trpc.daw["ai.suggestions"]',
    'export interface MixSuggestion',
    'const accept = useCallback((idx: number)',
]
AUTOLVL_ANCHORS = [
    'AutoLevelPipeline',
    'pipelineRef.current?.acceptSuggestion',
    'pipelineRef.current?.rejectSuggestion',
]
# Router patch is surgical: must contain the exact unmodified procedure string
ROUTER_OLD_PROC = """  recordDecision: protectedProcedure
    .input(z.object({
      sessionId:           z.string(),
      nodeId:              z.string(),
      actionType:          z.string(),
      trackId:             z.string().optional(),
      inputConfidence:     z.number().min(0).max(1),
      displayedConfidence: z.number().min(0).max(1),
      decision:            z.record(z.unknown()),
      outcome:             z.enum(["auto_applied","accepted","rejected","ignored","discarded"]),
      latencyMs:           z.number().int().min(0),
    }))
    .mutation(({ input }) => logAIDecision(input)),"""

ROUTER_NEW_PROC = """  recordDecision: protectedProcedure
    .input(z.object({
      sessionId:           z.string(),
      nodeId:              z.string(),
      actionType:          z.string(),
      trackId:             z.string().optional(),
      inputConfidence:     z.number().min(0).max(1),
      displayedConfidence: z.number().min(0).max(1),
      decision:            z.record(z.unknown()),
      outcome:             z.enum(["auto_applied","accepted","rejected","ignored","discarded"]),
      latencyMs:           z.number().int().min(0),
    }))
    .output(z.string())
    .mutation(({ input }) => logAIDecision(input)),"""

for anchor in MIXSUGG_ANCHORS:
    if anchor not in old_mixsugg:
        die(f"useMixSuggestions.ts missing anchor: {anchor!r}\nFile may have changed since read.")
ok("useMixSuggestions.ts anchors verified")

for anchor in AUTOLVL_ANCHORS:
    if anchor not in old_autolvl:
        die(f"useAutoLeveling.ts missing anchor: {anchor!r}\nFile may have changed since read.")
ok("useAutoLeveling.ts anchors verified")

if ROUTER_OLD_PROC not in old_router:
    die(
        "sessionMetrics.router.ts: recordDecision procedure not found in expected form.\n"
        "File may have changed since read, or formatting differs.\n"
        "Inspect manually before retrying."
    )
ok("sessionMetrics.router.ts: recordDecision procedure located")

# Idempotency check — refuse to apply if patch already applied
if "useSessionMetricsStore" in old_mixsugg and "recordDecisionMut" in old_mixsugg:
    die("useMixSuggestions.ts already contains the patch.\nDelete or restore from backup before re-running.")
if "useSessionMetricsStore" in old_autolvl and "recordDecisionMut" in old_autolvl:
    die("useAutoLeveling.ts already contains the patch.\nDelete or restore from backup before re-running.")
if ".output(z.string())" in old_router:
    die("sessionMetrics.router.ts already contains .output(z.string()).\nDelete or restore from backup before re-running.")
ok("Idempotency check passed — patch not yet applied")

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 2 — Backup
# ─────────────────────────────────────────────────────────────────────────────

print()
print("=" * 60)
print("PHASE 2 — Backup")
print("=" * 60)

os.makedirs(BAK_DIR, exist_ok=True)
ok(f"Backup directory: {BAK_DIR}")

mixsugg_bak = os.path.join(BAK_DIR, "useMixSuggestions.ts.bak")
autolvl_bak = os.path.join(BAK_DIR, "useAutoLeveling.ts.bak")
router_bak  = os.path.join(BAK_DIR, "sessionMetrics.router.ts.bak")

try:
    shutil.copy2(MIXSUGG_PATH, mixsugg_bak)
    ok(f"Backed up: useMixSuggestions.ts        →  {os.path.basename(mixsugg_bak)}")
    shutil.copy2(AUTOLVL_PATH, autolvl_bak)
    ok(f"Backed up: useAutoLeveling.ts          →  {os.path.basename(autolvl_bak)}")
    shutil.copy2(ROUTER_PATH, router_bak)
    ok(f"Backed up: sessionMetrics.router.ts    →  {os.path.basename(router_bak)}")
except OSError as e:
    die(f"Backup failed: {e}")

def rollback():
    print("\n[ROLLBACK] Restoring originals...", file=sys.stderr)
    for src, dst, label in (
        (mixsugg_bak, MIXSUGG_PATH, "useMixSuggestions.ts"),
        (autolvl_bak, AUTOLVL_PATH, "useAutoLeveling.ts"),
        (router_bak,  ROUTER_PATH,  "sessionMetrics.router.ts"),
    ):
        try:
            shutil.copy2(src, dst)
            print(f"[ROLLBACK]   Restored: {label}", file=sys.stderr)
        except OSError as e:
            print(f"[ROLLBACK]   FAILED {label}: {e}", file=sys.stderr)

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 3 — Write new files
# ─────────────────────────────────────────────────────────────────────────────

print()
print("=" * 60)
print("PHASE 3 — Writing patched files")
print("=" * 60)

try:
    with open(MIXSUGG_PATH, "w", encoding="utf-8") as f:
        f.write(NEW_MIXSUGG)
    ok(f"Wrote: useMixSuggestions.ts        ({len(NEW_MIXSUGG)} bytes)")
except OSError as e:
    rollback()
    die(f"Write failed for useMixSuggestions.ts: {e}")

try:
    with open(AUTOLVL_PATH, "w", encoding="utf-8") as f:
        f.write(NEW_AUTOLVL)
    ok(f"Wrote: useAutoLeveling.ts          ({len(NEW_AUTOLVL)} bytes)")
except OSError as e:
    rollback()
    die(f"Write failed for useAutoLeveling.ts: {e}")

# Surgical patch on router — single string replacement
new_router = old_router.replace(ROUTER_OLD_PROC, ROUTER_NEW_PROC)
if new_router == old_router:
    rollback()
    die("Router patch had no effect — replace produced identical content.")
if new_router.count(".output(z.string())") != 1:
    rollback()
    die(f"Router patch produced unexpected count of .output(z.string()): {new_router.count('.output(z.string())')}")

try:
    with open(ROUTER_PATH, "w", encoding="utf-8") as f:
        f.write(new_router)
    ok(f"Patched: sessionMetrics.router.ts  (+.output(z.string()) on recordDecision)")
except OSError as e:
    rollback()
    die(f"Write failed for sessionMetrics.router.ts: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# PHASE 4 — Post-write verify
# ─────────────────────────────────────────────────────────────────────────────

print()
print("=" * 60)
print("PHASE 4 — Post-write verify")
print("=" * 60)

with open(MIXSUGG_PATH, "r", encoding="utf-8") as f:
    new_mixsugg_check = f.read()
with open(AUTOLVL_PATH, "r", encoding="utf-8") as f:
    new_autolvl_check = f.read()
with open(ROUTER_PATH, "r", encoding="utf-8") as f:
    new_router_check = f.read()

VERIFY_ANCHORS = [
    "useSessionMetricsStore",
    "recordDecisionMut",
    "trpc.sessionMetrics.recordDecision",
]
for anchor in VERIFY_ANCHORS:
    if anchor not in new_mixsugg_check:
        rollback()
        die(f"Post-write verify failed for useMixSuggestions.ts — missing {anchor!r}")
    if anchor not in new_autolvl_check:
        rollback()
        die(f"Post-write verify failed for useAutoLeveling.ts — missing {anchor!r}")

if "trpc.sessionMetrics.recordOutcome" not in new_mixsugg_check:
    rollback()
    die("Post-write verify failed — useMixSuggestions.ts missing recordOutcome wiring")

if ".output(z.string())" not in new_router_check:
    rollback()
    die("Post-write verify failed — sessionMetrics.router.ts missing .output(z.string())")

ok("All anchor strings present in all three patched files")

# ─────────────────────────────────────────────────────────────────────────────
# DONE
# ─────────────────────────────────────────────────────────────────────────────

print()
print("=" * 60)
print("[DONE]")
print("=" * 60)
print()
print("Files patched:")
print(f"  client/src/hooks/useMixSuggestions.ts        ({len(NEW_MIXSUGG):>5} bytes — full rewrite)")
print(f"  client/src/hooks/useAutoLeveling.ts          ({len(NEW_AUTOLVL):>5} bytes — full rewrite)")
print(f"  server/routers/sessionMetrics.router.ts             (+.output(z.string()) — surgical)")
print()
print(f"Backups: {BAK_DIR}/")
print()
print("Next steps:")
print("  1. cd ~/Stable/client && tsc --noEmit")
print("     Expected: 0 errors")
print()
print("  2. cd ~/Stable && tsc --noEmit  (server side)")
print("     Expected: 0 errors")
print()
print("  3. If both clean, commit:")
print("     cd ~/Stable && git add -A && git commit -m \\")
print('       "feat(P0): wire aiDecisionLog writes — useMixSuggestions + useAutoLeveling"')
print()
print("  4. Live verify (PRD §15 demo gate):")
print("     a. pnpm dev")
print("     b. Start session via DJ controls (transport play)")
print("     c. Open AI MIX panel → click ANALYSE")
print("     d. Click ✓ on 1+ suggestions, ✕ on 1+, ignore the rest")
print("     e. Query DB:")
print("          SELECT outcome, COUNT(*) FROM ai_decision_log")
print("          WHERE session_id = '<sid>' GROUP BY outcome;")
print("        Expected: rows with outcome IN ('ignored','accepted','rejected')")
print("     f. End session → SessionSummaryPanel acceptance rate ≠ 0")
print()
print("Rollback (if tsc errors):")
print(f"  cp {mixsugg_bak} {MIXSUGG_PATH}")
print(f"  cp {autolvl_bak} {AUTOLVL_PATH}")
print(f"  cp {router_bak}  {ROUTER_PATH}")
print()
print("Out of scope (P1 follow-ups):")
print("  - Auto-apply (≥0.65) logging — needs AutoLevelPipeline event-shape change")
print("  - Dead code cleanup: useAIMix.ts, useSessionMetrics.ts, aiMix.router.ts:recordOutcome")
print("  - liveSummary count exclusion (now correct under new architecture)")