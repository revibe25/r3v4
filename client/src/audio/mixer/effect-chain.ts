// FILE: client/src/audio/mixer/effect-chain.ts
import type {
  EffectChain as IEffectChain,
  AudioEffect,
  EffectChainState,
} from '@/types/audio';

// ─── Types ────────────────────────────────────────────────────────────────────

export type EffectChainStatus = 'active' | 'disposed';

/** Snapshot of a single slot — used for undo/redo and serialisation */
export interface EffectSlot {
  /** Position in the chain (0-indexed) */
  index:    number;
  effect:   AudioEffect;
  /** Per-slot wet/dry — 0 = full dry, 1 = full wet (default 1) */
  wetDry:   number;
}

export type EffectChainEventMap = {
  effectAdded:    { chain: EffectChain; slot: EffectSlot };
  effectRemoved:  { chain: EffectChain; effectId: string; index: number };
  effectReordered:{ chain: EffectChain; effectId: string; from: number; to: number };
  effectBypassed: { chain: EffectChain; effectId: string; bypassed: boolean };
  wetDryChanged:  { chain: EffectChain; effectId: string; value: number };
  bypassAll:      { chain: EffectChain; bypassed: boolean };
  cleared:        { chain: EffectChain };
  restored:       { chain: EffectChain; state: EffectChainState };
  disposed:       { chain: EffectChain };
  error:          { chain: EffectChain; error: Error; context: string };
};

type Listener<K extends keyof EffectChainEventMap> = (
  payload: EffectChainEventMap[K],
) => void;

/**
 * Factory function type — implement this to enable full deserialisation.
 * Given an effect state snapshot, return a fully-wired AudioEffect.
 */
export type EffectFactory = (state: ReturnType<AudioEffect['getState']>) => AudioEffect;

// ─── EffectChain ──────────────────────────────────────────────────────────────

export class EffectChain implements IEffectChain {
  public readonly id:        string;
  public readonly channelId: string;

  private readonly audioContext: AudioContext;
  private readonly inputNode:    GainNode;
  private readonly outputNode:   GainNode;

  /** Ordered slots (source of truth — not a raw AudioEffect[]) */
  private slots: EffectSlot[] = [];

  /** Per-slot wet nodes: effectId → { dry: GainNode; wet: GainNode } */
  private wetNodes = new Map<string, { dry: GainNode; wet: GainNode }>();

  private _status: EffectChainStatus = 'active';

  private effectFactory?: EffectFactory;

  private readonly listeners: {
    [K in keyof EffectChainEventMap]?: Set<Listener<K>>;
  } = {};

  // ─── Constructor ────────────────────────────────────────────────────────────

  constructor(
    channelId: string,
    audioContext: AudioContext,
    options?: {
      id?:            string;
      effectFactory?: EffectFactory;
    },
  ) {
    this.id            = options?.id ?? `fx-chain-${channelId}-${Date.now()}`;
    this.channelId     = channelId;
    this.audioContext  = audioContext;
    this.effectFactory = options?.effectFactory;

    this.inputNode  = audioContext.createGain();
    this.outputNode = audioContext.createGain();

    // Passthrough until effects are added
    this.inputNode.connect(this.outputNode);
  }

  // ─── Public accessors ────────────────────────────────────────────────────────

  getInput():  GainNode { return this.inputNode;  }
  getOutput(): GainNode { return this.outputNode; }

  get status(): EffectChainStatus { return this._status; }
  get length():  number            { return this.slots.length; }
  get isEmpty(): boolean           { return this.slots.length === 0; }

  /** Flat array of AudioEffect objects in chain order (live reference). */
  get effects(): AudioEffect[] {
    return this.slots.map((s) => s.effect);
  }

  /** All slots in order — includes index and wetDry metadata. */
  getSlots(): ReadonlyArray<Readonly<EffectSlot>> {
    return this.slots;
  }

  // ─── Effect management ────────────────────────────────────────────────────────

  /**
   * Add an effect at an optional position (appends by default).
   * `wetDry` sets the initial per-slot mix (default 1 = full wet).
   */
  addEffect(effect: AudioEffect, position?: number, wetDry = 1): void {
    this.assertActive();

    const insertAt = position !== undefined
      ? clamp(position, 0, this.slots.length)
      : this.slots.length;

    // Build per-slot wet/dry nodes
    const dry = this.audioContext.createGain();
    const wet = this.audioContext.createGain();
    dry.gain.value = 1 - wetDry;
    wet.gain.value = wetDry;
    this.wetNodes.set(effect.id, { dry, wet });

    const slot: EffectSlot = { index: insertAt, effect, wetDry };
    this.slots.splice(insertAt, 0, slot);
    this.reindexSlots();
    this.rebuildGraph();

    this.emit('effectAdded', { chain: this, slot: { ...slot } });
  }

