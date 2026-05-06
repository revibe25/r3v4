/**
 * useAutoSave — debounced auto-save for the arrangement store.
 * - Marks dirty on any store change
 * - Saves via tRPC after `debounceMs` of inactivity
 * - Guards browser unload when dirty
 * - Returns { saving, dirty, lastSaved, saveNow }
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { useArrangementStore } from "@/store/arrangement-store";

export interface AutoSaveState {
  saving:    boolean;
  dirty:     boolean;
  lastSaved: Date | null;
  saveNow:   () => Promise<void>;
  error:     string | null;
}

export function useAutoSave(
  arrangementId: string | null,
  debounceMs = 3000,
): AutoSaveState {
  const [saving,    setSaving]    = useState(false);
  const [dirty,     setDirty]     = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef  = useRef(true);

  const update = trpc.arrangement.update.useMutation();

  const doSave = useCallback(async () => {
    if (!arrangementId || !mountedRef.current) return;
    const store = useArrangementStore.getState();
    setSaving(true); setError(null);
    try {
      await update.mutateAsync({
        id: arrangementId,
        patch: {
          name:          store.name,
          tempo:         store.tempo,
          timeSignature: store.timeSignature,
          lengthBars:    store.lengthBars,
        },
      });
      if (mountedRef.current) {
        setDirty(false);
        setLastSaved(new Date());
      }
    } catch (e: unknown) {
      if (mountedRef.current) {
        setError(e instanceof Error ? e.message : "Save failed");
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  }, [arrangementId, update]);

  // Subscribe to store changes — mark dirty and schedule debounced save
  useEffect(() => {
    if (!arrangementId) return;
    const unsub = useArrangementStore.subscribe(
      state => ({
        tracks: state.tracks,
        tempo:  state.tempo,
        name:   state.name,
        markers: state.markers,
      }),
      () => {
        setDirty(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => { doSave(); }, debounceMs);
      },
      { equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b) }
    );
    return () => { unsub(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, [arrangementId, debounceMs, doSave]);

  // Browser unload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return { saving, dirty, lastSaved, saveNow: doSave, error };
}
