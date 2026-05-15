import { useClipStore } from '@/store/clip-store';
import { useEffect, useRef, useState, useCallback } from "react";
import * as Tone from "tone";
import "@/store/clip-store"

const GRID_SNAP_SECONDS = 0.25;

export default function ArrangementTimeline() {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [playheadX, setPlayheadX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [dragging, setDragging] = useState<{
    clipId: string;
    trackId: string;
    startX: number;
    originalStart: number;
    previewStart: number;
  } | null>(null);

  const tracks = useClipStore(state => state.tracks);

  // PATCH-M07: Playhead animation — RAF with zoom dependency
  useEffect(() => {
    let raf: number;
    const update = () => {
      try {
        const seconds = Tone.Transport.seconds ?? 0;
        setPlayheadX(seconds * zoom);
      } catch {
        // Tone not ready
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [zoom]);

  // PATCH-M08: Wheel zoom (Ctrl+Scroll) [50–400 px/s]
  const handleWheel = useCallback((e: WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(50, Math.min(400, z * delta)));
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // PATCH-M09: Scroll position preservation
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollLeft((e.target as HTMLDivElement).scrollLeft);
  }, []);

  // PATCH-M10: Snap-to-grid (0.25s grid)
  const snapToGrid = useCallback((time: number): number => {
    return Math.round(time / GRID_SNAP_SECONDS) * GRID_SNAP_SECONDS;
  }, []);

  // PATCH-M11: Drag with preview + boundary validation
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const deltaPx = e.clientX - dragging.startX;
      const deltaTime = deltaPx / zoom;
      const rawStart = dragging.originalStart + deltaTime;
      const snappedStart = snapToGrid(Math.max(0, rawStart));
      setDragging(prev => prev ? { ...prev, previewStart: snappedStart } : null);
      const track = tracks[dragging.trackId];
      const clip = track?.getClip(dragging.clipId);
      if (!clip) return;
      try {
        clip.update({ startTime: snappedStart });
      } catch (err) {
        console.error('[ArrangementTimeline] Clip update failed:', err);
      }
    };
    const onUp = () => setDragging(null);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, [dragging, tracks, zoom, snapToGrid]);

  const TOTAL_DURATION = 300;
  const TRACK_HEIGHT = 80;

  return (
    <div
      ref={scrollContainerRef}
      className="relative w-full h-full overflow-x-auto bg-background text-foreground"
      onScroll={handleScroll}
    >
      <div className="sticky top-0 z-10 relative h-10 border-b border-neutral-800 bg-neutral-900">
        <div className="relative w-max" style={{ width: TOTAL_DURATION * zoom }}>
          {Array.from({ length: Math.ceil(TOTAL_DURATION) + 1 }).map((_, i) => (
            <div key={i} className="absolute top-0 h-full border-l border-neutral-700 text-xs text-neutral-500"
              style={{ left: i * zoom }}>
              <span className="absolute top-1 left-1">{i}s</span>
              {[0.25, 0.5, 0.75].map(frac => (
                <div key={frac} className="absolute top-0 h-1/2 border-l border-neutral-800"
                  style={{ left: frac * zoom }} />
              ))}
            </div>
          ))}
        </div>
      </div>

      <div ref={timelineRef} className="relative">
        {Object.values(tracks).map(track => (
          <div key={track.id} className="relative border-b border-neutral-800"
            style={{ height: TRACK_HEIGHT, width: TOTAL_DURATION * zoom }}>
            {Array.from({ length: Math.ceil(TOTAL_DURATION / GRID_SNAP_SECONDS) }).map((_, i) => (
              <div key={`grid-${i}`} className="absolute top-0 h-full border-l border-neutral-900"
                style={{ left: i * GRID_SNAP_SECONDS * zoom }} />
            ))}
            {track.getAllClips().map(clip => {
              const cfg = clip["config"] as { startTime: number; duration?: number };
              const clipStart = dragging?.clipId === clip.id ? dragging.previewStart : cfg.startTime;
              const x = clipStart * zoom;
              const w = ((cfg.duration ?? (clip as any).buffer?.duration ?? 1) * zoom);
              return (
                <div key={clip.id}
                  className={`absolute top-2 h-16 rounded-md cursor-grab active:cursor-grabbing transition-colors ${
                    dragging?.clipId === clip.id ? 'bg-blue-500 shadow-lg shadow-blue-500/50' : 'bg-blue-600 hover:bg-blue-500'
                  }`}
                  style={{ left: x, width: Math.max(4, w) }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setDragging({
                      clipId: clip.id,
                      trackId: track.id,
                      startX: e.clientX,
                      originalStart: cfg.startTime,
                      previewStart: cfg.startTime,
                    });
                  }}
                  title={`${clip.id} @ ${cfg.startTime.toFixed(2)}s (drag to move)`}
                  role="button" tabIndex={0}>
                  <span className="text-xs px-2 overflow-hidden text-ellipsis whitespace-nowrap">{clip.id}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="fixed top-0 bottom-0 w-px bg-red-500 pointer-events-none z-20"
        style={{ left: playheadX + scrollLeft }} />

      <div className="fixed bottom-4 right-4 bg-neutral-800 text-xs text-neutral-300 px-3 py-1 rounded pointer-events-none">
        {zoom.toFixed(0)}px/s (Ctrl+Scroll)
      </div>
    </div>
  );
}