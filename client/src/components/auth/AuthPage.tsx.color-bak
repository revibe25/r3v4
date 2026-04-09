import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/authStore';

/* ─── Types ──────────────────────────────────────────────── */
type Mode = 'login' | 'register';

interface ApiError {
  message: string;
}

/* ─── API helpers ─────────────────────────────────────────── */
const BASE = '/api/auth';

async function apiLogin(email: string, password: string) {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as ApiError).message || 'Login failed');
  return data as { user: Parameters<ReturnType<typeof useAuthStore.getState>['setAuth']>[0]; token: string };
}

async function apiRegister(username: string, email: string, password: string) {
  const res = await fetch(`${BASE}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as ApiError).message || 'Registration failed');
  return data as { user: Parameters<ReturnType<typeof useAuthStore.getState>['setAuth']>[0]; token: string };
}

/* ─── Waveform canvas decoration ─────────────────────────── */
function WaveformBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame: number;
    let t = 0;

    const draw = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const { width: w, height: h } = canvas;

      ctx.clearRect(0, 0, w, h);

      // Draw multiple wave layers
      const layers = [
        { amp: h * 0.06, freq: 0.012, speed: 0.018, alpha: 0.12, y: h * 0.3 },
        { amp: h * 0.04, freq: 0.02,  speed: 0.025, alpha: 0.08, y: h * 0.5 },
        { amp: h * 0.08, freq: 0.008, speed: 0.012, alpha: 0.06, y: h * 0.7 },
      ];

      layers.forEach(({ amp, freq, speed, alpha, y }) => {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(255, 140, 30, ${alpha})`;
        ctx.lineWidth = 1;
        for (let x = 0; x <= w; x++) {
          const yPos = y + Math.sin(x * freq + t * speed) * amp
                         + Math.sin(x * freq * 2.3 + t * speed * 1.7) * amp * 0.4;
          x === 0 ? ctx.moveTo(x, yPos) : ctx.lineTo(x, yPos);
        }
        ctx.stroke();
      });

      t++;
      frame = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.9 }}
    />
  );
}

