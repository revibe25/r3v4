import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useLayoutEffect, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
export const CollapsibleFXPanel = ({ title, icon, children, defaultOpen = false, variant = 'default', className, maxHeight, scrollable = false, }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const uid = useId();
    const headerId = `cfxp-btn-${uid}`;
    const regionId = `cfxp-region-${uid}`;
    // Refs for measured-height animation
    const wrapperRef = useRef(null);
    const contentRef = useRef(null);
    // Once opened for the first time, children stay mounted to preserve audio state
    const hasBeenOpenedRef = useRef(defaultOpen);
    if (isOpen)
        hasBeenOpenedRef.current = true;
    // Measured height: fires synchronously after DOM update, before paint — no flicker
    useLayoutEffect(() => {
        const wrapper = wrapperRef.current;
        const content = contentRef.current;
        if (!wrapper || !content)
            return;
        if (isOpen) {
            wrapper.style.maxHeight = `${content.scrollHeight}px`;
            wrapper.style.opacity = '1';
        }
        else {
            // Snapshot current height first so the collapse animation starts from the right place
            wrapper.style.maxHeight = `${wrapper.scrollHeight}px`;
            // Force a reflow so the browser registers the starting value before we set the target
            wrapper.getBoundingClientRect();
            wrapper.style.maxHeight = '0px';
            wrapper.style.opacity = '0';
        }
    }, [isOpen]);
    // When children change size (e.g. dynamic content), keep maxHeight in sync
    useLayoutEffect(() => {
        const wrapper = wrapperRef.current;
        const content = contentRef.current;
        if (!wrapper || !content || !isOpen)
            return;
        wrapper.style.maxHeight = `${content.scrollHeight}px`;
    });
    const variantStyles = {
        default: {
            container: 'bg-card/50 backdrop-blur-sm border border-border rounded-lg',
            header: 'px-4 py-3',
            content: 'px-4 pb-4 pt-2',
        },
        compact: {
            container: 'bg-card/30 backdrop-blur-sm border border-border/50 rounded-md',
            header: 'px-3 py-2',
            content: 'px-3 pb-3 pt-1',
        },
        minimal: {
            container: 'border-b border-border/30',
            header: 'px-2 py-2',
            content: 'px-2 pb-2 pt-1',
        },
    };
    const styles = variantStyles[variant];
    return (_jsxs("div", { className: cn(styles.container, className), children: [_jsxs("button", { id: headerId, onClick: () => setIsOpen(prev => !prev), className: cn(styles.header, 'w-full flex items-center justify-between', 'text-left font-medium text-sm', 'hover:bg-accent/50 transition-colors duration-200', 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background', variant !== 'minimal' && 'rounded-t-lg', 'active:scale-[0.98]'), "aria-expanded": isOpen, "aria-controls": regionId, children: [_jsxs("div", { className: "flex items-center gap-2", children: [icon && (_jsx("span", { className: "text-muted-foreground flex-shrink-0", "aria-hidden": "true", children: icon })), _jsx("span", { className: "text-foreground", children: title })] }), _jsx(ChevronDown, { className: cn('h-4 w-4 flex-shrink-0 ml-2 text-muted-foreground', 'transition-transform duration-200', isOpen ? 'rotate-0' : '-rotate-90'), "aria-hidden": "true" })] }), _jsx("div", { ref: wrapperRef, id: regionId, role: "region", "aria-labelledby": headerId, style: {
                    maxHeight: defaultOpen ? undefined : '0px',
                    opacity: defaultOpen ? 1 : 0,
                    overflow: 'hidden',
                    // Matches PRD: cubic-bezier(.4,0,.2,1) for material-style easing
                    transition: 'max-height 280ms cubic-bezier(.4,0,.2,1), opacity 200ms ease',
                    willChange: 'max-height',
                    // Respect reduced-motion preference
                }, className: "[@media(prefers-reduced-motion:reduce)]:transition-none", children: _jsx("div", { ref: contentRef, className: styles.content, children: hasBeenOpenedRef.current
                        ? scrollable
                            ? (_jsx("div", { className: "ag-panel-scroll", style: {
                                    maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : (maxHeight ?? '320px'),
                                    overflowY: 'auto',
                                    overflowX: 'hidden',
                                    paddingRight: 2,
                                }, children: children }))
                            : children
                        : null }) })] }));
};
export const FXSection = ({ title, children, className }) => (_jsxs("div", { className: cn('space-y-2', className), children: [title && (_jsx("h3", { className: "text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3", children: title })), _jsx("div", { className: "space-y-1", children: children })] }));
export const CompactKnob = ({ label, value, onChange, min = 0, max = 100, step = 1, unit = '', disabled = false, }) => {
    const normalizedValue = (value - min) / (max - min);
    const rotationAngle = normalizedValue * 270 - 135;
    const displayValue = step < 1 ? value.toFixed(1) : Math.round(value).toString();
    return (_jsxs("div", { className: cn('flex flex-col items-center gap-1.5 min-w-[60px]', disabled && 'opacity-50 pointer-events-none'), children: [_jsx("label", { className: "text-xs text-muted-foreground font-medium truncate max-w-full", children: label }), _jsxs("div", { className: "relative w-12 h-12", children: [_jsx("div", { className: "absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border-2 border-primary/30 shadow-inner" }), _jsx("div", { className: "absolute top-1/2 left-1/2 w-0.5 h-5 bg-primary rounded-full shadow-lg transition-transform duration-75", style: {
                            transform: `translate(-50%, -100%) rotate(${rotationAngle}deg)`,
                            transformOrigin: 'bottom center',
                        } }), _jsx("input", { type: "range", min: min, max: max, step: step, value: value, onChange: (e) => onChange(parseFloat(e.target.value)), disabled: disabled, className: "absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed", "aria-label": label })] }), _jsxs("span", { className: "text-xs font-mono text-foreground/90 tabular-nums", children: [displayValue, unit && _jsx("span", { className: "text-muted-foreground ml-0.5", children: unit })] })] }));
};
export const CompactSlider = ({ label, value, onChange, min = 0, max = 100, step = 1, unit = '', disabled = false, }) => {
    const displayValue = step < 1 ? value.toFixed(1) : Math.round(value).toString();
    return (_jsxs("div", { className: cn('flex items-center gap-3', disabled && 'opacity-50 pointer-events-none'), children: [_jsx("label", { className: "text-xs text-muted-foreground font-medium min-w-[60px]", children: label }), _jsx("div", { className: "flex-1 relative", children: _jsx("input", { type: "range", min: min, max: max, step: step, value: value, onChange: (e) => onChange(parseFloat(e.target.value)), disabled: disabled, className: cn('w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer', 'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background', '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4', '[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary', '[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform', '[&::-webkit-slider-thumb]:hover:scale-110', '[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full', '[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border-0', '[&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:transition-transform', '[&::-moz-range-thumb]:hover:scale-110', 'disabled:cursor-not-allowed'), "aria-label": label }) }), _jsxs("span", { className: "text-xs font-mono text-foreground/90 min-w-[45px] text-right tabular-nums", children: [displayValue, unit && _jsx("span", { className: "text-muted-foreground ml-0.5", children: unit })] })] }));
};
