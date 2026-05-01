// FILE: client/src/audio/mixer/solo-manager.ts
import type { MixerChannel } from './mixer-channel';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * exclusive — only the most recently soloed channel is heard (radio-button style)
 * additive  — multiple channels can be soloed simultaneously (default DAW behaviour)
 */
export type SoloMode = 'exclusive' | 'additive';

export interface ChannelEntry {
  channel:     MixerChannel;
  /** Solo state — owned here, not on MixerChannel */
  isSoloed:    boolean;
  /** Mute state the channel had before any solo was engaged */
  preSoloMute: boolean;
  /** Solo group id — channels in the same group are treated as a unit */
  groupId?:    string;
}

export type SoloManagerEventMap = {
  /** A channel was registered */
  registered:   { channel: MixerChannel };
  /** A channel was unregistered */
  unregistered: { id: string };
  /** Solo states were recalculated */
  updated:      { soloed: string[]; muted: string[] };
  /** Solo mode changed */
  modeChanged:  { mode: SoloMode };
  /** All solos were cleared */
  cleared:      {};
  /** Manager was disposed */
  disposed:     {};
};

type Listener<K extends keyof SoloManagerEventMap> = (
  payload: SoloManagerEventMap[K],
) => void;

// ─── SoloManager ─────────────────────────────────────────────────────────────

export class SoloManager {
  private entries = new Map<string, ChannelEntry>();

  private _mode: SoloMode = 'additive';
  private _disposed = false;

  /** In exclusive mode, track which channel was soloed last */
  private lastSoloedId: string | null = null;

  private readonly listeners: {
    [K in keyof SoloManagerEventMap]?: Set<Listener<K>>;
  } = {};

  // ─── Mode ──────────────────────────────────────────────────────────────────

  get mode(): SoloMode { return this._mode; }

  setMode(mode: SoloMode): void {
    this.assertNotDisposed();
    if (this._mode === mode) return;
    this._mode = mode;
    this.emit('modeChanged', { mode });
    this.recalculate();
  }

  // ─── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a channel with the manager.
   * The current mute state is captured as the pre-solo baseline.
   */
  register(channel: MixerChannel, groupId?: string): void {
    this.assertNotDisposed();

    if (this.entries.has(channel.id)) {
      // Re-registering — update group without resetting pre-solo state
      const _entry = this.entries.get(channel.id)!;
      entry.groupId = groupId;
      return;
    }

    this.entries.set(channel.id, {
      channel,
      isSoloed:    false,
      preSoloMute: channel.isMuted(),
      groupId,
    });

    this.emit('registered', { channel });

    // If solos are already active, apply them to the new channel immediately
    if (this.hasSoloed()) {
      this.recalculate();
    }
  }

  /**
   * Unregister a channel. Restores its mute state before removing it.
   */
  unregister(id: string): void {
    const _entry = this.entries.get(id);
    if (!entry) return;

    // Restore pre-solo mute before removing
    try {
      entry.channel.setMute(entry.preSoloMute);
    } catch { /* channel may already be disposed */ }

    this.entries.delete(id);

    if (this.lastSoloedId === id) {
      this.lastSoloedId = null;
    }

    this.emit('unregistered', { id });

    // Recalculate in case the removed channel was soloed
    this.recalculate();
  }

  getChannel(id: string): MixerChannel | undefined {
    return this.entries.get(id)?.channel;
  }

  get channelIds(): string[] {
    return [...this.entries.keys()];
  }

  get count(): number {
    return this.entries.size;
  }

  // ─── Solo control ─────────────────────────────────────────────────────────

  /**
   * Programmatically solo a channel by id.
   * In exclusive mode, this clears all other solos first.
   */
  solo(id: string): void {
    this.assertNotDisposed();

    const _entry = this.entries.get(id);
    if (!entry) {
      console.warn(`[SoloManager] solo: channel "${id}" not registered`);
      return;
    }

    if (this._mode === 'exclusive') {
      // Clear all other solos without recalculating until done
      for (const [otherId, otherEntry] of this.entries) {
        if (otherId !== id) otherEntry.isSoloed = false;
      }
    }

    entry.isSoloed    = true;
    this.lastSoloedId = id;
    this.recalculate();
  }

  /**
   * Programmatically unsolo a channel by id.
   */
  unsolo(id: string): void {
    this.assertNotDisposed();

    const _entry = this.entries.get(id);
    if (!entry) return;

    entry.isSoloed = false;
    if (this.lastSoloedId === id) this.lastSoloedId = null;
    this.recalculate();
  }

  /**
   * Toggle the solo state of a channel by id.
   */
  toggleSolo(id: string): void {
    const _entry = this.entries.get(id);
    if (!entry) return;

    if (entry.isSoloed) {
      this.unsolo(id);
    } else {
      this.solo(id);
    }
  }

  /**
   * Returns true if the given channel is currently soloed.
   */
  isSoloed(id: string): boolean {
    return this.entries.get(id)?.isSoloed ?? false;
  }

  /**
   * Remove all solos and restore every channel to its pre-solo mute state.
   */
  clearAllSolos(): void {
    this.assertNotDisposed();

    for (const entry of this.entries.values()) {
      entry.isSoloed = false;
    }

    this.lastSoloedId = null;
    this.restorePreSoloStates();
    this.emit('cleared', {});
    this.emit('updated', { soloed: [], muted: this.mutedIds() });
  }

  // ─── Groups ───────────────────────────────────────────────────────────────