  /**
   * Remove an effect by id. Disposes the effect and its wet/dry nodes.
   * Returns true if found and removed.
   */
  removeEffect(effectId: string): boolean {
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
  reorderEffect(effectId: string, newPosition: number): void {
    this.assertActive();

    const from = this.slots.findIndex((s) => s.effect.id === effectId);
    if (from === -1) {
      this.warn(`reorderEffect: effect "${effectId}" not found`);
      return;
    }

    const to = clamp(newPosition, 0, this.slots.length - 1);
    if (from === to) return;

    const [slot] = this.slots.splice(from, 1);
    this.slots.splice(to, 0, slot);
    this.reindexSlots();
    this.rebuildGraph();

    this.emit('effectReordered', { chain: this, effectId, from, to });
  }

  /**
   * Move an effect one step toward the front of the chain.
   */
  moveUp(effectId: string): void {
    const idx = this.slots.findIndex((s) => s.effect.id === effectId);
    if (idx > 0) this.reorderEffect(effectId, idx - 1);
  }

  /**
   * Move an effect one step toward the end of the chain.
   */
  moveDown(effectId: string): void {
    const idx = this.slots.findIndex((s) => s.effect.id === effectId);
    if (idx !== -1 && idx < this.slots.length - 1) this.reorderEffect(effectId, idx + 1);
  }

  getEffect(effectId: string): AudioEffect | undefined {
    return this.slots.find((s) => s.effect.id === effectId)?.effect;
  }

  // ─── Per-slot bypass ─────────────────────────────────────────────────────────

  /**
   * Toggle bypass for a single effect without removing it from the chain.
   */
  setEffectBypassed(effectId: string, bypassed: boolean): void {
    this.assertActive();

    const slot = this.slots.find((s) => s.effect.id === effectId);
    if (!slot) {
      this.warn(`setEffectBypassed: effect "${effectId}" not found`);
      return;
    }

    if (slot.effect.bypassed === bypassed) return;
    slot.effect.bypassed = bypassed;
    this.rebuildGraph();
    this.emit('effectBypassed', { chain: this, effectId, bypassed });
  }

  bypassAll(): void {
    this.assertActive();
    this.slots.forEach((s) => { s.effect.bypassed = true; });
    this.rebuildGraph();
    this.emit('bypassAll', { chain: this, bypassed: true });
  }

  enableAll(): void {
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
  setEffectWetDry(effectId: string, value: number): void {
    this.assertActive();

    const slot  = this.slots.find((s) => s.effect.id === effectId);
    const nodes = this.wetNodes.get(effectId);

    if (!slot || !nodes) {
      this.warn(`setEffectWetDry: effect "${effectId}" not found`);
      return;
    }

    const clamped       = clamp(value, 0, 1);
    slot.wetDry         = clamped;
    const now           = this.audioContext.currentTime;
    nodes.wet.gain.setTargetAtTime(clamped,     now, 0.015);
    nodes.dry.gain.setTargetAtTime(1 - clamped, now, 0.015);

    this.emit('wetDryChanged', { chain: this, effectId, value: clamped });
  }

  // ─── Bulk operations ─────────────────────────────────────────────────────────

  /**
   * Dispose all effects and reset to passthrough. Does NOT dispose the chain itself.
   */
  clear(): void {
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

  serialize(): EffectChainState {
    return {
      id:        this.id,
      channelId: this.channelId,
      effects:   this.slots.map((s) => ({
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
  deserialize(state: EffectChainState, factory?: EffectFactory): void {
    this.assertActive();

    const resolve = factory ?? this.effectFactory;
    if (!resolve) {
      this.emitError(
        new Error('No effectFactory provided — pass one to the constructor or to deserialize()'),
        'deserialize',
      );
      return;
    }

    this.clear();

    for (const effectState of state.effects) {
      try {
        const wetDry = (effectState as unknown as Record<string, unknown>)['_wetDry'] as number ?? 1;
        const effect = resolve(effectState);
        this.addEffect(effect, undefined, wetDry);
      } catch (err) {
        this.emitError(toError(err), `deserialize[${effectState.id}]`);
      }
    }

    this.emit('restored', { chain: this, state });
  }

  /**
   * Take a lightweight snapshot of the current slot order and bypass state
   * without serialising full effect params — useful for undo/redo stacks.
   */
  snapshot(): Array<{ effectId: string; bypassed: boolean; wetDry: number }> {
    return this.slots.map((s) => ({
      effectId: s.effect.id,
      bypassed: s.effect.bypassed,
      wetDry:   s.wetDry,
    }));
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._status === 'disposed') return;

    for (const { effect } of this.slots) {
      this.disposeSlotNodes(effect.id);
      this.safeDispose(effect);
    }

    this.slots = [];
    this.wetNodes.clear();

    try { this.inputNode.disconnect();  } catch { /* ok */ }
    try { this.outputNode.disconnect(); } catch { /* ok */ }

    this._status = 'disposed';
    this.emit('disposed', { chain: this });
  }

  // ─── Introspection ────────────────────────────────────────────────────────────

  toJSON() {
    return {
      id:            this.id,
      channelId:     this.channelId,
      status:        this._status,
      effectCount:   this.slots.length,
      activeEffects: this.slots.filter((s) => !s.effect.bypassed).length,
      slots: this.slots.map((s) => ({
        index:    s.index,
        id:       s.effect.id,
        name:     s.effect.name,
        type:     s.effect.type,
        bypassed: s.effect.bypassed,
        enabled:  s.effect.enabled,
        wetDry:   s.wetDry,
      })),
    };
  }

  // ─── Event emitter ────────────────────────────────────────────────────────────

  on<K extends keyof EffectChainEventMap>(event: K, listener: Listener<K>): this {
    if (!this.listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.listeners as any)[event] = new Set();
    }
    (this.listeners[event] as Set<Listener<K>>).add(listener);
    return this;
  }

  off<K extends keyof EffectChainEventMap>(event: K, listener: Listener<K>): this {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.delete(listener);
    return this;
  }

  once<K extends keyof EffectChainEventMap>(event: K, listener: Listener<K>): this {
    const wrapper: Listener<K> = (payload) => {
      listener(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  private emit<K extends keyof EffectChainEventMap>(
    event: K,
    payload: EffectChainEventMap[K],
  ): void {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.forEach((fn) => fn(payload));
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
  private rebuildGraph(): void {
    // Tear down existing connections
    try { this.inputNode.disconnect(); } catch { /* ok */ }
    for (const { dry, wet } of this.wetNodes.values()) {
      try { dry.disconnect(); } catch { /* ok */ }
      try { wet.disconnect(); } catch { /* ok */ }
    }
    for (const { effect } of this.slots) {
      try { effect.disconnect(); } catch { /* ok */ }
    }

    const active = this.slots.filter((s) => !s.effect.bypassed);

    if (active.length === 0) {
      this.inputNode.connect(this.outputNode);
      return;
    }

    // Wire first slot
    let prev: AudioNode = this.inputNode;

    for (const slot of active) {
      const nodes = this.wetNodes.get(slot.effect.id);

      if (!nodes || slot.wetDry >= 1) {
        // Full wet — simple series connection
        prev.connect(slot.effect.input);
        prev = slot.effect.output;
      } else if (slot.wetDry <= 0) {
        // Full dry — bypass this slot's effect entirely
        // (effect is "active" meaning not bypassed flag, but mix is 0 — passthrough)
        prev = prev; // signal skips the effect node
      } else {
        // Partial wet/dry — parallel blend
        prev.connect(slot.effect.input);  // wet path
        prev.connect(nodes.dry);          // dry path

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
  private reindexSlots(): void {
    this.slots.forEach((s, i) => { s.index = i; });
  }

  /** Disconnect and nullify the wet/dry gain pair for a slot. */
  private disposeSlotNodes(effectId: string): void {
    const nodes = this.wetNodes.get(effectId);
    if (!nodes) return;
    try { nodes.dry.disconnect(); } catch { /* ok */ }
    try { nodes.wet.disconnect(); } catch { /* ok */ }
    this.wetNodes.delete(effectId);
  }

  /** Safely call dispose() on an effect, emitting an error if it throws. */
  private safeDispose(effect: AudioEffect): void {
    try {
      effect.dispose();
    } catch (err) {
      this.emitError(toError(err), `dispose[${effect.id}]`);
    }
  }

  private assertActive(): void {
    if (this._status === 'disposed') {
      throw new Error(`[EffectChain ${this.id}] Cannot operate on a disposed chain.`);
    }
  }

  private warn(msg: string): void {
    console.warn(`[EffectChain ${this.id}] ${msg}`);
  }

  private emitError(error: Error, context: string): void {
    console.error(`[EffectChain ${this.id}] ${context}:`, error);
    this.emit('error', { chain: this, error, context });
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}