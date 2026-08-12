import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// client/src/components/logout-button.tsx
// Canonical logout — used by PageNav (full) and HeaderControls (compact).
// Confirmation popover prevents accidental sign-out.
// Clears Zustand store + localStorage, then navigates to /login via wouter.
import { useState, useCallback, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { LogOut } from 'lucide-react';
import { useAuthStore } from '@/hooks/authStore';
const S = {
    bg: 'var(--dj-surface)',
    border: 'var(--dj-border)',
    accent: '#a3e635',
    dim: '#555',
    danger: '#ff3b3b',
    font: "'IBM Plex Mono', 'JetBrains Mono', monospace",
};
export function LogoutButton({ variant = 'full' }) {
    const [confirming, setConfirming] = useState(false);
    const [, navigate] = useLocation();
    const { logout } = useAuthStore();
    const popoverRef = useRef(null);
    const triggerRef = useRef(null);
    // Close on outside click
    useEffect(() => {
        if (!confirming)
            return;
        const handler = (e) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target) &&
                triggerRef.current && !triggerRef.current.contains(e.target))
                setConfirming(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [confirming]);
    // Close on Escape
    useEffect(() => {
        if (!confirming)
            return;
        const handler = (e) => {
            if (e.key === 'Escape')
                setConfirming(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [confirming]);
    const handleConfirm = useCallback(() => {
        logout(); // clears hooks/authStore + r3_token
        localStorage.removeItem('r3-auth'); // purge legacy stores/authStore key
        setConfirming(false);
        navigate('/login');
    }, [logout, navigate]);
    return (_jsxs("div", { style: { position: 'relative', display: 'inline-flex', flexShrink: 0 }, children: [_jsxs("button", { ref: triggerRef, onClick: () => setConfirming(v => !v), "aria-label": "Sign out", "aria-expanded": confirming, style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 28,
                    padding: variant === 'full' ? '0 12px' : '0 8px',
                    background: confirming ? 'rgba(255,59,59,0.12)' : 'transparent',
                    color: confirming ? S.danger : S.dim,
                    border: `1px solid ${confirming ? S.danger : S.border}`,
                    borderRadius: 0,
                    cursor: 'pointer',
                    fontFamily: S.font,
                    fontSize: 10,
                    letterSpacing: 1,
                    textTransform: 'uppercase',
                    flexShrink: 0,
                    transition: 'all .15s',
                }, onMouseEnter: e => {
                    if (confirming)
                        return;
                    e.currentTarget.style.background = 'rgba(255,59,59,0.08)';
                    e.currentTarget.style.color = S.danger;
                    e.currentTarget.style.borderColor = S.danger;
                }, onMouseLeave: e => {
                    if (confirming)
                        return;
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = S.dim;
                    e.currentTarget.style.borderColor = S.border;
                }, children: [_jsx(LogOut, { size: 11 }), variant === 'full' && _jsx("span", { children: "Sign Out" })] }), confirming && (_jsxs("div", { ref: popoverRef, role: "dialog", "aria-label": "Confirm sign out", style: {
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    zIndex: 9999,
                    background: S.bg,
                    border: `1px solid ${S.danger}`,
                    borderTop: `2px solid ${S.danger}`,
                    padding: '12px 14px',
                    minWidth: '176px',
                    fontFamily: S.font,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                }, children: [_jsx("p", { style: {
                            fontSize: 9,
                            letterSpacing: '.15em',
                            textTransform: 'uppercase',
                            color: 'rgba(255,255,255,0.35)',
                            marginBottom: 10,
                            lineHeight: 1.6,
                            margin: '0 0 10px 0',
                        }, children: "End session?" }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [_jsx("button", { onClick: handleConfirm, autoFocus: true, style: {
                                    flex: 1,
                                    padding: '7px 0',
                                    background: S.danger,
                                    color: 'var(--white)',
                                    border: 'none',
                                    borderRadius: 0,
                                    cursor: 'pointer',
                                    fontFamily: S.font,
                                    fontSize: 9,
                                    letterSpacing: '.15em',
                                    textTransform: 'uppercase',
                                    fontWeight: 700,
                                    transition: 'background .1s',
                                }, onMouseEnter: e => { e.currentTarget.style.background = 'var(--status-error)'; }, onMouseLeave: e => { e.currentTarget.style.background = S.danger; }, children: "Sign Out" }), _jsx("button", { onClick: () => setConfirming(false), style: {
                                    flex: 1,
                                    padding: '7px 0',
                                    background: 'transparent',
                                    color: S.dim,
                                    border: `1px solid ${S.border}`,
                                    borderRadius: 0,
                                    cursor: 'pointer',
                                    fontFamily: S.font,
                                    fontSize: 9,
                                    letterSpacing: '.15em',
                                    textTransform: 'uppercase',
                                    transition: 'all .1s',
                                }, onMouseEnter: e => {
                                    e.currentTarget.style.background = 'var(--t-b2x)';
                                    e.currentTarget.style.borderColor = 'var(--dj-dim)';
                                    e.currentTarget.style.color = 'var(--text-dim)';
                                }, onMouseLeave: e => {
                                    e.currentTarget.style.background = 'transparent';
                                    e.currentTarget.style.borderColor = S.border;
                                    e.currentTarget.style.color = S.dim;
                                }, children: "Cancel" })] })] }))] }));
}
