import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * PricingPage.tsx — R3 v4 (Refactored)
 *
 * Pure display. All state via usePricing hook.
 * All colors via tokens.ts — zero inline hex.
 * 3-tier layout: Explorer / Creator / Pro Artist (matches SUBSCRIPTION_TIERS).
 * Respects prefers-reduced-motion on every animated element.
 *
 * Route: <Route path="/pricing" component={PricingPage} />
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check, X, Zap, Music2, ChevronRight, Sparkles, Upload, Cpu, Users, Shield, Layers, AlertCircle, Loader2, } from "lucide-react";
import { COLOR, PLAN_ACCENT, PLAN_GLOW } from "./tokens";
import { PLANS, STORAGE_ROWS, FAQ_ITEMS, resolvePrice, isFree, annualTotal, } from "./pricing.data";
import { usePricing } from "./usePricing";
// ─── Constants ──────────────────────────────────────────────────────────────
const STAGGER_DELAY = 0.07;
const FADE_DURATION = 0.45;
// ─── Static lookup maps ───────────────────────────────────────────────────────
const PLAN_ICON = {
    explorer: _jsx(Music2, { size: 16 }),
    creator: _jsx(Zap, { size: 16 }),
    pro_artist: _jsx(Layers, { size: 16 }),
};
const STAT_ITEMS = [
    { value: "< 3ms", label: "Audio latency", Icon: Cpu },
    { value: "4K+", label: "Active studios", Icon: Users },
    { value: "99.9%", label: "Uptime SLA", Icon: Shield },
    { value: "∞", label: "Track length", Icon: Layers },
];
// ─── Animation helpers ────────────────────────────────────────────────────────
function useFadeUp(delay = 0) {
    const shouldReduceMotion = useReducedMotion();
    return shouldReduceMotion
        ? {}
        : {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            transition: { delay, duration: FADE_DURATION, ease: "easeOut" },
        };
}
// ─── Background ───────────────────────────────────────────────────────────────
function GridOverlay() {
    return (_jsxs("svg", { className: "absolute inset-0 w-full h-full pointer-events-none select-none", "aria-hidden": "true", preserveAspectRatio: "none", style: { opacity: 0.03 }, children: [_jsx("defs", { children: _jsx("pattern", { id: "r3-grid", width: "40", height: "40", patternUnits: "userSpaceOnUse", children: _jsx("path", { d: "M 40 0 L 0 0 0 40", fill: "none", stroke: COLOR.cyan, strokeWidth: "0.5" }) }) }), _jsx("rect", { width: "100%", height: "100%", fill: "url(#r3-grid)" })] }));
}
function ScanLine() {
    const shouldReduceMotion = useReducedMotion();
    if (shouldReduceMotion)
        return null;
    return (_jsx(motion.div, { className: "absolute left-0 right-0 h-px pointer-events-none", style: {
            background: `linear-gradient(90deg,transparent,${COLOR.cyan},transparent)`,
            opacity: 0.15,
            top: 0,
        }, initial: { y: "-100vh" }, animate: { y: "100vh" }, transition: { duration: 10, repeat: Infinity, ease: "linear" } }));
}
// ─── BillingToggle ────────────────────────────────────────────────────────────
function BillingToggle({ cycle, onToggle, onSet }) {
    const shouldReduceMotion = useReducedMotion();
    return (_jsxs("div", { className: "inline-flex items-center gap-3", role: "group", "aria-label": "Billing cycle", children: [_jsx("button", { onClick: () => onSet("monthly"), className: "text-sm font-mono transition-colors", "aria-pressed": cycle === "monthly", style: { color: cycle === "monthly" ? COLOR.textBody : COLOR.textDim }, children: "Monthly" }), _jsx("button", { onClick: onToggle, className: "relative w-12 h-6 rounded-full flex items-center", style: { border: `1px solid ${COLOR.borderSub}`, background: COLOR.bgElevate }, "aria-label": `Switch to ${cycle === "monthly" ? "annual" : "monthly"} billing`, children: _jsx(motion.div, { className: "absolute w-4 h-4 rounded-full", style: { background: COLOR.cyan }, animate: { left: cycle === "annual" ? "1.5rem" : "0.25rem" }, transition: shouldReduceMotion
                        ? { duration: 0 }
                        : { type: "spring", stiffness: 400, damping: 40 } }) }), _jsx("button", { onClick: () => onSet("annual"), className: "text-sm font-mono transition-colors", "aria-pressed": cycle === "annual", style: { color: cycle === "annual" ? COLOR.textBody : COLOR.textDim }, children: "Annual" }), _jsx(AnimatePresence, { children: cycle === "annual" && (_jsx(motion.span, { initial: shouldReduceMotion ? {} : { opacity: 0, x: -8 }, animate: shouldReduceMotion ? {} : { opacity: 1, x: 0 }, exit: shouldReduceMotion ? {} : { opacity: 0, x: -8 }, className: "text-xs font-mono px-2 py-0.5 rounded", style: {
                        color: COLOR.textBody,
                        border: `1px solid ${COLOR.borderMid}`,
                        background: COLOR.bgElevate,
                    }, children: "Save ~20%" })) })] }));
}
// ─── PriceDisplay ─────────────────────────────────────────────────────────────
function PriceDisplay({ plan, cycle }) {
    const price = resolvePrice(plan, cycle);
    const shouldReduceMotion = useReducedMotion();
    if (isFree(plan)) {
        return (_jsxs("div", { className: "mb-6", children: [_jsx("span", { className: "text-4xl font-mono", style: { color: COLOR.textBody }, children: "$0" }), _jsx("span", { className: "text-sm font-mono ml-1.5", style: { color: COLOR.textDim }, children: "forever" })] }));
    }
    return (_jsxs("div", { className: "mb-6", children: [_jsxs("div", { className: "flex items-end gap-0.5", children: [_jsx("span", { className: "text-sm font-mono mb-1.5", style: { color: COLOR.textDim }, children: "$" }), _jsx(motion.span, { initial: shouldReduceMotion ? {} : { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, className: "text-4xl font-mono", style: { color: COLOR.textBody }, children: price }, price), _jsx("span", { className: "text-sm font-mono mb-1.5 ml-0.5", style: { color: COLOR.textDim }, children: "/mo" })] }), cycle === "annual" && (_jsxs("p", { className: "text-xs font-mono mt-0.5", style: { color: COLOR.textDim }, children: ["Billed $", annualTotal(plan), "/yr"] }))] }));
}
// ─── PlanCta ──────────────────────────────────────────────────────────────────
function PlanCta({ plan, accent, isPending, onCheckout }) {
    return (_jsx("button", { onClick: () => { if (!isPending)
            onCheckout(plan); }, disabled: isPending, "aria-busy": isPending, className: "w-full py-2.5 px-4 text-sm font-mono tracking-wide transition-all\n                 duration-200 mb-6 flex items-center justify-center gap-2\n                 disabled:opacity-60 disabled:cursor-not-allowed group/btn", style: plan.popular
            ? { background: accent, color: COLOR.bgBase }
            : { border: `1px solid ${COLOR.borderMid}`, color: accent, background: COLOR.bgElevate }, children: isPending
            ? _jsx(Loader2, { size: 14, className: "animate-spin" })
            : _jsxs(_Fragment, { children: [plan.cta, _jsx(ChevronRight, { size: 14, className: "transition-transform group-hover/btn:translate-x-0.5" })] }) }));
}
// ─── FeatureRow ───────────────────────────────────────────────────────────────
function FeatureRow({ feature }) {
    const cc = feature.included ? COLOR.cyan : COLOR.borderSub;
    const lc = !feature.included ? COLOR.textGhost
        : feature.highlight ? COLOR.textBody : COLOR.textMuted;
    return (_jsxs("li", { className: "flex items-start gap-2.5 py-[3px]", children: [_jsx("span", { className: "mt-0.5 shrink-0", style: { color: cc }, children: _jsx(Check, { size: 12, strokeWidth: 2.5 }) }), _jsxs("span", { className: `text-[13px] font-mono leading-snug ${!feature.included ? "line-through" : ""}`, style: { color: lc }, children: [feature.label, feature.detail && feature.included && (_jsxs("span", { className: "ml-1.5 text-[11px]", style: { color: COLOR.textDim }, children: ["\u2014 ", feature.detail] }))] })] }));
}
// ─── PlanCard ─────────────────────────────────────────────────────────────────
function PlanCard({ plan, cycle, index, isPending, onCheckout }) {
    const fadeUpProps = useFadeUp(index * STAGGER_DELAY);
    const accent = PLAN_ACCENT[plan.id];
    const glow = PLAN_GLOW[plan.id];
    return (_jsx(motion.article, { ...fadeUpProps, className: "relative flex flex-col overflow-hidden transition-colors duration-300", style: {
            background: COLOR.bgSurface,
            border: `1px solid ${plan.popular ? COLOR.borderMid : COLOR.borderSub}`,
            borderLeft: `2px solid ${COLOR.cyan}`,
            boxShadow: plan.popular
                ? `0 0 60px ${glow}, inset 2px 0 20px rgba(163,230,53,0.2)`
                : `inset 2px 0 20px rgba(163,230,53,0.15)`,
        }, "aria-labelledby": `plan-title-${plan.id}`, children: _jsxs("div", { className: "p-6 flex flex-col flex-1", children: [_jsxs("div", { className: "flex items-center gap-2 mb-1", children: [_jsx("span", { style: { color: accent }, children: PLAN_ICON[plan.id] }), _jsx("span", { id: `plan-title-${plan.id}`, className: "text-[11px] font-mono uppercase tracking-[0.18em]", style: { color: COLOR.textDim }, children: plan.name })] }), _jsx("p", { className: "text-[13px] font-mono leading-relaxed mb-5", style: { color: COLOR.textDim }, children: plan.tagline }), _jsx(PriceDisplay, { plan: plan, cycle: cycle }), _jsx(PlanCta, { plan: plan, accent: accent, isPending: isPending, onCheckout: onCheckout }), _jsx("div", { className: "h-px mb-4", style: { background: COLOR.borderSub } }), _jsx("ul", { className: "flex flex-col flex-1", children: plan.features.map(f => _jsx(FeatureRow, { feature: f }, f.label)) })] }) }));
}
// ─── Stats strip ──────────────────────────────────────────────────────────────
function StatsStrip() {
    const fadeUpProps = useFadeUp(0.2);
    return (_jsx(motion.div, { ...fadeUpProps, className: "grid grid-cols-4 overflow-hidden mb-14", style: { border: `1px solid ${COLOR.borderSub}`, background: COLOR.borderSub, gap: "1px" }, children: STAT_ITEMS.map(({ value, label, Icon }) => (_jsxs("div", { className: "flex flex-col items-center gap-1 px-6 py-4", style: { background: COLOR.bgSurface }, children: [_jsxs("div", { className: "flex items-center gap-1.5 mb-1", children: [_jsx(Icon, { size: 12, style: { color: COLOR.textDim } }), _jsx("span", { className: "text-[11px] font-mono uppercase tracking-wider", style: { color: COLOR.textDim }, children: label })] }), _jsx("span", { className: "text-xl font-mono", style: { color: COLOR.cyan }, children: value })] }, label))) }));
}
// ─── Storage table ────────────────────────────────────────────────────────────
function StorageTable() {
    const fadeUpProps = useFadeUp(0.35);
    return (_jsxs(motion.div, { ...fadeUpProps, className: "overflow-hidden mb-16", style: { border: `1px solid ${COLOR.borderSub}` }, children: [_jsxs("div", { className: "px-8 py-5 flex items-center gap-3", style: { borderBottom: `1px solid ${COLOR.borderSub}`, background: COLOR.bgSurface }, children: [_jsx(Upload, { size: 14, style: { color: COLOR.cyan } }), _jsx("span", { className: "text-[12px] font-mono uppercase tracking-[0.18em]", style: { color: COLOR.textDim }, children: "Limits & Storage" })] }), _jsx("div", { className: "grid grid-cols-3", style: { background: COLOR.borderSub, gap: "1px" }, children: STORAGE_ROWS.map(row => {
                    const accent = PLAN_ACCENT[row.tierKey] ?? COLOR.textDim;
                    return (_jsxs("div", { className: "px-6 py-5", style: { background: COLOR.bgSurface }, children: [_jsx("p", { className: "text-[11px] font-mono uppercase tracking-wider mb-3", style: { color: accent }, children: row.tier }), [["Uploads", row.uploads], ["Projects", row.projects], ["Stems", row.stems]].map(([k, v]) => (_jsxs("div", { className: "mb-2 last:mb-0", children: [_jsx("p", { className: "text-[10px] font-mono uppercase tracking-wider mb-0.5", style: { color: COLOR.textGhost }, children: k }), _jsx("p", { className: "text-sm font-mono", style: { color: COLOR.textBody }, children: v })] }, k)))] }, row.tierKey));
                }) })] }));
}
// ─── FAQ ──────────────────────────────────────────────────────────────────────
function FAQ() {
    const [openIndex, setOpenIndex] = useState(null);
    const shouldReduceMotion = useReducedMotion();
    return (_jsxs("div", { className: "max-w-2xl mx-auto mb-12", children: [_jsx("p", { className: "text-[11px] font-mono uppercase tracking-[0.18em] text-center mb-6", style: { color: COLOR.textDim }, children: "Frequently Asked Questions" }), _jsx("div", { className: "space-y-2", children: FAQ_ITEMS.map((item, i) => {
                    const open = openIndex === i;
                    return (_jsxs("div", { className: "overflow-hidden", style: {
                            border: `1px solid ${open ? COLOR.borderMid : COLOR.borderSub}`,
                            background: COLOR.bgSurface,
                        }, children: [_jsxs("button", { onClick: () => setOpenIndex(p => p === i ? null : i), "aria-expanded": open, className: "w-full text-left px-5 py-4 flex items-center justify-between gap-4 transition-colors", style: { background: open ? COLOR.bgElevate : undefined }, children: [_jsx("span", { className: "text-[13px] font-mono", style: { color: COLOR.textBody }, children: item.q }), _jsx(motion.span, { animate: { rotate: open ? 90 : 0 }, transition: shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }, className: "shrink-0", style: { color: COLOR.textDim }, children: _jsx(ChevronRight, { size: 14 }) })] }), _jsx(AnimatePresence, { initial: false, children: open && (_jsx(motion.div, { initial: { height: 0, opacity: 0 }, animate: { height: "auto", opacity: 1 }, exit: { height: 0, opacity: 0 }, transition: { duration: shouldReduceMotion ? 0 : 0.22, ease: "easeInOut" }, className: "overflow-hidden", children: _jsx("div", { className: "px-5 pb-4 pt-3", style: { borderTop: `1px solid ${COLOR.borderSub}` }, children: _jsx("p", { className: "text-[13px] font-mono leading-relaxed", style: { color: COLOR.textDim }, children: item.a }) }) }, `faq-content-${i}`)) })] }, `faq-${i}`));
                }) })] }));
}
// ─── Error Toast ──────────────────────────────────────────────────────────────
function ErrorToast({ message, onDismiss }) {
    const toastRef = useRef(null);
    useEffect(() => {
        toastRef.current?.focus();
    }, []);
    return (_jsxs(motion.div, { ref: toastRef, tabIndex: -1, initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 16 }, role: "alert", "aria-live": "assertive", className: "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3\n                 px-5 py-3 rounded-xl font-mono text-sm shadow-2xl outline-none", style: {
            background: COLOR.bgElevate,
            border: `1px solid ${COLOR.borderMid}`,
            color: "var(--status-error-soft)",
        }, children: [_jsx(AlertCircle, { size: 14 }), _jsx("span", { children: message }), _jsx("button", { onClick: onDismiss, "aria-label": "Dismiss error", className: "ml-2 opacity-60 hover:opacity-100 transition-opacity", children: _jsx(X, { size: 14 }) })] }));
}
// ─── Page ─────────────────────────────────────────────────────────────────────
export default function PricingPage() {
    const { cycle, setCycle, toggleCycle, checkoutStatus, initiateCheckout, clearError } = usePricing();
    const pendingPlanId = checkoutStatus.type === "pending" ? checkoutStatus.planId : null;
    const headerFadeUp = useFadeUp(0);
    return (_jsxs("div", { className: "relative min-h-screen overflow-hidden", style: { background: COLOR.bgBase, color: COLOR.textBody }, children: [_jsx(GridOverlay, {}), _jsx(ScanLine, {}), _jsxs("div", { className: "relative z-10 max-w-6xl mx-auto px-6 py-20", children: [_jsxs(motion.div, { ...headerFadeUp, className: "text-center mb-16", children: [_jsxs("div", { className: "inline-flex items-center gap-2 text-[11px] font-mono uppercase\n                       tracking-[0.22em] px-3 py-1 rounded mb-5", style: {
                                    color: COLOR.textDim,
                                    border: `1px solid ${COLOR.borderSub}`,
                                    background: "transparent",
                                }, children: [_jsx(Sparkles, { size: 10 }), "R3 v4 \u2014 Subscription"] }), _jsxs("h1", { className: "text-5xl font-mono font-bold tracking-tight mb-4 leading-tight", style: { color: COLOR.textPrimary }, children: ["Build your studio.", _jsx("br", {}), _jsx("span", { style: { color: COLOR.cyan }, children: "Scale when you're ready." })] }), _jsx("p", { className: "text-[15px] font-mono max-w-xl mx-auto mb-8 leading-relaxed", style: { color: COLOR.textDim }, children: "Professional DJ & DAW tools in the browser. No installs, no dongles." }), _jsx(BillingToggle, { cycle: cycle, onToggle: toggleCycle, onSet: setCycle })] }), _jsx(StatsStrip, {}), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4 mb-20", children: PLANS.map((plan, i) => (_jsx(PlanCard, { plan: plan, cycle: cycle, index: i, isPending: pendingPlanId === plan.id, onCheckout: initiateCheckout }, plan.id))) }), _jsx(StorageTable, {}), _jsx(FAQ, {}), _jsx("p", { className: "text-center text-[12px] font-mono", style: { color: COLOR.textGhost }, children: "14-day free trial on Creator & Pro Artist\u00A0\u00B7\u00A0No credit card required\u00A0\u00B7\u00A0Cancel anytime" })] }), _jsx(AnimatePresence, { children: checkoutStatus.type === "error" && (_jsx(ErrorToast, { message: checkoutStatus.message, onDismiss: clearError })) })] }));
}
