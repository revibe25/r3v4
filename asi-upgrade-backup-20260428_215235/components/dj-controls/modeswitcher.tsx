import { ACID, DJ_BLACK, DJ_BORDER, DJ_DIM } from './types';
import type { PanelMode } from './types';

interface ModeSwitcherProps {
  mode: PanelMode;
  onChange: (m: PanelMode) => void;
}

export function ModeSwitcher({ mode, onChange }: ModeSwitcherProps) {
  return (
    <div style={{ display: 'flex', overflow: 'hidden', border: `1px solid ${DJ_BORDER}` }}>
      {(['compact', 'normal', 'professional'] as PanelMode[]).map((m, i, arr) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: '4px 10px', fontSize: 8, fontWeight: 700,
            letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer',
            background: mode === m ? ACID : 'transparent',
            color: mode === m ? DJ_BLACK : DJ_DIM,
            border: 'none',
            borderRight: i < arr.length - 1 ? `1px solid ${DJ_BORDER}` : 'none',
            fontFamily: 'inherit',
          }}
        >
          {m === 'professional' ? 'PRO' : m === 'compact' ? 'MICRO' : 'NORMAL'}
        </button>
      ))}
    </div>
  );
}