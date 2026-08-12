import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// @ts-nocheck
import { useCallback, useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Volume2, Plus } from "lucide-react";
import { DJControls } from "./dj-controls";
import { ChannelStrip } from "./channel-strip";
import { SpectrumAnalyzer } from "./SpectrumAnalyzer";
import { VUMeter } from "./vumeter";
import { Slider } from "@/components/ui/slider";
import { defaultChannel } from "./utils";
export default function MixerWithDJ() {
    // same logic as before
    const [channels, setChannels] = useState(() => [
        defaultChannel(1),
        defaultChannel(2),
        defaultChannel(3),
        defaultChannel(4),
    ]);
    const [master, setMaster] = useState({
        mainFader: 85,
        headphoneFader: 70,
        monitoring: "stereo",
        masterCompression: 1.5,
        masterLimiter: false,
        recording: false,
        streamActive: false,
    });
    const [filterVal, setFilterVal] = useState(0.5);
    const [pitchSemitones, setPitchSemitones] = useState(0);
    const [crossfade, setCrossfade] = useState(0);
    const updateChannel = useCallback((id, updates) => {
        setChannels((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    }, []);
    const duplicateChannel = (id) => {
        setChannels((prev) => {
            const base = prev.find((c) => c.id === id);
            if (!base)
                return prev;
            const newId = Math.max(...prev.map((p) => p.id)) + 1;
            return [...prev, { ...base, id: newId, name: `${base.name} Copy` }];
        });
    };
    const deleteChannel = (id) => setChannels((prev) => prev.filter((c) => c.id !== id));
    useEffect(() => {
        setChannels((prev) => prev.map((c) => ({ ...c, reverb: Math.round(filterVal * 50) })));
    }, [filterVal]);
    return (_jsxs("div", { className: "p-6 min-h-screen bg-background", children: [_jsxs("header", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-extrabold", children: "Mixer Console" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Dynamic Accent + shadcn Theme" })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm text-muted-foreground", children: [_jsx(Volume2, { className: "w-5 h-5" }), _jsxs("span", { children: [master.mainFader, "%"] })] }), _jsxs(Button, { onClick: () => setChannels((p) => [...p, defaultChannel(p.length + 1)]), children: [_jsx(Plus, { className: "w-4 h-4 mr-2" }), " Add Channel"] })] })] }), _jsx("section", { className: "mb-6", children: _jsx(DJControls, { filterVal: filterVal, pitchSemitones: pitchSemitones, crossfade: crossfade, onFilterChange: setFilterVal, onPitchChange: setPitchSemitones, onCrossfadeChange: setCrossfade }) }), _jsx("section", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6", children: channels.map((ch) => (_jsx(ChannelStrip, { channel: ch, onChange: (u) => updateChannel(ch.id, u), onDuplicate: () => duplicateChannel(ch.id), onDelete: () => deleteChannel(ch.id) }, ch.id))) }), _jsxs("section", { className: "grid grid-cols-1 lg:grid-cols-2 gap-4", children: [_jsxs(Card, { className: "bg-card/60 border-border/40", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Master" }) }), _jsx(CardContent, { children: _jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("div", { className: "flex-1", children: [_jsxs("div", { className: "flex justify-between text-sm mb-1", children: [_jsx("span", { children: "Main Fader" }), _jsxs("span", { className: "font-mono", children: [master.mainFader, "%"] })] }), _jsx(Slider, { value: [master.mainFader], min: 0, max: 100, step: 1, onValueChange: ([v]) => setMaster((s) => ({ ...s, mainFader: v })) })] }), _jsx("div", { className: "w-48", children: _jsx(SpectrumAnalyzer, { active: true }) })] }) })] }), _jsxs(Card, { className: "bg-card/60 border-border/40", children: [_jsx(CardHeader, { children: _jsx(CardTitle, { children: "Master Output" }) }), _jsx(CardContent, { children: _jsx(VUMeter, { level: channels.reduce((a, b) => a + b.level, 0) / Math.max(1, channels.length), peakLevel: channels.reduce((a, b) => Math.max(a, b.peakLevel), 0) }) })] })] })] }));
}
