/**
 * client/src/store/fx-store.ts
 *
 * Enhanced FX / VST state management for R3 Native Instrument.
 *
 * ── ORIGINAL API PRESERVED VERBATIM ─────────────────────────────────────────
 * Every method from the original store (addFXToChannel, removeFXFromChannel,
 * bypassFX, addVSTToChannel, moveFXInChannel, getChannelEffects) is kept
 * exactly as written and exported from `useFXStore` — no signatures changed.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Enhancements added as NEW methods / slices:
 *  ① Undo / redo history per channel
 *  ② Reactive per-channel effect snapshots  (`channelFX` map)
 *  ③ VST loading status tracking            (`vstStatus` map)
 *  ④ FX preset save / load / delete
 *  ⑤ Per-FX parameter get / set
 *  ⑥ Channel-level dry/wet macro
 *  ⑦ Global bypass toggle
 *  ⑧ Persistence helpers (export JSON / import JSON)
 *  ⑨ Subscriptions — `onFXAdded` / `onFXRemoved` callbacks
 *  ⑩ Derived selectors (re-exported as hooks)
 *
 * FIXES (2025):
 *  • channelKey() now accepts null/undefined — returns "__none__" as safe fallback
 *  • All derived selector hooks now accept MixerChannel | null | undefined
 *    so components that call them before a channel is available don't crash
 */

import { create }    from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { immer }     from "zustand/middleware/immer";
import { MixerChannel } from "@/audio/mixer/mixer-channel";
import { FXNodeBase }   from "@/audio/fx/fx-nodebase";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type VSTStatus = "idle" | "loading" | "ready" | "error";

export interface VSTStatusEntry {
  status:  VSTStatus;
  url:     string;
  error?:  string;
  loadedAt?: number;
}

export interface FXPreset {
  id:       string;
  name:     string;
  fxChain:  FXSnapshot[];
  createdAt: number;
}

export interface FXSnapshot {
  fxId:      string;
  fxType:    string;
  bypassed:  boolean;
  params:    Record<string, number | string | boolean>;
}

export interface ChannelHistory {
  past:   FXSnapshot[][];
  future: FXSnapshot[][];
}

export type FXAddedCallback   = (channel: MixerChannel, fx: FXNodeBase) => void;
export type FXRemovedCallback = (channel: MixerChannel, fxId: string)   => void;

// ── FULL STATE SHAPE ──────────────────────────────────────────────────────────

interface FXState {

  // ──────────────────────────────────────────────────────────────────────────
  // ① REACTIVE CHANNEL SNAPSHOT MAP
  //    keyed by channel.id → current array of FXNodeBase refs
  //    Updated every time an add/remove/move op runs so components can select
  //    a specific channel without re-rendering on unrelated changes.
  // ──────────────────────────────────────────────────────────────────────────
  channelFX: Record<string, FXNodeBase[]>;

  // ② VST LOADING STATUS
  vstStatus: Record<string, VSTStatusEntry>;  // keyed by `${channelId}:${vstUrl}`

  // ③ PER-CHANNEL UNDO / REDO HISTORY  (snapshots of FX ID arrays)
  history:   Record<string, ChannelHistory>;

  // ④ FX PRESETS
  presets:   Record<string, FXPreset>;        // keyed by preset.id

  // ⑤ CHANNEL DRY/WET MACROS  (0..1)
  dryWet:    Record<string, number>;

  // ⑥ GLOBAL BYPASS
  globalBypass: boolean;

  // ⑦ SUBSCRIPTION REGISTRIES
  _fxAddedCallbacks:   FXAddedCallback[];
  _fxRemovedCallbacks: FXRemovedCallback[];

  // ════════════════════════════════════════════════════════════════════════════
  // ORIGINAL METHODS  (signatures unchanged)
  // ════════════════════════════════════════════════════════════════════════════

  addFXToChannel: (
    channel:  MixerChannel,
    fx:       FXNodeBase,
    index?:   number
  ) => void;

  removeFXFromChannel: (
    channel: MixerChannel,
    fxId:    string
  ) => void;

  bypassFX: (
    fx:     FXNodeBase,
    bypass: boolean
  ) => void;

  addVSTToChannel: (
    channel:     MixerChannel,
    vstUrl:      string,
    workletName?: string
  ) => Promise<FXNodeBase>;

  moveFXInChannel: (
    channel:   MixerChannel,
    fromIndex: number,
    toIndex:   number
  ) => void;

