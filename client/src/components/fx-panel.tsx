import { memo, useCallback, useMemo, useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type PanelMode = 'compact' | 'normal' | 'professional';

interface FXState {
  reverb?: boolean;
  delay?: boolean;
  reverse?: boolean;
  flange?: boolean;
  chorus?: boolean;
  phaser?: boolean;
  bitcrusher?: boolean;
  distortion?: boolean;
  compressor?: boolean;
  tremolo?: boolean;
  autoFilter?: boolean;
  sidechain?: boolean;
  saturation?: boolean;
  stereoWiden?: boolean;
  vinyl?: boolean;
  [key: string]: boolean | undefined;
}

interface FXPanelProps {
  fx?: FXState;
  onToggle?: (fx: string) => void;
}

interface FXConfig {
  key: string;
  label: string;
  shortLabel: string;
  color: string;
  icon: React.ReactNode;
  category: 'time' | 'modulation' | 'dynamics' | 'tone' | 'creative';
}

// ═══════════════════════════════════════════════════════════════════════════
// ICONS
// ═══════════════════════════════════════════════════════════════════════════

const ReverbIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M2 12c0-3 2.5-6 6-6s6 3 6 6-2.5 6-6 6" />
    <path d="M8 12c0-2 1.5-4 4-4s4 2 4 4-1.5 4-4 4" opacity="0.6" />
    <path d="M14 12c0-1 .8-2 2-2s2 1 2 2-.8 2-2 2" opacity="0.3" />
  </svg>
);

const DelayIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="8" width="4" height="8" rx="1" />
    <rect x="10" y="10" width="4" height="6" rx="1" opacity="0.6" />
    <rect x="17" y="12" width="4" height="4" rx="1" opacity="0.3" />
  </svg>
);

const FlangerIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M2 12 Q 6 6, 8 12 T 14 12 T 20 12" />
    <path d="M2 12 Q 6 16, 10 12 T 18 12" opacity="0.4" />
  </svg>
);

const ReverseIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <polyline points="11 17 6 12 11 7" />
    <path d="M6 12h12" /><path d="M18 7v10" />
  </svg>
);

const VinylIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.5" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
  </svg>
);

const ChorusIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 12 Q 8 8, 12 12 T 20 12" />
    <path d="M4 12 Q 8 16, 12 12 T 20 12" opacity="0.5" />
  </svg>
);

const PhaserIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="8" opacity="0.3" />
    <circle cx="12" cy="12" r="5" opacity="0.5" />
    <circle cx="12" cy="12" r="2" />
  </svg>
);

const BitcrusherIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 12h3v3h3v-6h3v8h3v-10h3v12h3" />
  </svg>
);

const DistortionIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M2 12 L 6 8 L 10 16 L 14 4 L 18 18 L 22 12" />
  </svg>
);

const CompressorIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M3 20 L 8 15 L 12 15 L 21 6" />
    <path d="M3 4 L 21 4" opacity="0.3" />
  </svg>
);

const TremoloIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M2 12 L 5 8 L 8 12 L 11 8 L 14 12 L 17 8 L 20 12 L 23 8" />
  </svg>
);

// ═══════════════════════════════════════════════════════════════════════════
// FX CONFIG
// ═══════════════════════════════════════════════════════════════════════════

