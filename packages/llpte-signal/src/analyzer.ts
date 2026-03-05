/**
 * @llpte/llpte-signal — Audio Signal Analyzer
 *
 * Computes BPM, key, energy, spectral centroid, and RMS from raw audio.
 * Target: analysis time < 2000ms per track.
 *
 * STUB NOTICE:
 *   BPM and key detection are placeholder implementations.
 *   Replace with Essentia.js for production:
 *     https://essentia.upf.edu/essentiajs/
 *   Or aubio.js for a lighter alternative.
 */

import type { RawAudioBuffer, AnalysisResult } from './types';

// ── Analysis cache — avoids re-analyzing identical sources ────────────────────
const analysisCache = new Map<string, AnalysisResult>();

// ── RMS Loudness ──────────────────────────────────────────────────────────────
function computeRMS(channels: Float32Array[]): number {
  // Mix to mono first
  const len = channels[0].length;
  let sum = 0;
  for (let i = 0; i < len; i++) {
    let sample = 0;
    for (const ch of channels) sample += ch[i];
    sample /= channels.length;
    sum += sample * sample;
  }
  return Math.sqrt(sum / len);
}

// ── Energy (normalized from RMS) ─────────────────────────────────────────────
function computeEnergy(rms: number): number {
  // Clamp to 0–1 range with perceptual scaling
  return Math.min(1.0, Math.pow(rms * 3.5, 0.6));
}

// ── Spectral Centroid (approximation from time-domain) ────────────────────────
function computeSpectralCentroid(mono: Float32Array, sampleRate: number): number {
  const N = Math.min(4096, mono.length);
  let weightedSum = 0;
  let magnitudeSum = 0;
  for (let i = 0; i < N; i++) {
    const freq = (i / N) * (sampleRate / 2);
    const magnitude = Math.abs(mono[i]);
    weightedSum += freq * magnitude;
    magnitudeSum += magnitude;
  }
  return magnitudeSum > 0 ? weightedSum / magnitudeSum : sampleRate / 4;
}

// ── Dynamic Range (peak vs RMS) ───────────────────────────────────────────────
function computeDynamicRange(mono: Float32Array, rms: number): number {
  let peak = 0;
  for (let i = 0; i < mono.length; i++) {
    const abs = Math.abs(mono[i]);
    if (abs > peak) peak = abs;
  }
  if (rms <= 0 || peak <= 0) return 0;
  return 20 * Math.log10(peak / rms);
}

// ── BPM Detection (stub — replace with Essentia.js) ──────────────────────────
function estimateBPM(
  _mono: Float32Array,
  _sampleRate: number
): { bpm: number; confidence: number } {
  // TODO: Replace with:
  //   import { EssentiaWASM } from 'essentia.js';
  //   const essentia = new Essentia(await EssentiaWASM());
  //   const result = essentia.RhythmExtractor2013(vectorInput);
  //   return { bpm: result.bpm, confidence: result.confidence };
  console.warn('[llpte-signal] BPM detection stub — integrate Essentia.js for production');
  return { bpm: 128, confidence: 0 };
}

// ── Key Detection (stub — replace with Essentia.js KeyExtractor) ──────────────
function estimateKey(
  _mono: Float32Array
): { key: string; confidence: number } {
  // TODO: Replace with:
  //   const key = essentia.KeyExtractor(vectorInput);
  //   return { key: toCamelot(key.key, key.scale), confidence: key.strength };
  console.warn('[llpte-signal] Key detection stub — integrate Essentia.js for production');
  return { key: '8A', confidence: 0 };
}

// ── Main Entry Point ──────────────────────────────────────────────────────────
export async function analyzeAudio(buffer: RawAudioBuffer): Promise<AnalysisResult> {
  // Cache hit
  if (buffer.sourceId) {
    const cached = analysisCache.get(buffer.sourceId);
    if (cached) return cached;
  }

  const start = performance.now();
  const mono = buffer.channelData[0];

  const rms              = computeRMS(buffer.channelData);
  const energy           = computeEnergy(rms);
  const spectralCentroid = computeSpectralCentroid(mono, buffer.sampleRate);
  const dynamicRange     = computeDynamicRange(mono, rms);
  const { bpm, confidence: bpmConfidence } = estimateBPM(mono, buffer.sampleRate);
  const { key, confidence: keyConfidence } = estimateKey(mono);

  const result: AnalysisResult = {
    bpm,
    bpmConfidence,
    key,
    keyConfidence,
    energy,
    spectralCentroid,
    rmsLoudness:    rms,
    dynamicRange,
    analysisTimeMs: parseFloat((performance.now() - start).toFixed(2)),
  };

  // Cache result
  if (buffer.sourceId) analysisCache.set(buffer.sourceId, result);

  // Target warning
  if (result.analysisTimeMs > 2000) {
    console.warn(`[llpte-signal] Analysis exceeded 2000ms target: ${result.analysisTimeMs}ms`);
  }

  return result;
}

export function clearAnalysisCache(): void {
  analysisCache.clear();
}
