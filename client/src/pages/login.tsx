// client/src/pages/login.tsx
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { Link } from 'wouter';
import { LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type LoginState = 'idle' | 'loading' | 'error' | 'success';

// Bug fix #1: explicit typed interface replaces Record<string,string>
interface Tokens {
  bg:       string;
  card:     string;
  border:   string;
  accent:   string;
  accentHv: string;
  text:     string;
  muted:    string;
  dim:      string;
  error:    string;
  font:     string;
}

// ─── Design tokens — module-level constant (exact match to existing file) ─────
// Bug fix #1 cont.: T is module-level so sub-components close over it directly
// instead of receiving it as a prop typed as Record<string,string>.
const T: Tokens = {
  bg:       '#060606',
  card:     '#0a0a0a',
  border:   '#1c1c1c',
  accent:   '#a3e635',
  accentHv: '#84cc16',
  text:     '#f0f0f0',
  muted:    '#555555',
  dim:      '#333333',
  error:    '#ff3b3b',
  font:     "'IBM Plex Mono','JetBrains Mono',monospace",
};

// ─── Password strength ────────────────────────────────────────────────────────
function getStrength(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8)          s++;
  if (/[A-Z]/.test(pw))        s++;
  if (/[0-9]/.test(pw))        s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
}
const STRENGTH_LABEL = ['', 'WEAK', 'FAIR', 'STRONG', 'MAX'] as const;
const STRENGTH_COLOR = ['', '#ff3b3b', '#f59e0b', '#a3e635', '#a3e635'] as const;

// ─── Keyframe injection ───────────────────────────────────────────────────────
const INJECTED_ID = 'r3-login-keyframes';
// Bug fix #5: guard against SSR / test environments where document is absent
function injectKeyframes(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(INJECTED_ID)) return;
  const style = document.createElement('style');
  style.id = INJECTED_ID;
  style.textContent = `
    @keyframes r3-shake {
      0%,100% { transform: translateX(0); }
      18%     { transform: translateX(-6px); }
      36%     { transform: translateX(6px); }
      54%     { transform: translateX(-4px); }
      72%     { transform: translateX(4px); }
    }
    @keyframes r3-fadein {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: none; }
    }
    @keyframes r3-spin {
      to { transform: rotate(360deg); }
    }
    .r3-shake  { animation: r3-shake 0.42s cubic-bezier(.22,1,.36,1); }
    .r3-fadein { animation: r3-fadein 0.22s ease; }
    .r3-spin   { animation: r3-spin 0.75s linear infinite; }
  `;
  document.head.appendChild(style);
}

