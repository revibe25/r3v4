import { useState, useEffect, useRef } from 'react';
import { ACID } from './types';

interface WaveformDisplayProps {
  active: boolean;
}

export function WaveformDisplay({ active }: WaveformDisplayProps) {
  const [bars, setBars] = useState<number[]>(
    () => Array.from({ length: 64 }, () => Math.random() * 0.8 + 0.1),
  );
  const posRef = useRef(0);

  useEffect(() => {
    if (!active) return;
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

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 1, height: 36 }}>
      {bars.map((h, i) => {
        const isHead = i === posRef.current;
        return (
          <div key={i} style={{
            flex: 1,
            borderRadius: 0,
            height: `${Math.max(h * 100, 5)}%`,
            background: isHead ? '#ffffff' : i < posRef.current ? ACID : `${ACID}33`,
          }} />
        );
      })}
    </div>
  );
}