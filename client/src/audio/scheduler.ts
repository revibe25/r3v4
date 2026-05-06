/**
 * scheduler.ts — Bridges dawStore ↔ LLPTE engine.
 *
 * Contract (strictly enforced):
 *   - UI never calls scheduler directly — it mutates dawStore
 *   - Scheduler subscribes to dawStore via subscribeWithSelector
 *   - Engine never mutates store — it only receives commands here
 *
 * Scheduling model:
 *   - Lookahead window: 200ms (schedules audio 200ms ahead of playhead)
 *   - Checks every 50ms (setInterval)
 *   - Region → AudioBuffer mapping is cached by audioFileId
 */
import { useDAWStore } from "@/state/dawStore";
import type { ArrangementTrack, Region, AudioRegion } from "../../../shared/arrangement.types";

const LOOKAHEAD_MS = 200;
const TICK_MS      = 50;

interface ScheduledRegion {
  regionId:   string;
  trackId:    string;
  startTime:  number;    // AudioContext time
  endTime:    number;
  sourceNode: AudioBufferSourceNode | null;
}

export class DAWScheduler {
  private ctx:       AudioContext;
  private scheduled: Map<string, ScheduledRegion> = new Map();
  private bufCache:  Map<string, AudioBuffer>     = new Map();
  private ticker:    ReturnType<typeof setInterval> | null = null;
  private unsubPlay: (() => void) | null = null;
  private unsubStop: (() => void) | null = null;

  constructor(audioContext: AudioContext) {
    this.ctx = audioContext;
    this.bind();
  }

  private bind() {
    // Subscribe to play state changes
    this.unsubPlay = useDAWStore.subscribe(
      s => s.transport.isPlaying,
      (isPlaying) => {
        if (isPlaying) this.startTicker();
        else            this.stopAll();
      }
    );
    // Subscribe to stop → clear all
    this.unsubStop = useDAWStore.subscribe(
      s => s.transport.currentTime,
      (t) => { if (t === 0) this.clearScheduled(); }
    );
  }

  private startTicker() {
    if (this.ticker) return;
    this.ticker = setInterval(() => this.scheduleTick(), TICK_MS);
    this.scheduleTick();
  }

  private scheduleTick() {
    const store    = useDAWStore.getState();
    const { transport, tracks } = store;
    if (!transport.isPlaying) return;

    const now         = this.ctx.currentTime;
    const currentSec  = transport.currentTime;
    const lookaheadTo = currentSec + LOOKAHEAD_MS / 1000;

    for (const track of tracks) {
      if (track.muted) continue;
      const isSoloed = Object.values(store.mixer).some(ch => ch.soloed);
      if (isSoloed && !store.mixer[track.id]?.soloed) continue;

      for (const region of track.regions) {
        if (region.length <= 0) continue;
        const r          = region as AudioRegion;
        const startSec   = this.barToSeconds(r.startBar, transport.tempo, transport.timeSignature.numerator);
        const endSec     = this.barToSeconds(r.startBar + r.length, transport.tempo, transport.timeSignature.numerator);
        const relStart   = startSec - currentSec;
        const schedTime  = now + Math.max(0, relStart);

        if (schedTime > now + LOOKAHEAD_MS / 1000) continue;
        if (endSec < currentSec) continue;
        if (this.scheduled.has(region.id)) continue;

        this.scheduleRegion(track, region as AudioRegion, schedTime, endSec - startSec, store.mixer[track.id]?.volume ?? 1);
      }
    }
  }

  private barToSeconds(bar: number, tempo: number, beatsPerBar: number): number {
    return (bar - 1) * beatsPerBar * (60 / tempo);
  }

  private async scheduleRegion(
    track: ArrangementTrack,
    region: AudioRegion,
    startTime: number,
    duration: number,
    volume: number,
  ) {
    // Mark as scheduled immediately to prevent double-scheduling
    this.scheduled.set(region.id, {
      regionId: region.id, trackId: track.id,
      startTime, endTime: startTime + duration, sourceNode: null,
    });

    if (!region.audioFileId) return;

    let buffer = this.bufCache.get(region.audioFileId);
    if (!buffer) {
      try {
        const resp = await fetch(`/api/audio/${region.audioFileId}`);
        if (!resp.ok) return;
        const arr  = await resp.arrayBuffer();
        buffer     = await this.ctx.decodeAudioData(arr);
        this.bufCache.set(region.audioFileId, buffer);
      } catch { return; }
    }

    if (!this.scheduled.has(region.id)) return; // was cleared while fetching

    const src    = this.ctx.createBufferSource();
    src.buffer   = buffer;
    const gain   = this.ctx.createGain();
    gain.gain.value = volume * (region.gain ?? 1);
    src.connect(gain);
    gain.connect(this.ctx.destination);

    const entry = this.scheduled.get(region.id)!;
    this.scheduled.set(region.id, { ...entry, sourceNode: src });

    src.start(Math.max(this.ctx.currentTime, startTime), region.offset ?? 0, duration);
    src.onended = () => { this.scheduled.delete(region.id); };
  }

  private stopAll() {
    if (this.ticker) { clearInterval(this.ticker); this.ticker = null; }
    this.clearScheduled();
  }

  private clearScheduled() {
    this.scheduled.forEach(entry => {
      try { entry.sourceNode?.stop(0); } catch { /* already stopped */ }
    });
    this.scheduled.clear();
  }

  dispose() {
    this.stopAll();
    this.unsubPlay?.();
    this.unsubStop?.();
    this.bufCache.clear();
  }
}

/** React hook — mount once at app root after AudioContext is available */
import { useEffect, useRef } from "react";

export function useDAWScheduler(audioContext: AudioContext | null): void {
  const schedulerRef = useRef<DAWScheduler | null>(null);
  useEffect(() => {
    if (!audioContext) return;
    schedulerRef.current = new DAWScheduler(audioContext);
    return () => { schedulerRef.current?.dispose(); };
  }, [audioContext]);
}
