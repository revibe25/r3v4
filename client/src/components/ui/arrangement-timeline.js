import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
// @ts-nocheck
import { useClipStore } from '@/store/clip-store';
import { useEffect, useRef, useState } from "react";
import * as Tone from "tone";
import "@/store/clip-store";
const PIXELS_PER_SECOND = 100;
export default function ArrangementTimeline() {
    const containerRef = useRef(null);
    const [playheadX, setPlayheadX] = useState(0);
    const [dragging, setDragging] = useState(null);
    const tracks = useClipStore(state => state.tracks);
    useEffect(() => {
        let raf;
        const update = () => {
            const seconds = Tone.Transport.seconds;
            setPlayheadX(seconds * PIXELS_PER_SECOND);
            raf = requestAnimationFrame(update);
        };
        raf = requestAnimationFrame(update);
        return () => cancelAnimationFrame(raf);
    }, []);
    useEffect(() => {
        const onMove = (e) => {
            if (!dragging)
                return;
            const deltaPx = e.clientX - dragging.startX;
            const deltaTime = deltaPx / PIXELS_PER_SECOND;
            const track = tracks[dragging.trackId];
            const clip = track?.getClip(dragging.clipId);
            if (!clip)
                return;
            clip.update({
                startTime: Math.max(0, dragging.originalStart + deltaTime),
            });
        };
        const onUp = () => setDragging(null);
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [dragging, tracks]);
    return (_jsxs("div", { className: "relative w-full h-full overflow-x-auto bg-background text-foreground", children: [_jsx("div", { className: "relative h-10 border-b border-neutral-800", children: Array.from({ length: 200 }).map((_, i) => (_jsx("div", { className: "absolute top-0 h-full border-l border-neutral-700 text-xs text-neutral-500", style: { left: i * PIXELS_PER_SECOND }, children: _jsxs("span", { className: "absolute top-1 left-1", children: [i, "s"] }) }, i))) }), _jsx("div", { ref: containerRef, children: Object.values(tracks).map(track => (_jsx("div", { className: "relative h-20 border-b border-neutral-800", children: track.getAllClips().map(clip => {
                        const cfg = clip["config"];
                        const x = cfg.startTime * PIXELS_PER_SECOND;
                        const w = (cfg.duration ?? clip.buffer.duration) * PIXELS_PER_SECOND;
                        return (_jsx("div", { className: "absolute top-2 h-16 bg-blue-600 rounded-md cursor-grab active:cursor-grabbing hover:bg-blue-500", style: { left: x, width: w }, onMouseDown: e => setDragging({
                                clipId: clip.id,
                                trackId: track.id,
                                startX: e.clientX,
                                originalStart: cfg.startTime,
                            }), children: _jsx("span", { className: "text-xs px-2", children: clip.id }) }, clip.id));
                    }) }, track.id))) }), _jsx("div", { className: "absolute top-0 bottom-0 w-px bg-red-500 pointer-events-none", style: { left: playheadX } })] }));
}
