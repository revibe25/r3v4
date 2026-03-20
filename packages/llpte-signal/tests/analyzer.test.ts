/**
 * @llpte/llpte-signal — Analyzer Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { analyzeAudio, clearAnalysisCache } from '../src/analyzer';
import type { RawAudioBuffer } from '../src/types';

// ── Test signal generators ─────────────────────────────────────────────────────

/** Generate a sine wave at a given frequency */
function sineWave(freq: number, sampleRate: number, duration: number): Float32Array {
  const len    = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    buffer[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buffer;
}

/** Generate a 4/4 kick pulse train at a given BPM */
function kickPulseTrain(bpm: number, sampleRate: number, duration: number): Float32Array {
  const len        = Math.floor(sampleRate * duration);
  const buffer     = new Float32Array(len);
  const beatPeriod = Math.floor((60 / bpm) * sampleRate);
  for (let i = 0; i < len; i++) {
    if (i % beatPeriod < 64) {
      // Sharp transient at each beat
      buffer[i] = Math.exp(-i % beatPeriod / 10) * 0.9;
    }
  }
  return buffer;
}

/** Generate silence */
function silence(sampleRate: number, duration: number): Float32Array {
  return new Float32Array(Math.floor(sampleRate * duration));
}

function mkBuffer(channelData: Float32Array[], sampleRate = 44100, sourceId?: string): RawAudioBuffer {
  return {
    sampleRate,
    channelData,
    duration: channelData[0].length / sampleRate,
    sourceId,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('analyzeAudio', () => {
  beforeEach(() => clearAnalysisCache());

  it('returns all required fields', async () => {
    const buf    = mkBuffer([sineWave(440, 44100, 2)]);
    const result = await analyzeAudio(buf);
    expect(result).toHaveProperty('bpm');
    expect(result).toHaveProperty('bpmConfidence');
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('keyConfidence');
    expect(result).toHaveProperty('energy');
    expect(result).toHaveProperty('spectralCentroid');
    expect(result).toHaveProperty('rmsLoudness');
    expect(result).toHaveProperty('dynamicRange');
    expect(result).toHaveProperty('analysisTimeMs');
  });

  it('produces BPM within musical range (60–200)', async () => {
    const buf    = mkBuffer([kickPulseTrain(128, 44100, 4)]);
    const result = await analyzeAudio(buf);
    expect(result.bpm).toBeGreaterThanOrEqual(60);
    expect(result.bpm).toBeLessThanOrEqual(200);
  });

  it('produces bpmConfidence in 0–1 range', async () => {
    const buf    = mkBuffer([kickPulseTrain(128, 44100, 4)]);
    const result = await analyzeAudio(buf);
    expect(result.bpmConfidence).toBeGreaterThanOrEqual(0);
    expect(result.bpmConfidence).toBeLessThanOrEqual(1);
  });

  it('produces a valid Camelot key string', async () => {
    const buf    = mkBuffer([sineWave(440, 44100, 3)]);  // A440 → A major/minor
    const result = await analyzeAudio(buf);
    expect(result.key).toMatch(/^(1[0-2]|[1-9])[AB]$/);
  });

  it('produces keyConfidence in 0–1 range', async () => {
    const buf    = mkBuffer([sineWave(440, 44100, 3)]);
    const result = await analyzeAudio(buf);
    expect(result.keyConfidence).toBeGreaterThanOrEqual(0);
    expect(result.keyConfidence).toBeLessThanOrEqual(1);
  });

  it('produces energy in 0–1 range', async () => {
    const buf    = mkBuffer([sineWave(440, 44100, 2)]);
    const result = await analyzeAudio(buf);
    expect(result.energy).toBeGreaterThanOrEqual(0);
    expect(result.energy).toBeLessThanOrEqual(1);
  });

  it('produces higher energy for louder signal', async () => {
    const loud   = mkBuffer([sineWave(440, 44100, 2).map(v => v * 0.9) as Float32Array]);
    const quiet  = mkBuffer([sineWave(440, 44100, 2).map(v => v * 0.1) as Float32Array]);
    const loudR  = await analyzeAudio(loud);
    const quietR = await analyzeAudio(quiet);
    expect(loudR.energy).toBeGreaterThan(quietR.energy);
  });

  it('produces spectralCentroid > 0 for tonal signal', async () => {
    const buf    = mkBuffer([sineWave(1000, 44100, 2)]);
    const result = await analyzeAudio(buf);
    expect(result.spectralCentroid).toBeGreaterThan(0);
  });

  it('produces rmsLoudness > 0 for non-silent signal', async () => {
    const buf    = mkBuffer([sineWave(440, 44100, 2)]);
    const result = await analyzeAudio(buf);
    expect(result.rmsLoudness).toBeGreaterThan(0);
  });

  it('produces rmsLoudness = 0 for silence', async () => {
    const buf    = mkBuffer([silence(44100, 2)]);
    const result = await analyzeAudio(buf);
    expect(result.rmsLoudness).toBe(0);
  });

  it('caches result on second call with same sourceId', async () => {
    const buf    = mkBuffer([sineWave(440, 44100, 2)], 44100, 'track-001');
    const first  = await analyzeAudio(buf);
    const second = await analyzeAudio(buf);
    expect(second).toBe(first);  // Same object reference
  });

  it('does not cache when sourceId is absent', async () => {
    const buf    = mkBuffer([sineWave(440, 44100, 2)]);
    const first  = await analyzeAudio(buf);
    const second = await analyzeAudio(buf);
    // Different objects — no caching without sourceId
    expect(second).not.toBe(first);
  });

  it('handles stereo input', async () => {
    const ch1    = sineWave(440, 44100, 2);
    const ch2    = sineWave(440, 44100, 2);
    const buf    = mkBuffer([ch1, ch2]);
    const result = await analyzeAudio(buf);
    expect(result.rmsLoudness).toBeGreaterThan(0);
  });

  it('completes within 2000ms for a 4-second buffer', async () => {
    const buf    = mkBuffer([kickPulseTrain(128, 44100, 4)]);
    const result = await analyzeAudio(buf);
    expect(result.analysisTimeMs).toBeLessThan(2000);
  });
});

describe('analyzeAudio — edge case branches', () => {
  beforeEach(() => clearAnalysisCache());

  // line 65: estimateBPM envLen < 8 early-return
  // 2048 samples @ 44100 Hz → envLen = floor(2048/512) = 4 < 8
  it('returns bpm=128 confidence=0 for a very short buffer (envLen < 8)', async () => {
    const buf    = mkBuffer([sineWave(440, 44100, 2048 / 44100)]);
    const result = await analyzeAudio(buf);
    expect(result.bpm).toBe(128);
    expect(result.bpmConfidence).toBe(0);
  });

  // line 98: acCount === 0 arm in estimateBPM
  // 6144 samples @ 44100 Hz → envLen = 12; lagMin = 26 > lagMax = min(11, 87) = 11
  // The autocorrelation loop never runs → acCount stays 0 → ternary false arm fires
  it('handles medium-length buffer where BPM lag range is empty (acCount=0)', async () => {
    const buf    = mkBuffer([sineWave(440, 44100, 6144 / 44100)]);
    const result = await analyzeAudio(buf);
    expect(result.bpm).toBeGreaterThanOrEqual(60);
    expect(result.bpm).toBeLessThanOrEqual(200);
    expect(result.bpmConfidence).toBeGreaterThanOrEqual(0);
    expect(result.bpmConfidence).toBeLessThanOrEqual(1);
  });

  // line 197: analysisTimeMs > 2000 console.warn path
  it('warns when analysis exceeds the 2000ms target', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // First now() call = start; second = result time → 2500ms elapsed
    let nowCall = 0;
    vi.stubGlobal('performance', { now: vi.fn().mockImplementation(() => nowCall++ === 0 ? 0 : 2500) });
    try {
      await analyzeAudio(mkBuffer([sineWave(440, 44100, 1)]));
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('exceeded 2000ms'));
    } finally {
      warnSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });
});