/* ─── VU meter bar ───────────────────────────────────────── */
function VuMeter({ active }: { active: boolean }) {
  return (
    <div className="flex gap-[2px] items-end h-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="w-[3px] rounded-[1px] transition-all duration-150"
          style={{
            height: active ? `${Math.max(20, Math.random() * 100)}%` : '20%',
            backgroundColor: i < 8
              ? `rgba(255,160,30,${active ? 0.8 : 0.2})`
              : `rgba(255,60,60,${active ? 0.9 : 0.2})`,
            transition: `height 80ms ease, background-color 200ms ease`,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Input field ────────────────────────────────────────── */
function Field({
  label, type = 'text', value, onChange, placeholder, autoComplete, error,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  error?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-[10px] tracking-[0.18em] uppercase font-medium"
        style={{ color: focused ? '#ff8c1e' : 'rgba(255,255,255,0.35)' }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="w-full px-3 py-2.5 text-sm outline-none transition-all duration-200"
        style={{
          background: 'rgba(0,0,0,0.5)',
          border: `1px solid ${error ? 'rgba(255,80,80,0.6)' : focused ? 'rgba(255,140,30,0.7)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '3px',
          color: 'rgba(255,255,255,0.9)',
          fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
          fontSize: '13px',
          letterSpacing: '0.02em',
          boxShadow: focused ? '0 0 0 2px rgba(255,140,30,0.12), inset 0 1px 3px rgba(0,0,0,0.4)' : 'inset 0 1px 3px rgba(0,0,0,0.4)',
        }}
      />
    </div>
  );
}

/* ─── Main AuthPage component ────────────────────────────── */
export default function AuthPage({ onSuccess }: { onSuccess?: () => void }) {
  const { setAuth } = useAuthStore();

  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [vuActive, setVuActive] = useState(false);

  // Pulse VU on load
  useEffect(() => {
    const t = setTimeout(() => setVuActive(true), 600);
    const t2 = setTimeout(() => setVuActive(false), 2200);
    return () => { clearTimeout(t); clearTimeout(t2); };
  }, []);

  const reset = () => { setError(''); };

  const handleSubmit = async () => {
    reset();
    if (!email || !password || (mode === 'register' && !username)) {
      setError('All fields required.');
      return;
    }

    setLoading(true);
    setVuActive(true);
    try {
      const data = mode === 'login'
        ? await apiLogin(email, password)
        : await apiRegister(username, email, password);

      setAuth(data.user, data.token);
      onSuccess?.();
    } catch (err) {
      setError((err as Error).message);
      setVuActive(false);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: '#0a0a0a' }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,140,30,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,140,30,0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Waveform decoration */}
      <WaveformBg />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
        }}
      />

      {/* Card */}
      <div
        className="relative w-full mx-4 flex flex-col"
        style={{
          maxWidth: '400px',
          background: 'rgba(10,10,10,0.92)',
          border: '1px solid rgba(255,140,30,0.15)',
          borderRadius: '4px',
          boxShadow: '0 0 60px rgba(255,140,30,0.06), 0 32px 80px rgba(0,0,0,0.6)',
          backdropFilter: 'blur(20px)',
        }}
      >
        {/* Header strip */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-3">
            {/* Logo mark */}
            <div
              className="text-base font-black tracking-tight"
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                color: '#ff8c1e',
                letterSpacing: '-0.04em',
              }}
            >
              R3
            </div>
            <div
              className="text-[9px] tracking-[0.22em] uppercase"
              style={{ color: 'rgba(255,255,255,0.2)' }}
            >
              Studio Access
            </div>
          </div>
          <VuMeter active={vuActive || loading} />
        </div>

        {/* Mode toggle */}
        <div
          className="flex mx-5 mt-5 rounded-[3px] overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); reset(); }}
              className="flex-1 py-2 text-[10px] tracking-[0.16em] uppercase font-medium transition-all duration-200"
              style={{
                background: mode === m ? 'rgba(255,140,30,0.15)' : 'transparent',
                color: mode === m ? '#ff8c1e' : 'rgba(255,255,255,0.3)',
                borderRight: m === 'login' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                cursor: 'pointer',
              }}
            >
              {m === 'login' ? 'Sign In' : 'Register'}
            </button>
          ))}
        </div>

        {/* Form fields */}
        <div className="flex flex-col gap-4 px-5 pt-5 pb-2" onKeyDown={handleKey}>
          {mode === 'register' && (
            <Field
              label="Username"
              value={username}
              onChange={setUsername}
              placeholder="producer_name"
              autoComplete="username"
            />
          )}
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            autoComplete="email"
            error={!!error}
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            error={!!error}
          />
        </div>

        {/* Error */}
        <div className="px-5 h-6 flex items-center">
          {error && (
            <p
              className="text-[11px] tracking-wide"
              style={{ color: 'rgba(255,80,80,0.85)', fontFamily: 'monospace' }}
            >
              ⚠ {error}
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="px-5 pb-5">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-3 relative overflow-hidden transition-all duration-200 group"
            style={{
              background: loading
                ? 'rgba(255,140,30,0.1)'
                : 'rgba(255,140,30,0.18)',
              border: '1px solid rgba(255,140,30,0.4)',
              borderRadius: '3px',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {/* Shimmer on hover */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,140,30,0.08), transparent)' }}
            />
            <span
              className="relative text-[11px] tracking-[0.2em] uppercase font-semibold"
              style={{
                color: loading ? 'rgba(255,140,30,0.4)' : '#ff8c1e',
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {loading
                ? '▶ Connecting...'
                : mode === 'login' ? '▶ Enter Studio' : '▶ Create Account'}
            </span>
          </button>
        </div>

        {/* Footer strip */}
        <div
          className="px-5 py-2.5 flex items-center justify-between"
          style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
        >
          <span
            className="text-[9px] tracking-[0.16em] uppercase"
            style={{ color: 'rgba(255,255,255,0.12)', fontFamily: 'monospace' }}
          >
            R3 v4 · Browser DAW
          </span>
          <div className="flex gap-1 items-center">
            {[1,2,3].map(i => (
              <div
                key={i}
                className="w-1 h-1 rounded-full"
                style={{ background: `rgba(255,140,30,${0.15 * i})` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
