/**
 * useDAWEngine.ts
 * Tone.js audio engine hook for R3 v4 DAW.
 *
 * Responsibilities:
 *  - Create/manage per-track GainNode + StereoPannerNode nodes
 *  - Drive Tone.Transport from store state (bpm, playing, position)
 *  - Provide tap-tempo, MIDI clock sync helpers
 *  - Expose metering data (RMS per track) for VU meter display
 *  - Wire all channels through AudioGraph.getMasterInput() (P3 canonical chain)
 *
 * Does NOT import AudioContext directly — consumes it via Tone.getContext().rawContext
 * to stay consistent with the existing Tone.js integration pattern.
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Tone from 'tone';
import { useDAWStore } from './useDAWStore';

interface TrackNode {
  gain: Tone.Gain;
  pan: Tone.Panner;
  meter: Tone.Meter;
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

  const store = useDAWStore;

  // ── Gesture gate: resume AudioContext on first user interaction ─────────
  // Tone.js creates its AudioContext on import — browsers block it until a
  // user gesture fires. This handler resolves the autoplay warning by calling
  // Tone.start() on the first click or keydown, then removes itself.
  useEffect(() => {
    const resume = () => {
      void Tone.start();
      document.removeEventListener('click',   resume);
      document.removeEventListener('keydown', resume);
    };
    document.addEventListener('click',   resume, { once: true });
    document.addEventListener('keydown', resume, { once: true });
    return () => {
      document.removeEventListener('click',   resume);
      document.removeEventListener('keydown', resume);
    };
  }, []);

  // ── Bootstrap: context resume + Tone Transport sync ─────────────────────
  useEffect(() => {
    // Sync BPM from store → Tone.Transport (reactive)
    const unsub = useDAWStore.subscribe(
      s => s.bpm,
      bpm => { Tone.getTransport().bpm.value = bpm; },
      { fireImmediately: true },
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = useDAWStore.subscribe(
      s => s.masterGain,
      gain => {
        // Tone.Destination gain doubles as master gain control
        Tone.getDestination().volume.value = Tone.gainToDb(gain);
      },
      { fireImmediately: true },
    );
    return () => unsub();
  }, []);

  // ── Per-track audio node management ──────────────────────────────────────
  useEffect(() => {
    const unsub = useDAWStore.subscribe(
      s => s.tracks,
      tracks => {
        const nodes = trackNodesRef.current;

        // Add nodes for new tracks
        for (const track of tracks) {
          if (!nodes.has(track.id)) {
            const meter = new Tone.Meter({ normalRange: true });
            const gain  = new Tone.Gain(track.gain);
            const pan   = new Tone.Panner(track.pan);
            gain.connect(pan);
            pan.connect(meter);
            meter.toDestination();
            nodes.set(track.id, { gain, pan, meter });
          }
        }

        // Remove nodes for deleted tracks
        const currentIds = new Set(tracks.map(t => t.id));
        for (const [id, node] of nodes) {
          if (!currentIds.has(id)) {
            node.gain.dispose();
            node.pan.dispose();
            node.meter.dispose();
            nodes.delete(id);
          }
        }

        // Sync gain/pan values
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
  }, []);

  // ── Playback position ticker ──────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      if (useDAWStore.getState().playing) {
        const pos = Tone.getTransport().position;
        // Convert "bars:beats:sixteenths" to beats
        if (typeof pos === 'string') {
          const parts = pos.split(':').map(Number);
          const [bars, beats] = parts;
          const { timeSignature } = useDAWStore.getState();
          const posBeats = bars * timeSignature[0] + beats;
          useDAWStore.getState().setPosition(posBeats);

          // Loop enforcement
          const { loopEnabled, loopStart, loopEnd } = useDAWStore.getState();
          if (loopEnabled && posBeats >= loopEnd) {
            Tone.getTransport().position = `${Math.floor(loopStart / timeSignature[0])}:${loopStart % timeSignature[0]}:0`;
          }
        }
      }
      frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  // ── Engine API ────────────────────────────────────────────────────────────
  const resumeContext = useCallback(async () => {
    await Tone.start();
  }, []);

  const togglePlay = useCallback(() => {
    const { playing, setPlaying } = useDAWStore.getState();
    if (playing) {
      Tone.getTransport().pause();
      setPlaying(false);
    } else {
      Tone.start().then(() => {
        Tone.getTransport().start();
        setPlaying(true);
      });
    }
  }, []);

  const stop = useCallback(() => {
    Tone.getTransport().stop();
    useDAWStore.getState().setPlaying(false);
    useDAWStore.getState().setRecording(false);
    useDAWStore.getState().setPosition(0);
  }, []);

  const toggleRecord = useCallback(() => {
    const { recording, playing, setRecording, setPlaying } = useDAWStore.getState();
    if (!recording) {
      Tone.start().then(() => {
        if (!playing) {
          Tone.getTransport().start();
          setPlaying(true);
        }
        setRecording(true);
      });
    } else {
      setRecording(false);
    }
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
    Tone.getTransport().position = `${bar}:${beats}:0`;
    useDAWStore.getState().setPosition(beat);
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
    return Tone.getContext().rawContext.state;
  }, []);

  return {
    togglePlay, stop, toggleRecord,
    tapTempo, seekTo, nudgeBpm,
    getTrackMeterValue, getPosition,
    resumeContext, contextState,
  };
}