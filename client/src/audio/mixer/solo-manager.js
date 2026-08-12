// ─── SoloManager ─────────────────────────────────────────────────────────────
export class SoloManager {
    constructor() {
        this.entries = new Map();
        this._mode = 'additive';
        this._disposed = false;
        /** In exclusive mode, track which channel was soloed last */
        this.lastSoloedId = null;
        this.listeners = {};
    }
    // ─── Mode ──────────────────────────────────────────────────────────────────
    get mode() { return this._mode; }
    setMode(mode) {
        this.assertNotDisposed();
        if (this._mode === mode)
            return;
        this._mode = mode;
        this.emit('modeChanged', { mode });
        this.recalculate();
    }
    // ─── Registration ──────────────────────────────────────────────────────────
    /**
     * Register a channel with the manager.
     * The current mute state is captured as the pre-solo baseline.
     */
    register(channel, groupId) {
        this.assertNotDisposed();
        if (this.entries.has(channel.id)) {
            // Re-registering — update group without resetting pre-solo state
            const entry = this.entries.get(channel.id);
            entry.groupId = groupId;
            return;
        }
        this.entries.set(channel.id, {
            channel,
            isSoloed: false,
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
    unregister(id) {
        const entry = this.entries.get(id);
        if (!entry)
            return;
        // Restore pre-solo mute before removing
        try {
            entry.channel.setMute(entry.preSoloMute);
        }
        catch { /* channel may already be disposed */ }
        this.entries.delete(id);
        if (this.lastSoloedId === id) {
            this.lastSoloedId = null;
        }
        this.emit('unregistered', { id });
        // Recalculate in case the removed channel was soloed
        this.recalculate();
    }
    getChannel(id) {
        return this.entries.get(id)?.channel;
    }
    get channelIds() {
        return [...this.entries.keys()];
    }
    get count() {
        return this.entries.size;
    }
    // ─── Solo control ─────────────────────────────────────────────────────────
    /**
     * Programmatically solo a channel by id.
     * In exclusive mode, this clears all other solos first.
     */
    solo(id) {
        this.assertNotDisposed();
        const entry = this.entries.get(id);
        if (!entry) {
            console.warn(`[SoloManager] solo: channel "${id}" not registered`);
            return;
        }
        if (this._mode === 'exclusive') {
            // Clear all other solos without recalculating until done
            for (const [otherId, otherEntry] of this.entries) {
                if (otherId !== id)
                    otherEntry.isSoloed = false;
            }
        }
        entry.isSoloed = true;
        this.lastSoloedId = id;
        this.recalculate();
    }
    /**
     * Programmatically unsolo a channel by id.
     */
    unsolo(id) {
        this.assertNotDisposed();
        const entry = this.entries.get(id);
        if (!entry)
            return;
        entry.isSoloed = false;
        if (this.lastSoloedId === id)
            this.lastSoloedId = null;
        this.recalculate();
    }
    /**
     * Toggle the solo state of a channel by id.
     */
    toggleSolo(id) {
        const entry = this.entries.get(id);
        if (!entry)
            return;
        if (entry.isSoloed) {
            this.unsolo(id);
        }
        else {
            this.solo(id);
        }
    }
    /**
     * Returns true if the given channel is currently soloed.
     */
    isSoloed(id) {
        return this.entries.get(id)?.isSoloed ?? false;
    }
    /**
     * Remove all solos and restore every channel to its pre-solo mute state.
     */
    clearAllSolos() {
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
    soloGroup(groupId) {
        this.assertNotDisposed();
        if (this._mode === 'exclusive') {
            for (const entry of this.entries.values()) {
                entry.isSoloed = entry.groupId === groupId;
            }
        }
        else {
            for (const entry of this.entries.values()) {
                if (entry.groupId === groupId)
                    entry.isSoloed = true;
            }
        }
        this.recalculate();
    }
    /**
     * Unsolo every channel in a named group.
     */
    unsoloGroup(groupId) {
        this.assertNotDisposed();
        for (const entry of this.entries.values()) {
            if (entry.groupId === groupId)
                entry.isSoloed = false;
        }
        this.recalculate();
    }
    // ─── Core recalculation ───────────────────────────────────────────────────
    /**
     * Recalculate mute states for all channels based on current solo flags.
     * Call this after externally changing solo state via solo()/unsolo().
     */
    recalculate() {
        if (this._disposed)
            return;
        const soloedEntries = [...this.entries.values()].filter((e) => e.isSoloed);
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
        const soloedIds = new Set(soloedEntries.map((e) => e.channel.id));
        // Also unmute channels in the same group as any soloed channel
        const soloedGroups = new Set(soloedEntries
            .map((e) => e.groupId)
            .filter((g) => g !== undefined));
        for (const [id, entry] of this.entries) {
            const shouldHear = soloedIds.has(id) ||
                (entry.groupId !== undefined && soloedGroups.has(entry.groupId));
            // Mute channels that shouldn't be heard; preserve independent mutes on
            // soloed channels
            const newMute = !shouldHear || (entry.channel.isMuted() && !soloedIds.has(id));
            entry.channel.setMute(newMute);
        }
        this.emit('updated', {
            soloed: [...soloedIds],
            muted: this.mutedIds(),
        });
    }
    // ─── Pre-solo state ───────────────────────────────────────────────────────
    /**
     * Update the pre-solo baseline for a channel.
     * Call this when mute is changed by the user while no solos are active,
     * so a later clearAllSolos() restores the correct state.
     */
    recordMuteState(id) {
        const entry = this.entries.get(id);
        if (entry && !this.hasSoloed()) {
            entry.preSoloMute = entry.channel.isMuted();
        }
    }
    restorePreSoloStates() {
        for (const entry of this.entries.values()) {
            try {
                entry.channel.setMute(entry.preSoloMute);
            }
            catch { /* channel may be disposed */ }
        }
    }
    // ─── Introspection ────────────────────────────────────────────────────────
    hasSoloed() {
        return [...this.entries.values()].some((e) => e.isSoloed);
    }
    soloedIds() {
        return [...this.entries.values()]
            .filter((e) => e.isSoloed)
            .map((e) => e.channel.id);
    }
    mutedIds() {
        return [...this.entries.values()]
            .filter((e) => e.channel.isMuted())
            .map((e) => e.channel.id);
    }
    toJSON() {
        return {
            mode: this._mode,
            disposed: this._disposed,
            channels: [...this.entries.values()].map((e) => ({
                id: e.channel.id,
                solo: e.isSoloed,
                muted: e.channel.isMuted(),
                preSoloMute: e.preSoloMute,
                groupId: e.groupId,
            })),
        };
    }
    // ─── Lifecycle ────────────────────────────────────────────────────────────
    dispose() {
        if (this._disposed)
            return;
        this._disposed = true;
        // Restore all channels before releasing references
        this.restorePreSoloStates();
        this.entries.clear();
        this.emit('disposed', {});
        // Clear listeners after final emit
        Object.keys(this.listeners).forEach((k) => {
            delete this.listeners[k];
        });
    }
    // ─── Event emitter ────────────────────────────────────────────────────────
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
    // ─── Private helpers ──────────────────────────────────────────────────────
    assertNotDisposed() {
        if (this._disposed)
            throw new Error('[SoloManager] Instance has been disposed.');
    }
}
// ─── Singleton ────────────────────────────────────────────────────────────────
let _soloManagerInstance = null;
/**
 * Shared SoloManager singleton. Re-creates itself if disposed.
 */
export function getSoloManager() {
    if (!_soloManagerInstance || _soloManagerInstance._disposed) {
        _soloManagerInstance = new SoloManager();
    }
    return _soloManagerInstance;
}
/** Convenience re-export for code that imported the old `soloManager` constant */
export const soloManager = new Proxy({}, {
    get(_target, prop) {
        return getSoloManager()[prop];
    },
});
