/**
 * useKeyboardShortcuts.test.ts
 *
 * Environment: Node (Vitest default — no DOM globals).
 * KeyboardEvent does NOT exist in Node. All tests use a plain object cast
 * to KeyboardEvent. The handlers are vi.fn() mocks and never read the event.
 *
 * Covers:
 *   - buildDAWShortcuts map shape and all 14 handler bindings
 *   - Combo string format (Ctrl+Z, Ctrl+Shift+Z, etc.)
 *   - Fallback behaviour: map[combo] ?? map[key]
 *   - Unknown keys produce no handler call
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildDAWShortcuts, type ShortcutMap } from "../useKeyboardShortcuts";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the same combo string the hook's internal handler builds,
 * looks it up in the map, and calls the handler if found.
 * Returns true when a handler was found and called.
 *
 * Uses a plain object cast — no DOM globals required.
 */
function dispatch(
  map: ShortcutMap,
  key: string,
  modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; altKey?: boolean } = {},
): boolean {
  const parts: string[] = [];
  if (modifiers.ctrlKey || modifiers.metaKey) parts.push("Ctrl");
  if (modifiers.shiftKey) parts.push("Shift");
  if (modifiers.altKey)   parts.push("Alt");
  parts.push(key === " " ? "Space" : key);
  const combo = parts.join("+");

  // Mirror the hook's fallback: exact combo first, plain key second
  const fn = map[combo] ?? map[key];
  if (fn) {
    // Plain object cast — handlers are mocks and never read the event
    fn({ key, ...modifiers } as unknown as KeyboardEvent);
    return true;
  }
  return false;
}

// ── Shared handler mocks ──────────────────────────────────────────────────────

function makeHandlers() {
  return {
    play:            vi.fn(),
    stop:            vi.fn(),
    record:          vi.fn(),
    undo:            vi.fn(),
    redo:            vi.fn(),
    save:            vi.fn(),
    zoomIn:          vi.fn(),
    zoomOut:         vi.fn(),
    prevMarker:      vi.fn(),
    nextMarker:      vi.fn(),
    deleteSelected:  vi.fn(),
    deselectAll:     vi.fn(),
    duplicateRegion: vi.fn(),
    selectAll:       vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildDAWShortcuts — map shape", () => {
  it("returns a non-null object", () => {
    const map = buildDAWShortcuts(makeHandlers());
    expect(typeof map).toBe("object");
    expect(map).not.toBeNull();
  });

  it("every value in the map is a function", () => {
    const map = buildDAWShortcuts(makeHandlers());
    for (const fn of Object.values(map)) {
      expect(typeof fn).toBe("function");
    }
  });

  it("map contains at least 14 entries (all handlers bound)", () => {
    const map = buildDAWShortcuts(makeHandlers());
    expect(Object.keys(map).length).toBeGreaterThanOrEqual(14);
  });
});

