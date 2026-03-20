// client/src/pages/login.tsx
import { useState } from 'react';
import { Link } from 'wouter';
import { LogIn, AlertCircle, Mail, X, CheckCircle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ResetState = 'idle' | 'open' | 'sent';

// ─── Shared input style factory (keeps DRY, no inline duplication) ────────────
const inputStyle: React.CSSProperties = {
  display:      'block',
  width:        '100%',
  boxSizing:    'border-box',
  background:   '#060606',
  border:       '1px solid #1c1c1c',
  borderRadius: 0,
  color:        '#f0f0f0',
  fontFamily:   'inherit',
  fontSize:     13,
  padding:      '12px 14px',
  outline:      'none',
  transition:   'border-color .1s',
};

const labelTextStyle: React.CSSProperties = {
  display:       'block',
  fontSize:      9,
  letterSpacing: '.25em',
  textTransform: 'uppercase',
  color:         '#555',
  marginBottom:  8,
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginPage() {
  // Sign-in state
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState<string | null>(null);

  // Forgot-password stub state
  const [resetState, setResetState] = useState<ResetState>('idle');
  const [resetEmail, setResetEmail] = useState('');
  const [resetError, setResetError] = useState<string | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: replace with real auth call once provider is chosen
    setError('Auth backend not yet connected.');
  };

  const handleResetRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setResetError('Please enter your email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resetEmail.trim())) {
      setResetError('Please enter a valid email address.');
      return;
    }
    // TODO: replace with real provider reset call, e.g.:
    //   await supabase.auth.resetPasswordForEmail(resetEmail)
    //   await clerk.client.signIn.create({ strategy: 'reset_password_email_code', identifier: resetEmail })
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
    <div
      style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'center',
        minHeight:       'calc(100vh - 37px)',
        background:      '#060606',
        backgroundImage: [
          'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,.012) 3px,rgba(255,255,255,.012) 4px)',
          'repeating-linear-gradient(90deg,transparent,transparent 31px,rgba(255,255,255,.016) 31px,rgba(255,255,255,.016) 32px)',
        ].join(','),
        fontFamily: "'IBM Plex Mono','JetBrains Mono',monospace",
        padding:    '40px 20px',
      }}
    >
      <div
        style={{
          width:      'min(600px, calc(100vw - 40px))',
          background: '#0a0a0a',
          border:     '1px solid #1c1c1c',
          borderTop:  '3px solid #b8ff00',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          padding:      '28px 36px 24px',
          borderBottom: '1px solid #1c1c1c',
          display:      'flex',
          alignItems:   'center',
          gap:          12,
        }}>
          <LogIn size={18} color="#b8ff00" />
          <div>
            <div style={{
              fontSize:      16,
              fontWeight:    700,
              color:         '#f0f0f0',
              letterSpacing: '-.01em',
              lineHeight:    1,
              marginBottom:  5,
            }}>
              R3<span style={{ color: '#b8ff00', margin: '0 3px' }}>/</span>NATIVE
            </div>
            <div style={{
              fontSize:      9,
              letterSpacing: '.3em',
              textTransform: 'uppercase',
              color:         '#555',
            }}>
              Sign In to your account
            </div>
          </div>
        </div>

        {/* ── Sign-in form ── */}
        <form onSubmit={handleSignIn} style={{ padding: '32px 36px 36px' }}>

          {/* Sign-in error */}
          {error && (
            <div style={{
              display:      'flex',
              gap:          10,
              alignItems:   'flex-start',
              background:   'rgba(255,59,59,.06)',
              borderLeft:   '3px solid #ff3b3b',
              padding:      '12px 16px',
              marginBottom: 24,
            }}>
              <AlertCircle size={14} color="#ff3b3b" style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'rgba(255,59,59,.8)', letterSpacing: '.05em' }}>
                {error}
              </span>
            </div>
          )}

          {/* Email */}
          <label style={{ display: 'block', marginBottom: 20 }}>
            <span style={labelTextStyle}>Email</span>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#b8ff00'; }}
              onBlur={e  => { e.currentTarget.style.borderColor = '#1c1c1c'; }}
            />
          </label>

          {/* Password */}
          <label style={{ display: 'block', marginBottom: 10 }}>
            <span style={labelTextStyle}>Password</span>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#b8ff00'; }}
              onBlur={e  => { e.currentTarget.style.borderColor = '#1c1c1c'; }}
            />
          </label>

          {/* ── Forgot password trigger ── */}
          <div style={{ textAlign: 'right', marginBottom: resetState !== 'idle' ? 0 : 28 }}>
            {resetState === 'idle' && (
              <button
                type="button"
                onClick={() => setResetState('open')}
                style={{
                  background:    'none',
                  border:        'none',
                  padding:       0,
                  fontSize:      9,
                  letterSpacing: '.1em',
                  textTransform: 'uppercase',
                  color:         '#b8ff00',
                  cursor:        'pointer',
                  fontFamily:    'inherit',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Forgot password?
              </button>
            )}
          </div>

          {/* ── Forgot password inline panel ── */}
          {resetState === 'open' && (
            <div style={{
              margin:       '16px 0 28px',
              border:       '1px solid #2a2a2a',
              borderLeft:   '3px solid #b8ff00',
              background:   '#0d0d0d',
              padding:      '20px',
            }}>
              {/* Panel header */}
              <div style={{
                display:       'flex',
                alignItems:    'center',
                justifyContent:'space-between',
                marginBottom:  16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Mail size={12} color="#b8ff00" />
                  <span style={{
                    fontSize:      9,
                    letterSpacing: '.25em',
                    textTransform: 'uppercase',
                    color:         '#888',
                  }}>
                    Reset Password
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleResetClose}
                  aria-label="Close reset panel"
                  style={{
                    background: 'none',
                    border:     'none',
                    color:      '#444',
                    cursor:     'pointer',
                    padding:    0,
                    display:    'flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#f0f0f0'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = '#444'; }}
                >
                  <X size={13} />
                </button>
              </div>

              {/* Reset error */}
              {resetError && (
                <div style={{
                  display:      'flex',
                  gap:          8,
                  alignItems:   'flex-start',
                  background:   'rgba(255,59,59,.06)',
                  borderLeft:   '3px solid #ff3b3b',
                  padding:      '10px 12px',
                  marginBottom: 14,
                }}>
                  <AlertCircle size={12} color="#ff3b3b" style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ fontSize: 10, color: 'rgba(255,59,59,.8)', letterSpacing: '.04em' }}>
                    {resetError}
                  </span>
                </div>
              )}

              {/* Reset form */}
              <form onSubmit={handleResetRequest}>
                <label style={{ display: 'block', marginBottom: 14 }}>
                  <span style={{ ...labelTextStyle, fontSize: 8 }}>
                    Enter your account email
                  </span>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => { setResetEmail(e.target.value); setResetError(null); }}
                    placeholder="you@example.com"
                    autoFocus
                    style={{ ...inputStyle, fontSize: 12, padding: '10px 12px' }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#b8ff00'; }}
                    onBlur={e  => { e.currentTarget.style.borderColor = '#1c1c1c'; }}
                  />
                </label>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="submit"
                    style={{
                      flex:          1,
                      display:       'flex',
                      alignItems:    'center',
                      justifyContent:'center',
                      gap:           7,
                      padding:       '10px 14px',
                      border:        'none',
                      borderRadius:  0,
                      background:    '#b8ff00',
                      color:         '#060606',
                      fontFamily:    'inherit',
                      fontSize:      9,
                      letterSpacing: '.2em',
                      textTransform: 'uppercase',
                      fontWeight:    600,
                      cursor:        'pointer',
                      transition:    'background .1s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#84cc16'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#b8ff00'; }}
                  >
                    <Mail size={11} />
                    Send Reset Link
                  </button>
                  <button
                    type="button"
                    onClick={handleResetClose}
                    style={{
                      padding:       '10px 16px',
                      border:        '1px solid #222',
                      borderRadius:  0,
                      background:    'transparent',
                      color:         '#555',
                      fontFamily:    'inherit',
                      fontSize:      9,
                      letterSpacing: '.15em',
                      textTransform: 'uppercase',
                      cursor:        'pointer',
                      transition:    'all .1s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background   = '#1a1a1a';
                      e.currentTarget.style.borderColor  = '#444';
                      e.currentTarget.style.color        = '#888';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background   = 'transparent';
                      e.currentTarget.style.borderColor  = '#222';
                      e.currentTarget.style.color        = '#555';
                    }}
                  >
                    Cancel
                  </button>
                </div>

                {/* Stub notice */}
                <p style={{
                  marginTop:     12,
                  fontSize:      8,
                  letterSpacing: '.08em',
                  color:         '#333',
                  lineHeight:    1.6,
                }}>
                  ⚠ Auth provider not yet connected — no email will be sent until wired.
                </p>
              </form>
            </div>
          )}

          {/* ── Reset sent confirmation ── */}
          {resetState === 'sent' && (
            <div style={{
              margin:     '16px 0 28px',
              border:     '1px solid #1a3a1a',
              borderLeft: '3px solid #b8ff00',
              background: 'rgba(163,230,53,.04)',
              padding:    '18px 20px',
              display:    'flex',
              gap:        12,
              alignItems: 'flex-start',
            }}>
              <CheckCircle size={14} color="#b8ff00" style={{ marginTop: 1, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize:      10,
                  letterSpacing: '.15em',
                  textTransform: 'uppercase',
                  color:         '#b8ff00',
                  marginBottom:  6,
                  fontWeight:    600,
                }}>
                  Reset link sent
                </div>
                <div style={{ fontSize: 10, color: '#666', letterSpacing: '.04em', lineHeight: 1.7 }}>
                  If an account exists for <span style={{ color: '#888' }}>{resetEmail}</span>, a
                  reset link will be delivered once the auth provider is connected.
                </div>
                <button
                  type="button"
                  onClick={handleResetClose}
                  style={{
                    marginTop:     12,
                    background:    'none',
                    border:        'none',
                    padding:       0,
                    fontSize:      8,
                    letterSpacing: '.15em',
                    textTransform: 'uppercase',
                    color:         '#444',
                    cursor:        'pointer',
                    fontFamily:    'inherit',
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  Back to sign in
                </button>
              </div>
            </div>
          )}

          {/* ── Submit ── */}
          <button
            type="submit"
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            9,
              width:          '100%',
              padding:        '14px',
              border:         'none',
              borderRadius:   0,
              background:     '#b8ff00',
              color:          '#060606',
              fontFamily:     'inherit',
              fontSize:       11,
              letterSpacing:  '.25em',
              textTransform:  'uppercase',
              fontWeight:     600,
              cursor:         'pointer',
              transition:     'background .1s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#84cc16'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#b8ff00'; }}
          >
            <LogIn size={14} />
            Sign In
          </button>

          {/* ── Divider ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '28px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#1c1c1c' }} />
            <span style={{
              fontSize:      9,
              letterSpacing: '.2em',
              color:         '#333',
              textTransform: 'uppercase',
            }}>
              or
            </span>
            <div style={{ flex: 1, height: 1, background: '#1c1c1c' }} />
          </div>

          {/* ── Footer ── */}
          <p style={{
            fontSize:      10,
            letterSpacing: '.1em',
            color:         '#555',
            textAlign:     'center',
            margin:        0,
          }}>
            No account?{' '}
            <Link href="/" style={{ color: '#b8ff00', textDecoration: 'none' }}>
              View Plans →
            </Link>
          </p>

        </form>
      </div>
    </div>
  );
}