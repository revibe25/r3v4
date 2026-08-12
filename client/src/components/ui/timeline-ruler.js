import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export const TimelineRuler = ({ maxTime, pixelsPerSecond = 100, bpm = 120, showBeats = false }) => {
    const markers = [];
    // Generate second markers
    for (let i = 0; i <= maxTime; i++) {
        markers.push(i);
    }
    // Calculate beats if needed
    const beatsPerSecond = bpm / 60;
    const beatMarkers = [];
    if (showBeats) {
        for (let i = 0; i <= maxTime * beatsPerSecond; i++) {
            beatMarkers.push(i / beatsPerSecond);
        }
    }
    return (_jsxs("div", { className: "relative h-8 bg-card border-b border-border", children: [showBeats && beatMarkers.map((time, idx) => {
                const isBarStart = idx % 4 === 0;
                return (_jsx("div", { className: "absolute top-0 bottom-0 flex flex-col items-center", style: { left: `${time * pixelsPerSecond}px` }, children: _jsx("div", { className: `w-px ${isBarStart ? 'h-3 bg-background0' : 'h-2 bg-gray-600'}` }) }, `beat-${time}`));
            }), markers.map((time) => (_jsxs("div", { className: "absolute top-0 bottom-0 flex flex-col items-center", style: { left: `${time * pixelsPerSecond}px` }, children: [_jsx("div", { className: "w-px h-3 bg-gray-400" }), _jsxs("span", { className: "text-xs text-muted-foreground mt-1", children: [time, "s"] })] }, `sec-${time}`)))] }));
};
export default TimelineRuler;
