import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAudio, clearAnalysisCache } from '../../llpte-signal/src/analyzer';
import { LLPTETransitionGraph } from '../../llpte-transition-graph/src/transitionGraph';
import { executeCrossfade, buildFullCrossfade } from '../../llpte-execution/src/crossfade';
import { PERFORMANCE_TARGETS, CROSSFADE_DURATION_MS } from '../src/constants';
import type { RawAudioBuffer } from '../../llpte-signal/src/types';

function mockAudioParam(): AudioParam {
  return { value:1,defaultValue:1,minValue:0,maxValue:1,automationRate:'a-rate',
    cancelScheduledValues:vi.fn(),setValueAtTime:vi.fn().mockReturnThis(),
    linearRampToValueAtTime:vi.fn().mockReturnThis(),exponentialRampToValueAtTime:vi.fn().mockReturnThis(),
    setValueCurveAtTime:vi.fn().mockReturnThis(),setTargetAtTime:vi.fn().mockReturnThis(),
    cancelAndHoldAtTime:vi.fn().mockReturnThis() } as unknown as AudioParam;
}
function mockGainNode(): GainNode { return { gain: mockAudioParam() } as unknown as GainNode; }
function mockCtx(t=0): AudioContext { return { currentTime: t } as unknown as AudioContext; }
function sineWave(freq:number,sr:number,dur:number): Float32Array {
  const len=Math.floor(sr*dur); return Float32Array.from({length:len},(_,i)=>Math.sin(2*Math.PI*freq*i/sr));
}
function mkBuffer(freq:number,sr=44100,dur=2,id?:string): RawAudioBuffer {
  return { sampleRate:sr, channelData:[sineWave(freq,sr,dur)], duration:dur, sourceId:id };
}

describe('LLPTE End-to-End Pipeline', () => {
  let graph: LLPTETransitionGraph;
  beforeEach(() => { clearAnalysisCache(); graph = new LLPTETransitionGraph(); });

  it('Stage 1 — analyzeAudio within performance target', async () => {
    const r = await analyzeAudio(mkBuffer(440));
    expect(r.analysisTimeMs).toBeLessThan(PERFORMANCE_TARGETS.trackAnalysisMs);
    expect(r.bpm).toBeGreaterThan(0);
    expect(r.key).toMatch(/^(1[0-2]|[1-9])[AB]$/);
  });

  it('Stage 2 — analyzed signal loads into graph', async () => {
    const r = await analyzeAudio(mkBuffer(440,44100,2,'a'));
    graph.addTrack('a', { bpm:r.bpm, key:r.key, energy:r.energy, spectralCentroid:r.spectralCentroid, rmsLoudness:r.rmsLoudness });
    expect(graph.size()).toBe(1);
  });

  it('Stage 3 — getBestNext returns valid candidate', async () => {
    for (const [id,freq] of [['a',440],['b',493],['c',523]] as const) {
      const r = await analyzeAudio(mkBuffer(freq,44100,2,id));
      graph.addTrack(id, { bpm:r.bpm, key:r.key, energy:r.energy, spectralCentroid:r.spectralCentroid, rmsLoudness:r.rmsLoudness });
    }
    const best = graph.getBestNext('a');
    expect(best).not.toBeNull();
    expect(best!.score).toBeGreaterThan(0);
    expect(['b','c']).toContain(best!.toTrackId);
  });

  it('Stage 4 — candidate drives correct crossfade params', () => {
    graph.addTrack('a', { bpm:128, key:'8A', energy:0.7, spectralCentroid:3000, rmsLoudness:0.6 });
    graph.addTrack('b', { bpm:128, key:'9A', energy:0.72, spectralCentroid:3100, rmsLoudness:0.61 });
    const best = graph.getBestNext('a')!;
    const cf = buildFullCrossfade(best.suggestedCrossfadeDurationMs, best.suggestedCurve);
    expect(cf.durationMs).toBeGreaterThanOrEqual(CROSSFADE_DURATION_MS.excellent);
    expect(cf.durationMs).toBeLessThanOrEqual(CROSSFADE_DURATION_MS.poor);
  });

  it('Stage 5 — executeCrossfade within 10ms latency target', () => {
    graph.addTrack('a', { bpm:128, key:'8A', energy:0.7, spectralCentroid:3000, rmsLoudness:0.6 });
    graph.addTrack('b', { bpm:128, key:'9A', energy:0.72, spectralCentroid:3100, rmsLoudness:0.61 });
    const best = graph.getBestNext('a')!;
    const result = executeCrossfade(mockCtx(), mockGainNode(), mockGainNode(), buildFullCrossfade(best.suggestedCrossfadeDurationMs, best.suggestedCurve));
    expect(result.success).toBe(true);
    expect(result.actualLatencyMs).toBeLessThan(PERFORMANCE_TARGETS.crossfadeExecutionMs);
  });

  it('Full chain — analyze → graph → predict → execute', async () => {
    const sigA = await analyzeAudio(mkBuffer(440,44100,2,'full-a'));
    const sigB = await analyzeAudio(mkBuffer(493,44100,2,'full-b'));
    graph.addTrack('full-a', { bpm:sigA.bpm, key:sigA.key, energy:sigA.energy, spectralCentroid:sigA.spectralCentroid, rmsLoudness:sigA.rmsLoudness });
    graph.addTrack('full-b', { bpm:sigB.bpm, key:sigB.key, energy:sigB.energy, spectralCentroid:sigB.spectralCentroid, rmsLoudness:sigB.rmsLoudness });
    const best = graph.getBestNext('full-a')!;
    expect(best).not.toBeNull();
    const result = executeCrossfade(mockCtx(10.5), mockGainNode(), mockGainNode(), buildFullCrossfade(best.suggestedCrossfadeDurationMs, best.suggestedCurve));
    expect(result.success).toBe(true);
    expect(result.scheduledAtAudioTime).toBe(10.5);
    expect(result.actualLatencyMs).toBeLessThan(PERFORMANCE_TARGETS.crossfadeExecutionMs);
  });

  it('Score buckets align with CROSSFADE_DURATION_MS constants', () => {
    graph.addTrack('x', { bpm:128, key:'8A', energy:0.75, spectralCentroid:3200, rmsLoudness:0.65 });
    graph.addTrack('y', { bpm:128, key:'8A', energy:0.74, spectralCentroid:3190, rmsLoudness:0.64 });
    const best = graph.getBestNext('x')!;
    expect(best.score).toBeGreaterThan(0.70);
    expect(best.suggestedCrossfadeDurationMs).toBeLessThanOrEqual(CROSSFADE_DURATION_MS.good);
  });

  it('Serialized graph round-trips correctly', () => {
    graph.addTrack('a', { bpm:128, key:'8A', energy:0.7, spectralCentroid:3000, rmsLoudness:0.6 });
    graph.addTrack('b', { bpm:128, key:'9A', energy:0.72, spectralCentroid:3100, rmsLoudness:0.61 });
    graph.addTrack('c', { bpm:130, key:'1A', energy:0.4, spectralCentroid:1500, rmsLoudness:0.3 });
    const original = graph.getBestNext('a');
    const data = graph.serialize() as any;
    const restored = LLPTETransitionGraph.deserialize({ tracks: data.tracks });
    const after = restored.getBestNext('a');
    expect(after?.toTrackId).toBe(original?.toTrackId);
    expect(after?.score).toBe(original?.score);
  });
});
