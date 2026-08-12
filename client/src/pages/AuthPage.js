import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * client/src/pages/AuthPage.tsx
 * Login / Register page for R3 v4.
 *
 * Aesthetic: acid-techno hardware panel — dark, emissive amber accents,
 * monospace font, CRT scanline texture, structured form inputs.
 *
 * Routing: uses Wouter useLocation() to redirect to /daw on success.
 * Does NOT use react-router-dom.
 *
 * Auth: calls useAuthStore.login / .register, reads .loading / .error.
 * On success the JWT is stored by authStore and ProtectedRoute unblocks.
 */
import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuthStore, selectIsAuthed } from '../hooks/authStore';
// ── Validation ────────────────────────────────────────────────────────────────
function validateEmail(v) {
    if (!v.trim())
        return 'EMAIL REQUIRED';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
        return 'INVALID EMAIL FORMAT';
    return null;
}
function validatePassword(v, isRegister) {
    if (!v)
        return 'PASSWORD REQUIRED';
    if (isRegister && v.length < 8)
        return 'MINIMUM 8 CHARACTERS';
    return null;
}
// ── LED indicator ─────────────────────────────────────────────────────────────
function Led({ on, color = '#a3e635' }) {
    return (_jsx("span", { style: {
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: on ? color : 'var(--dj-surface2)',
            boxShadow: on ? `0 0 6px ${color}, 0 0 14px ${color}55` : 'none',
            border: `1px solid ${on ? color : '#2a2a2a'}`,
            flexShrink: 0,
        } }));
}
// ── Scanline overlay ──────────────────────────────────────────────────────────
const SCANLINES_CSS = `
  .r3-auth-scanlines::after {
    content: '';
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(
      to bottom,
      transparent 0px,
      transparent 3px,
      rgba(0,0,0,0.18) 3px,
      rgba(0,0,0,0.18) 4px
    );
    pointer-events: none;
    z-index: 0;
  }
`;
// ── Input component ───────────────────────────────────────────────────────────
function AuthInput({ label, type = 'text', value, onChange, error, autoFocus = false, placeholder, }) {
    const [focused, setFocused] = useState(false);
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 4 }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8 }, children: [_jsx(Led, { on: focused || value.length > 0, color: error ? '#ef4444' : '#a3e635' }), _jsx("label", { style: { fontSize: 9, letterSpacing: '0.2em', color: '#555' }, children: label }), error && (_jsx("span", { style: { fontSize: 8, color: '#ef4444', letterSpacing: '0.1em', marginLeft: 'auto' }, children: error }))] }), _jsx("input", { type: type, value: value, autoFocus: autoFocus, placeholder: placeholder, onChange: e => onChange(e.target.value), onFocus: () => setFocused(true), onBlur: () => setFocused(false), style: {
                    background: '#0d0d0d',
                    border: `1px solid ${error ? '#ef444455' : focused ? '#a3e63544' : 'var(--t-b3)'}`,
                    borderRadius: 3,
                    padding: '8px 12px',
                    color: '#e5e5e5',
                    fontSize: 12,
                    fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                    letterSpacing: '0.05em',
                    outline: 'none',
                    width: '100%',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                    boxShadow: focused ? `0 0 8px #a3e63511` : 'none',
                } })] }));
}
// ── Main component ────────────────────────────────────────────────────────────
export default function AuthPage() {
    const [, setLocation] = useLocation();
    const isAuthed = useAuthStore(selectIsAuthed);
    const { login, register, loading, error, clearError } = useAuthStore();
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [localErr, setLocalErr] = useState(null);
    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthed)
            setLocation('/instrument');
    }, [isAuthed, setLocation]);
    // Clear server error when mode switches
    useEffect(() => { clearError(); setLocalErr(null); }, [mode, clearError]);
    const submit = useCallback(async (e) => {
        e.preventDefault();
        setLocalErr(null);
        const emailErr = validateEmail(email);
        if (emailErr) {
            setLocalErr(emailErr);
            return;
        }
        const passErr = validatePassword(password, mode === 'register');
        if (passErr) {
            setLocalErr(passErr);
            return;
        }
        if (mode === 'register' && password !== confirm) {
            setLocalErr('PASSWORDS DO NOT MATCH');
            return;
        }
        try {
            if (mode === 'login') {
                await login(email, password);
            }
            else {
                await register(email, password);
            }
            setLocation('/instrument');
        }
        catch {
            // error already set in authStore
        }
    }, [email, password, confirm, mode, login, register, setLocation]);
    const displayError = localErr ?? error;
    return (_jsxs(_Fragment, { children: [_jsx("header", { className: "ag-header", children: _jsx("div", { className: "ag-header-top", children: _jsxs("div", { className: "ag-wordmark-block", children: [_jsxs("div", { className: "ag-wordmark", "data-testid": "text-title", children: ["R3", _jsx("span", { className: "ag-wordmark-slash", children: "/" }), "NATIVE"] }), _jsx("div", { className: "ag-wordmark-sub", children: "Auth \u00B7 Sign In" })] }) }) }), _jsxs(_Fragment, { children: [_jsx("style", { children: SCANLINES_CSS }), _jsxs("div", { style: {
                            height: 'calc(100vh - var(--nav-h, 0px))',
                            background: 'var(--t-b0x)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
                            overflow: 'hidden',
                            position: 'relative',
                        }, className: "r3-auth-scanlines", children: [_jsx("div", { style: {
                                    position: 'absolute',
                                    inset: 0,
                                    backgroundImage: `
              linear-gradient(rgba(245,158,11,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(245,158,11,0.03) 1px, transparent 1px)
            `,
                                    backgroundSize: '40px 40px',
                                } }), _jsx("div", { style: {
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: 600,
                                    height: 400,
                                    background: 'radial-gradient(ellipse, rgba(245,158,11,0.04) 0%, transparent 70%)',
                                    pointerEvents: 'none',
                                } }), _jsxs("div", { style: {
                                    position: 'relative',
                                    zIndex: 1,
                                    width: 360,
                                    background: '#0d0d0d',
                                    border: '1px solid var(--t-b3)',
                                    borderRadius: 6,
                                    overflow: 'hidden',
                                    boxShadow: '0 0 40px rgba(0,0,0,0.8), 0 0 1px #a3e63522',
                                }, children: [_jsxs("div", { style: {
                                            padding: '10px 16px',
                                            borderBottom: '1px solid var(--t-b2x)',
                                            background: '#0a0a0a',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 10,
                                        }, children: [_jsxs("div", { style: { display: 'flex', gap: 5 }, children: [_jsx(Led, { on: true, color: "var(--accent-green)" }), _jsx(Led, { on: loading, color: "#a3e635" }), _jsx(Led, { on: !!displayError, color: "#ef4444" })] }), _jsx("span", { style: { fontSize: 9, letterSpacing: '0.25em', color: '#555', flex: 1 }, children: "R3 v4 \u2014 ACCESS CONTROL" }), _jsx("span", { style: { fontSize: 8, color: 'var(--dj-dimmer)', letterSpacing: '0.1em' }, children: mode === 'login' ? 'AUTHENTICATE' : 'REGISTER' })] }), _jsx("div", { style: {
                                            display: 'flex',
                                            borderBottom: '1px solid var(--t-b2x)',
                                        }, children: ['login', 'register'].map(m => (_jsx("button", { onClick: () => setMode(m), style: {
                                                flex: 1,
                                                padding: '8px 0',
                                                background: mode === m ? 'var(--dj-surface2)' : 'transparent',
                                                border: 'none',
                                                borderBottom: mode === m ? '1px solid #a3e635' : '1px solid transparent',
                                                color: mode === m ? '#a3e635' : 'var(--dj-dimmer)',
                                                fontSize: 9,
                                                letterSpacing: '0.2em',
                                                cursor: 'pointer',
                                                fontFamily: 'inherit',
                                                transition: 'color 0.15s',
                                            }, children: m.toUpperCase() }, m))) }), _jsxs("form", { onSubmit: submit, style: { padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 16 }, children: [_jsx(AuthInput, { label: "EMAIL", type: "email", value: email, onChange: setEmail, autoFocus: true, placeholder: "producer@r3vibe.io" }), _jsx(AuthInput, { label: "PASSWORD", type: "password", value: password, onChange: setPassword, placeholder: mode === 'register' ? 'min. 8 characters' : '' }), mode === 'register' && (_jsx(AuthInput, { label: "CONFIRM PASSWORD", type: "password", value: confirm, onChange: setConfirm })), displayError && (_jsx("div", { style: {
                                                    padding: '8px 12px',
                                                    background: '#ef444411',
                                                    border: '1px solid #ef444433',
                                                    borderRadius: 3,
                                                    fontSize: 10,
                                                    color: '#ef4444',
                                                    letterSpacing: '0.1em',
                                                }, children: displayError.toUpperCase() })), _jsx("button", { type: "submit", disabled: loading, style: {
                                                    padding: '10px 0',
                                                    background: loading ? 'var(--dj-surface2)' : '#a3e63518',
                                                    border: `1px solid ${loading ? 'var(--dj-border)' : '#a3e63544'}`,
                                                    borderRadius: 3,
                                                    color: loading ? 'var(--dj-dim)' : '#a3e635',
                                                    fontSize: 10,
                                                    letterSpacing: '0.25em',
                                                    cursor: loading ? 'not-allowed' : 'pointer',
                                                    fontFamily: 'inherit',
                                                    transition: 'all 0.15s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 8,
                                                }, children: loading ? (_jsxs(_Fragment, { children: [_jsx("span", { style: {
                                                                width: 10,
                                                                height: 10,
                                                                border: '1px solid var(--dj-dimmer)',
                                                                borderTop: '1px solid #a3e635',
                                                                borderRadius: '50%',
                                                                animation: 'spin 0.6s linear infinite',
                                                                display: 'inline-block',
                                                            } }), "PROCESSING"] })) : (mode === 'login' ? 'AUTHENTICATE →' : 'CREATE ACCOUNT →') }), mode === 'login' && (_jsx("p", { style: { fontSize: 8, color: '#2a2a2a', textAlign: 'center', letterSpacing: '0.15em', margin: 0 }, children: "NO ACCOUNT? SWITCH TO REGISTER ABOVE" }))] }), _jsxs("div", { style: {
                                            padding: '8px 16px',
                                            borderTop: '1px solid var(--t-b2)',
                                            background: 'var(--t-b0x)',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                        }, children: [_jsx("span", { style: { fontSize: 8, color: 'var(--dj-border)', letterSpacing: '0.15em' }, children: "SECURE \u00B7 ENCRYPTED" }), _jsx("span", { style: { fontSize: 8, color: 'var(--dj-border)', letterSpacing: '0.15em' }, children: "R3 v4" })] })] }), _jsx("style", { children: `@keyframes spin { to { transform: rotate(360deg); } }` })] })] })] }));
}
