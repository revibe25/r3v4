import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useDAWStore } from "@/hooks/useDAWStore";
import { timeToPixels } from "@/utils/time";
export const ClipBlock = ({ clip, isSelected, onDrag, onResize, onSelect, onContext, }) => {
    const zoom = useDAWStore(s => s.zoom);
    const left = timeToPixels(clip.startTime, zoom);
    const width = timeToPixels(clip.duration, zoom);
    return (_jsx("div", { className: `absolute h-14 rounded ${isSelected ? "border-2 border-blue-400" : ""}`, style: { left, width }, onMouseDown: (e) => {
            e.stopPropagation();
            onSelect(clip.id);
            onDrag(clip.id, e.clientX);
        }, onContextMenu: (e) => {
            e.preventDefault();
            onContext(clip.id, e.clientX, e.clientY);
        }, children: _jsxs("div", { className: "bg-indigo-500 h-full relative", children: [_jsx("div", { className: "absolute right-0 top-0 h-full w-2 bg-indigo-700 cursor-ew-resize", onMouseDown: (e) => {
                        e.stopPropagation();
                        onResize(clip.id, e.clientX);
                    } }), _jsx("span", { className: "text-xs text-foreground px-1 truncate", children: clip.name || clip.id })] }) }));
};