// ─── Animated waveform background ────────────────────────────────────────────
function WaveCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId    = 0;
    let t         = 0;
    let resizeTimer = 0;

    // Bug fix #10: getBoundingClientRect is reliable post-layout;
    // fall back to offsetWidth/Height, then a safe default.
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w    = Math.round(rect.width  || canvas.offsetWidth  || 480);
      const h    = Math.round(rect.height || canvas.offsetHeight || 300);
      // Only touch canvas dimensions when they actually changed —
      // assigning canvas.width resets the context and causes a blank frame.
      if (canvas.width !== w)  canvas.width  = w;
      if (canvas.height !== h) canvas.height = h;
    };

    // Bug fix #4: debounce resize so rapid drag-resizes don't stomp mid-draw
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 100);
    };

    resize();
    window.addEventListener('resize', onResize);

    const waves = [
      { amp: 18, freq: 0.012, speed: 0.018, color: 'rgba(184,255,0,0.18)',  lineW: 1.5, yOff: 0.50 },
      { amp: 10, freq: 0.022, speed: 0.028, color: 'rgba(184,255,0,0.09)',  lineW: 1,   yOff: 0.44 },
      { amp: 24, freq: 0.008, speed: 0.011, color: 'rgba(184,255,0,0.055)', lineW: 1,   yOff: 0.56 },
    ];

    const draw = () => {
      const { width, height } = canvas;
      // Bug fix #4 cont.: skip draw when canvas has no area
      if (width > 0 && height > 0) {
        ctx.clearRect(0, 0, width, height);
        waves.forEach(w => {
          ctx.beginPath();
          ctx.strokeStyle = w.color;
          ctx.lineWidth   = w.lineW;
          ctx.shadowColor = '#a3e635';
          ctx.shadowBlur  = 6;
          for (let x = 0; x <= width; x += 2) {
            const y =
              height * w.yOff
              + Math.sin(x * w.freq + t * w.speed * 60) * w.amp
              + Math.sin(x * w.freq * 0.5 + t * w.speed * 40) * (w.amp * 0.4);
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
          ctx.shadowBlur = 0;
        });
        t++;
      }
      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position:      'absolute',
        inset:         0,
        width:         '100%',
        height:        '100%',
        pointerEvents: 'none',
      }}
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function LoginPage() {
  const [credential, setCredential] = useState('');
  const [password,   setPassword]   = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [remember,   setRemember]   = useState(false);
  const [loginState, setLoginState] = useState<LoginState>('idle');
  const [errorMsg,   setErrorMsg]   = useState('');
  const [mounted,    setMounted]    = useState(false);
  // Bug fix #3: use an incrementing key to force re-application of the shake
  // class even when the same error fires twice in a row.
  const [shakeKey, setShakeKey] = useState(0);

  const credRef       = useRef<HTMLInputElement>(null);
  // Bug fix #2: store the auto-reset timer so we can cancel it on unmount
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const strength  = getStrength(password);
  const isLoading = loginState === 'loading';
  const isSuccess = loginState === 'success';
  const isError   = loginState === 'error';

  useEffect(() => {
    injectKeyframes();
    const mountTimer = setTimeout(() => setMounted(true), 40);
    return () => {
      clearTimeout(mountTimer);
      // Bug fix #2: cancel pending auto-reset if component unmounts mid-error
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (mounted) credRef.current?.focus();
  }, [mounted]);

  // Bug fix #2 + #3: triggerError is the single source of truth for errors.
  // It cancels any existing timer, sets state, increments shakeKey (so the
  // shake class always re-applies via key change), and owns its own cleanup ref.
  const triggerError = useCallback((msg: string) => {
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    setErrorMsg(msg);
    setLoginState('error');
    setShakeKey(k => k + 1);
    errorTimerRef.current = setTimeout(() => setLoginState('idle'), 5000);
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isLoading || isSuccess) return;

    const trimmed = credential.trim();
    if (!trimmed || !password) {
      triggerError('All fields are required.');
      return;
    }

    setLoginState('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/auth/login', {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ credential: trimmed, password }),
      });

      if (res.ok) {
        setLoginState('success');
        setTimeout(() => { window.location.href = '/'; }, 650);
      } else {
        let msg = 'Authentication failed — check your credentials.';
        try {
          const data = await res.json();
          // Guard: only use message if it's actually a non-empty string
          if (typeof data?.message === 'string' && data.message.trim()) {
            msg = data.message.trim();
          }
        } catch { /* non-JSON body — keep default message */ }
        triggerError(msg);
      }
    } catch {
      triggerError('Network error — please try again.');
    }
  };

  const gridBg = [
    'repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(255,255,255,.012) 3px,rgba(255,255,255,.012) 4px)',
    'repeating-linear-gradient(90deg,transparent,transparent 31px,rgba(255,255,255,.016) 31px,rgba(255,255,255,.016) 32px)',
  ].join(',');

  // Bug fix #8: simplified — only error changes the top border colour
  const cardBorderTop = `3px solid ${isError ? T.error : T.accent}`;

  return (
    <div style={{
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      minHeight:       'calc(100vh - 37px)',
      background:      T.bg,
      backgroundImage: gridBg,
      fontFamily:      T.font,
      padding:         '40px 20px',
      position:        'relative',
      overflow:        'hidden',
    }}>

      <WaveCanvas />

      {/*
        Bug fix #3: changing `key` causes React to unmount + remount this div,
        which re-applies the CSS class fresh — guaranteeing the shake animation
        fires every time triggerError is called, including consecutive calls
        with the same message.
        key="card-0" on initial render avoids the shake playing on mount.
      */}
      <div
        key={shakeKey === 0 ? 'card-init' : `card-${shakeKey}`}
        className={shakeKey > 0 ? 'r3-shake' : undefined}
        style={{
          position:   'relative',
          zIndex:     10,
          width:      'min(520px, calc(100vw - 40px))',
          background: T.card,
          border:     `1px solid ${T.border}`,
          borderTop:  cardBorderTop,
          opacity:    mounted ? 1 : 0,
          transform:  mounted ? 'none' : 'translateY(10px)',
          transition: 'opacity 0.35s ease, transform 0.35s ease, border-top-color 0.2s',
        }}
      >
        {/* Top glow line — sits just below the 3px border */}
        <div style={{
          position:      'absolute',
          top:           2,
          left:          0,
          right:         0,
          height:        1,
          background:    `linear-gradient(90deg, transparent 0%, ${T.accent}44 50%, transparent 100%)`,
          pointerEvents: 'none',
        }} />

        {/* ── Header ── */}
        <div style={{
          padding:      '26px 36px 22px',
          borderBottom: `1px solid ${T.border}`,
          display:      'flex',
          alignItems:   'center',
          gap:          14,
        }}>
          <div style={{
            width:        8,
            height:       8,
            borderRadius: '50%',
            background:   isError ? T.error : T.accent,
            boxShadow:    isError
              ? `0 0 8px ${T.error}, 0 0 16px ${T.error}55`
              : `0 0 8px ${T.accent}, 0 0 16px ${T.accent}55`,
            flexShrink:   0,
            transition:   'background 0.2s, box-shadow 0.2s',
          }} />

          <LogIn size={16} color={T.accent} strokeWidth={1.5} />

          <div style={{ flex: 1 }}>
            <div style={{
              fontSize:      15,
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
              textTransform: 'uppercase' as const,
              color:         T.muted,
            }}>
              Authenticate to continue
            </div>
          </div>

          <div style={{
            fontSize:      8,
            letterSpacing: '.25em',
            textTransform: 'uppercase' as const,
            color:         isSuccess ? T.accent : isError ? T.error : T.dim,
            borderLeft:    `1px solid ${T.border}`,
            paddingLeft:   14,
            transition:    'color 0.2s',
          }}>
            {isSuccess ? 'AUTHORIZED' : isError ? 'DENIED' : isLoading ? 'CHECKING' : 'SECURE'}
          </div>
        </div>

        {/* ── Form ── */}
        <form onSubmit={handleSubmit} style={{ padding: '30px 36px 34px' }} noValidate>

          {isError && errorMsg && (
            <div
              className="r3-fadein"
              role="alert"
              style={{
                display:      'flex',
                gap:          10,
                alignItems:   'flex-start',
                background:   'rgba(255,59,59,.06)',
                borderLeft:   `3px solid ${T.error}`,
                padding:      '12px 16px',
                marginBottom: 24,
              }}
            >
              <AlertCircle size={13} color={T.error} style={{ marginTop: 1, flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'rgba(255,59,59,.85)', letterSpacing: '.05em' }}>
                {errorMsg}
              </span>
            </div>
          )}

          {/* Bug fix #6: autocomplete="username" — valid single-token value */}
          <FieldBlock label="Email or Username">
            <input
              ref={credRef}
              type="text"
              value={credential}
              onChange={e => setCredential(e.target.value)}
              placeholder="you@example.com"
              autoComplete="username"
              spellCheck={false}
              disabled={isLoading || isSuccess}
              style={mkInputStyle()}
              onFocus={e => applyFocusStyle(e.currentTarget)}
              onBlur={e  => applyBlurStyle(e.currentTarget)}
            />
          </FieldBlock>

          <FieldBlock label="Password" style={{ marginBottom: 8 }}>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isLoading || isSuccess}
                style={{ ...mkInputStyle(), paddingRight: 44 }}
                onFocus={e => applyFocusStyle(e.currentTarget)}
                onBlur={e  => applyBlurStyle(e.currentTarget)}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                aria-label={showPw ? 'Hide password' : 'Show password'}
                style={{
                  position:   'absolute',
                  right:      12,
                  top:        '50%',
                  transform:  'translateY(-50%)',
                  background: 'none',
                  border:     'none',
                  cursor:     'pointer',
                  color:      T.muted,
                  padding:    4,
                  display:    'flex',
                  alignItems: 'center',
                }}
              >
                {showPw ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
              </button>
            </div>
          </FieldBlock>

          {password.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <div style={{ display: 'flex', gap: 3, flex: 1 }}>
                {([1, 2, 3, 4] as const).map(n => (
                  <div key={n} style={{
                    flex:       1,
                    height:     2,
                    background: n <= strength ? STRENGTH_COLOR[strength] : T.border,
                    transition: 'background 0.25s',
                    boxShadow:  n <= strength && strength >= 3
                      ? `0 0 4px ${STRENGTH_COLOR[strength]}88`
                      : 'none',
                  }} />
                ))}
              </div>
              <span style={{
                fontSize:      9,
                letterSpacing: '.2em',
                color:         strength > 0 ? STRENGTH_COLOR[strength] : T.muted,
                minWidth:      38,
                textAlign:     'right' as const,
                transition:    'color 0.25s',
              }}>
                {STRENGTH_LABEL[strength]}
              </span>
            </div>
          )}

          <div style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'space-between',
            marginBottom:   26,
          }}>
            <label style={{
              display:    'flex',
              alignItems: 'center',
              gap:        8,
              cursor:     'pointer',
              userSelect: 'none' as const,
            }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                disabled={isLoading || isSuccess}
                style={{
                  appearance: 'none',
                  width:      12,
                  height:     12,
                  border:     `1px solid ${remember ? T.accent : '#2a2a2a'}`,
                  background: remember ? T.accent : T.bg,
                  cursor:     'pointer',
                  flexShrink: 0,
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              />
              <span style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase' as const, color: T.muted }}>
                Remember me
              </span>
            </label>

            <Link
              href="/forgot-password"
              style={{
                fontSize:      9,
                letterSpacing: '.15em',
                textTransform: 'uppercase' as const,
                color:         T.dim,
                textDecoration:'none',
              }}
            >
              Forgot password?
            </Link>
          </div>

          <SubmitButton state={loginState} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '26px 0' }}>
            <div style={{ flex: 1, height: 1, background: T.border }} />
            <span style={{ fontSize: 9, letterSpacing: '.2em', color: T.dim, textTransform: 'uppercase' as const }}>
              or
            </span>
            <div style={{ flex: 1, height: 1, background: T.border }} />
          </div>

          <p style={{ fontSize: 10, letterSpacing: '.1em', color: T.muted, textAlign: 'center' as const, margin: 0 }}>
            No account?{' '}
            <Link href="/" style={{ color: T.accent, textDecoration: 'none' }}>
              View Plans →
            </Link>
          </p>
        </form>

        <div style={{
          height:     3,
          background: `repeating-linear-gradient(90deg, ${T.border} 0px, ${T.border} 1px, transparent 1px, transparent 4px)`,
          opacity:    0.5,
        }} />
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Bug fix #7: label color now reads from module-level T, not a hardcoded '#555'
function FieldBlock({
  label,
  children,
  style,
}: {
  label:    string;
  children: ReactNode;
  style?:   CSSProperties;
}) {
  return (
    <div style={{ marginBottom: 20, ...style }}>
      <span style={{
        display:       'block',
        fontSize:      9,
        letterSpacing: '.25em',
        textTransform: 'uppercase' as const,
        color:         T.muted,
        marginBottom:  8,
      }}>
        {label}
      </span>
      {children}
    </div>
  );
}

// Bug fix #1: SubmitButton no longer accepts T as a prop — it closes over the
// module-level constant directly, avoiding the Record<string,string> mismatch.
function SubmitButton({ state }: { state: LoginState }) {
  const isLoading = state === 'loading';
  const isSuccess = state === 'success';
  const [hovered, setHovered] = useState(false);

  const bg = hovered && !isLoading && !isSuccess ? T.accentHv : T.accent;

  return (
    <button
      type="submit"
      disabled={isLoading || isSuccess}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        gap:            9,
        width:          '100%',
        padding:        '14px',
        border:         'none',
        borderRadius:   0,
        background:     bg,
        color:          '#060606',
        fontFamily:     T.font,
        fontSize:       11,
        letterSpacing:  '.25em',
        textTransform:  'uppercase' as const,
        fontWeight:     700,
        cursor:         isLoading || isSuccess ? 'not-allowed' : 'pointer',
        transition:     'background 0.1s, box-shadow 0.2s',
        opacity:        isLoading ? 0.75 : 1,
        boxShadow:      isSuccess
          ? `0 0 20px ${T.accent}66`
          : `0 0 12px ${T.accent}33`,
      }}
    >
      {isSuccess ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          AUTHORIZED
        </>
      ) : isLoading ? (
        <>
          <svg
            className="r3-spin"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <circle cx="12" cy="12" r="10" strokeDasharray="40" strokeDashoffset="30" strokeLinecap="round" />
          </svg>
          CHECKING…
        </>
      ) : (
        <>
          <LogIn size={13} strokeWidth={2} />
          Sign In
        </>
      )}
    </button>
  );
}

// ─── Input style helpers ──────────────────────────────────────────────────────
// Bug fix #1: close over module-level T — no prop threading needed

function mkInputStyle(): CSSProperties {
  return {
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
    transition:   'border-color .1s, box-shadow .1s',
  };
}

function applyFocusStyle(el: HTMLInputElement): void {
  el.style.borderColor = T.accent;
  el.style.boxShadow   = `0 0 0 1px ${T.accent}33`;
}

function applyBlurStyle(el: HTMLInputElement): void {
  el.style.borderColor = T.border;
  el.style.boxShadow   = 'none';
}
