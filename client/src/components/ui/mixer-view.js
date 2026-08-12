import { jsx as _jsx } from "react/jsx-runtime";
import { useMixerStore } from '@/store/mixer-store';
import "@/store/mixer-store";
import { MixerStrip } from "./mixer-strip";
export function MixerView() {
    const channels = useMixerStore(state => Object.keys(state.channels));
    return (_jsx("div", { style: { display: "flex", gap: 12 }, children: channels.map(id => (_jsx(MixerStrip, { id: id }, id))) }));
}
