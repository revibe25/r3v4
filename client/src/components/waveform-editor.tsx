import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, Scissors } from 'lucide-react';

interface WaveformEditorProps {
  getWaveformData: () => Uint8Array | null;
  isInitialized: boolean;
}

export function WaveformEditor({ getWaveformData, isInitialized }: WaveformEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (!isInitialized) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const data = getWaveformData();
      const width = canvas.width;
      const height = canvas.height;

      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = 'rgba(96, 165, 250, 0.1)';
      ctx.lineWidth = 1;
      const gridLines = 8;
      for (let i = 0; i <= gridLines; i++) {
        const y = (height / gridLines) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      const centerY = height / 2;
      ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      if (data) {
        ctx.strokeStyle = 'hsl(217, 91%, 60%)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const sliceWidth = (width * zoom) / data.length;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
          if (x > width) break;
        }

        ctx.stroke();

        ctx.strokeStyle = 'rgba(0, 255, 231, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        x = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0;
          const y = (v * height) / 2 + 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }

          x += sliceWidth;
          if (x > width) break;
        }
        ctx.stroke();
      } else {
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin(x * 0.05) * 5;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [getWaveformData, isInitialized, zoom]);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">Waveform Editor</h4>
      <canvas
        ref={canvasRef}
        width={800}
        height={100}
        className="w-full h-24 rounded-lg border border-border/30"
        style={{ background: '#020617' }}
        data-testid="canvas-waveform"
      />
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom((z) => Math.min(z * 1.5, 10))}
          data-testid="button-zoom-in"
        >
          <ZoomIn className="w-4 h-4 mr-1" />
          Zoom In
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setZoom((z) => Math.max(z / 1.5, 0.5))}
          data-testid="button-zoom-out"
        >
          <ZoomOut className="w-4 h-4 mr-1" />
          Zoom Out
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="button-trim"
        >
          <Scissors className="w-4 h-4 mr-1" />
          Trim
        </Button>
      </div>
    </div>
  );
}
