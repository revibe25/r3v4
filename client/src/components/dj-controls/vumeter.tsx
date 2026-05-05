import { ACID, DJ_SURFACE2, DJ_BORDER, DJ_DIM } from './types';

interface VUMeterProps {
  value: number;
  color: string;
  label: string;
}

export function VUMeter({ value, color, label }: VUMeterProps) {
  const segs   = 10;
  const active = Math.floor(value * segs);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ display: 'flex', gap: 1.5, width: '100%' }}>
        {Array.from({ length: segs }).map((_, i) => {
          const on = i < active;
          const c  = i < segs * 0.6 ? ACID : i < segs * 0.85 ? 'var(--signal-warn)' : 'var(--signal-clip)';
          return (
            <div key={i} style={{
              flex: 1, height: 5,
              borderRadius: 0,
              background: on ? c : DJ_SURFACE2,
              border: `1px solid ${on ? 'transparent' : DJ_BORDER}`,
            }} />
          );
        })}
      </div>
      <span style={{ fontSize: 7, color: DJ_DIM, textTransform: 'uppercase', letterSpacing: 2 }}>
        {label}
      </span>
    </div>
  );
}