import { jsx as _jsx } from "react/jsx-runtime";
// ui/modular-rack.tsx
export function Rack({ children }) {
    return (_jsx("div", { className: "grid grid-cols-12 gap-2 bg-background/40 p-2 rounded-xl", children: children }));
}
