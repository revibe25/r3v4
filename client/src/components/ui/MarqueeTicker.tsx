// client/src/components/ui/MarqueeTicker.tsx
// Continuous scrolling ticker with pause-on-hover.
// Extracted from the HTML prototype's .marquee region.

import { memo } from 'react';

interface MarqueeTickerProps {
  items: string[];
  speed?: number; // seconds for one full loop
}

export const MarqueeTicker = memo(function MarqueeTicker({
  items,
  speed = 40,
}: MarqueeTickerProps) {
  // Duplicate items for seamless loop
  const allItems = [...items, ...items];

  return (
    <div
      className="overflow-hidden cursor-default"
      style={{
        minHeight: 25,
        padding: '5px 10px',
        background: '#080908',
        borderBottom: '1px solid #1a1f16',
        display: 'block',
      }}
      aria-label="Platform feature highlights"
    >
      <style>{`
        @keyframes r3-ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .r3-ticker-track {
          display: inline-flex;
          align-items: center;
          white-space: nowrap;
          animation: r3-ticker ${speed}s linear infinite;
          will-change: transform;
        }
        .r3-ticker-track:hover {
          animation-play-state: paused;
        }
        .r3-ticker-item {
          display: inline-block;
          padding: 5px 12px;
          font-size: 8px;
          font-weight: 550;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: #e6e6e6;
          transition: color 0.12s ease;
        }
        .r3-ticker-item.acid {
          color: var(--r3-accent);
          text-shadow: 0 0 14px rgba(200, 255, 0, 0.20);
        }
        .r3-ticker-sep {
          display: inline-block;
          padding: 5px 3px;
          color: #2c2c2c;
          font-size: 7px;
          letter-spacing: 0;
          text-shadow: none;
        }
      `}</style>
      <div className="r3-ticker-track" aria-hidden="true">
        {allItems.map((item, i) => (
          <span key={i}>
            <span className={`r3-ticker-item ${i % 2 === 1 ? 'acid' : ''}`}>
              {item}
            </span>
            <span className="r3-ticker-sep">/</span>
          </span>
        ))}
      </div>
    </div>
  );
});