describe("buildDAWShortcuts — handler bindings", () => {
  let handlers: ReturnType<typeof makeHandlers>;
  let map: ShortcutMap;

  beforeEach(() => {
    handlers = makeHandlers();
    map = buildDAWShortcuts(handlers);
  });

  it("Space → play", () => {
    dispatch(map, " ");
    expect(handlers.play).toHaveBeenCalledOnce();
  });

  it(". → stop", () => {
    dispatch(map, ".");
    expect(handlers.stop).toHaveBeenCalledOnce();
  });

  it("Ctrl+Z → undo", () => {
    dispatch(map, "Z", { ctrlKey: true });
    expect(handlers.undo).toHaveBeenCalledOnce();
  });

  it("Ctrl+z lowercase → undo", () => {
    dispatch(map, "z", { ctrlKey: true });
    expect(handlers.undo).toHaveBeenCalledOnce();
  });

  it("Ctrl+Y → redo", () => {
    dispatch(map, "Y", { ctrlKey: true });
    expect(handlers.redo).toHaveBeenCalledOnce();
  });

  it("Ctrl+Shift+Z → redo", () => {
    dispatch(map, "Z", { ctrlKey: true, shiftKey: true });
    expect(handlers.redo).toHaveBeenCalledOnce();
  });

  it("Ctrl+R → record", () => {
    dispatch(map, "R", { ctrlKey: true });
    expect(handlers.record).toHaveBeenCalledOnce();
  });

  it("Ctrl+S → save", () => {
    dispatch(map, "S", { ctrlKey: true });
    expect(handlers.save).toHaveBeenCalledOnce();
  });

  it("Ctrl+A → selectAll", () => {
    dispatch(map, "A", { ctrlKey: true });
    expect(handlers.selectAll).toHaveBeenCalledOnce();
  });

  it("Ctrl+D → duplicateRegion", () => {
    dispatch(map, "D", { ctrlKey: true });
    expect(handlers.duplicateRegion).toHaveBeenCalledOnce();
  });

  it("+ → zoomIn", () => {
    dispatch(map, "+");
    expect(handlers.zoomIn).toHaveBeenCalledOnce();
  });

  it("= → zoomIn", () => {
    dispatch(map, "=");
    expect(handlers.zoomIn).toHaveBeenCalledOnce();
  });

  it("- → zoomOut", () => {
    dispatch(map, "-");
    expect(handlers.zoomOut).toHaveBeenCalledOnce();
  });

  it("[ → prevMarker", () => {
    dispatch(map, "[");
    expect(handlers.prevMarker).toHaveBeenCalledOnce();
  });

  it("] → nextMarker", () => {
    dispatch(map, "]");
    expect(handlers.nextMarker).toHaveBeenCalledOnce();
  });

  it("Delete → deleteSelected", () => {
    dispatch(map, "Delete");
    expect(handlers.deleteSelected).toHaveBeenCalledOnce();
  });

  it("Backspace → deleteSelected", () => {
    dispatch(map, "Backspace");
    expect(handlers.deleteSelected).toHaveBeenCalledOnce();
  });

  it("Escape → deselectAll", () => {
    dispatch(map, "Escape");
    expect(handlers.deselectAll).toHaveBeenCalledOnce();
  });

  it("Space fires play, not stop or undo", () => {
    dispatch(map, " ");
    expect(handlers.play).toHaveBeenCalledOnce();
    expect(handlers.stop).not.toHaveBeenCalled();
    expect(handlers.undo).not.toHaveBeenCalled();
  });

  it("unknown key F12 → no handler called, returns false", () => {
    const found = dispatch(map, "F12");
    expect(found).toBe(false);
    for (const fn of Object.values(handlers)) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});

describe("ShortcutMap — combo string fallback logic", () => {
  it("exact combo Ctrl+Shift+Z matches before plain Z", () => {
    const redo = vi.fn();
    const other = vi.fn();
    const map: ShortcutMap = { "Ctrl+Shift+Z": redo, "Z": other };
    dispatch(map, "Z", { ctrlKey: true, shiftKey: true });
    expect(redo).toHaveBeenCalledOnce();
    expect(other).not.toHaveBeenCalled();
  });

  it("plain key matches when no combo entry exists", () => {
    const handler = vi.fn();
    const map: ShortcutMap = { "Z": handler };
    dispatch(map, "Z");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("fallback to plain key when combo not in map", () => {
    const handler = vi.fn();
    // Only "Z" in map, not "Ctrl+Z"
    const map: ShortcutMap = { "Z": handler };
    dispatch(map, "Z", { ctrlKey: true });
    // map["Ctrl+Z"] is undefined → falls back to map["Z"] → called
    expect(handler).toHaveBeenCalledOnce();
  });

  it("no match when neither combo nor plain key is in map", () => {
    const handler = vi.fn();
    const map: ShortcutMap = { "A": handler };
    const found = dispatch(map, "Z", { ctrlKey: true });
    expect(found).toBe(false);
    expect(handler).not.toHaveBeenCalled();
  });
});
