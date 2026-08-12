import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * client/src/pages/admin/AgentSuitePage.tsx
 *
 * Route: /admin/agents (admin-only — guarded at route level AND server level)
 *
 * Admin gate sequence:
 *  1. ProtectedRoute in App.tsx ensures the user is authenticated.
 *  2. This page queries trpc.admin.checkAccess to verify isAdmin === true in DB.
 *     (JWT contains userId + tier ONLY — auth.md JWT CONTRACT)
 *  3. If not admin → locked screen with no sensitive leak.
 *
 * Wire.txt §8 — only one hydration path; reads from hooks/authStore ONLY.
 * CLAUDE.md Hard Guard #7 — post-login redirect: /instrument only, never /daw.
 * CLAUDE.md Hard Guard #1 — no `any`; unknown + type guards.
 * Wire.txt §5 — acid-techno palette only.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc"; // verify against your tRPC client path
import { AgentSuite } from "@/components/admin/AgentSuite";
import { AgentMeshPanel } from "@/components/admin/AgentMeshPanel";
// ─── Design Tokens (Wire.txt §5) ──────────────────────────────────────────────
const T = {
    black: "var(--void)",
    acid: "#a3e635",
    red: "#EF4444",
    z950: "var(--z950)",
    z900: "var(--panel)",
    z800: "var(--zinc-800)",
    z700: "var(--zinc-700)",
    z600: "var(--zinc-600)",
    z400: "var(--zinc-400)",
    cyan: "var(--accent-cyan)",
    violet: "var(--accent-purple)",
    amber: "var(--status-warn)",
};
// ─── Admin Not Authorized Screen ──────────────────────────────────────────────
function AdminForbidden() {
    return (_jsxs("div", { style: {
            height: "calc(100vh - var(--nav-h, 44px))", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: T.black, gap: 12,
        }, children: [_jsx("div", { style: {
                    width: 48, height: 48, borderRadius: "50%",
                    background: `${T.red}12`,
                    border: `1px solid ${T.red}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 22, color: T.red,
                }, children: "\u2297" }), _jsx("div", { style: {
                    fontSize: 13, fontWeight: 600,
                    color: T.red,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "0.1em",
                }, children: "ADMIN ACCESS REQUIRED" }), _jsx("div", { style: {
                    fontSize: 11, color: T.z600,
                    fontFamily: "Inter, sans-serif",
                }, children: "This panel is restricted to administrators." })] }));
}
// ─── Admin Loading Screen ─────────────────────────────────────────────────────
function AdminLoading() {
    return (_jsxs("div", { style: {
            height: "calc(100vh - var(--nav-h, 44px))", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: T.black, gap: 10,
        }, children: [_jsx("div", { style: {
                    fontSize: 9, color: T.z600,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "0.2em", animation: "pulse 1.5s ease-in-out infinite",
                }, children: "VERIFYING ADMIN ACCESS\u2026" }), _jsx("style", { children: `@keyframes pulse{0%,100%{opacity:0.3;}50%{opacity:1;}}` })] }));
}
// ─── Tab Button ───────────────────────────────────────────────────────────────
function TabBtn({ label, icon, active, color, onClick, }) {
    return (_jsxs("button", { onClick: onClick, style: {
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 14px",
            background: active ? `${color}12` : "transparent",
            border: `1px solid ${active ? color + "40" : T.z800}`,
            borderRadius: 8,
            cursor: "pointer",
            color: active ? color : T.z400,
            fontSize: 12, fontWeight: 600,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: "0.05em",
            transition: "all 0.15s",
        }, children: [_jsx("span", { children: icon }), _jsx("span", { children: label })] }));
}
// ─── Admin Agent Suite Page ───────────────────────────────────────────────────
export function AdminAgentSuitePage() {
    const [activeTab, setActiveTab] = useState("agents");
    // Server-side admin gate — JWT has no isAdmin (auth.md JWT CONTRACT)
    const { data, isLoading, isError } = trpc.admin.checkAccess.useQuery(undefined, {
        retry: false,
        staleTime: 5 * 60 * 1000, // 5 min — re-check on refocus
    });
    if (isLoading)
        return _jsx(AdminLoading, {});
    if (isError || !data?.isAdmin)
        return _jsx(AdminForbidden, {});
    return (_jsxs("div", { style: {
            display: "flex",
            flexDirection: "column",
            height: "calc(100vh - var(--nav-h, 44px))",
            background: T.black,
            overflow: "hidden",
        }, children: [_jsx("style", { children: `
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600&display=swap');
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:3px;height:3px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:2px;}
      ` }), _jsxs("div", { style: {
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 16px",
                    background: T.z900,
                    borderBottom: `1px solid ${T.z800}`,
                    flexShrink: 0,
                }, children: [_jsxs("div", { style: {
                            display: "flex", alignItems: "center", gap: 6,
                            padding: "4px 10px",
                            background: `${T.red}12`,
                            border: `1px solid ${T.red}40`,
                            borderRadius: 6,
                        }, children: [_jsx("div", { style: { width: 6, height: 6, borderRadius: "50%", background: T.red } }), _jsx("span", { style: {
                                    fontSize: 9, fontWeight: 600,
                                    color: T.red, letterSpacing: "0.2em",
                                    fontFamily: "'JetBrains Mono', monospace",
                                }, children: "ADMIN" })] }), _jsx("div", { style: {
                            fontSize: 13, fontWeight: 700,
                            color: T.acid, fontFamily: "'JetBrains Mono', monospace",
                            letterSpacing: "0.06em",
                            textShadow: `0 0 20px ${T.acid}50`,
                        }, children: "R3 V4 \u00B7 AGENT SUITE" }), _jsx("div", { style: { flex: 1 } }), _jsxs("div", { style: { display: "flex", gap: 6 }, children: [_jsx(TabBtn, { label: "EXPERT AGENTS", icon: "\u2B21", active: activeTab === "agents", color: T.acid, onClick: () => setActiveTab("agents") }), _jsx(TabBtn, { label: "AGENT MESH", icon: "\u25C8", active: activeTab === "mesh", color: T.violet, onClick: () => setActiveTab("mesh") })] })] }), _jsxs("div", { style: { flex: 1, overflow: "hidden", position: "relative" }, children: [activeTab === "agents" && (_jsx("div", { style: { height: "100%", overflow: "hidden" }, children: _jsx(AgentSuite, {}) })), activeTab === "mesh" && (_jsx("div", { style: { height: "100%", overflowY: "auto" }, children: _jsx(AgentMeshPanel, {}) }))] })] }));
}
