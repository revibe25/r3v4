import { jsx as _jsx } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { ACID } from './types';
export function WaveformDisplay({ active }) {
    const [bars, setBars] = useState(() => Array.from({ length: 64 }, () => Math.random() * 0.8 + 0.1));
    const posRef = useRef(0);
    useEffect(() => {
        if (!active)
            return;
        const interval = setInterval(() => {
            posRef.current = (posRef.current + 1) % bars.length;
            setBars(prev => {
                const next = [...prev];
                next[posRef.current] = Math.random() * 0.8 + 0.1;
                return next;
            });
        }, 80);
        return () => clearInterval(interval);
    }, [active, bars.length]);
    return (_jsx("div", { style: { display: 'flex', alignItems: 'center', gap: 1, height: 36 }, children: bars.map((h, i) => {
            const isHead = i === posRef.current;
            return (_jsx("div", { style: {
                    flex: 1,
                    borderRadius: 0,
                    height: `${Math.max(h * 100, 5)}%`,
                    background: isHead ? 'var(--white)' : i < posRef.current ? ACID : `${ACID}33`,
                } }, i));
        }) }));
}
