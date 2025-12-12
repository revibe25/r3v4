import { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
  getAnalyserData: () => Uint8Array | null;
  isInitialized: boolean;
}

export function AudioVisualizer({ getAnalyserData, isInitialized }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!isInitialized) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const data = getAnalyserData();
      const width = canvas.width;
      const height = canvas.height;

      const gradient = ctx.createLinearGradient(0, height, 0, 0);
      gradient.addColorStop(0, 'rgba(2, 6, 23, 1)');
      gradient.addColorStop(1, 'rgba(2, 18, 42, 1)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      if (data) {
        const barWidth = width / 64;
        const barGap = 2;

        for (let i = 0; i < 64; i++) {
          const dataIndex = Math.floor(i * (data.length / 64));
          const value = data[dataIndex] / 255;
          const barHeight = value * height * 0.9;

          const barGradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
          barGradient.addColorStop(0, 'hsl(217, 91%, 60%)');
          barGradient.addColorStop(1, 'hsl(174, 84%, 50%)');

          ctx.fillStyle = barGradient;
          ctx.fillRect(
            i * (barWidth + barGap),
            height - barHeight,
            barWidth,
            barHeight
          );

          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.fillRect(
            i * (barWidth + barGap),
            height - barHeight,
            barWidth,
            2
          );
        }
      } else {
        ctx.fillStyle = 'rgba(96, 165, 250, 0.2)';
        const centerY = height / 2;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin(x * 0.02 + Date.now() * 0.002) * 10;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.closePath();
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [getAnalyserData, isInitialized]);

  return (
    <canvas
      ref={canvasRef}
      width={630}
      height={120}
      className="w-full h-28 md:h-32 rounded-xl"
      style={{ background: 'linear-gradient(180deg, #020617, #02122a)' }}
      data-testid="canvas-visualizer"
    />
  );
}
