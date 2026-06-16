import React, { useState, useCallback, useRef } from "react";

/**
 * PanelResizeHandle — draggable resize handle for DAW panels
 * 
 * Matches the DAW.tsx aesthetic: inline styles, no Tailwind classes,
 * dark theme with #a3e635 accent.
 */

interface PanelResizeHandleProps {
  direction: "horizontal" | "vertical";
  onResize: (size: number) => void;
  min: number;
  max: number;
}

export const PanelResizeHandle = React.memo(function PanelResizeHandle({
  direction,
  onResize,
  min,
  max,
}: PanelResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startRef = useRef(0);
  const startSizeRef = useRef(0);
  const rafRef = useRef<number>(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);

      startRef.current = direction === "horizontal" ? e.clientX : e.clientY;

      const parent = (e.target as HTMLElement).parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        startSizeRef.current = direction === "horizontal" ? rect.width : rect.height;
      }

      document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          const current = direction === "horizontal" ? moveEvent.clientX : moveEvent.clientY;
          const delta = current - startRef.current;
          const newSize = Math.max(min, Math.min(max, startSizeRef.current + delta));
          onResize(newSize);
        });
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [direction, min, max, onResize]
  );

  // Touch support for tablets
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0];
      startRef.current = direction === "horizontal" ? touch.clientX : touch.clientY;

      const parent = (e.target as HTMLElement).parentElement;
      if (parent) {
        const rect = parent.getBoundingClientRect();
        startSizeRef.current = direction === "horizontal" ? rect.width : rect.height;
      }

      const handleTouchMove = (moveEvent: TouchEvent) => {
        const moveTouch = moveEvent.touches[0];
        const current = direction === "horizontal" ? moveTouch.clientX : moveTouch.clientY;
        const delta = current - startRef.current;
        const newSize = Math.max(min, Math.min(max, startSizeRef.current + delta));
        onResize(newSize);
      };

      const handleTouchEnd = () => {
        document.removeEventListener("touchmove", handleTouchMove);
        document.removeEventListener("touchend", handleTouchEnd);
      };

      document.addEventListener("touchmove", handleTouchMove, { passive: true });
      document.addEventListener("touchend", handleTouchEnd);
    },
    [direction, min, max, onResize]
  );

  const isHorizontal = direction === "horizontal";

  return (
    <div
      style={{
        position: "absolute",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: isHorizontal ? "col-resize" : "row-resize",
        background: isDragging ? "rgba(163, 230, 53, 0.08)" : "transparent",
        transition: "background 0.15s ease-out",
        ...(isHorizontal
          ? { right: 0, top: 0, height: "100%", width: 8, marginRight: -4 }
          : { left: 0, bottom: 0, height: 8, width: "100%", marginBottom: -4 }),
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      role="separator"
      aria-orientation={direction}
      aria-label={`Resize panel ${direction}ally`}
      tabIndex={0}
      onKeyDown={(e) => {
        const step = 20;
        if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          onResize(Math.max(min, startSizeRef.current - step));
        } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          onResize(Math.min(max, startSizeRef.current + step));
        }
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "rgba(163, 230, 53, 0.04)";
      }}
      onMouseLeave={(e) => {
        if (!isDragging) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    >
      <div
        style={{
          borderRadius: 9999,
          transition: "all 0.15s ease-out",
          background: isDragging ? "#a3e635" : "rgba(85, 85, 85, 0.5)",
          boxShadow: isDragging ? "0 0 6px rgba(163, 230, 53, 0.4)" : "none",
          ...(isHorizontal
            ? { height: 32, width: 2 }
            : { height: 2, width: 32 }),
        }}
      />
    </div>
  );
});
