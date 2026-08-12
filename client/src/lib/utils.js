// FILE: client/src/lib/utils.ts
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
// ─── Core ────────────────────────────────────────────────────────────────────
/**
 * Merge Tailwind classes safely, resolving conflicts (e.g. `p-2` + `p-4` → `p-4`).
 * Accepts any value clsx understands: strings, objects, arrays, falsy values.
 *
 * @example
 * cn('px-2 py-1', isActive && 'bg-blue-500', { 'opacity-50': disabled })
 */
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
/**
 * Build a type-safe variant utility — a lightweight alternative to CVA.
 *
 * @example
 * const button = variants({
 *   base: 'inline-flex items-center rounded',
 *   variants: {
 *     intent: { primary: 'bg-blue-500 text-white', ghost: 'bg-transparent' },
 *     size:   { sm: 'h-8 px-3 text-sm', md: 'h-10 px-4' },
 *   },
 *   defaultVariants: { intent: 'primary', size: 'md' },
 * });
 *
 * button({ intent: 'ghost', size: 'sm' })  // → merged class string
 */
export function variants(config) {
    return (props) => {
        const { className, ...variantProps } = props ?? {};
        const variantClasses = Object.entries(config.variants).map(([key, options]) => {
            const value = variantProps[key] ??
                config.defaultVariants?.[key];
            return value !== undefined ? options[value] : undefined;
        });
        const compoundClasses = (config.compoundVariants ?? [])
            .filter((compound) => {
            const { className: _c, ...conditions } = compound;
            return Object.entries(conditions).every(([k, v]) => {
                const active = variantProps[k] ??
                    config.defaultVariants?.[k];
                return active === v;
            });
        })
            .map((c) => c.className);
        return cn(config.base, ...variantClasses, ...compoundClasses, className);
    };
}
// ─── Conditional helpers ──────────────────────────────────────────────────────
/**
 * Return `whenTrue` classes when `condition` is truthy, `whenFalse` otherwise.
 *
 * @example
 * cif(isOpen, 'opacity-100 translate-y-0', 'opacity-0 -translate-y-2')
 */
export function cif(condition, whenTrue, whenFalse = '') {
    return cn(condition ? whenTrue : whenFalse);
}
/**
 * Pick a class from a map by key — useful for status/state colouring.
 *
 * @example
 * cmap(status, {
 *   success: 'text-green-500',
 *   error:   'text-red-500',
 *   loading: 'text-yellow-500',
 * })
 */
export function cmap(key, map, fallback = '') {
    return cn(key != null ? (map[key] ?? fallback) : fallback);
}
// ─── Animation helpers ────────────────────────────────────────────────────────
/**
 * Common enter/leave transition pair — pass to Headless UI / Radix `asChild`
 * or spread manually.
 *
 * @example
 * const cls = transition('fade');
 * // cls.base, cls.from, cls.to
 */
const TRANSITIONS = {
    fade: { base: 'transition-opacity duration-200', from: 'opacity-0', to: 'opacity-100' },
    scale: { base: 'transition-transform duration-200 origin-top-left', from: 'scale-95 opacity-0', to: 'scale-100 opacity-100' },
    slideDown: { base: 'transition-all duration-200', from: '-translate-y-2 opacity-0', to: 'translate-y-0 opacity-100' },
    slideUp: { base: 'transition-all duration-200', from: 'translate-y-2 opacity-0', to: 'translate-y-0 opacity-100' },
    slideRight: { base: 'transition-all duration-200', from: '-translate-x-2 opacity-0', to: 'translate-x-0 opacity-100' },
};
export function transition(preset) {
    return TRANSITIONS[preset];
}
// ─── Style object helpers ─────────────────────────────────────────────────────
/**
 * Merge plain React `style` objects, filtering out undefined values.
 * Mirrors what `cn` does but for inline styles.
 *
 * @example
 * smerge({ color: 'red' }, isActive && { fontWeight: 700 })
 */
export function smerge(...styles) {
    return Object.assign({}, ...styles.filter(Boolean));
}
// ─── Re-exports ───────────────────────────────────────────────────────────────
// Keep clsx/twMerge available to callers that want to compose further
// without adding another import.
export { clsx, twMerge };
