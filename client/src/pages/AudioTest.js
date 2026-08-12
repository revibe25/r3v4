import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useAudioEngine } from '../audio/hooks/useAudioEngine';
export default function AudioTest() {
    const { start, ready, energy } = useAudioEngine();
    if (!ready) {
        return (_jsxs("div", { children: [_jsx("header", { className: "ag-header", children: _jsx("div", { className: "ag-header-top", children: _jsxs("div", { className: "ag-wordmark-block", children: [_jsxs("div", { className: "ag-wordmark", "data-testid": "text-title", children: ["R3", _jsx("span", { className: "ag-wordmark-slash", children: "/" }), "NATIVE"] }), _jsx("div", { className: "ag-wordmark-sub", children: "Audio \u00B7 Device Testing" })] }) }) }), _jsx("div", { style: { padding: 20 }, children: _jsx("button", { onClick: start, children: "Start Audio" }) })] }));
    }
    return (_jsxs("div", { style: { padding: 20 }, children: [_jsx("h2", { children: "Audio Engine Running" }), _jsxs("p", { children: ["Energy: ", energy.toFixed(4)] })] }));
}
