import { useRef, useEffect } from 'react';

interface OscilloscopeProps {
  data: Float32Array;
  width?: number;
  height?: number;
  color?: string;
}

export function Oscilloscope({ data, width = 300, height = 100, color = '#a3e635' }: OscilloscopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const points = Array.from(data).map((v, i): [number, number] => [
      (i / data.length) * width,
      (1 - (v + 1) / 2) * height,
    ]);

    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.stroke();
  }, [data, width, height, color]);

  return <canvas ref={canvasRef} width={width} height={height} />;
}

export default Oscilloscope;
