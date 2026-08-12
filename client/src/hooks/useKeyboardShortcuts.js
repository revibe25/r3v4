import { useEffect } from 'react';
/**
 * Hook for managing keyboard shortcuts across the DAW.
 * Prevents event handling when user is typing in inputs.
 *
 * @example
 * useKeyboardShortcuts({
 *   enabled: isInitialized,
 *   shortcuts: { pads: [...], keys: [...], onPadTrigger, ... },
 *   state: { pads: state.pads, keys: state.keys }
 * });
 */
export function useKeyboardShortcuts({ enabled, shortcuts, state, }) {
    useEffect(() => {
        if (!enabled)
            return;
        const handleKeyDown = (e) => {
            // Ignore if typing in input/textarea
            if (e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement) {
                return;
            }
            const k = e.key.toUpperCase();
            // Pad shortcuts (Q–], default 12 pads)
            const padIndex = shortcuts.pads.indexOf(k);
            if (padIndex !== -1 && state.pads[padIndex]) {
                e.preventDefault();
                shortcuts.onPadTrigger(padIndex);
                return;
            }
            // Key shortcuts (Z–M, default 12 keys)
            const keyIndex = shortcuts.keys.indexOf(k);
            if (keyIndex !== -1 && state.keys[keyIndex]) {
                e.preventDefault();
                shortcuts.onKeyTrigger(keyIndex);
                return;
            }
            // Transport & utility shortcuts
            const mod = e.ctrlKey || e.metaKey;
            if (e.code === 'Space') {
                e.preventDefault();
                shortcuts.onPlay();
            }
            else if (e.code === 'Escape') {
                e.preventDefault();
                shortcuts.onStop();
            }
            else if (mod && e.code === 'KeyA') {
                e.preventDefault();
                shortcuts.onArm();
            }
            else if (mod && e.code === 'KeyR') {
                e.preventDefault();
                shortcuts.onRecord();
            }
            else if (mod && e.code === 'KeyZ' && !e.shiftKey) {
                e.preventDefault();
                shortcuts.onUndo();
            }
            else if ((mod && e.code === 'KeyZ' && e.shiftKey) ||
                (mod && e.code === 'KeyY')) {
                e.preventDefault();
                shortcuts.onRedo();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [enabled, shortcuts, state]);
}
