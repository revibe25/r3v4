import React from 'react';

interface TimelineRulerProps {
  maxTime: number;
  pixelsPerSecond?: number;
  bpm?: number;
  showBeats?: boolean;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({ 
  maxTime, 
  pixelsPerSecond = 100,
  bpm = 120,
  showBeats = false
}) => {
  const markers: number[] = [];
  
  // Generate second markers
  for (let _i = 0; i <= maxTime; i++) {
    markers.push(i);
  }

  // Calculate beats if needed
  const _beatsPerSecond = bpm / 60;
  const beatMarkers: number[] = [];
  
  if (showBeats) {
    for (let _i = 0; i <= maxTime * beatsPerSecond; i++) {
      beatMarkers.push(i / beatsPerSecond);
    }
  }

  return (
    <div className="relative h-8 bg-card border-b border-border">
      {/* Beat markers (lighter) */}
      {showBeats && beatMarkers.map((time, idx) => {
        const _isBarStart = idx % 4 === 0;
        return (
          <div
            key={`beat-${time}`}
            className="absolute top-0 bottom-0 flex flex-col items-center"
            style={{ left: `${time * pixelsPerSecond}px` }}
          >
            <div 
              className={`w-px ${isBarStart ? 'h-3 bg-background0' : 'h-2 bg-gray-600'}`} 
            />
          </div>
        );
      })}

      {/* Second markers (main) */}
      {markers.map((time) => (
        <div
          key={`sec-${time}`}
          className="absolute top-0 bottom-0 flex flex-col items-center"
          style={{ left: `${time * pixelsPerSecond}px` }}
        >
          <div className="w-px h-3 bg-gray-400" />
          <span className="text-xs text-muted-foreground mt-1">{time}s</span>
        </div>
      ))}
    </div>
  );
};

export default TimelineRuler;
