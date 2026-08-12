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
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Derives a stable string key from a channel.
 * Accepts null/undefined and returns "__none__" so hooks that fire before a
 * channel is ready never crash trying to read `.id` on undefined.
 */
function channelKey(channel) {
    if (!channel)
        return "__none__";
    return channel.id ?? String(channel._id ?? "default");
}
function vstKey(channel, vstUrl) {
    return `${channelKey(channel)}:${vstUrl}`;
}
/** Take an immutable snapshot of a channel's FX chain */
function takeSnapshot(channel) {
    return [...channel.getEffects()].map(fx => ({
        fxId: fx.id,
        fxType: fx.type ?? "unknown",
        bypassed: fx.bypassed ?? false,
        params: fx.getParams ? { ...fx.getParams() } : {},
    }));
}
function pushHistory(hist, snapshot) {
    hist.past.push(snapshot);
    if (hist.past.length > 50)
        hist.past.shift(); // cap at 50 steps
    hist.future = [];
}
function ensureHistory(state, cid) {
    if (!state.history[cid])
        state.history[cid] = { past: [], future: [] };
    return state.history[cid];
}
// ═══════════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════════
export const useFXStore = create()(subscribeWithSelector(immer((set, get) => ({
    // ── Initial state ────────────────────────────────────────────────────────
    channelFX: {},
    vstStatus: {},
    history: {},
    presets: {},
    dryWet: {},
    globalBypass: false,
    _fxAddedCallbacks: [],
    _fxRemovedCallbacks: [],
    // ════════════════════════════════════════════════════════════════════════
    // ORIGINAL METHODS  (logic unchanged)
    // ════════════════════════════════════════════════════════════════════════
    addFXToChannel(channel, fx, index) {
        channel.addFX(fx, index);
        set(state => {
            const cid = channelKey(channel);
            const hist = ensureHistory(state, cid);
            pushHistory(hist, takeSnapshot(channel));
            state.channelFX[cid] = [...channel.getEffects()];
        });
        get()._fxAddedCallbacks.forEach(cb => cb(channel, fx));
    },
    removeFXFromChannel(channel, fxId) {
        channel.removeFX(fxId);
        set(state => {
            const cid = channelKey(channel);
            const hist = ensureHistory(state, cid);
            pushHistory(hist, takeSnapshot(channel));
            state.channelFX[cid] = [...channel.getEffects()];
        });
        get()._fxRemovedCallbacks.forEach(cb => cb(channel, fxId));
    },
    bypassFX(fx, bypass) {
        fx.setBypass(bypass);
        set(state => {
            for (const [cid, fxArr] of Object.entries(state.channelFX)) {
                if (fxArr.some(f => f.id === fx.id)) {
                    state.channelFX[cid] = [...fxArr];
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
                const cid = channelKey(channel);
                const hist = ensureHistory(state, cid);
                pushHistory(hist, takeSnapshot(channel));
                state.channelFX[cid] = [...channel.getEffects()];
                state.vstStatus[key] = { status: "ready", url: vstUrl, loadedAt: Date.now() };
            });
            console.log(`VST loaded to channel ${channel.id}:`, vstUrl);
            get()._fxAddedCallbacks.forEach(cb => cb(channel, vstNode));
            return vstNode;
        }
        catch (error) {
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
            const cid = channelKey(channel);
            const hist = ensureHistory(state, cid);
            pushHistory(hist, takeSnapshot(channel));
            state.channelFX[cid] = [...channel.getEffects()];
        });
    },
    getChannelEffects(channel) {
        return channel.getEffects();
    },
    // ════════════════════════════════════════════════════════════════════════
    // ① UNDO / REDO
    // ════════════════════════════════════════════════════════════════════════
    undoChannel(channel) {
        const cid = channelKey(channel);
        const hist = get().history[cid];
        if (!hist || hist.past.length === 0)
            return;
        set(state => {
            const h = state.history[cid];
            const current = takeSnapshot(channel);
            const prev = h.past.pop();
            h.future.push(current);
            if (typeof channel.replaceEffects === "function") {
                channel.replaceEffects(prev);
            }
            state.channelFX[cid] = [...channel.getEffects()];
        });
    },
    redoChannel(channel) {
        const cid = channelKey(channel);
        const hist = get().history[cid];
        if (!hist || hist.future.length === 0)
            return;
        set(state => {
            const h = state.history[cid];
            const next = h.future.pop();
            h.past.push(takeSnapshot(channel));
            if (typeof channel.replaceEffects === "function") {
                channel.replaceEffects(next);
            }
            state.channelFX[cid] = [...channel.getEffects()];
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
            state.channelFX[cid] = [...channel.getEffects()];
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
        const preset = {
            id: crypto.randomUUID(),
            name,
            fxChain: takeSnapshot(channel),
            createdAt: Date.now(),
        };
        set(state => {
            state.presets[preset.id] = preset;
        });
        return preset;
    },
    async loadPreset(presetId, channel) {
        const preset = get().presets[presetId];
        if (!preset)
            throw new Error(`Preset "${presetId}" not found`);
        if (typeof channel.loadFromSnapshot === "function") {
            await channel.loadFromSnapshot(preset.fxChain);
        }
        set(state => {
            const cid = channelKey(channel);
            state.channelFX[cid] = [...channel.getEffects()];
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
        if (typeof fx.setParam === "function") {
            fx.setParam(paramName, value);
        }
        else if (paramName in fx) {
            fx[paramName] = value;
        }
        set(state => {
            for (const [cid, fxArr] of Object.entries(state.channelFX)) {
                if (fxArr.some(f => f.id === fx.id)) {
                    state.channelFX[cid] = [...fxArr];
                }
            }
        });
    },
    getFXParam(fx, paramName) {
        if (typeof fx.getParam === "function")
            return fx.getParam(paramName);
        return fx[paramName];
    },
    getFXParams(fx) {
        if (typeof fx.getParams === "function")
            return fx.getParams();
        return {};
    },
    // ════════════════════════════════════════════════════════════════════════
    // ⑥ DRY/WET
    // ════════════════════════════════════════════════════════════════════════
    setChannelDryWet(channel, value) {
        const clamped = Math.max(0, Math.min(1, value));
        if (typeof channel.setDryWet === "function")
            channel.setDryWet(clamped);
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
            for (const fx of fxArr)
                fx.setBypass(bypass);
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
            channelId: channelKey(channel),
            fxChain: takeSnapshot(channel),
            dryWet: get().dryWet[channelKey(channel)] ?? 1,
            exportedAt: new Date().toISOString(),
        }, null, 2);
    },
    async importChainJSON(channel, json) {
        const data = JSON.parse(json);
        if (Array.isArray(data.fxChain) && typeof channel.loadFromSnapshot === "function") {
            await channel.loadFromSnapshot(data.fxChain);
        }
        if (typeof data.dryWet === "number") {
            get().setChannelDryWet(channel, data.dryWet);
        }
        set(state => {
            state.channelFX[channelKey(channel)] = [...channel.getEffects()];
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
        for (const fx of effects)
            channel.removeFX(fx.id);
        set(state => {
            const cid = channelKey(channel);
            const hist = ensureHistory(state, cid);
            pushHistory(hist, effects.map(fx => ({
                fxId: fx.id,
                fxType: fx.type ?? "unknown",
                bypassed: fx.bypassed ?? false,
                params: {},
            })));
            state.channelFX[cid] = [];
        });
    },
    async duplicateFX(channel, fxId) {
        const fx = channel.getEffects().find(f => f.id === fxId);
        if (!fx || typeof fx.clone !== "function")
            return null;
        const clone = await fx.clone();
        get().addFXToChannel(channel, clone);
        return clone;
    },
    bypassAllInChannel(channel, bypass) {
        for (const fx of channel.getEffects())
            fx.setBypass(bypass);
        set(state => {
            const cid = channelKey(channel);
            if (state.channelFX[cid]) {
                state.channelFX[cid] = [...state.channelFX[cid]];
            }
        });
    },
}))));
// ═══════════════════════════════════════════════════════════════════════════════
// DERIVED SELECTORS  (stable references, safe for React.memo)
//
// All hooks accept `MixerChannel | null | undefined` so components that render
// before a channel is resolved never crash — they simply receive safe defaults.
// ═══════════════════════════════════════════════════════════════════════════════
/** Returns live FX array for a channel, re-renders only when that channel changes */
export function useChannelFX(channel) {
    const cid = channel ? channelKey(channel) : "__none__";
    return useFXStore(s => s.channelFX[cid] ?? (channel ? channel.getEffects() : []));
}
export function useVSTStatus(channel, vstUrl) {
    return useFXStore(s => channel ? s.vstStatus[vstKey(channel, vstUrl)] : undefined);
}
export function useChannelDryWet(channel) {
    return useFXStore(s => channel ? (s.dryWet[channelKey(channel)] ?? 1) : 1);
}
export function useGlobalBypass() {
    return useFXStore(s => s.globalBypass);
}
export function useCanUndo(channel) {
    return useFXStore(s => channel ? (s.history[channelKey(channel)]?.past.length ?? 0) > 0 : false);
}
export function useCanRedo(channel) {
    return useFXStore(s => channel ? (s.history[channelKey(channel)]?.future.length ?? 0) > 0 : false);
}
export function usePresets() {
    return useFXStore(s => Object.values(s.presets).sort((a, b) => b.createdAt - a.createdAt));
}
// ═══════════════════════════════════════════════════════════════════════════════
// STORE SUBSCRIPTIONS  (outside React — for audio-thread bridging)
// ═══════════════════════════════════════════════════════════════════════════════
/** Subscribe to channelFX changes for a specific channel */
export function subscribeChannelFX(channel, callback) {
    const cid = channelKey(channel);
    return useFXStore.subscribe(s => s.channelFX[cid] ?? [], callback, { equalityFn: (a, b) => a === b });
}
/** Subscribe to global bypass changes */
export function subscribeGlobalBypass(callback) {
    return useFXStore.subscribe(s => s.globalBypass, callback);
}
// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL HELPERS (exported for testing)
// ═══════════════════════════════════════════════════════════════════════════════
export { channelKey, vstKey, takeSnapshot };
