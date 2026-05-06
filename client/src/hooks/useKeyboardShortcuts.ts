/**
 * useKeyboardShortcuts — centralised DAW hotkey system.
 * Register once at the ArrangementPage level; all panels respond.
 */
import { useEffect, useCallback, useRef } from "react";

export type ShortcutMap = Record<string, (e: KeyboardEvent) => void>;

export interface ShortcutOptions {
  /** Disable shortcuts while typing in an input/textarea */
  respectInputFocus?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: ShortcutMap,
  options: ShortcutOptions = { respectInputFocus: true },
) {
  // Keep a stable ref so callers can pass inline objects without re-registering
  const mapRef = useRef<ShortcutMap>(shortcuts);
  useEffect(() => { mapRef.current = shortcuts; }, [shortcuts]);

  const handler = useCallback((e: KeyboardEvent) => {
    if (options.respectInputFocus) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    }

    const parts: string[] = [];
    if (e.ctrlKey  || e.metaKey)  parts.push("Ctrl");
    if (e.shiftKey)                parts.push("Shift");
    if (e.altKey)                  parts.push("Alt");
    // Normalise key: space → "Space", arrow → "ArrowLeft", etc.
    const key = e.key === " " ? "Space" : e.key;
    parts.push(key);
    const combo = parts.join("+");

    const fn = mapRef.current[combo] ?? mapRef.current[key];
    if (fn) {
      e.preventDefault();
      fn(e);
    }
  }, [options.respectInputFocus]);

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);
}

/** Pre-built DAW shortcut map — pass your transport handlers */
export function buildDAWShortcuts(handlers: {
  play:            () => void;
  stop:            () => void;
  record:          () => void;
  undo:            () => void;
  redo:            () => void;
  save:            () => void;
  zoomIn:          () => void;
  zoomOut:         () => void;
  prevMarker:      () => void;
  nextMarker:      () => void;
  deleteSelected:  () => void;
  deselectAll:     () => void;
  duplicateRegion: () => void;
  selectAll:       () => void;
}): ShortcutMap {
  return {
    "Space":          () => handlers.play(),
    ".":              () => handlers.stop(),
    "Ctrl+z":         () => handlers.undo(),
    "Ctrl+Z":         () => handlers.undo(),
    "Ctrl+y":         () => handlers.redo(),
    "Ctrl+Y":         () => handlers.redo(),
    "Ctrl+Shift+z":   () => handlers.redo(),
    "Ctrl+Shift+Z":   () => handlers.redo(),
    "Ctrl+r":         () => handlers.record(),
    "Ctrl+R":         () => handlers.record(),
    "Ctrl+s":         () => handlers.save(),
    "Ctrl+S":         () => handlers.save(),
    "Ctrl+a":         () => handlers.selectAll(),
    "Ctrl+A":         () => handlers.selectAll(),
    "Ctrl+d":         () => handlers.duplicateRegion(),
    "Ctrl+D":         () => handlers.duplicateRegion(),
    "+":              () => handlers.zoomIn(),
    "=":              () => handlers.zoomIn(),
    "-":              () => handlers.zoomOut(),
    "[":              () => handlers.prevMarker(),
    "]":              () => handlers.nextMarker(),
    "Delete":         () => handlers.deleteSelected(),
    "Backspace":      () => handlers.deleteSelected(),
    "Escape":         () => handlers.deselectAll(),
  };
}
