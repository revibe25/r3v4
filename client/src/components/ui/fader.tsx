import React, { useState, useCallback, useRef } from "react";

interface FaderProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  color?: string;
  label?: string;
  showDb?: boolean;
  disabled?: boolean;
}

const dBFromGain = (gain: number): number => {
  if (gain <= 0) return -Infinity;
  return 20 * Math.log10(gain);
};

const gainFromDb = (db: number): number => {
  if (db <= -60) return 0;
  return Math.pow(10, db / 20);
};

const posFromDb = (db: number): number => {
  if (db <= -60) return 0;
  if (db >= 6) return 1;
  if (db < -24) return (db + 60) / 120;
  if (db < 0) return 0.3 + (db + 24) / 80;
  return 0.6 + db / 15;
};

const dbFromPos = (pos: number): number => {
  if (pos <= 0) return -Infinity;
  if (pos < 0.3) return pos * 120 - 60;
  if (pos < 0.6) return (pos - 0.3) * 80 - 24;
  return (pos - 0.6) * 15;
};

export const Fader = React.memo(function Fader({
  value,
  min = 0,
  max = 1.5,
  onChange,
  color = '#a3e635',
  label = 'Fader',
  showDb = true,
  disabled = false,
}: FaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const trackRef = useRef<SVGRectElement>(null);

  const db = dBFromGain(value);
  const pos = posFromDb(db);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled) return;
    e.preventDefault();
    setIsDragging(true);
    setShowTooltip(true);
    (e.target as Element).setPointerCapture(e.pointerId);

    const rect = trackRef.current?.getBoundingClientRect();
    if (rect) {
      const y = e.clientY - rect.top;
      const newPos = 1 - Math.max(0, Math.min(1, y / rect.height));
      const newDb = dbFromPos(newPos);
      const newGain = gainFromDb(newDb);
      onChange(Math.max(min, Math.min(max, newGain)));
    }
  }, [disabled, onChange, min, max]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging || disabled) return;
    const rect = trackRef.current?.getBoundingClientRect();
    if (rect) {
      const y = e.clientY - rect.top;
      const newPos = 1 - Math.max(0, Math.min(1, y / rect.height));
      const newDb = dbFromPos(newPos);
      const newGain = gainFromDb(newDb);
      onChange(Math.max(min, Math.min(max, newGain)));
    }
  }, [isDragging, disabled, onChange, min, max]);

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
    setShowTooltip(false);
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (disabled) return;
    const stepDb = e.shiftKey ? 0.1 : 1;
    let newDb = db;

    switch (e.key) {
      case 'ArrowUp': newDb += stepDb; break;
      case 'ArrowDown': newDb -= stepDb; break;
      case 'PageUp': newDb += 6; break;
      case 'PageDown': newDb -= 6; break;
      case 'Home': newDb = -60; break;
      case 'End': newDb = 6; break;
      default: return;
    }

    e.preventDefault();
    const newGain = gainFromDb(newDb);
    onChange(Math.max(min, Math.min(max, newGain)));
  }, [db, disabled, onChange, min, max]);

  const width = 28;
  const height = 80;
  const trackWidth = 4;
  const thumbHeight = 12;
  const thumbWidth = 20;
  const thumbY = (1 - pos) * (height - thumbHeight);

  const ticks = [-60, -24, -12, -6, 0, 6];
  const tickPositions = ticks.map(tickDb => ({
    db: tickDb,
    y: (1 - posFromDb(tickDb)) * height,
  }));

  const gradId = `faderGrad-${label.replace(/\s/g, '')}`;

  return (
    <div 
      className="relative flex flex-col items-center"
      style={{ width, height: height + 20 }}
      role="slider"
      aria-label={label}
      aria-valuenow={Math.round(db * 10) / 10}
      aria-valuemin={-60}
      aria-valuemax={6}
      aria-valuetext={db === -Infinity ? '-Infinity dB' : `${Math.round(db * 10) / 10} dB`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
    >
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className={disabled ? 'opacity-50' : 'cursor-pointer'}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <rect
          ref={trackRef}
          x={(width - trackWidth) / 2}
          y={0}
          width={trackWidth}
          height={height}
          rx={trackWidth / 2}
          fill="#1c1c1c"
        />

        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.8} />
            <stop offset="100%" stopColor={color} stopOpacity={0.2} />
          </linearGradient>
        </defs>
        <rect
          x={(width - trackWidth) / 2}
          y={thumbY + thumbHeight / 2}
          width={trackWidth}
          height={height - thumbY - thumbHeight / 2}
          rx={trackWidth / 2}
          fill={`url(#${gradId})`}
        />

        {tickPositions.map(({ db: tickDb, y }) => (
          <g key={tickDb}>
            <line
              x1={0}
              y1={y}
              x2={width}
              y2={y}
              stroke={tickDb === 0 ? '#fff' : '#333'}
              strokeWidth={tickDb === 0 ? 1 : 0.5}
              opacity={0.5}
            />
            {showDb && (
              <text
                x={width + 2}
                y={y + 3}
                fill="#555"
                fontSize={6}
                fontFamily="monospace"
              >
                {tickDb === -60 ? '-inf' : tickDb > 0 ? `+${tickDb}` : tickDb}
              </text>
            )}
          </g>
        ))}

        <rect
          x={(width - thumbWidth) / 2}
          y={thumbY}
          width={thumbWidth}
          height={thumbHeight}
          rx={2}
          fill={isDragging ? '#fff' : color}
          stroke={isDragging ? color : 'transparent'}
          strokeWidth={1}
          style={{
            filter: isDragging ? `drop-shadow(0 0 4px ${color})` : 'none',
            transition: isDragging ? 'none' : 'fill 0.15s ease',
          }}
        />
      </svg>

      <span className="text-[8px] font-mono mt-1" style={{ color: disabled ? '#333' : color }}>
        {db === -Infinity ? '-inf' : `${db > 0 ? '+' : ''}${Math.round(db)}`}
      </span>

      {showTooltip && (
        <div
          className="absolute z-50 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#1c1c1c] border border-[#333] text-white pointer-events-none"
          style={{ bottom: '100%', marginBottom: 4 }}
        >
          {db === -Infinity ? '-inf dB' : `${Math.round(db * 10) / 10} dB`}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1c1c1c]" />
        </div>
      )}
    </div>
  );
});
