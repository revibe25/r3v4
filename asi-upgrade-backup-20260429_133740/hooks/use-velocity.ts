/**
 * use-velocity.ts — pointer-pressure-aware velocity hook for R3 v4
 *
 * Priority:
 *   1. Pointer pressure API (stylus / capacitive touch): direct hardware value
 *   2. Time-delta: duration between pointerdown and getVelocity() call.
 *      < 30 ms  → 1.0  (hard hit)
 *      > 250 ms → 0.08 (soft / held)
 *
 * Usage in a pad or key button:
 *   const { onPointerDown, getVelocity } = useVelocity();
 *   <button
 *     onPointerDown={onPointerDown}
 *     onClick={() => onTrigger(index, getVelocity())}
 *   />
 */
import { useRef, useCallback } from 'react';

const MIN_VEL      = 0.08;
const MAX_VEL      = 1.0;
const DECAY_MS     = 250;
const PRESSURE_MIN = 0.01;

export function useVelocity() {
  const pressTimeRef = useRef<number>(0);
  const pressureRef  = useRef<number>(-1);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    pressTimeRef.current = e.timeStamp;
    pressureRef.current  = e.pressure > PRESSURE_MIN ? e.pressure : -1;
  }, []);

  const getVelocity = useCallback((): number => {
    if (pressureRef.current >= 0) {
      return Math.min(MAX_VEL, Math.max(MIN_VEL, pressureRef.current));
    }
    const elapsed = performance.now() - pressTimeRef.current;
    const t       = Math.min(1, elapsed / DECAY_MS);
    // ease-in-cubic: fast presses feel punchy
    const vel     = MAX_VEL - (MAX_VEL - MIN_VEL) * (t * t * t);
    return Math.min(MAX_VEL, Math.max(MIN_VEL, vel));
  }, []);

  return { onPointerDown, getVelocity };
}
