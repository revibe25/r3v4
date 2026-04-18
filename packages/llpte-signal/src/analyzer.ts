/**
 * @llpte/llpte-signal — Audio Signal Analyzer v2
 *
 * BPM  — RMS energy envelope decimation + autocorrelation  O(n/HOP + env*lagRange)
 * Key  — Zero-crossing rate chromagram + KS correlation    O(n/ZC_WINDOW)
 * All other metrics — single-pass O(n)
 *
 * Target: < 2000ms for 4-second 44100Hz buffer.
 */

import type { RawAudioBuffer, AnalysisResult } from './types';

const analysisCache = new Map<string, AnalysisResult>();

function toMono(channels: Float32Array[]): Float32Array {
  const len = channels[0].length;
  const nCh = channels.length;
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let c = 0; c < nCh; c++) s += channels[c][i];
    out[i] = s / nCh;
  }
  return out;
}

/** Single-pass: RMS + peak + energy */
function computeMetrics(channels: Float32Array[]): {
  rms: number; energy: number; dynamicRange: number;
} {
  const len = channels[0].length;
  const nCh = channels.length;
  let sum = 0, peak = 0;
  for (let i = 0; i < len; i++) {
    let s = 0;
    for (let c = 0; c < nCh; c++) s += channels[c][i];
    s /= nCh;
    sum += s * s;
    const abs = s < 0 ? -s : s;
    if (abs > peak) peak = abs;
  }
  const rms          = Math.sqrt(sum / len);
  const energy       = Math.min(1.0, Math.pow(rms * 3.5, 0.6));
  const dynamicRange = rms > 0 && peak > 0 ? 20 * Math.log10(peak / rms) : 0;
  return { rms, energy, dynamicRange };
}

function computeSpectralCentroid(mono: Float32Array, sampleRate: number): number {
  const N = Math.min(4096, mono.length);
  let wsum = 0, msum = 0;
  for (let i = 0; i < N; i++) {
    const mag = mono[i] < 0 ? -mono[i] : mono[i];
    const freq = (i / N) * (sampleRate / 2);
    wsum += freq * mag;
    msum += mag;
  }
  return msum > 0 ? wsum / msum : sampleRate / 4;
}

// ── BPM: energy envelope autocorrelation ──────────────────────────────────────
// HOP=512 → envelope is ~344 samples for 4s@44100 — autocorrelation is trivial
function estimateBPM(mono: Float32Array, sampleRate: number): { bpm: number; confidence: number } {
  const HOP = 512, MIN_BPM = 60, MAX_BPM = 200;
  const envLen = Math.floor(mono.length / HOP);
  if (envLen < 8) return { bpm: 128, confidence: 0 };

  // Decimate to RMS energy envelope
  const env = new Float32Array(envLen);
  for (let i = 0; i < envLen; i++) {
    const s = i * HOP, e = Math.min(s + HOP, mono.length);
    let sum = 0;
    for (let j = s; j < e; j++) sum += mono[j] * mono[j];
    env[i] = Math.sqrt(sum / (e - s));
  }

  // AC coupling
  let mean = 0;
  for (let i = 0; i < envLen; i++) mean += env[i];
  mean /= envLen;
  for (let i = 0; i < envLen; i++) env[i] -= mean;

  // Autocorrelate over BPM lag range
  const rate   = sampleRate / HOP;
  const lagMin = Math.max(1, Math.floor(rate * 60 / MAX_BPM));
  const lagMax = Math.min(envLen - 1, Math.ceil(rate * 60 / MIN_BPM));

  let bestLag = lagMin, bestAC = -Infinity, acSum = 0, acCount = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    let ac = 0;
    const lim = envLen - lag;
    for (let i = 0; i < lim; i++) ac += env[i] * env[i + lag];
    ac /= lim;
    if (ac > bestAC) { bestAC = ac; bestLag = lag; }
    acSum += ac; acCount++;
  }

  const bpm        = Math.min(MAX_BPM, Math.max(MIN_BPM, (rate * 60) / bestLag));
  const meanAC     = acCount > 0 ? acSum / acCount : 1;
  const confidence = meanAC !== 0 ? Math.min(1, Math.max(0, bestAC / (Math.abs(meanAC) * 2))) : 0;
  return { bpm: parseFloat(bpm.toFixed(1)), confidence: parseFloat(confidence.toFixed(3)) };
}

