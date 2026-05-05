/**
 * use-loop-engine-fft.ts
 *
 * Polls loopEngine audio analysers every rAF and returns:
 *   - masterFft / masterWaveform          (Float32Array, live)
 *   - trackFft[n] / trackWaveform[n]      (Float32Array[], live)
 *   - bands: { sub, low, mid, high, presence, air }  (0-1 normalised RMS per band)
 *   - peakAmplitude / rms                 (0-1, from master waveform)
 *
 * Two variants:
 *   useLoopEngineFFT(fps?)        — React state, triggers re-renders at fps rate
 *   useLoopEngineFFTRef()         — ref only, zero re-renders, use inside useFrame
 */

import { useEffect, useRef, useState } from "react";
import {
  getLoopEngine,
  TRACK_COUNT,
  FFT_SIZE,
  ANALYSER_SIZE,
} from "../features/loopstation/engine/loopEngine";

const BAND_RANGES = {
  sub:      [20,    80]    as [number, number],
  low:      [80,    250]   as [number, number],
  mid:      [250,   2000]  as [number, number],
  high:     [2000,  8000]  as [number, number],
  presence: [8000,  12000] as [number, number],
  air:      [12000, 20000] as [number, number],
} as const;

export interface BandEnergies {
  sub: number; low: number; mid: number;
  high: number; presence: number; air: number;
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

function fftBandEnergy(fft: Float32Array, loHz: number, hiHz: number, sr = 44100): number {
  const binHz = sr / (fft.length * 2);
  const lo    = Math.max(0, Math.floor(loHz / binHz));
  const hi    = Math.min(fft.length - 1, Math.ceil(hiHz / binHz));
  if (lo > hi) return 0;
  let sum = 0;
  for (let i = lo; i <= hi; i++) {
    const lin = Math.pow(10, fft[i] / 20);
    sum += lin * lin;
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
  const bins = FFT_SIZE / 2;
  return {
    masterFft:      new Float32Array(bins),
    masterWaveform: new Float32Array(ANALYSER_SIZE),
    trackFft:       Array.from({ length: TRACK_COUNT }, () => new Float32Array(bins)),
    trackWaveform:  Array.from({ length: TRACK_COUNT }, () => new Float32Array(ANALYSER_SIZE)),
    bands:          { sub: 0, low: 0, mid: 0, high: 0, presence: 0, air: 0 },
    peakAmplitude:  0,
    rms:            0,
  };
}

export function useLoopEngineFFT(fps = 60): FFTData {
  const [data, setData] = useState<FFTData>(emptyData);
  const rafRef          = useRef<number>(0);
  const lastRef         = useRef(0);
  const interval        = 1000 / fps;

  useEffect(() => {
    const tick = (now: number) => {
      rafRef.current = requestAnimationFrame(tick);
      if (now - lastRef.current < interval) return;
      lastRef.current = now;
      const engine = getLoopEngine();
      if (!engine.initialized) return;
      const masterFft      = engine.getMasterFft();
      const masterWaveform = engine.getMasterWaveform();
      const bands          = buildBands(masterFft);
      let sumSq = 0, peak = 0;
      for (let i = 0; i < masterWaveform.length; i++) {
        const v = masterWaveform[i];
        sumSq += v * v;
        if (Math.abs(v) > peak) peak = Math.abs(v);
      }
      setData({
        masterFft, masterWaveform,
        trackFft:      Array.from({ length: TRACK_COUNT }, (_, i) => engine.getTrackFft(i)),
        trackWaveform: Array.from({ length: TRACK_COUNT }, (_, i) => engine.getTrackWaveform(i)),
        bands, peakAmplitude: peak,
        rms: Math.sqrt(sumSq / masterWaveform.length),
      });
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [interval]);

  return data;
}

/** Ref variant — zero re-renders. Use inside R3F useFrame. */
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
      let sumSq = 0, peak = 0;
      for (let i = 0; i < masterWaveform.length; i++) {
        const v = masterWaveform[i];
        sumSq += v * v;
        if (Math.abs(v) > peak) peak = Math.abs(v);
      }
      ref.current = {
        masterFft, masterWaveform,
        trackFft:      Array.from({ length: TRACK_COUNT }, (_, i) => engine.getTrackFft(i)),
        trackWaveform: Array.from({ length: TRACK_COUNT }, (_, i) => engine.getTrackWaveform(i)),
        bands, peakAmplitude: peak,
        rms: Math.sqrt(sumSq / masterWaveform.length),
      };
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  return ref;
}
