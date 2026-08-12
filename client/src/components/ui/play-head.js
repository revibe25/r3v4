import { jsx as _jsx } from "react/jsx-runtime";
export const Playhead = ({ position, pixelsPerSecond = 100, height = '100%', color = 'bg-red-500' }) => {
    const left = position * pixelsPerSecond;
    return (_jsx("div", { className: `absolute top-0 w-0.5 ${color} pointer-events-none z-20`, style: {
            left: `${left}px`,
            height
        }, children: _jsx("div", { className: `absolute -top-2 -left-2 w-4 h-4 ${color} rotate-45` }) }));
};
export default Playhead;
