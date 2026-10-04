/**
 * useDAWEngine.ts
 * Tone.js audio engine hook for R3 v4 DAW.
 *
 * Responsibilities:
 *  - Create/manage per-track GainNode + StereoPannerNode nodes
 *  - Drive Tone.getTransport() from store state (bpm, playing, position)
 *  - Provide tap-tempo, MIDI clock sync helpers
 *  - Expose metering data (RMS per track) for VU meter display
 *  - Wire all channels through AudioGraph.getMasterInput() (P3 canonical chain)
 *
 * Does NOT own Tone.js loading or AudioContext lifecycle.
 * Runtime Tone is consumed only through the canonical R3 tone-runtime authority.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import type * as ToneTypes from 'tone';
import {
  Tone,
  waitForToneReady,
  isToneReady,
  initializeToneFromGesture,
} from '@/audio/core/tone-runtime';
import { useDAWStore } from './useDAWStore';
import { getAudioContext } from '@/audio/core/audio-context';
import { getAudioGraph } from '@/audio/core/audio-graph';

interface TrackNode {
  gain: ToneTypes.Gain;
  pan: ToneTypes.Panner;
  meter: ToneTypes.Meter;
}

interface EngineAPI {
  togglePlay: () => void;
  stop: () => void;
  toggleRecord: () => void;
  tapTempo: () => void;
  seekTo: (beat: number) => void;
  nudgeBpm: (delta: number) => void;
  getTrackMeterValue: (trackId: string) => number;
  getPosition: () => number;
  resumeContext: () => Promise<void>;
  contextState: () => AudioContextState;
}

export function useDAWEngine(): EngineAPI {
  const trackNodesRef = useRef<Map<string, TrackNode>>(new Map());
  const tapTimesRef   = useRef<number[]>([]);
  const frameRef      = useRef<number>(0);
  const [toneReady, setToneReady] = useState(() => isToneReady());

  const store = useDAWStore;

  // V1.3 gesture paths cross the canonical Tone runtime through the
  // engine API below. No AudioContext or Tone lifecycle is owned here.
  useEffect(() => {
    let alive = true;

    if (isToneReady()) {
      setToneReady(true);
      return () => {
        alive = false;
      };
    }

    void waitForToneReady()
      .then(() => {
        if (alive) setToneReady(true);
      })
      .catch(() => {
        if (alive) setToneReady(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  // ── Bootstrap: canonical Tone runtime → Transport sync ───────────────────
  useEffect(() => {
    if (!toneReady) return;

    const unsub = useDAWStore.subscribe(
      s => s.bpm,
      bpm => { Tone.getTransport().bpm.value = bpm; },
      { fireImmediately: true },
    );

    // Store position remains the application source of truth during bootstrap.
    // Tone transport position is established only by explicit seek/play actions.

    return () => unsub();
  }, [toneReady]);

  useEffect(() => {
    if (!toneReady) return;

    const unsub = useDAWStore.subscribe(
      s => s.masterGain,
      gain => {
        // Canonical R3 master bus owns final gain before limiter/analyser.
        getAudioGraph().setMasterVolume(gain);
      },
      { fireImmediately: true },
    );

    return () => unsub();
  }, [toneReady]);

  // ── Per-track audio node management ──────────────────────────────────────
  useEffect(() => {
    if (!toneReady) return;

    const unsub = useDAWStore.subscribe(
      s => s.tracks,
      tracks => {
        const nodes = trackNodesRef.current;

        // Add nodes for new tracks.
        for (const track of tracks) {
          if (!nodes.has(track.id)) {
            const meter = new Tone.Meter({ normalRange: true });
            const gain  = new Tone.Gain(track.gain);
            const pan   = new Tone.Panner(track.pan);

            const audioGraph = getAudioGraph();

            gain.connect(pan);
            pan.connect(meter);
            meter.connect(audioGraph.masterGain);

            nodes.set(track.id, { gain, pan, meter });
          }
        }

        // Remove nodes for deleted tracks.
        const currentIds = new Set(tracks.map(t => t.id));

        for (const [id, node] of nodes) {
          if (!currentIds.has(id)) {
            const audioGraph = getAudioGraph();

            try {
              node.meter.disconnect(audioGraph.masterGain);
            } catch {
              // Already disconnected.
            }

            node.gain.dispose();
            node.pan.dispose();
            node.meter.dispose();
            nodes.delete(id);
          }
        }

        // Sync gain/pan values.
        for (const track of tracks) {
          const node = nodes.get(track.id);
          if (!node) continue;

          const effectiveGain = track.mute ? 0 : track.gain;

          if (node.gain.gain.value !== effectiveGain) {
            node.gain.gain.rampTo(effectiveGain, 0.01);
          }

          if (node.pan.pan.value !== track.pan) {
            node.pan.pan.rampTo(track.pan, 0.01);
          }
        }
      },
      { fireImmediately: true },
    );

    return () => unsub();
  }, [toneReady]);


  // ── Playback position ticker ──────────────────────────────────────────────
  useEffect(() => {
    if (!toneReady) return;

    const tick = () => {
      if (useDAWStore.getState().playing) {
        const pos = Tone.getTransport().position;

        // Convert "bars:beats:sixteenths" to beats.
        if (typeof pos === 'string') {
          const parts = pos.split(':').map(Number);
          const [bars, beats] = parts;
          const { timeSignature } = useDAWStore.getState();
          const posBeats = bars * timeSignature[0] + beats;

          useDAWStore.getState().setPosition(posBeats);

          // Loop enforcement.
          const { loopEnabled, loopStart, loopEnd } =
            useDAWStore.getState();

          if (loopEnabled && posBeats >= loopEnd) {
            Tone.getTransport().position =
              `${Math.floor(loopStart / timeSignature[0])}:${loopStart % timeSignature[0]}:0`;
          }
        }
      }

      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameRef.current);
  }, [toneReady]);

  // ── Engine API ────────────────────────────────────────────────────────────
  const resumeContext = useCallback(async () => {
    await initializeToneFromGesture();
  }, []);

  const togglePlay = useCallback(() => {
    const { playing, setPlaying } = useDAWStore.getState();

    if (playing) {
      if (isToneReady()) {
        Tone.getTransport().pause();
      }

      setPlaying(false);
      return;
    }

    void initializeToneFromGesture()
      .then(() => {
        Tone.getTransport().start();
        setPlaying(true);
      })
      .catch(() => {
        setPlaying(false);
      });
  }, []);

  const stop = useCallback(() => {
    if (isToneReady()) {
      Tone.getTransport().stop();
    }

    useDAWStore.getState().setPlaying(false);
    useDAWStore.getState().setRecording(false);
    useDAWStore.getState().setPosition(0);
  }, []);

  const toggleRecord = useCallback(() => {
    const { recording, playing, setRecording, setPlaying } =
      useDAWStore.getState();

    if (recording) {
      setRecording(false);
      return;
    }

    void initializeToneFromGesture()
      .then(() => {
        if (!playing) {
          Tone.getTransport().start();
          setPlaying(true);
        }

        setRecording(true);
      })
      .catch(() => {
        setRecording(false);
      });
  }, []);

  const tapTempo = useCallback(() => {
    const now = Date.now();
    const taps = tapTimesRef.current;
    taps.push(now);

    // Keep last 4 taps
    if (taps.length > 4) taps.splice(0, taps.length - 4);

    // Discard if gap > 3s (user restarted tapping)
    if (taps.length > 1 && now - taps[0] > 3000) {
      tapTimesRef.current = [now];
      return;
    }

    if (taps.length >= 2) {
      const intervals = taps.slice(1).map((t, i) => t - taps[i]);
      const avgMs = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const bpm = Math.round(60000 / avgMs);
      useDAWStore.getState().setBpm(bpm);
    }
  }, []);

  const seekTo = useCallback((beat: number) => {
    const { timeSignature } = useDAWStore.getState();
    const bar   = Math.floor(beat / timeSignature[0]);
    const beats = beat % timeSignature[0];

    useDAWStore.getState().setPosition(beat);

    if (isToneReady()) {
      Tone.getTransport().position = `${bar}:${beats}:0`;
    }
  }, []);

  const nudgeBpm = useCallback((delta: number) => {
    useDAWStore.getState().setBpm(useDAWStore.getState().bpm + delta);
  }, []);

  const getTrackMeterValue = useCallback((trackId: string): number => {
    const node = trackNodesRef.current.get(trackId);
    if (!node) return 0;
    const val = node.meter.getValue();
    return typeof val === 'number' ? val : (val as number[])[0] ?? 0;
  }, []);

  const getPosition = useCallback((): number => {
    return useDAWStore.getState().position;
  }, []);

  const contextState = useCallback((): AudioContextState => {
    // Keep pre-ready state side-effect free. The canonical native context
    // remains the sole context authority.
    if (!isToneReady()) return 'suspended';

    return getAudioContext().state;
  }, []);

  return {
    togglePlay, stop, toggleRecord,
    tapTempo, seekTo, nudgeBpm,
    getTrackMeterValue, getPosition,
    resumeContext, contextState,
  };
}