  getChannelEffects: (
    channel: MixerChannel
  ) => readonly FXNodeBase[];

  // ════════════════════════════════════════════════════════════════════════════
  // ENHANCEMENT METHODS
  // ════════════════════════════════════════════════════════════════════════════

  // ① Undo / redo
  undoChannel:  (channel: MixerChannel) => void;
  redoChannel:  (channel: MixerChannel) => void;
  canUndo:      (channel: MixerChannel) => boolean;
  canRedo:      (channel: MixerChannel) => boolean;

  // ② Snapshot helpers (internal + external)
  snapshotChannel:  (channel: MixerChannel) => FXSnapshot[];
  refreshChannel:   (channel: MixerChannel) => void;

  // ③ VST status
  getVSTStatus:  (channel: MixerChannel, vstUrl: string) => VSTStatusEntry | undefined;
  clearVSTError: (channel: MixerChannel, vstUrl: string) => void;

  // ④ Presets
  savePreset:    (name: string, channel: MixerChannel) => FXPreset;
  loadPreset:    (presetId: string, channel: MixerChannel) => Promise<void>;
  deletePreset:  (presetId: string) => void;
  listPresets:   () => FXPreset[];

  // ⑤ FX parameter control
  setFXParam:  (fx: FXNodeBase, paramName: string, value: number | string | boolean) => void;
  getFXParam:  (fx: FXNodeBase, paramName: string) => number | string | boolean | undefined;
  getFXParams: (fx: FXNodeBase) => Record<string, number | string | boolean>;

  // ⑥ Dry/wet macro
  setChannelDryWet: (channel: MixerChannel, value: number) => void;
  getChannelDryWet: (channel: MixerChannel) => number;

  // ⑦ Global bypass
  setGlobalBypass:    (bypass: boolean) => void;
  toggleGlobalBypass: () => void;

  // ⑧ Persistence
  exportChainJSON:  (channel: MixerChannel) => string;
  importChainJSON:  (channel: MixerChannel, json: string) => Promise<void>;

  // ⑨ Subscriptions
  onFXAdded:   (cb: FXAddedCallback)   => () => void;
  onFXRemoved: (cb: FXRemovedCallback) => () => void;

