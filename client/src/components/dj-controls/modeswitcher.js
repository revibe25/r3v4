import { jsx as _jsx } from "react/jsx-runtime";
import { ACID, DJ_BLACK, DJ_BORDER, DJ_DIM } from './types';
export function ModeSwitcher({ mode, onChange }) {
    return (_jsx("div", { style: { display: 'flex', overflow: 'hidden', border: `1px solid ${DJ_BORDER}` }, children: ['compact', 'normal', 'professional'].map((m, i, arr) => (_jsx("button", { onClick: () => onChange(m), style: {
                padding: '4px 10px', fontSize: 8, fontWeight: 700,
                letterSpacing: 2, textTransform: 'uppercase', cursor: 'pointer',
                background: mode === m ? ACID : 'transparent',
                color: mode === m ? DJ_BLACK : DJ_DIM,
                border: 'none',
                borderRight: i < arr.length - 1 ? `1px solid ${DJ_BORDER}` : 'none',
                fontFamily: 'inherit',
            }, children: m === 'professional' ? 'PRO' : m === 'compact' ? 'MICRO' : 'NORMAL' }, m))) }));
}
