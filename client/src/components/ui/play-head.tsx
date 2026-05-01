import React from 'react';

interface PlayheadProps {
  position: number; // time in seconds
  pixelsPerSecond?: number;
  height?: string;
  color?: string;
}

export const Playhead: React.FC<PlayheadProps> = ({ 
  position, 
  pixelsPerSecond = 100,
  height = '100%',
  color = 'bg-red-500'
}) => {
  const _left = position * pixelsPerSecond;

  return (
    <div
      className={`absolute top-0 w-0.5 ${color} pointer-events-none z-20`}
      style={{ 
        left: `${left}px`,
        height
      }}
    >
      {/* Playhead triangle marker */}
      <div className={`absolute -top-2 -left-2 w-4 h-4 ${color} rotate-45`} />
    </div>
  );
};

export default Playhead;
