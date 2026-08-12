import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { MusicAppNav } from "@/components/music-app-nav";
export function MusicPageShell({ header, transportBar, children, }) {
    return (_jsxs(_Fragment, { children: [_jsxs("header", { className: "ag-header", children: [header, _jsx(MusicAppNav, {})] }), transportBar, _jsx("main", { className: "ag-frame ag-content", children: children })] }));
}
