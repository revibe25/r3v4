import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// ─────────────────────────────────────────────────────────────────────────────
// R3 · UpgradePrompt Component
// Drop into: client/src/components/subscription/UpgradePrompt.tsx
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';
import { useSubscription } from '../../hooks/useSubscription';
import { TIER_DEFINITIONS } from '../../../../shared/subscription.types';
const TIER_COLORS = {
    explorer: 'var(--tier-explorer)',
    creator: 'var(--tier-creator)',
    pro_artist: 'var(--tier-pro-artist)',
};
export function UpgradePrompt({ gateError, requiredTier: requiredTierProp, feature, compact = false, onDismiss, }) {
    const { startCheckout, tier: currentTier } = useSubscription();
    const [billing, setBilling] = useState('annual');
    const [loading, setLoading] = useState(false);
    const requiredTier = gateError?.requiredTier ?? requiredTierProp ?? 'creator';
    const message = gateError?.message ??
        `Upgrade to ${TIER_DEFINITIONS[requiredTier].displayName} to unlock this feature.`;
    const tierDef = TIER_DEFINITIONS[requiredTier];
    const color = TIER_COLORS[requiredTier];
    const monthlyCents = tierDef.monthlyPriceCents;
    const annualCents = tierDef.annualPriceCents;
    async function handleUpgrade() {
        if (requiredTier === 'explorer')
            return;
        setLoading(true);
        try {
            await startCheckout(requiredTier, billing);
        }
        finally {
            setLoading(false);
        }
    }
    if (compact) {
        return (_jsxs("div", { style: {
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                background: `${color}14`,
                border: `1px solid ${color}40`,
                borderRadius: '8px',
                fontSize: '13px',
            }, children: [_jsx("span", { style: { flex: 1, color: 'var(--fg)' }, children: message }), _jsx("button", { onClick: handleUpgrade, disabled: loading, style: {
                        padding: '6px 14px',
                        background: color,
                        color: 'var(--white)',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '12px',
                        whiteSpace: 'nowrap',
                    }, children: loading ? 'Opening...' : `Upgrade to ${tierDef.displayName}` })] }));
    }
    return (_jsxs("div", { style: {
            background: 'var(--dj-surface)',
            border: `2px solid ${color}`,
            borderRadius: '16px',
            padding: '32px',
            maxWidth: '420px',
            width: '100%',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            fontFamily: 'Arial, sans-serif',
            position: 'relative',
        }, children: [onDismiss && (_jsx("button", { onClick: onDismiss, style: {
                    position: 'absolute',
                    top: '14px',
                    right: '14px',
                    background: 'none',
                    border: 'none',
                    fontSize: '18px',
                    cursor: 'pointer',
                    color: 'var(--dj-muted)',
                    lineHeight: 1,
                }, "aria-label": "Dismiss", children: "\u00D7" })), _jsx("div", { style: {
                    display: 'inline-block',
                    background: color,
                    color: 'var(--white)',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.05em',
                    marginBottom: '16px',
                    textTransform: 'uppercase',
                }, children: tierDef.displayName }), _jsx("h3", { style: { margin: '0 0 8px', fontSize: '20px', color: 'var(--fg)' }, children: "Unlock this feature" }), _jsx("p", { style: { margin: '0 0 24px', fontSize: '14px', color: 'var(--dj-muted)', lineHeight: 1.6 }, children: message }), requiredTier !== 'explorer' && (_jsxs(_Fragment, { children: [_jsx("div", { style: {
                            display: 'flex',
                            background: 'var(--dj-surface2)',
                            borderRadius: '8px',
                            padding: '3px',
                            marginBottom: '20px',
                            gap: '2px',
                        }, children: ['monthly', 'annual'].map((cycle) => (_jsx("button", { onClick: () => setBilling(cycle), style: {
                                flex: 1,
                                padding: '7px',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: billing === cycle ? 700 : 400,
                                fontSize: '13px',
                                background: billing === cycle ? 'var(--dj-surface3)' : 'transparent',
                                color: billing === cycle ? 'var(--fg)' : 'var(--dj-muted)',
                                boxShadow: billing === cycle ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                                transition: 'all 0.15s',
                            }, children: cycle === 'monthly' ? 'Monthly' : 'Annual (save 20%)' }, cycle))) }), _jsxs("div", { style: { marginBottom: '20px' }, children: [_jsxs("span", { style: { fontSize: '32px', fontWeight: 700, color: 'var(--fg)' }, children: ["$", billing === 'monthly' ? (monthlyCents / 100).toFixed(0) : (annualCents / 100).toFixed(0)] }), _jsx("span", { style: { fontSize: '14px', color: 'var(--dj-muted)' }, children: " / month" }), billing === 'annual' && (_jsxs("span", { style: {
                                    marginLeft: '8px',
                                    fontSize: '12px',
                                    background: 'rgba(46,125,50,0.18)',
                                    color: 'var(--looper-lime)',
                                    padding: '2px 8px',
                                    borderRadius: '10px',
                                    fontWeight: 600,
                                }, children: ["billed $", ((annualCents / 100) * 12).toFixed(0), "/yr"] }))] }), _jsx("button", { onClick: handleUpgrade, disabled: loading, style: {
                            width: '100%',
                            padding: '14px',
                            background: loading ? 'var(--dj-dim)' : color,
                            color: 'var(--white)',
                            border: 'none',
                            borderRadius: '10px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            fontWeight: 700,
                            fontSize: '15px',
                            transition: 'opacity 0.2s',
                        }, children: loading
                            ? 'Redirecting to checkout...'
                            : `Start 7-day free trial — then $${billing === 'monthly' ? (monthlyCents / 100).toFixed(0) : (annualCents / 100).toFixed(0)}/mo` }), _jsx("p", { style: { marginTop: '12px', fontSize: '11px', color: 'var(--dj-muted)', textAlign: 'center' }, children: "Cancel any time \u00B7 No commitment \u00B7 Secure checkout via Stripe" })] }))] }));
}
export function FeatureGate({ feature, requiredTier, compact, children, fallback, }) {
    const { can } = useSubscription();
    const allowed = can(feature);
    if (allowed)
        return _jsx(_Fragment, { children: children });
    if (fallback)
        return _jsx(_Fragment, { children: fallback });
    return (_jsx(UpgradePrompt, { requiredTier: requiredTier, feature: String(feature), compact: compact }));
}
