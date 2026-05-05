/**
 * client/src/hooks/useLoopEngineFFTRef.ts
 * Bridges Tone.js FFT analysis to a stable React ref consumed by Three.js scenes.
 *
 * Returns a ref whose `.current` is updated every animation frame with:
 *   { fft: Float32Array (128 bins), rms: number, peak: number, beatEnergy: number }
 *
 * AudioReactiveScene and WaveformMesh import this hook to drive ShaderMaterial
 * uniforms and InstancedMesh positions without triggering React re-renders.
 *
 * Design decisions:
 *  - Uses a ref (not state) to avoid React re-render on every frame
 *  - FFT bin count: 128 (adequate for visual use; matches PRD ShaderMaterial needs)
 *  - Tone.FFT smoothing: 0.8 (typical for visuals — adjust for responsiveness)
 *  - Beat energy: sum of bins 0–4 (sub-bass, ~20–80 Hz at 44.1kHz/128 bins)
 *  - Cleanup: disposes Tone nodes on unmount
 */

import { useEffect, useRef } from 'react';
import * as Tone from 'tone';

export interface FFTFrame {
  fft:        Float32Array;  // 128 normalised frequency bins [0..1]
  rms:        number;        // 0–1 RMS of current frame
  peak:       number;        // 0–1 peak hold (decays 2%/frame)
  beatEnergy: number;        // 0–1 sub-bass energy (kick detector)
  waveform:   Float32Array;  // 128 waveform samples [-1..1]
}

const FFT_SIZE   = 128;
const SMOOTHING  = 0.8;
const PEAK_DECAY = 0.02;

export function useLoopEngineFFTRef(): React.MutableRefObject<FFTFrame> {
  const frameRef = useRef<FFTFrame>({
    fft:        new Float32Array(FFT_SIZE),
    rms:        0,
    peak:       0,
    beatEnergy: 0,
    waveform:   new Float32Array(FFT_SIZE),
  });

  useEffect(() => {
    // Tone.FFT — frequency domain
    const fftNode = new Tone.FFT({ size: FFT_SIZE, smoothing: SMOOTHING });
    // Tone.Waveform — time domain
    const waveformNode = new Tone.Waveform({ size: FFT_SIZE });
    // Tone.Meter — RMS
    const meterNode = new Tone.Meter({ normalRange: true, smoothing: 0.85 });

    // Tap into the Tone.Destination (master output) for analysis
    Tone.getDestination().connect(fftNode);
    Tone.getDestination().connect(waveformNode);
    Tone.getDestination().connect(meterNode);

    let peakHold  = 0;
    let rafHandle = 0;

    const tick = () => {
      // Frequency domain
      const rawFFT  = fftNode.getValue() as Float32Array;
      const normFFT = frameRef.current.fft;
      for (let i = 0; i < FFT_SIZE; i++) {
        // rawFFT values are in dB (-100..0); map to [0..1]
        normFFT[i] = Math.max(0, (rawFFT[i] + 100) / 100);
      }

      // Waveform
      const rawWave = waveformNode.getValue() as Float32Array;
      frameRef.current.waveform.set(rawWave);

      // RMS
      const rms = typeof meterNode.getValue() === 'number'
        ? (meterNode.getValue() as number)
        : ((meterNode.getValue() as number[])[0] ?? 0);

      // Peak hold with decay
      if (rms > peakHold) peakHold = rms;
      else peakHold = Math.max(0, peakHold - PEAK_DECAY);

      // Beat / kick energy: sum of sub-bass bins (bins 0–4 ≈ 0–170 Hz)
      let beatEnergy = 0;
      for (let i = 0; i < 5; i++) beatEnergy += normFFT[i];
      beatEnergy /= 5;

      frameRef.current.rms        = rms;
      frameRef.current.peak       = peakHold;
      frameRef.current.beatEnergy = beatEnergy;

      rafHandle = requestAnimationFrame(tick);
    };

    rafHandle = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafHandle);
      fftNode.dispose();
      waveformNode.dispose();
      meterNode.dispose();
    };
  }, []);

  return frameRef;
}