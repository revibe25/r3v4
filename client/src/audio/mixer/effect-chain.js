// ─── EffectChain ──────────────────────────────────────────────────────────────
export class EffectChain {
    // ─── Constructor ────────────────────────────────────────────────────────────
    constructor(channelId, audioContext, options) {
        /** Ordered slots (source of truth — not a raw AudioEffect[]) */
        this.slots = [];
        /** Per-slot wet nodes: effectId → { dry: GainNode; wet: GainNode } */
        this.wetNodes = new Map();
        this._status = 'active';
        this.listeners = {};
        this.id = options?.id ?? `fx-chain-${channelId}-${Date.now()}`;
        this.channelId = channelId;
        this.audioContext = audioContext;
        this.effectFactory = options?.effectFactory;
        this.inputNode = audioContext.createGain();
        this.outputNode = audioContext.createGain();
        // Passthrough until effects are added
        this.inputNode.connect(this.outputNode);
    }
    // ─── Public accessors ────────────────────────────────────────────────────────
    getInput() { return this.inputNode; }
    getOutput() { return this.outputNode; }
    get status() { return this._status; }
    get length() { return this.slots.length; }
    get isEmpty() { return this.slots.length === 0; }
    /** Flat array of AudioEffect objects in chain order (live reference). */
    get effects() {
        return this.slots.map((s) => s.effect);
    }
    /** All slots in order — includes index and wetDry metadata. */
    getSlots() {
        return this.slots;
    }
    // ─── Effect management ────────────────────────────────────────────────────────
    /**
     * Add an effect at an optional position (appends by default).
     * `wetDry` sets the initial per-slot mix (default 1 = full wet).
     */
    addEffect(effect, position, wetDry = 1) {
        this.assertActive();
        const insertAt = position !== undefined
            ? clamp(position, 0, this.slots.length)
            : this.slots.length;
        // Build per-slot wet/dry nodes
        const dry = this.audioContext.createGain();
        const wet = this.audioContext.createGain();
        dry.gain.setTargetAtTime(1 - wetDry, this.audioContext.currentTime, 0.015);
        wet.gain.setTargetAtTime(wetDry, this.audioContext.currentTime, 0.015);
        this.wetNodes.set(effect.id, { dry, wet });
        const slot = { index: insertAt, effect, wetDry };
        this.slots.splice(insertAt, 0, slot);
        this.reindexSlots();
        this.rebuildGraph();
        this.emit('effectAdded', { chain: this, slot: { ...slot } });
    }
    /**
     * Remove an effect by id. Disposes the effect and its wet/dry nodes.
     * Returns true if found and removed.
     */
    removeEffect(effectId) {
        this.assertActive();
        const index = this.slots.findIndex((s) => s.effect.id === effectId);
        if (index === -1) {
            this.warn(`removeEffect: effect "${effectId}" not found`);
            return false;
        }
        const { effect } = this.slots[index];
        this.disposeSlotNodes(effectId);
        this.safeDispose(effect);
        this.slots.splice(index, 1);
        this.reindexSlots();
        this.rebuildGraph();
        this.emit('effectRemoved', { chain: this, effectId, index });
        return true;
    }
    /**
     * Move an effect to a new zero-indexed position.
     * No-op if already in position.
     */
    reorderEffect(effectId, newPosition) {
        this.assertActive();
        const from = this.slots.findIndex((s) => s.effect.id === effectId);
        if (from === -1) {
            this.warn(`reorderEffect: effect "${effectId}" not found`);
            return;
        }
        const to = clamp(newPosition, 0, this.slots.length - 1);
        if (from === to)
            return;
        const [slot] = this.slots.splice(from, 1);
        this.slots.splice(to, 0, slot);
        this.reindexSlots();
        this.rebuildGraph();
        this.emit('effectReordered', { chain: this, effectId, from, to });
    }
    /**
     * Move an effect one step toward the front of the chain.
     */
    moveUp(effectId) {
        const idx = this.slots.findIndex((s) => s.effect.id === effectId);
        if (idx > 0)
            this.reorderEffect(effectId, idx - 1);
    }
    /**
     * Move an effect one step toward the end of the chain.
     */
    moveDown(effectId) {
        const idx = this.slots.findIndex((s) => s.effect.id === effectId);
        if (idx !== -1 && idx < this.slots.length - 1)
            this.reorderEffect(effectId, idx + 1);
    }
    getEffect(effectId) {
        return this.slots.find((s) => s.effect.id === effectId)?.effect;
    }
    // ─── Per-slot bypass ─────────────────────────────────────────────────────────
    /**
     * Toggle bypass for a single effect without removing it from the chain.
     */
    setEffectBypassed(effectId, bypassed) {
        this.assertActive();
        const slot = this.slots.find((s) => s.effect.id === effectId);
        if (!slot) {
            this.warn(`setEffectBypassed: effect "${effectId}" not found`);
            return;
        }
        if (slot.effect.bypassed === bypassed)
            return;
        slot.effect.bypassed = bypassed;
        this.rebuildGraph();
        this.emit('effectBypassed', { chain: this, effectId, bypassed });
    }
    bypassAll() {
        this.assertActive();
        this.slots.forEach((s) => { s.effect.bypassed = true; });
        this.rebuildGraph();
        this.emit('bypassAll', { chain: this, bypassed: true });
    }
    enableAll() {
        this.assertActive();
        this.slots.forEach((s) => { s.effect.bypassed = false; });
        this.rebuildGraph();
        this.emit('bypassAll', { chain: this, bypassed: false });
    }
    // ─── Per-slot wet/dry ─────────────────────────────────────────────────────────
    /**
     * Set the wet/dry mix for a single effect slot (0 = dry, 1 = wet).
     * Applied via the slot's gain nodes so the graph doesn't need rebuilding.
     */
    setEffectWetDry(effectId, value) {
        this.assertActive();
        const slot = this.slots.find((s) => s.effect.id === effectId);
        const nodes = this.wetNodes.get(effectId);
        if (!slot || !nodes) {
            this.warn(`setEffectWetDry: effect "${effectId}" not found`);
            return;
        }
        const clamped = clamp(value, 0, 1);
        slot.wetDry = clamped;
        const now = this.audioContext.currentTime;
        nodes.wet.gain.setTargetAtTime(clamped, now, 0.015);
        nodes.dry.gain.setTargetAtTime(1 - clamped, now, 0.015);
        this.emit('wetDryChanged', { chain: this, effectId, value: clamped });
    }
    // ─── Bulk operations ─────────────────────────────────────────────────────────
    /**
     * Dispose all effects and reset to passthrough. Does NOT dispose the chain itself.
     */
    clear() {
        this.assertActive();
        for (const { effect } of this.slots) {
            this.disposeSlotNodes(effect.id);
            this.safeDispose(effect);
        }
        this.slots = [];
        this.wetNodes.clear();
        this.inputNode.disconnect();
        this.inputNode.connect(this.outputNode);
        this.emit('cleared', { chain: this });
    }
    // ─── Serialisation ────────────────────────────────────────────────────────────
    serialize() {
        return {
            id: this.id,
            channelId: this.channelId,
            effects: this.slots.map((s) => ({
                ...s.effect.getState(),
                _wetDry: s.wetDry,
            })),
            timestamp: Date.now(),
        };
    }
    /**
     * Restore chain from a serialised state snapshot.
     * Requires an `effectFactory` to have been provided at construction time,
     * or passed here as a one-off override.
     */
    deserialize(state, factory) {
        this.assertActive();
        const resolve = factory ?? this.effectFactory;
        if (!resolve) {
            this.emitError(new Error('No effectFactory provided — pass one to the constructor or to deserialize()'), 'deserialize');
            return;
        }
        this.clear();
        for (const effectState of state.effects) {
            try {
                const wetDry = effectState['_wetDry'] ?? 1;
                const effect = resolve(effectState);
                this.addEffect(effect, undefined, wetDry);
            }
            catch (err) {
                this.emitError(toError(err), `deserialize[${effectState.id}]`);
            }
        }
        this.emit('restored', { chain: this, state });
    }
    /**
     * Take a lightweight snapshot of the current slot order and bypass state
     * without serialising full effect params — useful for undo/redo stacks.
     */
    snapshot() {
        return this.slots.map((s) => ({
            effectId: s.effect.id,
            bypassed: s.effect.bypassed,
            wetDry: s.wetDry,
        }));
    }
    // ─── Lifecycle ────────────────────────────────────────────────────────────────
    dispose() {
        if (this._status === 'disposed')
            return;
        for (const { effect } of this.slots) {
            this.disposeSlotNodes(effect.id);
            this.safeDispose(effect);
        }
        this.slots = [];
        this.wetNodes.clear();
        try {
            this.inputNode.disconnect();
        }
        catch { /* ok */ }
        try {
            this.outputNode.disconnect();
        }
        catch { /* ok */ }
        this._status = 'disposed';
        this.emit('disposed', { chain: this });
    }
    // ─── Introspection ────────────────────────────────────────────────────────────
    toJSON() {
        return {
            id: this.id,
            channelId: this.channelId,
            status: this._status,
            effectCount: this.slots.length,
            activeEffects: this.slots.filter((s) => !s.effect.bypassed).length,
            slots: this.slots.map((s) => ({
                index: s.index,
                id: s.effect.id,
                name: s.effect.name,
                type: s.effect.type,
                bypassed: s.effect.bypassed,
                enabled: s.effect.enabled,
                wetDry: s.wetDry,
            })),
        };
    }
    // ─── Event emitter ────────────────────────────────────────────────────────────
    on(event, listener) {
        if (!this.listeners[event]) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.listeners[event] = new Set();
        }
        this.listeners[event].add(listener);
        return this;
    }
    off(event, listener) {
        this.listeners[event]?.delete(listener);
        return this;
    }
    once(event, listener) {
        const wrapper = (payload) => {
            listener(payload);
            this.off(event, wrapper);
        };
        return this.on(event, wrapper);
    }
    emit(event, payload) {
        this.listeners[event]?.forEach((fn) => fn(payload));
    }
    // ─── Private helpers ─────────────────────────────────────────────────────────
    /**
     * Rebuild the audio graph from scratch.
     *
     * For each non-bypassed effect the signal path is:
     *   previous → [dry split] → effect.input
     *               └──────────→ effect.output → [wet mix] → next
     *
     * Bypassed effects are skipped entirely (signal jumps over them).
     */
    rebuildGraph() {
        // Tear down existing connections
        try {
            this.inputNode.disconnect();
        }
        catch { /* ok */ }
        for (const { dry, wet } of this.wetNodes.values()) {
            try {
                dry.disconnect();
            }
            catch { /* ok */ }
            try {
                wet.disconnect();
            }
            catch { /* ok */ }
        }
        for (const { effect } of this.slots) {
            try {
                effect.disconnect();
            }
            catch { /* ok */ }
        }
        const active = this.slots.filter((s) => !s.effect.bypassed);
        if (active.length === 0) {
            this.inputNode.connect(this.outputNode);
            return;
        }
        // Wire first slot
        let prev = this.inputNode;
        for (const slot of active) {
            const nodes = this.wetNodes.get(slot.effect.id);
            if (!nodes || slot.wetDry >= 1) {
                // Full wet — simple series connection
                prev.connect(slot.effect.input);
                prev = slot.effect.output;
            }
            else if (slot.wetDry <= 0) {
                // Full dry — bypass this slot's effect entirely
                // (effect is "active" meaning not bypassed flag, but mix is 0 — passthrough)
                prev = prev; // signal skips the effect node
            }
            else {
                // Partial wet/dry — parallel blend
                prev.connect(slot.effect.input); // wet path
                prev.connect(nodes.dry); // dry path
                slot.effect.output.connect(nodes.wet);
                nodes.wet.connect(this.outputNode);
                nodes.dry.connect(this.outputNode);
                // For chaining purposes, treat the output node as the next input source
                prev = this.outputNode; // subsequent effects read from the mixed output
            }
        }
        // Connect the last active effect's output to the chain output
        if (prev !== this.outputNode) {
            prev.connect(this.outputNode);
        }
    }
    /** Keep slot.index values consistent with array position. */
    reindexSlots() {
        this.slots.forEach((s, i) => { s.index = i; });
    }
    /** Disconnect and nullify the wet/dry gain pair for a slot. */
    disposeSlotNodes(effectId) {
        const nodes = this.wetNodes.get(effectId);
        if (!nodes)
            return;
        try {
            nodes.dry.disconnect();
        }
        catch { /* ok */ }
        try {
            nodes.wet.disconnect();
        }
        catch { /* ok */ }
        this.wetNodes.delete(effectId);
    }
    /** Safely call dispose() on an effect, emitting an error if it throws. */
    safeDispose(effect) {
        try {
            effect.dispose();
        }
        catch (err) {
            this.emitError(toError(err), `dispose[${effect.id}]`);
        }
    }
    assertActive() {
        if (this._status === 'disposed') {
            throw new Error(`[EffectChain ${this.id}] Cannot operate on a disposed chain.`);
        }
    }
    warn(msg) {
        console.warn(`[EffectChain ${this.id}] ${msg}`);
    }
    emitError(error, context) {
        console.error(`[EffectChain ${this.id}] ${context}:`, error);
        this.emit('error', { chain: this, error, context });
    }
}
// ─── Utilities ────────────────────────────────────────────────────────────────
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function toError(value) {
    return value instanceof Error ? value : new Error(String(value));
}
