/**
 * use-loop-engine-fft.ts
 *
 * Polls loopEngine audio analysers every rAF and returns:
 *   - masterFft / masterWaveform          (Float32Array, live)
 *   - trackFft[n] / trackWaveform[n]      (Float32Array[], live)
 *   - bands: { sub, low, mid, high, presence, air }  (0–1 normalised RMS per band)
 *   - peakAmplitude / rms                 (0–1, from master waveform)
 *
 * Consumed by:
 *   - AudioReactiveScene (Three.js uniforms)
 *   - WaveformMesh (InstancedMesh amplitude)
 *   - Any visualiser that needs band-energy reactivity
 *
 * fps param throttles state updates so React tree doesn't churn at 60fps
 * for components that only need 30fps granularity.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  getLoopEngine,
  TRACK_COUNT,
  FFT_SIZE,
  ANALYSER_SIZE,
} from '../features/loopstation/engine/loopEngine';

// ── Band frequency ranges (Hz) ────────────────────────────────────────────────

const BAND_RANGES = {
  sub:      [20,    80]    as [number, number],
  low:      [80,    250]   as [number, number],
  mid:      [250,   2000]  as [number, number],
  high:     [2000,  8000]  as [number, number],
  presence: [8000,  12000] as [number, number],
  air:      [12000, 20000] as [number, number],
} as const;

export type BandKey = keyof typeof BAND_RANGES;

export interface BandEnergies {
  sub:      number;
  low:      number;
  mid:      number;
  high:     number;
  presence: number;
  air:      number;
}

export interface FFTData {
  masterFft:      Float32Array;
  masterWaveform: Float32Array;
  trackFft:       Float32Array[];
  trackWaveform:  Float32Array[];
  bands:          BandEnergies;
  peakAmplitude:  number;
  rms:            number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Compute RMS energy of FFT bins in [loHz, hiHz].
 * Tone.js Analyser('fft') returns dBFS values (typically -∞ to 0).
 * We convert to linear before summing.
 */
function fftBandEnergy(
  fft:       Float32Array,
  loHz:      number,
  hiHz:      number,
  sampleRate = 44100,
): number {
  const binHz = sampleRate / (fft.length * 2);
  const lo    = Math.max(0, Math.floor(loHz / binHz));
  const hi    = Math.min(fft.length - 1, Math.ceil(hiHz / binHz));
  if (lo > hi) return 0;
  let sum = 0;
  for (let i = lo; i <= hi; i++) {
    const linear = Math.pow(10, fft[i] / 20);   // dBFS → linear
    sum += linear * linear;
  }
  return Math.sqrt(sum / (hi - lo + 1));
}

function buildBands(fft: Float32Array): BandEnergies {
  return {
    sub:      fftBandEnergy(fft, ...BAND_RANGES.sub),
    low:      fftBandEnergy(fft, ...BAND_RANGES.low),
    mid:      fftBandEnergy(fft, ...BAND_RANGES.mid),
    high:     fftBandEnergy(fft, ...BAND_RANGES.high),
    presence: fftBandEnergy(fft, ...BAND_RANGES.presence),
    air:      fftBandEnergy(fft, ...BAND_RANGES.air),
  };
}

function emptyData(): FFTData {
  const fftBins = FFT_SIZE / 2;
  return {
    masterFft:      new Float32Array(fftBins),
    masterWaveform: new Float32Array(ANALYSER_SIZE),
    trackFft:       Array.from({ length: TRACK_COUNT }, () => new Float32Array(fftBins)),
    trackWaveform:  Array.from({ length: TRACK_COUNT }, () => new Float32Array(ANALYSER_SIZE)),
    bands:          { sub: 0, low: 0, mid: 0, high: 0, presence: 0, air: 0 },
    peakAmplitude:  0,
    rms:            0,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @param fps   Target React state update rate (default 60). Use 30 for
 *              components that only need smoother meter/band data.
 * @param trackIndices  Which tracks to include in trackFft/trackWaveform.
 *              Default: all TRACK_COUNT tracks. Pass a subset for perf.
 */
export function useLoopEngineFFT(
  fps           = 60,
  trackIndices?: number[],
): FFTData {
  const [data, setData]   = useState<FFTData>(emptyData);
  const rafRef            = useRef<number>(0);
  const lastTickRef       = useRef(0);
  const intervalMs        = 1000 / fps;
  const indices           = trackIndices ?? Array.from({ length: TRACK_COUNT }, (_, i) => i);

  useEffect(() => {
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);

      // Throttle React state updates to target fps
      if (now - lastTickRef.current < intervalMs) return;
      lastTickRef.current = now;

      const engine = getLoopEngine();
      if (!engine.initialized) return;

      const masterFft      = engine.getMasterFft();
      const masterWaveform = engine.getMasterWaveform();
      const bands          = buildBands(masterFft);

      // Master peak + RMS from waveform
      let sumSq = 0;
      let peak  = 0;
      for (let i = 0; i < masterWaveform.length; i++) {
        const v = masterWaveform[i];
        sumSq += v * v;
        const abs = Math.abs(v);
        if (abs > peak) peak = abs;
      }
      const rms = Math.sqrt(sumSq / masterWaveform.length);

      setData({
        masterFft,
        masterWaveform,
        trackFft:      indices.map(i => engine.getTrackFft(i)),
        trackWaveform: indices.map(i => engine.getTrackWaveform(i)),
        bands,
        peakAmplitude: peak,
        rms,
      });
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [intervalMs, indices.join(',')]);   // eslint-disable-line

  return data;
}

// ── Ref variant — for Three.js useFrame (avoids React re-render) ──────────────

/**
 * Like useLoopEngineFFT but stores data in a ref instead of state.
 * Use inside R3F <Canvas> components where you read in useFrame callbacks,
 * not in React render. Zero React re-renders.
 *
 * @example
 *   const fftRef = useLoopEngineFFTRef();
 *   useFrame(() => {
 *     const { bands } = fftRef.current;
 *     mesh.scale.y = 1 + bands.sub * 2;
 *   });
 */
export function useLoopEngineFFTRef(): React.MutableRefObject<FFTData> {
  const ref    = useRef<FFTData>(emptyData());
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const tick = () => {
      rafRef.current = requestAnimationFrame(tick);
      const engine = getLoopEngine();
      if (!engine.initialized) return;

      const masterFft      = engine.getMasterFft();
      const masterWaveform = engine.getMasterWaveform();
      const bands          = buildBands(masterFft);

      let sumSq = 0;
      let peak  = 0;
      for (let i = 0; i < masterWaveform.length; i++) {
        const v = masterWaveform[i];
        sumSq += v * v;
        if (Math.abs(v) > peak) peak = Math.abs(v);
      }

      ref.current = {
        masterFft,
        masterWaveform,
        trackFft:      Array.from({ length: TRACK_COUNT }, (_, i) => engine.getTrackFft(i)),
        trackWaveform: Array.from({ length: TRACK_COUNT }, (_, i) => engine.getTrackWaveform(i)),
        bands,
        peakAmplitude: peak,
        rms:           Math.sqrt(sumSq / masterWaveform.length),
      };
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return ref;
}
