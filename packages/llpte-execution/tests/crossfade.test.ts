import { describe, it, expect, vi } from 'vitest';
import { executeCrossfade, buildFullCrossfade } from '../src/crossfade';
import type { CrossfadeParams } from '../src/types';

function mockAudioParam(): AudioParam {
  return { value:1, defaultValue:1, minValue:0, maxValue:1, automationRate:'a-rate',
    cancelScheduledValues: vi.fn(), setValueAtTime: vi.fn().mockReturnThis(),
    linearRampToValueAtTime: vi.fn().mockReturnThis(),
    exponentialRampToValueAtTime: vi.fn().mockReturnThis(),
    setValueCurveAtTime: vi.fn().mockReturnThis(),
    setTargetAtTime: vi.fn().mockReturnThis(),
    cancelAndHoldAtTime: vi.fn().mockReturnThis(),
  } as unknown as AudioParam;
}
function mockGainNode(): GainNode { return { gain: mockAudioParam() } as unknown as GainNode; }
function mockCtx(t = 0): AudioContext { return { currentTime: t } as unknown as AudioContext; }

describe('buildFullCrossfade', () => {
  it('A→B gain values', () => { const p = buildFullCrossfade(8000); expect(p.startGainA).toBe(1); expect(p.endGainA).toBe(0); expect(p.startGainB).toBe(0); expect(p.endGainB).toBe(1); });
  it('default curve is equal-power', () => { expect(buildFullCrossfade(8000).curveType).toBe('equal-power'); });
  it('respects curve override', () => { expect(buildFullCrossfade(8000,'s-curve').curveType).toBe('s-curve'); });
  it('preserves durationMs', () => { expect(buildFullCrossfade(12000).durationMs).toBe(12000); });
});

describe('executeCrossfade', () => {
  it('returns success true', () => { expect(executeCrossfade(mockCtx(), mockGainNode(), mockGainNode(), buildFullCrossfade(4000)).success).toBe(true); });
  it('scheduledAtAudioTime matches ctx.currentTime', () => { expect(executeCrossfade(mockCtx(3.14), mockGainNode(), mockGainNode(), buildFullCrossfade(4000)).scheduledAtAudioTime).toBe(3.14); });
  it('scheduling latency under 10ms', () => { expect(executeCrossfade(mockCtx(), mockGainNode(), mockGainNode(), buildFullCrossfade(4000)).actualLatencyMs).toBeLessThan(10); });
  it('cancels scheduled values on both nodes', () => { const a=mockGainNode(),b=mockGainNode(); executeCrossfade(mockCtx(),a,b,buildFullCrossfade(4000)); expect(a.gain.cancelScheduledValues).toHaveBeenCalledOnce(); expect(b.gain.cancelScheduledValues).toHaveBeenCalledOnce(); });
  it('equal-power uses setValueCurveAtTime', () => { const a=mockGainNode(),b=mockGainNode(); executeCrossfade(mockCtx(),a,b,buildFullCrossfade(4000,'equal-power')); expect(a.gain.setValueCurveAtTime).toHaveBeenCalled(); });
  it('s-curve uses setValueCurveAtTime', () => { const a=mockGainNode(),b=mockGainNode(); executeCrossfade(mockCtx(),a,b,buildFullCrossfade(4000,'s-curve')); expect(a.gain.setValueCurveAtTime).toHaveBeenCalled(); });
  it('logarithmic uses exponentialRamp', () => { const a=mockGainNode(),b=mockGainNode(); executeCrossfade(mockCtx(),a,b,buildFullCrossfade(4000,'logarithmic')); expect(a.gain.exponentialRampToValueAtTime).toHaveBeenCalled(); });
  it('linear uses linearRamp', () => { const a=mockGainNode(),b=mockGainNode(); executeCrossfade(mockCtx(),a,b,buildFullCrossfade(4000,'linear')); expect(a.gain.linearRampToValueAtTime).toHaveBeenCalled(); });
  it('correct start gains scheduled', () => { const a=mockGainNode(),b=mockGainNode(); executeCrossfade(mockCtx(),a,b,buildFullCrossfade(4000)); expect(a.gain.setValueAtTime).toHaveBeenCalledWith(1,expect.any(Number)); expect(b.gain.setValueAtTime).toHaveBeenCalledWith(0,expect.any(Number)); });
  it('returns error on throw', () => { const b={gain:{...mockAudioParam(),setValueAtTime:vi.fn().mockImplementation(()=>{throw new Error('closed')})}} as unknown as GainNode; const r=executeCrossfade(mockCtx(),mockGainNode(),b,buildFullCrossfade(4000)); expect(r.success).toBe(false); expect(r.error).toContain('closed'); });
  it('handles zero durationMs', () => { const p:CrossfadeParams={durationMs:0,curveType:'linear',startGainA:1,endGainA:0,startGainB:0,endGainB:1}; expect(executeCrossfade(mockCtx(),mockGainNode(),mockGainNode(),p).success).toBe(true); });
  it('handles partial crossfade gains', () => { const a=mockGainNode(),b=mockGainNode(); const p:CrossfadeParams={durationMs:6000,curveType:'equal-power',startGainA:0.7,endGainA:0,startGainB:0.3,endGainB:1}; executeCrossfade(mockCtx(),a,b,p); expect(a.gain.setValueAtTime).toHaveBeenCalledWith(0.7,expect.any(Number)); });
});
