// components/AdvancedMeter.tsx - Professional audio level meter

import React, { useMemo } from 'react';
import type { AdvancedMeterProps } from '../types';
import { gainToDb } from '../utils';

export const AdvancedMeter: React.FC<AdvancedMeterProps> = ({
  level,
  peak,
  height,
}) => {
  const levelDb = useMemo(() => gainToDb(level), [level]);
  const peakDb = useMemo(() => gainToDb(peak), [peak]);

  const getLevelColor = (db: number): string => {
    if (db > -3) return 'bg-red-500';
    if (db > -12) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getLevelPercentage = (db: number): number => {
    // Map -60dB to 0dB range to 0-100%
    const normalized = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
    return normalized;
  };

  const levelPercentage = getLevelPercentage(levelDb);
  const peakPercentage = getLevelPercentage(peakDb);

  return (
    <div 
      className="relative w-full bg-muted rounded overflow-hidden"
      style={{ height: `${height}px` }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 opacity-30">
        <div className="h-1/3 bg-gradient-to-t from-green-900" />
        <div className="h-1/3 bg-gradient-to-t from-yellow-900" />
        <div className="h-1/3 bg-gradient-to-t from-red-900" />
      </div>

      {/* Level bar */}
      <div
        className={`absolute bottom-0 w-full transition-all duration-75 ${getLevelColor(levelDb)}`}
        style={{ height: `${levelPercentage}%` }}
      />

      {/* Peak indicator */}
      {peak > 0 && (
        <div
          className="absolute w-full h-0.5 bg-white transition-all duration-100"
          style={{ bottom: `${peakPercentage}%` }}
        />
      )}

      {/* dB scale markers */}
      <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
        {[0, -6, -12, -18, -24, -30].map((db) => (
          <div
            key={db}
            className="text-[8px] text-muted-foreground px-1 leading-none"
          >
            {db}
          </div>
        ))}
      </div>
    </div>
  );
};