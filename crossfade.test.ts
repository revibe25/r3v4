/**
 * @llpte/llpte-execution — Crossfade Tests
 *
 * Web Audio API is unavailable in Node/vitest — all AudioContext, GainNode,
 * and AudioParam objects are mocked with full call recording so we can assert
 * scheduling behaviour without a browser.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeCrossfade, buildFullCrossfade } from '../src/crossfade';
import type { CrossfadeParams } from '../src/types';

// ── Web Audio Mocks ───────────────────────────────────────────────────────────

function mockAudioParam(): AudioParam {
  return {
    value:                    1,
    defaultValue:             1,
    minValue:                 0,
    maxValue:                 1,
    automationRate:           'a-rate',
    cancelScheduledValues:    vi.fn(),
    setValueAtTime:           vi.fn().mockReturnThis(),
    linearRampToValueAtTime:  vi.fn().mockReturnThis(),
    exponentialRampToValueAtTime: vi.fn().mockReturnThis(),
    setValueCurveAtTime:      vi.fn().mockReturnThis(),
    setTargetAtTime:          vi.fn().mockReturnThis(),
    cancelAndHoldAtTime:      vi.fn().mockReturnThis(),
  } as unknown as AudioParam;
}

function mockGainNode(): GainNode {
  return { gain: mockAudioParam() } as unknown as GainNode;
}

function mockAudioContext(currentTime = 0): AudioContext {
  return { currentTime } as unknown as AudioContext;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSetup(currentTime = 0) {
  const ctx   = mockAudioContext(currentTime);
  const gainA = mockGainNode();
  const gainB = mockGainNode();
  return { ctx, gainA, gainB };
}

// ── buildFullCrossfade ────────────────────────────────────────────────────────

describe('buildFullCrossfade', () => {
  it('produces correct A→B gain values', () => {
    const p = buildFullCrossfade(8000);
    expect(p.startGainA).toBe(1);
    expect(p.endGainA).toBe(0);
    expect(p.startGainB).toBe(0);
    expect(p.endGainB).toBe(1);
  });

  it('uses equal-power curve by default', () => {
    expect(buildFullCrossfade(8000).curveType).toBe('equal-power');
  });

  it('respects explicit curve override', () => {
    expect(buildFullCrossfade(8000, 's-curve').curveType).toBe('s-curve');
    expect(buildFullCrossfade(8000, 'linear').curveType).toBe('linear');
    expect(buildFullCrossfade(8000, 'logarithmic').curveType).toBe('logarithmic');
  });

  it('preserves durationMs', () => {
    expect(buildFullCrossfade(12000).durationMs).toBe(12000);
  });
});

// ── executeCrossfade ──────────────────────────────────────────────────────────

describe('executeCrossfade', () => {
  it('returns success: true on valid inputs', () => {
    const { ctx, gainA, gainB } = makeSetup();
    const result = executeCrossfade(ctx, gainA, gainB, buildFullCrossfade(4000));
    expect(result.success).toBe(true);
  });

  it('returns scheduledAtAudioTime matching ctx.currentTime', () => {
    const { ctx, gainA, gainB } = makeSetup(3.14);
    const result = executeCrossfade(ctx, gainA, gainB, buildFullCrossfade(4000));
    expect(result.scheduledAtAudioTime).toBe(3.14);
  });

  it('reports actualLatencyMs as a number', () => {
    const { ctx, gainA, gainB } = makeSetup();
    const result = executeCrossfade(ctx, gainA, gainB, buildFullCrossfade(4000));
    expect(typeof result.actualLatencyMs).toBe('number');
    expect(result.actualLatencyMs).toBeGreaterThanOrEqual(0);
  });

  it('scheduling latency is under 10ms', () => {
    const { ctx, gainA, gainB } = makeSetup();
    const result = executeCrossfade(ctx, gainA, gainB, buildFullCrossfade(4000));
    expect(result.actualLatencyMs).toBeLessThan(10);
  });

  it('calls cancelScheduledValues on both gain params', () => {
    const { ctx, gainA, gainB } = makeSetup();
    executeCrossfade(ctx, gainA, gainB, buildFullCrossfade(4000));
    expect(gainA.gain.cancelScheduledValues).toHaveBeenCalledOnce();
    expect(gainB.gain.cancelScheduledValues).toHaveBeenCalledOnce();
  });

  it('calls setValueAtTime on both gain params', () => {
    const { ctx, gainA, gainB } = makeSetup();
    executeCrossfade(ctx, gainA, gainB, buildFullCrossfade(4000));
    expect(gainA.gain.setValueAtTime).toHaveBeenCalledOnce();
    expect(gainB.gain.setValueAtTime).toHaveBeenCalledOnce();
  });

  it('uses setValueCurveAtTime for equal-power curve', () => {
    const { ctx, gainA, gainB } = makeSetup();
    executeCrossfade(ctx, gainA, gainB, buildFullCrossfade(4000, 'equal-power'));
    expect(gainA.gain.setValueCurveAtTime).toHaveBeenCalled();
    expect(gainB.gain.setValueCurveAtTime).toHaveBeenCalled();
  });

  it('uses setValueCurveAtTime for s-curve', () => {
    const { ctx, gainA, gainB } = makeSetup();
    executeCrossfade(ctx, gainA, gainB, buildFullCrossfade(4000, 's-curve'));
    expect(gainA.gain.setValueCurveAtTime).toHaveBeenCalled();
    expect(gainB.gain.setValueCurveAtTime).toHaveBeenCalled();
  });

  it('uses exponentialRampToValueAtTime for logarithmic curve', () => {
    const { ctx, gainA, gainB } = makeSetup();
    executeCrossfade(ctx, gainA, gainB, buildFullCrossfade(4000, 'logarithmic'));
    expect(gainA.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
    expect(gainB.gain.exponentialRampToValueAtTime).toHaveBeenCalled();
  });

  it('uses linearRampToValueAtTime for linear curve', () => {
    const { ctx, gainA, gainB } = makeSetup();
    executeCrossfade(ctx, gainA, gainB, buildFullCrossfade(4000, 'linear'));
    expect(gainA.gain.linearRampToValueAtTime).toHaveBeenCalled();
    expect(gainB.gain.linearRampToValueAtTime).toHaveBeenCalled();
  });

  it('schedules gainA fade-out (1→0) and gainB fade-in (0→1)', () => {
    const { ctx, gainA, gainB } = makeSetup();
    const params = buildFullCrossfade(4000);
    executeCrossfade(ctx, gainA, gainB, params);
    // setValueAtTime called with correct starting gain per node
    expect(gainA.gain.setValueAtTime).toHaveBeenCalledWith(1, expect.any(Number));
    expect(gainB.gain.setValueAtTime).toHaveBeenCalledWith(0, expect.any(Number));
  });

  it('returns success: false and error message on throw', () => {
    const ctx   = mockAudioContext();
    const gainA = mockGainNode();
    const gainB = { gain: { ...mockAudioParam(), setValueAtTime: vi.fn().mockImplementation(() => { throw new Error('AudioContext closed'); }) } } as unknown as GainNode;
    const result = executeCrossfade(ctx, gainA, gainB, buildFullCrossfade(4000));
    expect(result.success).toBe(false);
    expect(result.error).toContain('AudioContext closed');
  });

  it('handles zero durationMs without throwing', () => {
    const { ctx, gainA, gainB } = makeSetup();
    const params: CrossfadeParams = { durationMs: 0, curveType: 'linear', startGainA: 1, endGainA: 0, startGainB: 0, endGainB: 1 };
    const result = executeCrossfade(ctx, gainA, gainB, params);
    expect(result.success).toBe(true);
  });

  it('handles partial crossfade (non-zero start gains)', () => {
    const { ctx, gainA, gainB } = makeSetup();
    const params: CrossfadeParams = { durationMs: 6000, curveType: 'equal-power', startGainA: 0.7, endGainA: 0, startGainB: 0.3, endGainB: 1 };
    const result = executeCrossfade(ctx, gainA, gainB, params);
    expect(result.success).toBe(true);
    expect(gainA.gain.setValueAtTime).toHaveBeenCalledWith(0.7, expect.any(Number));
    expect(gainB.gain.setValueAtTime).toHaveBeenCalledWith(0.3, expect.any(Number));
  });
});