const FX_CONFIG: readonly FXConfig[] = [
  { key: 'reverb',      label: 'Reverb',       shortLabel: 'REV', color: 'var(--status-ok)', icon: <ReverbIcon />,     category: 'time' },
  { key: 'delay',       label: 'Delay',        shortLabel: 'DLY', color: 'var(--looper-blue)', icon: <DelayIcon />,      category: 'time' },
  { key: 'reverse',     label: 'Reverse',      shortLabel: 'RVS', color: 'var(--status-warn)', icon: <ReverseIcon />,    category: 'time' },
  { key: 'flange',      label: 'Flanger',      shortLabel: 'FLN', color: 'var(--accent-violet-soft)', icon: <FlangerIcon />,    category: 'modulation' },
  { key: 'chorus',      label: 'Chorus',       shortLabel: 'CHO', color: 'var(--track-cyan)', icon: <ChorusIcon />,     category: 'modulation' },
  { key: 'phaser',      label: 'Phaser',       shortLabel: 'PHS', color: 'var(--accent-purple)', icon: <PhaserIcon />,     category: 'modulation' },
  { key: 'tremolo',     label: 'Tremolo',      shortLabel: 'TRM', color: 'var(--track-pink)', icon: <TremoloIcon />,    category: 'modulation' },
  { key: 'compressor',  label: 'Compressor',   shortLabel: 'CMP', color: 'var(--track-orange)', icon: <CompressorIcon />, category: 'dynamics' },
  { key: 'sidechain',   label: 'Sidechain',    shortLabel: 'SID', color: 'var(--accent-blue)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, category: 'dynamics' },
  { key: 'distortion',  label: 'Distortion',   shortLabel: 'DST', color: '#ef4444', icon: <DistortionIcon />, category: 'tone' },
  { key: 'bitcrusher',  label: 'Bitcrusher',   shortLabel: 'BIT', color: 'var(--looper-lime)', icon: <BitcrusherIcon />, category: 'tone' },
  { key: 'saturation',  label: 'Saturation',   shortLabel: 'SAT', color: 'var(--orange-400)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.912 5.813a2 2 0 001.272 1.272L21 12l-5.816 1.916a2 2 0 00-1.272 1.272L12 21l-1.912-5.812a2 2 0 00-1.272-1.272L3 12l5.816-1.916a2 2 0 001.272-1.272z"/></svg>, category: 'tone' },
  { key: 'vinyl',       label: 'Vinyl',        shortLabel: 'VNL', color: 'var(--status-error)', icon: <VinylIcon />,      category: 'creative' },
  { key: 'autoFilter',  label: 'Auto Filter',  shortLabel: 'AFL', color: 'var(--accent-purple)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 3H2l8 9.46V19l4 2v-8.54z"/></svg>, category: 'creative' },
  { key: 'stereoWiden', label: 'Stereo Width', shortLabel: 'STW', color: 'var(--looper-teal)', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9-4.03-9-9-9z"/><path d="M12 3c-2.76 3.6-4.5 6.77-4.5 9s1.74 5.4 4.5 9"/><path d="M12 3c2.76 3.6 4.5 6.77 4.5 9s-1.74 5.4-4.5 9"/></svg>, category: 'creative' },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  time: 'var(--status-ok)',
  modulation: 'var(--accent-violet-soft)',
  dynamics: 'var(--status-warn)',
  tone: '#ef4444',
  creative: 'var(--track-cyan)',
};

// ═══════════════════════════════════════════════════════════════════════════
// SPECTRUM ANALYZER
// ═══════════════════════════════════════════════════════════════════════════

function SpectrumAnalyzer({ activeCount, height = 48 }: { activeCount: number; height?: number }) {
  const bars = 32;
  const [heights, setHeights] = useState<number[]>(Array(bars).fill(0));

  useEffect(() => {
    const interval = setInterval(() => {
      setHeights(Array.from({ length: bars }, () => Math.random() * (activeCount > 0 ? 0.85 : 0.25)));
    }, 60);
    return () => clearInterval(interval);
  }, [activeCount]);

  return (
    <div className="flex items-end justify-center gap-0.5 px-1" style={{ height }}>
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t"
          style={{
            height: `${Math.max(h * 100, 3)}%`,
            transition: 'height 0.06s ease-out',
            background: `linear-gradient(180deg, ${i < bars * 0.3 ? 'var(--status-ok)' : i < bars * 0.65 ? 'var(--status-warn)' : '#ef4444'} 0%, ${i < bars * 0.3 ? 'var(--status-ok)' : i < bars * 0.65 ? 'var(--status-warn)' : 'var(--status-error)'} 100%)`,
            boxShadow: h > 0.5 ? `0 0 6px ${i < bars * 0.3 ? 'var(--status-ok)' : i < bars * 0.65 ? 'var(--status-warn)' : '#ef4444'}55` : 'none',
            minHeight: 2,
          }}
        />
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODE SWITCHER BUTTON
// ═══════════════════════════════════════════════════════════════════════════

function ModeSwitcher({ mode, onChange }: { mode: PanelMode; onChange: (m: PanelMode) => void }) {
  const modes: { id: PanelMode; label: string; icon: string }[] = [
    { id: 'compact',      label: 'Compact',      icon: '⬜' },
    { id: 'normal',       label: 'Normal',        icon: '▣' },
    { id: 'professional', label: 'Pro',           icon: '⊞' },
  ];

  return (
    <div
      className="flex rounded-lg overflow-hidden"
      style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.4)' }}
    >
      {modes.map((m) => (
        <button
          key={m.id}
          onClick={() => onChange(m.id)}
          title={m.label}
          style={{
            padding: '4px 10px',
            fontSize: 10,
            fontFamily: "'JetBrains Mono', monospace",
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            background: mode === m.id ? 'rgba(167,139,250,0.2)' : 'transparent',
            color: mode === m.id ? 'var(--accent-violet-soft)' : 'rgba(255,255,255,0.4)',
            borderRight: m.id !== 'professional' ? '1px solid rgba(255,255,255,0.1)' : 'none',
            transition: 'all 0.15s ease',
            cursor: 'pointer',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FX BUTTON VARIANTS
// ═══════════════════════════════════════════════════════════════════════════

const FXButtonCompact = memo(({ config, isActive, onToggle }: { config: FXConfig; isActive: boolean; onToggle: (k: string) => void }) => {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={() => onToggle(config.key)}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      title={config.label}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        padding: '6px 4px',
        borderRadius: 8,
        border: `1px solid ${isActive ? config.color + '88' : 'rgba(255,255,255,0.1)'}`,
        background: isActive
          ? `linear-gradient(135deg, ${config.color}28 0%, ${config.color}12 100%)`
          : 'rgba(0,0,0,0.4)',
        color: isActive ? config.color : 'rgba(255,255,255,0.5)',
        fontSize: 9,
        fontFamily: "'JetBrains Mono', monospace",
        fontWeight: 700,
        letterSpacing: '0.04em',
        cursor: 'pointer',
        transform: pressed ? 'scale(0.93)' : 'scale(1)',
        boxShadow: isActive ? `0 0 10px ${config.color}30, inset 0 1px 0 rgba(255,255,255,0.05)` : 'none',
        transition: 'all 0.15s ease',
        flexDirection: 'column',
        gap: 3,
      }}
    >
      <div style={{ color: isActive ? config.color : 'rgba(255,255,255,0.45)', filter: isActive ? `drop-shadow(0 0 4px ${config.color}88)` : 'none' }}>
        {config.icon}
      </div>
      <span>{config.shortLabel}</span>
      {isActive && (
        <div style={{
          width: 4, height: 4, borderRadius: '50%',
          background: config.color,
          boxShadow: `0 0 6px ${config.color}`,
        }} />
      )}
    </button>
  );
});

const FXButtonNormal = memo(({ config, isActive, onToggle }: { config: FXConfig; isActive: boolean; onToggle: (k: string) => void }) => {
  const [pressed, setPressed] = useState(false);
  const [wetDry, setWetDry] = useState(70);
  const [showSlider, setShowSlider] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <button
        onClick={() => onToggle(config.key)}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        onContextMenu={(e) => { e.preventDefault(); if (isActive) setShowSlider(!showSlider); }}
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 8px 10px',
          borderRadius: 12,
          border: `1.5px solid ${isActive ? config.color + '66' : 'rgba(255,255,255,0.1)'}`,
          background: isActive
            ? `linear-gradient(135deg, ${config.color}22 0%, ${config.color}10 100%)`
            : 'linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.6) 100%)',
          color: isActive ? config.color : 'rgba(255,255,255,0.5)',
          cursor: 'pointer',
          transform: pressed ? 'scale(0.95)' : 'scale(1)',
          boxShadow: isActive ? `0 4px 18px ${config.color}28, inset 0 1px 0 rgba(255,255,255,0.05)` : 'inset 0 1px 0 rgba(255,255,255,0.02)',
          transition: 'all 0.18s ease',
          gap: 6,
          overflow: 'hidden',
        }}
      >
        {/* Glow bar */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 2,
          background: isActive ? `linear-gradient(90deg, transparent, ${config.color}, transparent)` : 'transparent',
          boxShadow: isActive ? `0 0 10px ${config.color}88` : 'none',
          transition: 'all 0.3s ease',
        }} />

        {/* LED */}
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isActive ? config.color : 'rgba(255,255,255,0.2)',
          boxShadow: isActive ? `0 0 8px ${config.color}, 0 0 14px ${config.color}55` : 'none',
          border: `1px solid ${isActive ? config.color : 'rgba(255,255,255,0.15)'}`,
          transition: 'all 0.2s ease',
        }} />

        {/* Icon */}
        <div style={{
          color: isActive ? config.color : 'rgba(255,255,255,0.4)',
          filter: isActive ? `drop-shadow(0 0 5px ${config.color}66)` : 'none',
          transition: 'all 0.2s ease',
        }}>
          {config.icon}
        </div>

        {/* Label */}
        <span style={{
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: isActive ? config.color : 'rgba(255,255,255,0.5)',
        }}>
          {config.shortLabel}
        </span>

        {/* Category dot */}
        <div style={{
          position: 'absolute', top: 4, right: 4,
          width: 5, height: 5, borderRadius: '50%',
          background: CATEGORY_COLORS[config.category] + '88',
        }} />
      </button>

      {showSlider && isActive && (
        <div style={{
          background: 'rgba(0,0,0,0.6)', borderRadius: 8,
          border: `1px solid ${config.color}33`, padding: '6px 8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 8, fontFamily: 'monospace', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Mix</span>
            <span style={{ fontSize: 8, fontFamily: 'monospace', fontWeight: 700, color: config.color }}>{wetDry}%</span>
          </div>
          <input type="range" min={0} max={100} value={wetDry} onChange={e => setWetDry(+e.target.value)}
            style={{ width: '100%', accentColor: config.color, height: 2 }}
          />
        </div>
      )}
    </div>
  );
});

const FXButtonPro = memo(({ config, isActive, onToggle }: { config: FXConfig; isActive: boolean; onToggle: (k: string) => void }) => {
  const [pressed, setPressed] = useState(false);
  const [wetDry, setWetDry] = useState(70);
  const [depth, setDepth] = useState(50);

  return (
    <div style={{
      borderRadius: 10,
      border: `1px solid ${isActive ? config.color + '55' : 'rgba(255,255,255,0.1)'}`,
      background: isActive ? `${config.color}12` : 'rgba(0,0,0,0.5)',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
      boxShadow: isActive ? `0 0 16px ${config.color}20` : 'none',
    }}>
      {/* Header row */}
      <button
        onClick={() => onToggle(config.key)}
        onPointerDown={() => setPressed(true)}
        onPointerUp={() => setPressed(false)}
        onPointerLeave={() => setPressed(false)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 9px', background: 'transparent', border: 'none',
          cursor: 'pointer', transform: pressed ? 'scale(0.97)' : 'scale(1)',
          transition: 'transform 0.12s ease',
        }}
      >
        {/* LED */}
        <div style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: isActive ? config.color : 'rgba(255,255,255,0.2)',
          boxShadow: isActive ? `0 0 8px ${config.color}` : 'none',
          transition: 'all 0.2s ease',
        }} />
        {/* Icon */}
        <div style={{
          color: isActive ? config.color : 'rgba(255,255,255,0.4)',
          filter: isActive ? `drop-shadow(0 0 4px ${config.color}77)` : 'none',
          flexShrink: 0,
        }}>
          {config.icon}
        </div>
        {/* Label */}
        <span style={{
          fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1, textAlign: 'left',
          color: isActive ? config.color : 'rgba(255,255,255,0.5)',
        }}>{config.label}</span>
        {/* Category chip */}
        <span style={{
          fontSize: 7, fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase',
          padding: '1px 4px', borderRadius: 4,
          background: CATEGORY_COLORS[config.category] + '22',
          color: CATEGORY_COLORS[config.category],
          border: `1px solid ${CATEGORY_COLORS[config.category]}33`,
        }}>{config.category.slice(0, 3)}</span>
      </button>

      {/* Parameter sliders (always visible in pro mode when active) */}
      {isActive && (
        <div style={{ padding: '0 9px 8px', display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 7, fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Wet/Dry</span>
              <span style={{ fontSize: 7, fontFamily: 'monospace', fontWeight: 700, color: config.color }}>{wetDry}%</span>
            </div>
            <input type="range" min={0} max={100} value={wetDry} onChange={e => setWetDry(+e.target.value)}
              style={{ width: '100%', accentColor: config.color, height: 2 }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
              <span style={{ fontSize: 7, fontFamily: 'monospace', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' }}>Depth</span>
              <span style={{ fontSize: 7, fontFamily: 'monospace', fontWeight: 700, color: config.color }}>{depth}%</span>
            </div>
            <input type="range" min={0} max={100} value={depth} onChange={e => setDepth(+e.target.value)}
              style={{ width: '100%', accentColor: config.color, height: 2 }}
            />
          </div>
        </div>
      )}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// MAIN FX PANEL
// ═══════════════════════════════════════════════════════════════════════════

export const FXPanel = memo(({ fx: fxProp, onToggle: onToggleProp }: FXPanelProps) => {
  const [fxState, setFxState] = useState<FXState>({});
  const [mode, setMode] = useState<PanelMode>('normal');
  const [collapsed, setCollapsed] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [masterMix, setMasterMix] = useState(100);
  const [showAnalyzer, setShowAnalyzer] = useState(true);

  const fx = fxProp ?? fxState;

  const onToggle = useCallback((key: string) => {
    if (onToggleProp) {
      onToggleProp(key);
    } else {
      setFxState(prev => ({ ...prev, [key]: !prev[key] }));
    }
  }, [onToggleProp]);

  const activeCount = useMemo(() => FX_CONFIG.filter(c => fx[c.key]).length, [fx]);
  const activeFX = useMemo(() => FX_CONFIG.filter(c => fx[c.key]), [fx]);

  const _panelGlow = useMemo(() => {
    const colors = activeFX.map(c => c.color);
    if (!colors.length) return 'none';
    return colors.slice(0, 3).map(c => `0 0 40px ${c}14`).join(', ');
  }, [activeFX]);

  const filteredFX = selectedCategory
    ? FX_CONFIG.filter(c => c.category === selectedCategory)
    : FX_CONFIG;

  const gridCols = mode === 'compact' ? 'repeat(auto-fill, minmax(58px, 1fr))' :
                   mode === 'normal'  ? 'repeat(auto-fill, minmax(88px, 1fr))' :
                                        '1fr';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&display=swap');
        @keyframes fx-ripple { 0% { opacity:1; transform:scale(0.5); } 100% { opacity:0; transform:scale(1.3); } }
        @keyframes fx-led-pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        .fx-panel-body { transition: max-height 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease, padding 0.3s ease; }
      `}</style>

      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          background: 'rgba(0, 0, 0, 0.6)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 8,
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          transition: 'box-shadow 0.3s ease',
          overflow: 'hidden',
        }}
      >
        {/* ── HEADER ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: collapsed ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0,0,0,0.4)',
          }}
        >
          {/* Left: icon + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'linear-gradient(135deg, var(--accent-violet-soft) 0%, var(--accent-purple) 100%)',
              boxShadow: '0 0 14px #a78bfa44',
              flexShrink: 0,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.9)' }}>
                FX Rack
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em' }}>
                Studio-Grade DSP Chain
              </div>
            </div>
          </div>

          {/* Center: Active badge */}
          {activeCount > 0 && !collapsed && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 20,
              background: 'rgba(16,185,129,0.12)',
              border: '1px solid rgba(16,185,129,0.3)',
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--status-ok)', boxShadow: '0 0 8px var(--status-ok)',
                animation: 'fx-led-pulse 1.5s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--status-ok)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {activeCount}/{FX_CONFIG.length} Active
              </span>
            </div>
          )}

          {/* Right: Mode switcher + collapse */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!collapsed && <ModeSwitcher mode={mode} onChange={setMode} />}

            {/* Collapse button */}
            <button
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'Expand' : 'Collapse'}
              style={{
                width: 28, height: 28, borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(51,65,85,0.4)',
                border: '1px solid rgba(71,85,105,0.3)',
                color: 'rgba(148,163,184,0.7)',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              <svg
                width="12" height="12" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease' }}
              >
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── BODY (collapsible) ─────────────────────────────── */}
        <div
          className="fx-panel-body"
          style={{
            maxHeight: collapsed ? 0 : 2000,
            opacity: collapsed ? 0 : 1,
            overflow: 'hidden',
            padding: collapsed ? '0 16px' : '14px 16px',
          }}
        >
          {/* Spectrum Analyzer (normal + pro) */}
          {showAnalyzer && mode !== 'compact' && (
            <div style={{
              borderRadius: 8, marginBottom: 14,
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(255,255,255,0.1)',
              padding: '8px 6px 4px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, paddingInline: 4 }}>
                <span style={{ fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>Spectrum</span>
                <button onClick={() => setShowAnalyzer(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>✕</button>
              </div>
              <SpectrumAnalyzer activeCount={activeCount} height={mode === 'professional' ? 56 : 40} />
            </div>
          )}

          {/* Compact mode: show analyzer toggle */}
          {mode === 'compact' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 8, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' }}>
                {activeCount > 0 ? `${activeCount} fx active` : 'No FX active'}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                {Object.entries(CATEGORY_COLORS).map(([cat, color]) => {
                  const active = FX_CONFIG.filter(c => c.category === cat && fx[c.key]).length;
                  return active > 0 ? (
                    <div key={cat} style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: color, boxShadow: `0 0 6px ${color}`,
                    }} />
                  ) : null;
                })}
              </div>
            </div>
          )}

          {/* Category filter (normal + pro) */}
          {mode !== 'compact' && (
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 12 }}>
              <button
                onClick={() => setSelectedCategory(null)}
                style={{
                  padding: '3px 9px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                  background: !selectedCategory ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${!selectedCategory ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
                  color: !selectedCategory ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.15s ease',
                }}
              >
                All
              </button>
              {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                  style={{
                    padding: '3px 9px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
                    background: selectedCategory === cat ? `${color}22` : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${selectedCategory === cat ? `${color}55` : 'rgba(255,255,255,0.1)'}`,
                    color: selectedCategory === cat ? color : 'rgba(255,255,255,0.4)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Master Mix (normal + pro) */}
          {mode !== 'compact' && (
            <div style={{
              marginBottom: 14, padding: '10px 12px', borderRadius: 8,
              background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Master FX Mix
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--status-ok)' }}>{masterMix}%</span>
                  <button
                    onClick={() => setMasterMix(100)}
                    style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 4, cursor: 'pointer', padding: '2px 4px', color: 'rgba(255,255,255,0.5)', fontSize: 8 }}
                  >↺</button>
                </div>
              </div>
              <input
                type="range" min={0} max={100} value={masterMix}
                onChange={e => setMasterMix(+e.target.value)}
                style={{ width: '100%', accentColor: 'var(--status-ok)', height: 2 }}
              />
            </div>
          )}

          {/* FX Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: mode === 'compact' ? 5 : mode === 'professional' ? 6 : 7 }}>
            {filteredFX.map(config => {
              if (mode === 'compact') return <FXButtonCompact key={config.key} config={config} isActive={!!fx[config.key]} onToggle={onToggle} />;
              if (mode === 'normal')  return <FXButtonNormal  key={config.key} config={config} isActive={!!fx[config.key]} onToggle={onToggle} />;
              return <FXButtonPro key={config.key} config={config} isActive={!!fx[config.key]} onToggle={onToggle} />;
            })}
          </div>

          {/* Signal Chain (normal + pro when FX active) */}
          {mode !== 'compact' && activeCount > 0 && (
            <div style={{
              marginTop: 14, padding: '10px 12px', borderRadius: 8,
              background: 'linear-gradient(135deg, rgba(16,185,129,0.07) 0%, rgba(59,130,246,0.07) 100%)',
              border: '1px solid rgba(255,255,255,0.1)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Signal Chain</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5 }}>
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>IN</span>
                {activeFX.map((c, i) => (
                  <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                      padding: '2px 7px', borderRadius: 4,
                      background: `${c.color}22`, color: c.color,
                      border: `1px solid ${c.color}44`,
                      boxShadow: `0 0 8px ${c.color}20`,
                    }}>{c.shortLabel}</span>
                    {i < activeFX.length - 1 && <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>›</span>}
                  </div>
                ))}
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'linear-gradient(90deg, var(--status-ok), var(--status-ok))', color: 'white', boxShadow: '0 0 10px #10b98133' }}>OUT</span>
              </div>
            </div>
          )}

          {/* Footer */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginTop: 12, paddingTop: 10,
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}>
            <button
              onClick={() => {
                const keys = Object.fromEntries(FX_CONFIG.map(c => [c.key, false]));
                setFxState(keys);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', borderRadius: 7, cursor: 'pointer',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)', fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
              Clear
            </button>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              32-bit float · zero-latency
            </span>
          </div>
        </div>
      </div>
    </>
  );
});

FXPanel.displayName = 'FXPanel';
export default FXPanel;