  /**
   * Solo every channel in a named group simultaneously.
   * In exclusive mode the group acts as a single unit (all others muted).
   */
  soloGroup(groupId: string): void {
    this.assertNotDisposed();

    if (this._mode === 'exclusive') {
      for (const entry of this.entries.values()) {
        entry.isSoloed = entry.groupId === groupId;
      }
    } else {
      for (const entry of this.entries.values()) {
        if (entry.groupId === groupId) entry.isSoloed = true;
      }
    }

    this.recalculate();
  }

  /**
   * Unsolo every channel in a named group.
   */
  unsoloGroup(groupId: string): void {
    this.assertNotDisposed();

    for (const entry of this.entries.values()) {
      if (entry.groupId === groupId) entry.isSoloed = false;
    }

    this.recalculate();
  }

  // ─── Core recalculation ───────────────────────────────────────────────────

  /**
   * Recalculate mute states for all channels based on current solo flags.
   * Call this after externally changing solo state via solo()/unsolo().
   */
  recalculate(): void {
    if (this._disposed) return;

    const _soloedEntries = [...this.entries.values()].filter((e) => e.isSoloed);

    if (soloedEntries.length === 0) {
      this.restorePreSoloStates();
      this.emit('updated', { soloed: [], muted: this.mutedIds() });
      return;
    }

    // Capture pre-solo baseline for channels not yet tracked
    for (const entry of this.entries.values()) {
      if (!entry.isSoloed && !this.hasSoloed()) {
        entry.preSoloMute = entry.channel.isMuted();
      }
    }

    const _soloedIds = new Set(soloedEntries.map((e) => e.channel.id));

    // Also unmute channels in the same group as any soloed channel
    const _soloedGroups = new Set(
      soloedEntries
        .map((e) => e.groupId)
        .filter((g): g is string => g !== undefined),
    );

    for (const [id, entry] of this.entries) {
      const _shouldHear =
        soloedIds.has(id) ||
        (entry.groupId !== undefined && soloedGroups.has(entry.groupId));

      // Mute channels that shouldn't be heard; preserve independent mutes on
      // soloed channels
      const _newMute = !shouldHear || (entry.channel.isMuted() && !soloedIds.has(id));
      entry.channel.setMute(newMute);
    }

    this.emit('updated', {
      soloed: [...soloedIds],
      muted:  this.mutedIds(),
    });
  }

  // ─── Pre-solo state ───────────────────────────────────────────────────────

  /**
   * Update the pre-solo baseline for a channel.
   * Call this when mute is changed by the user while no solos are active,
   * so a later clearAllSolos() restores the correct state.
   */
  recordMuteState(id: string): void {
    const _entry = this.entries.get(id);
    if (entry && !this.hasSoloed()) {
      entry.preSoloMute = entry.channel.isMuted();
    }
  }

  private restorePreSoloStates(): void {
    for (const entry of this.entries.values()) {
      try {
        entry.channel.setMute(entry.preSoloMute);
      } catch { /* channel may be disposed */ }
    }
  }

  // ─── Introspection ────────────────────────────────────────────────────────

  hasSoloed(): boolean {
    return [...this.entries.values()].some((e) => e.isSoloed);
  }

  soloedIds(): string[] {
    return [...this.entries.values()]
      .filter((e) => e.isSoloed)
      .map((e) => e.channel.id);
  }

  mutedIds(): string[] {
    return [...this.entries.values()]
      .filter((e) => e.channel.isMuted())
      .map((e) => e.channel.id);
  }

  toJSON() {
    return {
      mode:     this._mode,
      disposed: this._disposed,
      channels: [...this.entries.values()].map((e) => ({
        id:          e.channel.id,
        solo:        e.isSoloed,
        muted:       e.channel.isMuted(),
        preSoloMute: e.preSoloMute,
        groupId:     e.groupId,
      })),
    };
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;

    // Restore all channels before releasing references
    this.restorePreSoloStates();
    this.entries.clear();

    this.emit('disposed', {});
    // Clear listeners after final emit
    Object.keys(this.listeners).forEach((k) => {
      delete this.listeners[k as keyof SoloManagerEventMap];
    });
  }

  // ─── Event emitter ────────────────────────────────────────────────────────

  on<K extends keyof SoloManagerEventMap>(event: K, listener: Listener<K>): this {
    if (!this.listeners[event]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.listeners as any)[event] = new Set();
    }
    (this.listeners[event] as Set<Listener<K>>).add(listener);
    return this;
  }

  off<K extends keyof SoloManagerEventMap>(event: K, listener: Listener<K>): this {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.delete(listener);
    return this;
  }

  once<K extends keyof SoloManagerEventMap>(event: K, listener: Listener<K>): this {
    const wrapper: Listener<K> = (payload) => {
      listener(payload);
      this.off(event, wrapper);
    };
    return this.on(event, wrapper);
  }

  private emit<K extends keyof SoloManagerEventMap>(
    event: K,
    payload: SoloManagerEventMap[K],
  ): void {
    (this.listeners[event] as Set<Listener<K>> | undefined)?.forEach((fn) => fn(payload));
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private assertNotDisposed(): void {
    if (this._disposed) throw new Error('[SoloManager] Instance has been disposed.');
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _soloManager: SoloManager | null = null;

/**
 * Shared SoloManager singleton. Re-creates itself if disposed.
 */
export function getSoloManager(): SoloManager {
  if (!_soloManager || (_soloManager as unknown as { _disposed: boolean })._disposed) {
    _soloManager = new SoloManager();
  }
  return _soloManager;
}

/** Convenience re-export for code that imported the old `soloManager` constant */
export const soloManager: SoloManager = new Proxy({} as SoloManager, {
  get(_target, prop) {
    return getSoloManager()[prop as keyof SoloManager];
  },
});