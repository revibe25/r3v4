// client/src/pages/login.tsx
// Lime-green design system — aligned with instrument panel palette (#b8ff00)
import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useAuthStore } from '@/stores/authStore';
import { LogIn, AlertCircle, Mail, X, CheckCircle } from 'lucide-react';

// ─── Design tokens — mirrors instrument panel exactly ─────────────────────────
const T = {
  bg:        '#060606',
  card:      '#0a0a0a',
  panel:     '#0d0d0d',
  border:    '#1c1c1c',
  borderMid: '#2a2a2a',
  accent:    '#b8ff00',
  accentHov: '#84cc16',
  accentDim: 'rgba(184,255,0,0.08)',
  accentBdr: 'rgba(184,255,0,0.25)',
  text:      '#f0f0f0',
  textMuted: '#888888',
  textDim:   '#555555',
  textGhost: '#333333',
  danger:    '#ff3b3b',
  dangerBg:  'rgba(255,59,59,.06)',
  font:      "'IBM Plex Mono','JetBrains Mono',monospace",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────
type ResetState = 'idle' | 'open' | 'sent';

// ─── Shared input style ───────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  display:      'block',
  width:        '100%',
  boxSizing:    'border-box',
  background:   T.bg,
  border:       `1px solid ${T.border}`,
  borderRadius: 0,
  color:        T.text,
  fontFamily:   T.font,
  fontSize:     13,
  padding:      '12px 14px',
  outline:      'none',
  transition:   'border-color .15s, box-shadow .15s',
};

const labelStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      9,
  letterSpacing: '.25em',
  textTransform: 'uppercase',
  color:         T.textDim,
  marginBottom:  8,
  fontFamily:    T.font,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [error,       setError]       = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetState,  setResetState]  = useState<ResetState>('idle');
  const [resetEmail,  setResetEmail]  = useState('');
  const [resetError,  setResetError]  = useState<string | null>(null);

  const { setAuth }  = useAuthStore();
  const [, navigate] = useLocation();

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Login failed. Please try again.');
        return;
      }
      setAuth(data.user, data.token);
      navigate('/instrument');
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) { setResetError('Please enter your email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setResetError('Please enter a valid email address.'); return;
    }
    setResetError(null);
    setResetState('sent');
  };

  const handleResetClose = () => {
    setResetState('idle');
    setResetEmail('');
    setResetError(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      minHeight:       'calc(100vh - 37px)',
      background:      T.bg,
      backgroundImage: [
        'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(184,255,0,.015) 3px,rgba(184,255,0,.015) 4px)',
        'repeating-linear-gradient(90deg,transparent,transparent 31px,rgba(184,255,0,.018) 31px,rgba(184,255,0,.018) 32px)',
      ].join(','),
      fontFamily: T.font,
      padding:    '40px 20px',
    }}>
      <div style={{
        width:      'min(600px, calc(100vw - 40px))',
        background: T.card,
        border:     `1px solid ${T.border}`,
        borderTop:  `3px solid ${T.accent}`,
        boxShadow:  `0 0 60px rgba(184,255,0,0.04), 0 32px 80px rgba(0,0,0,0.6)`,
      }}>

        {/* ── Header ── */}
        <div style={{
          padding:      '28px 36px 24px',
          borderBottom: `1px solid ${T.border}`,
          display:      'flex',
          alignItems:   'center',
          gap:          12,
        }}>
          <div style={{
            width:          36,
            height:         36,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            background:     T.accentDim,
            border:         `1px solid ${T.accentBdr}`,
          }}>
            <LogIn size={16} color={T.accent} />
          </div>
          <div>
            <div style={{
              fontSize:      16,
              fontWeight:    700,
              color:         T.text,
              letterSpacing: '-.01em',
              lineHeight:    1,
              marginBottom:  5,
            }}>
              R3<span style={{ color: T.accent, margin: '0 3px' }}>/</span>NATIVE
            </div>
            <div style={{
              fontSize:      9,
              letterSpacing: '.3em',
              textTransform: 'uppercase',
              color:         T.textDim,
            }}>
              Studio Access
            </div>
          </div>
          {/* ── Live indicator ── */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width:        6,
              height:       6,
              borderRadius: '50%',
              background:   T.accent,
              boxShadow:    `0 0 8px ${T.accent}`,
              animation:    'pulse 2s infinite',
            }} />
            <span style={{ fontSize: 8, letterSpacing: '.2em', color: T.textDim, textTransform: 'uppercase' }}>
              Live
            </span>
          </div>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSignIn} style={{ padding: '32px 36px 36px' }}>

          {/* Error */}
          {error && (
            <div style={{
              display:      'flex',
              gap:          10,
              alignItems:   'flex-start',
              background:   T.dangerBg,
              borderLeft:   `3px solid ${T.danger}`,
              padding:      '12px 16px',
              marginBottom: 24,
            }}>
              <AlertCircle size={14} color={T.danger} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'rgba(255,59,59,.85)', letterSpacing: '.05em' }}>
                {error}
              </span>
            </div>
          )}

          {/* Email */}
          <label style={{ display: 'block', marginBottom: 20 }}>
            <span style={labelStyle}>Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={inputStyle}
              onFocus={e => {
                e.currentTarget.style.borderColor = T.accent;
                e.currentTarget.style.boxShadow   = `0 0 0 2px rgba(184,255,0,0.08)`;
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = T.border;
                e.currentTarget.style.boxShadow   = 'none';
              }}
            />
          </label>

          {/* Password */}
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={labelStyle}>Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={inputStyle}
              onFocus={e => {
                e.currentTarget.style.borderColor = T.accent;
                e.currentTarget.style.boxShadow   = `0 0 0 2px rgba(184,255,0,0.08)`;
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = T.border;
                e.currentTarget.style.boxShadow   = 'none';
              }}
            />
          </label>

          {/* Forgot password trigger */}
          <div style={{ textAlign: 'right', marginBottom: resetState !== 'idle' ? 0 : 28 }}>
            {resetState === 'idle' && (
              <button
                type="button"
                onClick={() => setResetState('open')}
                style={{
                  background:          'none',
                  border:              'none',
                  padding:             0,
                  fontSize:            9,
                  letterSpacing:       '.1em',
                  textTransform:       'uppercase',
                  color:               T.accent,
                  cursor:              'pointer',
                  fontFamily:          T.font,
                  textDecoration:      'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Forgot password?
              </button>
            )}
          </div>

          {/* Forgot password panel */}
          {resetState === 'open' && (
            <div style={{
              margin:     '16px 0 28px',
              border:     `1px solid ${T.borderMid}`,
              borderLeft: `3px solid ${T.accent}`,
              background: T.panel,
              padding:    '20px',
            }}>
              <div style={{
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'space-between',
                marginBottom:   16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={12} color={T.accent} />
                  <span style={{
                    fontSize:      9,
                    letterSpacing: '.25em',
                    textTransform: 'uppercase',
                    color:         T.textMuted,
                  }}>Reset Password</span>
                </div>
                <button
                  type="button"
                  onClick={handleResetClose}
                  aria-label="Close reset panel"
                  style={{
                    background: 'none', border: 'none',
                    color: T.textGhost, cursor: 'pointer',
                    padding: 0, display: 'flex', alignItems: 'center',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = T.text; }}
                  onMouseLeave={e => { e.currentTarget.style.color = T.textGhost; }}
                >
                  <X size={13} />
                </button>
              </div>

              {resetError && (
                <div style={{
                  display:      'flex',
                  gap:          8,
                  alignItems:   'flex-start',
                  background:   T.dangerBg,
                  borderLeft:   `3px solid ${T.danger}`,
                  padding:      '10px 12px',
                  marginBottom: 14,
                }}>
                  <AlertCircle size={12} color={T.danger} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'rgba(255,59,59,.85)', letterSpacing: '.04em' }}>
                    {resetError}
                  </span>
                </div>
              )}

              <form onSubmit={handleResetRequest}>
                <label style={{ display: 'block', marginBottom: 14 }}>
                  <span style={{ ...labelStyle, fontSize: 8 }}>Enter your account email</span>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => { setResetEmail(e.target.value); setResetError(null); }}
                    placeholder="you@example.com"
                    autoFocus
                    style={{ ...inputStyle, fontSize: 12, padding: '10px 12px' }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = T.accent;
                      e.currentTarget.style.boxShadow   = `0 0 0 2px rgba(184,255,0,0.08)`;
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.boxShadow   = 'none';
                    }}
                  />
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="submit"
                    style={{
                      flex:           1,
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      gap:            7,
                      padding:        '10px 14px',
                      border:         'none',
                      borderRadius:   0,
                      background:     T.accent,
                      color:          T.bg,
                      fontFamily:     T.font,
                      fontSize:       9,
                      letterSpacing:  '.2em',
                      textTransform:  'uppercase',
                      fontWeight:     700,
                      cursor:         'pointer',
                      transition:     'background .1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.accentHov; }}
                    onMouseLeave={e => { e.currentTarget.style.background = T.accent; }}
                  >
                    <Mail size={11} />
                    Send Reset Link
                  </button>
                  <button
                    type="button"
                    onClick={handleResetClose}
                    style={{
                      padding:       '10px 16px',
                      border:        `1px solid ${T.border}`,
                      borderRadius:  0,
                      background:    'transparent',
                      color:         T.textDim,
                      fontFamily:    T.font,
                      fontSize:      9,
                      letterSpacing: '.15em',
                      textTransform: 'uppercase',
                      cursor:        'pointer',
                      transition:    'all .1s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background  = '#111';
                      e.currentTarget.style.borderColor = T.borderMid;
                      e.currentTarget.style.color       = T.textMuted;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background  = 'transparent';
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.color       = T.textDim;
                    }}
                  >
                    Cancel
                  </button>
                </div>
                <p style={{
                  marginTop:     12,
                  fontSize:      8,
                  letterSpacing: '.08em',
                  color:         T.textGhost,
                  lineHeight:    1.6,
                }}>
                  ⚠ Auth provider not yet connected — no email will be sent until wired.
                </p>
              </form>
            </div>
          )}

          {/* Reset sent */}
          {resetState === 'sent' && (
            <div style={{
              margin:     '16px 0 28px',
              border:     `1px solid rgba(184,255,0,0.2)`,
              borderLeft: `3px solid ${T.accent}`,
              background: `rgba(184,255,0,0.04)`,
              padding:    '18px 20px',
              display:    'flex',
              gap:        12,
              alignItems: 'flex-start',
            }}>
              <CheckCircle size={14} color={T.accent} style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize:      10,
                  letterSpacing: '.15em',
                  textTransform: 'uppercase',
                  color:         T.accent,
                  marginBottom:  6,
                  fontWeight:    700,
                }}>
                  Reset link sent
                </div>
                <div style={{ fontSize: 10, color: T.textMuted, letterSpacing: '.04em', lineHeight: 1.7 }}>
                  If an account exists for{' '}
                  <span style={{ color: T.text }}>{resetEmail}</span>,
                  a reset link will be delivered once the auth provider is connected.
                </div>
                <button
                  type="button"
                  onClick={handleResetClose}
                  style={{
                    marginTop:           12,
                    background:          'none',
                    border:              'none',
                    padding:             0,
                    fontSize:            8,
                    letterSpacing:       '.15em',
                    textTransform:       'uppercase',
                    color:               T.textGhost,
                    cursor:              'pointer',
                    fontFamily:          T.font,
                    textDecoration:      'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  Back to sign in
                </button>
              </div>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            9,
              width:          '100%',
              padding:        '14px',
              border:         'none',
              borderRadius:   0,
              background:     isSubmitting ? '#3a5c00' : T.accent,
              opacity:        isSubmitting ? 0.75 : 1,
              cursor:         isSubmitting ? 'not-allowed' : 'pointer',
              color:          T.bg,
              fontFamily:     T.font,
              fontSize:       11,
              letterSpacing:  '.25em',
              textTransform:  'uppercase',
              fontWeight:     700,
              transition:     'background .15s',
            }}
            onMouseEnter={e => { if (!isSubmitting) e.currentTarget.style.background = T.accentHov; }}
            onMouseLeave={e => { if (!isSubmitting) e.currentTarget.style.background = T.accent; }}
          >
            <LogIn size={14} />
            {isSubmitting ? 'Signing in…' : 'Enter Studio'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '28px 0' }}>
            <div style={{ flex: 1, height: 1, background: T.border }} />
            <span style={{
              fontSize:      9,
              letterSpacing: '.2em',
              color:         T.textGhost,
              textTransform: 'uppercase',
            }}>or</span>
            <div style={{ flex: 1, height: 1, background: T.border }} />
          </div>

          {/* Footer */}
          <p style={{
            fontSize:      10,
            letterSpacing: '.1em',
            color:         T.textDim,
            textAlign:     'center',
            margin:        0,
          }}>
            No account?{' '}
            <Link href="/" style={{ color: T.accent, textDecoration: 'none' }}>
              View Plans →
            </Link>
          </p>

        </form>
      </div>
    </div>
  );
}
