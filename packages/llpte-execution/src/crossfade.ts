/**
 * @llpte/llpte-execution — Crossfade Optimizer
 *
 * Schedules Web Audio API crossfades with deterministic latency.
 * Target: execution scheduling < 10ms.
 *
 * All AudioParam scheduling is done via the native Web Audio scheduler
 * for sample-accurate timing regardless of JS event loop pressure.
 */

import type { CrossfadeParams, ExecutionResult, CrossfadeCurve } from './types';

function buildEqualPowerCurve(from: number, to: number, steps = 128): Float32Array {
  return Float32Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    // Equal-power formula preserves perceived loudness through crossfade
    const v = from + (to - from) * t;
    return Math.sqrt(Math.max(0, v));
  });
}

function buildSCurve(from: number, to: number, steps = 128): Float32Array {
  return Float32Array.from({ length: steps }, (_, i) => {
    const t = i / (steps - 1);
    // Hermite smoothstep — removes click at start/end of fade
    const smooth = t * t * (3 - 2 * t);
    return from + (to - from) * smooth;
  });
}

function applyGainCurve(
  param:       AudioParam,
  from:        number,
  to:          number,
  startTime:   number,
  durationSec: number,
  curve:       CrossfadeCurve,
): void {
  param.cancelScheduledValues(startTime);
  param.setValueAtTime(from, startTime);

  const end = startTime + durationSec;

  switch (curve) {
    case 'equal-power':
      param.setValueCurveAtTime(buildEqualPowerCurve(from, to), startTime, durationSec);
      break;
    case 's-curve':
      param.setValueCurveAtTime(buildSCurve(from, to), startTime, durationSec);
      break;
    case 'logarithmic':
      // exponentialRampToValueAtTime requires non-zero target
      param.exponentialRampToValueAtTime(Math.max(to, 0.00001), end);
      break;
    case 'linear':
    default:
      param.linearRampToValueAtTime(to, end);
  }
}

export function executeCrossfade(
  ctx:    AudioContext,
  gainA:  GainNode,
  gainB:  GainNode,
  params: CrossfadeParams,
): ExecutionResult {
  const scheduleStart = performance.now();

  try {
    const audioNow   = ctx.currentTime;
    const durationSec = params.durationMs / 1000;

    applyGainCurve(gainA.gain, params.startGainA, params.endGainA, audioNow, durationSec, params.curveType);
    applyGainCurve(gainB.gain, params.startGainB, params.endGainB, audioNow, durationSec, params.curveType);

    const latencyMs = parseFloat((performance.now() - scheduleStart).toFixed(3));

    if (latencyMs > 10) {
      console.warn(`[llpte-execution] Crossfade scheduling exceeded 10ms target: ${latencyMs}ms`);
    }

    return { success: true, scheduledAtAudioTime: audioNow, actualLatencyMs: latencyMs };
  } catch (e) {
    return {
      success:              false,
      scheduledAtAudioTime: 0,
      actualLatencyMs:      parseFloat((performance.now() - scheduleStart).toFixed(3)),
      error:                e instanceof Error ? e.message : String(e),
    };
  }
}

/** Standard crossfade parameters for a full A→B transition */
export function buildFullCrossfade(
  durationMs: number,
  curve:      CrossfadeCurve = 'equal-power',
): CrossfadeParams {
  return { durationMs, curveType: curve, startGainA: 1, endGainA: 0, startGainB: 0, endGainB: 1 };
}
