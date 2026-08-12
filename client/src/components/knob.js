import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from "react";
export function Knob({ value, min, max, label, onChange, formatValue, testId, defaultValue = 0, step = 0.01, }) {
    const [isDragging, setIsDragging] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const startYRef = useRef(0);
    const startValueRef = useRef(0);
    const normalizedValue = (value - min) / (max - min || 1);
    const rotation = -135 + normalizedValue * 270;
    const handlePointerDown = (e) => {
        setIsDragging(true);
        startYRef.current = e.clientY;
        startValueRef.current = value;
        e.target.setPointerCapture?.(e.pointerId);
        e.preventDefault();
    };
    const handlePointerMove = (ev) => {
        if (!isDragging)
            return;
        const deltaY = startYRef.current - ev.clientY;
        const range = max - min;
        const sensitivity = (range || 1) / 150;
        let newValue = startValueRef.current + deltaY * sensitivity;
        newValue = Math.min(max, Math.max(min, newValue));
        if (step)
            newValue = Math.round(newValue / step) * step;
        onChange(newValue);
    };
    const handlePointerUp = (ev) => {
        setIsDragging(false);
        ev.target.releasePointerCapture?.(ev.pointerId);
    };
    const handleDoubleClick = () => onChange(defaultValue);
    const handleKeyDown = (e) => {
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
            window.addEventListener("pointermove", handlePointerMove);
            window.addEventListener("pointerup", handlePointerUp);
            return () => {
                window.removeEventListener("pointermove", handlePointerMove);
                window.removeEventListener("pointerup", handlePointerUp);
            };
        }
    }, [isDragging]);
    return (_jsxs("div", { className: "flex flex-col items-center gap-2 select-none", children: [_jsxs("div", { "data-testid": testId, onPointerDown: handlePointerDown, onDoubleClick: handleDoubleClick, onMouseEnter: () => setIsHovered(true), onMouseLeave: () => setIsHovered(false), onKeyDown: handleKeyDown, tabIndex: 0, role: "slider", "aria-label": label, "aria-valuemin": min, "aria-valuemax": max, "aria-valuenow": value, className: `relative w-12 h-12 rounded-full cursor-grab
          bg-gradient-to-b from-muted/80 to-card border border-border/50
          flex items-center justify-center shadow-inner transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2
          ${isDragging ? "cursor-grabbing scale-105 shadow-lg" : ""}
          ${isHovered && !isDragging ? "scale-[1.02]" : ""}`, children: [_jsx("div", { className: `absolute w-1 h-4 rounded-full origin-bottom transition-colors duration-150 ${isDragging ? "bg-primary" : "bg-muted-foreground"}`, style: {
                            transform: `rotate(${rotation}deg) translateY(-6px)`,
                            top: "8px",
                        } }), _jsx("div", { className: "absolute inset-2 rounded-full bg-card border border-border/30" })] }), _jsx("span", { className: "text-sm text-muted-foreground font-medium", children: label }), _jsx("span", { className: "text-xs text-muted-foreground/70 font-mono", children: formatValue ? formatValue(value) : value.toFixed(2) })] }));
}