// ── Key: ZCR chromagram + Krumhansl-Schmuckler ────────────────────────────────
// ZC_WINDOW=2048 → ~86 windows for 4s@44100 — chromagram build is trivial
const KS_MAJOR = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const KS_MINOR = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
const NOTES    = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const CAMELOT: Record<string, Record<string, string>> = {
  C:{'major':'8B','minor':'5A'}, 'C#':{'major':'3B','minor':'12A'},
  D:{'major':'10B','minor':'7A'}, 'D#':{'major':'5B','minor':'2A'},
  E:{'major':'12B','minor':'9A'}, F:{'major':'7B','minor':'4A'},
  'F#':{'major':'2B','minor':'11A'}, G:{'major':'9B','minor':'6A'},
  'G#':{'major':'4B','minor':'1A'}, A:{'major':'11B','minor':'8A'},
  'A#':{'major':'6B','minor':'3A'}, B:{'major':'1B','minor':'10A'},
};

function pearson(x: number[], y: number[]): number {
  const n = x.length;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += x[i]; my += y[i]; }
  mx /= n; my /= n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx, b = y[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  const d = Math.sqrt(dx * dy);
  /* v8 ignore next -- d=0 requires cmax=0 with frames>0; structurally impossible */
  return d > 0 ? num / d : 0;
}

function estimateKey(mono: Float32Array, sampleRate: number): { key: string; confidence: number } {
  const ZCW    = 2048;
  const chroma = new Float64Array(12);
  let prevSign = 0, frames = 0;

  for (let i = 0; i + ZCW < mono.length; i += ZCW) {
    let zc = 0, energy = 0;
    for (let j = i; j < i + ZCW; j++) {
      const s = mono[j], sign = s >= 0 ? 1 : -1;
      if (prevSign !== 0 && sign !== prevSign) zc++;
      prevSign = sign;
      energy  += s * s;
    }
    const freq = (zc * sampleRate) / (2 * ZCW);
    if (freq < 20 || freq > 4200) continue;
    const midi = 69 + 12 * Math.log2(freq / 440);
    const pc   = ((Math.round(midi) % 12) + 12) % 12;
    chroma[pc] += energy / ZCW;
    frames++;
  }

  if (frames === 0) return { key: '8A', confidence: 0 };

  const cmax = Math.max(...chroma);
  /* v8 ignore next -- cmax=0 with frames>0 is impossible; energy>0 whenever freq in-range */
  const norm = cmax > 0 ? Array.from(chroma).map(v => v / cmax) : Array.from(chroma);

  let bestKey = 'A', bestScale = 'minor', bestR = -Infinity, secondR = -Infinity;
  for (let root = 0; root < 12; root++) {
    const maj = Array.from({length:12}, (_,i) => KS_MAJOR[(i-root+12)%12]);
    const min = Array.from({length:12}, (_,i) => KS_MINOR[(i-root+12)%12]);
    for (const [profile, scale] of [[maj,'major'],[min,'minor']] as const) {
      const r = pearson(norm, profile);
      if (r > bestR) {
        secondR = bestR; bestR = r;
        bestKey = NOTES[root]; bestScale = scale;
      } else if (r > secondR) secondR = r;
    }
  }

  /* v8 ignore next -- CAMELOT covers all 12 NOTES × {major,minor}; fallback unreachable */
  const camelot    = CAMELOT[bestKey]?.[bestScale] ?? '8A';
  const confidence = parseFloat(Math.min(1, Math.max(0, bestR - secondR)).toFixed(3));
  return { key: camelot, confidence };
}

// ── Main ──────────────────────────────────────────────────────────────────────
export async function analyzeAudio(buffer: RawAudioBuffer): Promise<AnalysisResult> {
  if (buffer.sourceId) {
    const cached = analysisCache.get(buffer.sourceId);
    if (cached) return cached;
  }

  const start = performance.now();
  const mono  = toMono(buffer.channelData);
  const { rms, energy, dynamicRange } = computeMetrics(buffer.channelData);
  const spectralCentroid              = computeSpectralCentroid(mono, buffer.sampleRate);
  const { bpm, confidence: bpmConfidence } = estimateBPM(mono, buffer.sampleRate);
  const { key, confidence: keyConfidence } = estimateKey(mono, buffer.sampleRate);

  const result: AnalysisResult = {
    bpm, bpmConfidence, key, keyConfidence, energy,
    spectralCentroid, rmsLoudness: rms, dynamicRange,
    analysisTimeMs: parseFloat((performance.now() - start).toFixed(2)),
  };

  if (buffer.sourceId) analysisCache.set(buffer.sourceId, result);
  if (result.analysisTimeMs > 2000)
    console.warn(`[llpte-signal] Analysis exceeded 2000ms target: ${result.analysisTimeMs}ms`);

  return result;
}

export function clearAnalysisCache(): void {
  analysisCache.clear();
}
