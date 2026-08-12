import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { PIXELS_PER_SECOND } from "@/utils/time";
export const Timeline = ({ maxTime }) => (_jsx("div", { className: "relative h-6 bg-card border-b border-border", children: Array.from({ length: Math.ceil(maxTime) + 1 }).map((_, i) => (_jsx("div", { className: "absolute top-0 w-px h-full bg-gray-600", style: { left: i * PIXELS_PER_SECOND }, children: _jsxs("span", { className: "absolute -top-5 text-xs text-muted-foreground", children: [i, "s"] }) }, i))) }));
