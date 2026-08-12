import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Card } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
export const EffectChain = ({ effects, onEffectChange, onRemove, }) => {
    return (_jsxs("div", { className: "space-y-3 bg-card rounded-lg p-4", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-200", children: "Effect Chain" }), effects.map((effect, index) => (_jsx(EffectNode, { effect: effect, index: index, onChange: (params) => onEffectChange(effect.id, params), onRemove: () => onRemove(effect.id) }, effect.id)))] }));
};
const EffectNode = ({ effect, index, onChange, onRemove, }) => {
    const [expanded, setExpanded] = useState(false);
    return (_jsxs(Card, { className: "bg-muted border-border p-3", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("span", { className: "text-xs text-muted-foreground", children: [index + 1, "."] }), _jsx("span", { className: "text-sm font-medium text-gray-200 capitalize", children: effect.type })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { size: "sm", variant: "ghost", onClick: () => setExpanded(!expanded), className: "h-6 w-6 p-0", children: expanded ? '−' : '+' }), _jsx(Button, { size: "sm", variant: "ghost", onClick: onRemove, className: "h-6 w-6 p-0 text-red-400", children: _jsx(X, { className: "w-4 h-4" }) })] })] }), expanded && (_jsxs("div", { className: "space-y-2 mt-3 pt-3 border-t border-border", children: [effect.type === 'reverb' && (_jsx(ReverbControls, { params: effect.params, onChange: onChange })), effect.type === 'delay' && (_jsx(DelayControls, { params: effect.params, onChange: onChange }))] }))] }));
};
// TODO: Implement ReverbControls, DelayControls, etc.
const ReverbControls = ({ params, onChange }) => (_jsx("div", { className: "text-xs text-muted-foreground", children: "Reverb controls coming..." }));
const DelayControls = ({ params, onChange }) => (_jsx("div", { className: "text-xs text-muted-foreground", children: "Delay controls coming..." }));
export const Crossfader = ({ state, onChange }) => {
    const handleChange = useCallback((values) => {
        onChange(values[0]);
    }, [onChange]);
    return (_jsx(Card, { className: "bg-muted border-border p-4", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsxs("div", { className: "flex justify-between mb-2", children: [_jsx("span", { className: "text-xs font-medium text-gray-300", children: "Channel A" }), _jsx("span", { className: "text-xs font-medium text-gray-300", children: "Channel B" })] }), _jsx(Slider, { value: [state.range], min: -1, max: 1, step: 0.01, onValueChange: handleChange, className: "w-full" })] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 text-xs", children: [_jsxs("div", { className: "text-muted-foreground", children: ["A: ", (state.leftVolume * 100).toFixed(0), "%"] }), _jsxs("div", { className: "text-muted-foreground text-right", children: ["B: ", (state.rightVolume * 100).toFixed(0), "%"] })] }), state.latency > 0 && (_jsxs("div", { className: "text-xs text-gray-500", children: ["Latency: ", state.latency.toFixed(2), "ms"] }))] }) }));
};
import { cn } from '@/lib/utils';
export const HotCues = ({ cues, selectedCue, onCueJump, onCueSet, onCueDelete, }) => {
    return (_jsx("div", { className: "grid grid-cols-4 gap-2", children: cues.map((cue) => (_jsxs("div", { className: "flex flex-col items-center gap-1", onContextMenu: (e) => {
                e.preventDefault();
                onCueDelete(cue.index);
            }, children: [_jsx(Button, { onClick: () => (cue.isActive ? onCueJump(cue.index) : onCueSet(cue.index)), className: cn('w-12 h-12 rounded-lg font-semibold text-xs', cue.isActive
                        ? 'bg-opacity-80'
                        : 'bg-muted hover:bg-accent text-muted-foreground'), style: cue.isActive
                        ? { backgroundColor: cue.color, color: 'var(--white)' }
                        : undefined, children: cue.index }), cue.label && (_jsx("span", { className: "text-xs text-muted-foreground truncate", children: cue.label }))] }, cue.id))) }));
};
// ============================================================================
// src/components/waveform-editor/waveform-display.tsx
// ============================================================================
import { useEffect, useRef } from 'react';
export const WaveformDisplay = ({ audioBuffer, state, selection, onSelectionChange, currentPosition, }) => {
    const canvasRef = useRef(null);
    useEffect(() => {
        if (!canvasRef.current || !audioBuffer)
            return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return;
        // Clear canvas
        ctx.fillStyle = state.config.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Draw waveform
        ctx.strokeStyle = state.config.waveformColor;
        ctx.lineWidth = 1;
        drawWaveform(ctx, audioBuffer, state);
        // Draw selection
        if (selection.isActive) {
            ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
            const startX = selection.start * state.config.pixelsPerSecond;
            const endX = selection.end * state.config.pixelsPerSecond;
            ctx.fillRect(startX, 0, endX - startX, canvas.height);
        }
        // Draw playhead
        ctx.strokeStyle = state.config.progressColor;
        ctx.lineWidth = 2;
        const playheadX = currentPosition * state.config.pixelsPerSecond;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, canvas.height);
        ctx.stroke();
    }, [audioBuffer, state, selection, currentPosition]);
    const drawWaveform = (ctx, buffer, state) => {
        const rawData = buffer.getChannelData(0);
        const samples = rawData.length;
        const blockSize = Math.floor(samples / (state.config.width * state.config.pixelsPerSecond));
        ctx.beginPath();
        ctx.moveTo(0, state.config.height / 2);
        for (let i = 0; i < samples; i += blockSize) {
            const blockEnd = Math.min(i + blockSize, samples);
            let sum = 0;
            for (let j = i; j < blockEnd; j++) {
                sum += Math.abs(rawData[j]);
            }
            const avg = sum / (blockEnd - i);
            const canvasHeight = avg * state.config.height;
            const x = (i / blockSize / state.config.pixelsPerSecond) % state.config.width;
            const y = state.config.height / 2 - canvasHeight / 2;
            ctx.lineTo(x, y);
        }
        ctx.stroke();
    };
    return (_jsx(Card, { className: "bg-card border-border overflow-hidden", children: _jsx("canvas", { ref: canvasRef, width: state.config.width, height: state.config.height, className: "w-full cursor-crosshair", onMouseDown: (e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const startTime = x / state.config.pixelsPerSecond;
                onSelectionChange(startTime, startTime);
            } }) }));
};
