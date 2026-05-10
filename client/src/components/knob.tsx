import React, { useEffect, useRef, useState } from "react";
import type { KnobProps } from "./types";

export function Knob({
  value,
  min,
  max,
  label,
  onChange,
  formatValue,
  testId,
  defaultValue = 0,
  step = 0.01,
}: KnobProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const startYRef = useRef(0);
  const startValueRef = useRef(0);

  const normalizedValue = (value - min) / (max - min || 1);
  const rotation = -135 + normalizedValue * 270;

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValueRef.current = value;
    (e.target as Element).setPointerCapture?.((e as any).pointerId);
    e.preventDefault();
  };

  const handlePointerMove = (ev: PointerEvent) => {
    if (!isDragging) return;
    const deltaY = startYRef.current - ev.clientY;
    const range = max - min;
    const sensitivity = (range || 1) / 150;
    let newValue = startValueRef.current + deltaY * sensitivity;
    newValue = Math.min(max, Math.max(min, newValue));
    if (step) newValue = Math.round(newValue / step) * step;
    onChange(newValue);
  };

  const handlePointerUp = (ev: PointerEvent) => {
    setIsDragging(false);
    (ev.target as Element).releasePointerCapture?.((ev as any).pointerId);
  };

  const handleDoubleClick = () => onChange(defaultValue);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const range = max - min;
    const keyStep = step || range / 100;
    switch (e.key) {
      case "ArrowUp":
      case "ArrowRight":
        e.preventDefault();
        onChange(Math.min(max, value + keyStep));
        break;
      case "ArrowDown":
      case "ArrowLeft":
        e.preventDefault();
        onChange(Math.max(min, value - keyStep));
        break;
      case "Enter":
        onChange(defaultValue);
        break;
    }
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove as any);
      window.addEventListener("pointerup", handlePointerUp as any);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove as any);
        window.removeEventListener("pointerup", handlePointerUp as any);
      };
    }
  }, [isDragging]);

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      <div
        data-testid={testId}
        onPointerDown={handlePointerDown}
        onDoubleClick={handleDoubleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        className={`relative w-12 h-12 rounded-full cursor-grab
          bg-gradient-to-b from-muted/80 to-card border border-border/50
          flex items-center justify-center shadow-inner transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2
          ${isDragging ? "cursor-grabbing scale-105 shadow-lg" : ""}
          ${isHovered && !isDragging ? "scale-[1.02]" : ""}`}
      >
        <div
          className={`absolute w-1 h-4 rounded-full origin-bottom transition-colors duration-150 ${
            isDragging ? "bg-primary" : "bg-muted-foreground"
          }`}
          style={{
            transform: `rotate(${rotation}deg) translateY(-6px)`,
            top: "8px",
          }}
        />
        <div className="absolute inset-2 rounded-full bg-card border border-border/30" />
      </div>
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
      <span className="text-xs text-muted-foreground/70 font-mono">
        {formatValue ? formatValue(value) : value.toFixed(2)}
      </span>
    </div>
  );
}
