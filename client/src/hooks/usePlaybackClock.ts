/**
 * usePlaybackClock.ts
 *
 * RAF-driven clock that advances dawStore.transport.currentTime while playing.
 * Mount once at the root DAW component. Handles:
 *   - precise time accumulation using performance.now()
 *   - loop boundary wrapping
 *   - pause/resume without time drift
 *   - metronome tick events (dispatched as CustomEvent for audio layer)
 *
 * Engine sync contract:
 *   1. This hook updates transport.currentTime via setCurrentTime()
 *   2. The engine layer subscribes to the store and schedules audio accordingly
 *   3. UI reads currentBar/currentBeat from store — never from engine directly
 */
import { useEffect, useRef } from "react";
import { useDAWStore } from "@/state/dawStore";

const METRONOME_EVENT = "r3:metronome-tick";

export function usePlaybackClock(): void {
  const rafRef       = useRef<number | null>(null);
  const lastTimeRef  = useRef<number | null>(null);   // performance.now() at last frame
  const accTimeRef   = useRef<number>(0);             // accumulated seconds

  useEffect(() => {
    const tick = (now: number) => {
      const store     = useDAWStore.getState();
      const transport = store.transport;

      if (!transport.isPlaying) {
        lastTimeRef.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      // First frame after play — initialise lastTime
      if (lastTimeRef.current === null) {
        lastTimeRef.current = now;
        accTimeRef.current  = transport.currentTime;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      const delta    = (now - lastTimeRef.current) / 1000;  // seconds
      lastTimeRef.current = now;
      let newTime = accTimeRef.current + delta;
      accTimeRef.current = newTime;

      // Loop boundary
      if (transport.isLooping) {
        const { loopStart, loopEnd, tempo, timeSignature: sig } = transport;
        const spb   = 60 / tempo;
        const loopStartSec = (loopStart - 1) * sig.numerator * spb;
        const loopEndSec   = (loopEnd   - 1) * sig.numerator * spb;
        if (newTime >= loopEndSec) {
          newTime = loopStartSec + (newTime - loopEndSec) % Math.max(0.001, loopEndSec - loopStartSec);
          accTimeRef.current = newTime;
        }
      }

      // Metronome — detect beat crossing and dispatch event
      const { tempo, timeSignature: sig } = transport;
      const spb          = 60 / tempo;
      const prevBeat     = Math.floor(transport.currentTime / spb);
      const newBeat      = Math.floor(newTime / spb);
      if (newBeat > prevBeat) {
        const beatInBar = newBeat % sig.numerator;
        window.dispatchEvent(new CustomEvent(METRONOME_EVENT, {
          detail: { beat: beatInBar, bar: Math.floor(newBeat / sig.numerator) + 1 },
        }));
      }

      store.setCurrentTime(newTime);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);  // mount once — reads store.getState() directly to avoid closure staleness
}

/** Hook to subscribe to metronome tick events */
export function useMetronomeTick(
  callback: (beat: number, bar: number) => void
): void {
  useEffect(() => {
    const handler = (e: Event) => {
      const { beat, bar } = (e as CustomEvent).detail;
      callback(beat, bar);
    };
    window.addEventListener(METRONOME_EVENT, handler);
    return () => window.removeEventListener(METRONOME_EVENT, handler);
  }, [callback]);
}
