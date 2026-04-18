// waveform-display.tsx
import React, { useEffect, useRef } from 'react';

interface WaveformDisplayProps {
  waveformData: number[];
  color?: string;
  width?: number;
  height?: number;
  backgroundColor?: string;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  waveformData,
  color = '#3b82f6',
  width = 400,
  height = 80,
  backgroundColor = 'transparent',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !waveformData || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = width;
    canvas.height = height;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // Draw waveform
    const sliceWidth = width / waveformData.length;
    const centerY = height / 2;
    const maxAmplitude = Math.max(...waveformData, 0.1);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    waveformData.forEach((value, index) => {
      const x = index * sliceWidth;
      const normalizedValue = (value / maxAmplitude) * (centerY - 5);
      const y = centerY - normalizedValue;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw mirrored waveform
    ctx.beginPath();
    waveformData.forEach((value, index) => {
      const x = index * sliceWidth;
      const normalizedValue = (value / maxAmplitude) * (centerY - 5);
      const y = centerY + normalizedValue;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw center line
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();
  }, [waveformData, color, width, height, backgroundColor]);

  return (
    <canvas
      ref={canvasRef}
      className="rounded"
      style={{ display: 'block' }}
    />
  );
};