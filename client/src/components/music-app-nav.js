import { jsx as _jsx } from "react/jsx-runtime";
import { Link, useLocation } from "wouter";
import { MUSIC_NAV_LINKS } from "@/config/music-nav-links";
export function MusicAppNav() {
    const [pathname] = useLocation();
    return (_jsx("nav", { className: "ag-controls-block", "aria-label": "Music sections", children: MUSIC_NAV_LINKS.map(({ href, label }) => (_jsx(Link, { href: href, className: "ag-nav-btn" + (pathname.startsWith(href) ? " ag-nav-active" : ""), children: label }, href))) }));
}
