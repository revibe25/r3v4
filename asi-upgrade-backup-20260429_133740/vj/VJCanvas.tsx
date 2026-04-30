import { useRef, useEffect } from "react";
export function VJCanvas({ level = 0, beat = 0 }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let anim: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.shadowBlur = 30 + 40 * level;
      ctx.shadowColor = "#bfff00";
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 70 + 32 * Math.abs(Math.sin(beat)), 0, 2 * Math.PI);
      ctx.fillStyle = "#101a00";
      ctx.fill();
      ctx.restore();
      anim = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(anim);
  }, [level, beat]);
  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: "transparent",
      }}
    />
  );
}
