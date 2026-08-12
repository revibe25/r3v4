import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// @ts-nocheck
import { useMeterStore } from '@/store/meter-store';
import { useMixerStore } from '@/store/mixer-store';
import "@/store/mixer-store";
import "@/store/meter-store";
export function MixerStrip({ id }) {
    const { setVolume, setPan, setMute, setSolo, channels, } = useMixerStore();
    const meter = useMeterStore(state => state.readMeter(id));
    const ch = channels[id];
    if (!ch)
        return null;
    return (_jsxs("div", { style: { width: 80 }, children: [_jsx("div", { style: { height: 60, background: "var(--dj-border)" }, children: _jsx("div", { style: {
                        height: `${(meter?.rms ?? 0) * 100}%`,
                        background: "lime",
                    } }) }), _jsx("input", { type: "range", min: 0, max: 1, step: 0.01, value: ch.gainNode.gain.value, onChange: e => setVolume(id, +e.target.value), orient: "vertical" }), _jsx("input", { type: "range", min: -1, max: 1, step: 0.01, value: ch.panNode.pan.value, onChange: e => setPan(id, +e.target.value) }), _jsx("button", { onClick: () => setMute(id, !ch.muted), children: "M" }), _jsx("button", { onClick: () => setSolo(id, !ch.solo), children: "S" })] }));
}