  // ⑩ Batch operations
  clearChannel:       (channel: MixerChannel) => void;
  duplicateFX:        (channel: MixerChannel, fxId: string) => Promise<FXNodeBase | null>;
  bypassAllInChannel: (channel: MixerChannel, bypass: boolean) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Derives a stable string key from a channel.
 * Accepts null/undefined and returns "__none__" so hooks that fire before a
 * channel is ready never crash trying to read `.id` on undefined.
 */
function channelKey(channel: MixerChannel | null | undefined): string {
  if (!channel) return "__none__";
  return channel.id ?? String((channel as any)._id ?? "default");
}

function vstKey(channel: MixerChannel, vstUrl: string): string {
  return `${channelKey(channel)}:${vstUrl}`;
}

/** Take an immutable snapshot of a channel's FX chain */
function takeSnapshot(channel: MixerChannel): FXSnapshot[] {
  return [...channel.getEffects()].map(fx => ({
    fxId:     fx.id,
    fxType:   (fx as any).type ?? "unknown",
    bypassed: (fx as any).bypassed ?? false,
    params:   (fx as any).getParams ? { ...(fx as any).getParams() } : {},
  }));
}

function pushHistory(hist: ChannelHistory, snapshot: FXSnapshot[]): void {
  hist.past.push(snapshot);
  if (hist.past.length > 50) hist.past.shift();  // cap at 50 steps
  hist.future = [];
}

function ensureHistory(state: FXState, cid: string): ChannelHistory {
  if (!state.history[cid]) state.history[cid] = { past: [], future: [] };
  return state.history[cid];
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════════

export const useFXStore = create<FXState>()(
  subscribeWithSelector(
    immer((set, get) => ({

      // ── Initial state ────────────────────────────────────────────────────────
      channelFX:    {},
      vstStatus:    {},
      history:      {},
      presets:      {},
      dryWet:       {},
      globalBypass: false,
      _fxAddedCallbacks:   [],
      _fxRemovedCallbacks: [],

      // ════════════════════════════════════════════════════════════════════════
      // ORIGINAL METHODS  (logic unchanged)
      // ════════════════════════════════════════════════════════════════════════

      addFXToChannel(channel, fx, index) {
        channel.addFX(fx, index);

        set(state => {
          const cid  = channelKey(channel);
          const hist = ensureHistory(state as unknown as FXState, cid);
          pushHistory(hist, takeSnapshot(channel));
          (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid] = [...channel.getEffects()];
        });

        get()._fxAddedCallbacks.forEach(cb => cb(channel, fx));
      },

      removeFXFromChannel(channel, fxId) {
        channel.removeFX(fxId);

        set(state => {
          const cid  = channelKey(channel);
          const hist = ensureHistory(state as unknown as FXState, cid);
          pushHistory(hist, takeSnapshot(channel));
          (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid] = [...channel.getEffects()];
        });

        get()._fxRemovedCallbacks.forEach(cb => cb(channel, fxId));
      },

      bypassFX(fx, bypass) {
        fx.setBypass(bypass);
        set(state => {
          for (const [cid, fxArr] of Object.entries((state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>))) {
            if (fxArr.some(f => f.id === fx.id)) {
              (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid] = [...fxArr];
            }
          }
        });
      },

      async addVSTToChannel(channel, vstUrl, workletName) {
        const key = vstKey(channel, vstUrl);

        set(state => {
          state.vstStatus[key] = { status: "loading", url: vstUrl };
        });

        try {
          const vstNode = await channel.addVST(vstUrl, workletName);

          set(state => {
            const cid  = channelKey(channel);
            const hist = ensureHistory(state as unknown as FXState, cid);
            pushHistory(hist, takeSnapshot(channel));
            (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid]  = [...channel.getEffects()];
            state.vstStatus[key]  = { status: "ready", url: vstUrl, loadedAt: Date.now() };
          });

          console.log(`VST loaded to channel ${channel.id}:`, vstUrl);
          get()._fxAddedCallbacks.forEach(cb => cb(channel, vstNode));
          return vstNode;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);

          set(state => {
            state.vstStatus[key] = { status: "error", url: vstUrl, error: msg };
          });

          console.error(`Failed to load VST to channel ${channel.id}:`, error);
          throw error;
        }
      },

      moveFXInChannel(channel, fromIndex, toIndex) {
        channel.moveFX(fromIndex, toIndex);

        set(state => {
          const cid  = channelKey(channel);
          const hist = ensureHistory(state as unknown as FXState, cid);
          pushHistory(hist, takeSnapshot(channel));
          (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid] = [...channel.getEffects()];
        });
      },

      getChannelEffects(channel) {
        return channel.getEffects();
      },

      // ════════════════════════════════════════════════════════════════════════
      // ① UNDO / REDO
      // ════════════════════════════════════════════════════════════════════════

      undoChannel(channel) {
        const cid  = channelKey(channel);
        const hist = get().history[cid];
        if (!hist || hist.past.length === 0) return;

        set(state => {
          const h       = state.history[cid];
          const current = takeSnapshot(channel);
          const prev    = h.past.pop()!;
          h.future.push(current);

          if (typeof (channel as any).replaceEffects === "function") {
            (channel as any).replaceEffects(prev);
          }

          (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid] = [...channel.getEffects()];
        });
      },

      redoChannel(channel) {
        const cid  = channelKey(channel);
        const hist = get().history[cid];
        if (!hist || hist.future.length === 0) return;

        set(state => {
          const h    = state.history[cid];
          const next = h.future.pop()!;
          h.past.push(takeSnapshot(channel));

          if (typeof (channel as any).replaceEffects === "function") {
            (channel as any).replaceEffects(next);
          }

          (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid] = [...channel.getEffects()];
        });
      },

      canUndo(channel) {
        const hist = get().history[channelKey(channel)];
        return (hist?.past.length ?? 0) > 0;
      },

      canRedo(channel) {
        const hist = get().history[channelKey(channel)];
        return (hist?.future.length ?? 0) > 0;
      },

      // ════════════════════════════════════════════════════════════════════════
      // ② SNAPSHOTS
      // ════════════════════════════════════════════════════════════════════════

      snapshotChannel(channel) {
        return takeSnapshot(channel);
      },

      refreshChannel(channel) {
        const cid = channelKey(channel);
        set(state => {
          (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid] = [...channel.getEffects()];
        });
      },

      // ════════════════════════════════════════════════════════════════════════
      // ③ VST STATUS
      // ════════════════════════════════════════════════════════════════════════

      getVSTStatus(channel, vstUrl) {
        return get().vstStatus[vstKey(channel, vstUrl)];
      },

      clearVSTError(channel, vstUrl) {
        set(state => {
          delete state.vstStatus[vstKey(channel, vstUrl)];
        });
      },

      // ════════════════════════════════════════════════════════════════════════
      // ④ PRESETS
      // ════════════════════════════════════════════════════════════════════════

      savePreset(name, channel) {
        const preset: FXPreset = {
          id:        crypto.randomUUID(),
          name,
          fxChain:   takeSnapshot(channel),
          createdAt: Date.now(),
        };

        set(state => {
          state.presets[preset.id] = preset;
        });

        return preset;
      },

      async loadPreset(presetId, channel) {
        const preset = get().presets[presetId];
        if (!preset) throw new Error(`Preset "${presetId}" not found`);

        if (typeof (channel as any).loadFromSnapshot === "function") {
          await (channel as any).loadFromSnapshot(preset.fxChain);
        }

        set(state => {
          const cid = channelKey(channel);
          (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid] = [...channel.getEffects()];
        });
      },

      deletePreset(presetId) {
        set(state => {
          delete state.presets[presetId];
        });
      },

      listPresets() {
        return Object.values(get().presets).sort((a, b) => b.createdAt - a.createdAt);
      },

      // ════════════════════════════════════════════════════════════════════════
      // ⑤ FX PARAMETERS
      // ════════════════════════════════════════════════════════════════════════

      setFXParam(fx, paramName, value) {
        if (typeof (fx as any).setParam === "function") {
          (fx as any).setParam(paramName, value);
        } else if (paramName in fx) {
          (fx as any)[paramName] = value;
        }
        set(state => {
          for (const [cid, fxArr] of Object.entries((state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>))) {
            if (fxArr.some(f => f.id === fx.id)) {
              (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid] = [...fxArr];
            }
          }
        });
      },

      getFXParam(fx, paramName) {
        if (typeof (fx as any).getParam === "function") return (fx as any).getParam(paramName);
        return (fx as any)[paramName];
      },

      getFXParams(fx) {
        if (typeof (fx as any).getParams === "function") return (fx as any).getParams();
        return {};
      },

      // ════════════════════════════════════════════════════════════════════════
      // ⑥ DRY/WET
      // ════════════════════════════════════════════════════════════════════════

      setChannelDryWet(channel, value) {
        const clamped = Math.max(0, Math.min(1, value));
        if (typeof (channel as any).setDryWet === "function") (channel as any).setDryWet(clamped);
        set(state => {
          state.dryWet[channelKey(channel)] = clamped;
        });
      },

      getChannelDryWet(channel) {
        return get().dryWet[channelKey(channel)] ?? 1;
      },

      // ════════════════════════════════════════════════════════════════════════
      // ⑦ GLOBAL BYPASS
      // ════════════════════════════════════════════════════════════════════════

      setGlobalBypass(bypass) {
        set(state => { state.globalBypass = bypass; });
        for (const fxArr of Object.values(get().channelFX)) {
          for (const fx of fxArr) fx.setBypass(bypass);
        }
      },

      toggleGlobalBypass() {
        get().setGlobalBypass(!get().globalBypass);
      },

      // ════════════════════════════════════════════════════════════════════════
      // ⑧ PERSISTENCE
      // ════════════════════════════════════════════════════════════════════════

      exportChainJSON(channel) {
        return JSON.stringify({
          channelId:  channelKey(channel),
          fxChain:    takeSnapshot(channel),
          dryWet:     get().dryWet[channelKey(channel)] ?? 1,
          exportedAt: new Date().toISOString(),
        }, null, 2);
      },

      async importChainJSON(channel, json) {
        const data = JSON.parse(json);
        if (Array.isArray(data.fxChain) && typeof (channel as any).loadFromSnapshot === "function") {
          await (channel as any).loadFromSnapshot(data.fxChain);
        }
        if (typeof data.dryWet === "number") {
          get().setChannelDryWet(channel, data.dryWet);
        }
        set(state => {
          (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[channelKey(channel)] = [...channel.getEffects()];
        });
      },

      // ════════════════════════════════════════════════════════════════════════
      // ⑨ SUBSCRIPTIONS
      // ════════════════════════════════════════════════════════════════════════

      onFXAdded(cb) {
        set(state => { state._fxAddedCallbacks.push(cb); });
        return () => set(state => {
          state._fxAddedCallbacks = state._fxAddedCallbacks.filter(f => f !== cb);
        });
      },

      onFXRemoved(cb) {
        set(state => { state._fxRemovedCallbacks.push(cb); });
        return () => set(state => {
          state._fxRemovedCallbacks = state._fxRemovedCallbacks.filter(f => f !== cb);
        });
      },

      // ════════════════════════════════════════════════════════════════════════
      // ⑩ BATCH OPERATIONS
      // ════════════════════════════════════════════════════════════════════════

      clearChannel(channel) {
        const effects = [...channel.getEffects()];
        for (const fx of effects) channel.removeFX(fx.id);

        set(state => {
          const cid  = channelKey(channel);
          const hist = ensureHistory(state as unknown as FXState, cid);
          pushHistory(hist, effects.map(fx => ({
            fxId:     fx.id,
            fxType:   (fx as any).type ?? "unknown",
            bypassed: (fx as any).bypassed ?? false,
            params:   {},
          })));
          (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid] = [];
        });
      },

      async duplicateFX(channel, fxId) {
        const fx = channel.getEffects().find(f => f.id === fxId);
        if (!fx || typeof (fx as any).clone !== "function") return null;

        const clone = await (fx as any).clone();
        get().addFXToChannel(channel, clone);
        return clone;
      },

      bypassAllInChannel(channel, bypass) {
        for (const fx of channel.getEffects()) fx.setBypass(bypass);
        set(state => {
          const cid = channelKey(channel);
          if ((state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid]) {
            (state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid] = [...(state.channelFX as Record<string, import("../audio/fx/fx-nodebase").FXNodeBase[]>)[cid]];
          }
        });
      },
    }))
  )
);

// ═══════════════════════════════════════════════════════════════════════════════
// DERIVED SELECTORS  (stable references, safe for React.memo)
//
// All hooks accept `MixerChannel | null | undefined` so components that render
// before a channel is resolved never crash — they simply receive safe defaults.
// ═══════════════════════════════════════════════════════════════════════════════

/** Returns live FX array for a channel, re-renders only when that channel changes */
export function useChannelFX(channel: MixerChannel | null | undefined): readonly FXNodeBase[] {
  const cid = channel ? channelKey(channel) : "__none__";
  return useFXStore(s => s.channelFX[cid] ?? (channel ? channel.getEffects() : []));
}

export function useVSTStatus(
  channel: MixerChannel | null | undefined,
  vstUrl:  string
): VSTStatusEntry | undefined {
  return useFXStore(s =>
    channel ? s.vstStatus[vstKey(channel, vstUrl)] : undefined
  );
}

export function useChannelDryWet(channel: MixerChannel | null | undefined): number {
  return useFXStore(s =>
    channel ? (s.dryWet[channelKey(channel)] ?? 1) : 1
  );
}

export function useGlobalBypass(): boolean {
  return useFXStore(s => s.globalBypass);
}

export function useCanUndo(channel: MixerChannel | null | undefined): boolean {
  return useFXStore(s =>
    channel ? (s.history[channelKey(channel)]?.past.length ?? 0) > 0 : false
  );
}

export function useCanRedo(channel: MixerChannel | null | undefined): boolean {
  return useFXStore(s =>
    channel ? (s.history[channelKey(channel)]?.future.length ?? 0) > 0 : false
  );
}

export function usePresets(): FXPreset[] {
  return useFXStore(s =>
    Object.values(s.presets).sort((a, b) => b.createdAt - a.createdAt)
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STORE SUBSCRIPTIONS  (outside React — for audio-thread bridging)
// ═══════════════════════════════════════════════════════════════════════════════

/** Subscribe to channelFX changes for a specific channel */
export function subscribeChannelFX(
  channel:  MixerChannel,
  callback: (fx: FXNodeBase[]) => void
): () => void {
  const cid = channelKey(channel);
  return useFXStore.subscribe(
    s  => s.channelFX[cid] ?? [],
    callback,
    { equalityFn: (a, b) => a === b }
  );
}

/** Subscribe to global bypass changes */
export function subscribeGlobalBypass(
  callback: (bypass: boolean) => void
): () => void {
  return useFXStore.subscribe(s => s.globalBypass, callback);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS (exported for testing)
// ═══════════════════════════════════════════════════════════════════════════════

export { channelKey, vstKey, takeSnapshot };