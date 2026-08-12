// FILE: client/src/audio/clips/ClipTrack.ts
import * as Tone from 'tone';
import { MixerChannel } from '../mixer/mixer-channel';
import { AudioClip } from './audio-clip';
// ─── ClipTrack ────────────────────────────────────────────────────────────────
export class ClipTrack {
    // ─── Constructor ────────────────────────────────────────────────────────────
    constructor({ id, name, rejectOverlaps = false }) {
        this.clips = new Map();
        this._state = 'idle';
        // Track-level flags
        this._muted = false;
        this._solo = false;
        this._armed = false;
        // Typed event emitter
        this.listeners = {};
        this.id = id;
        this.name = name ?? id;
        this.channel = new MixerChannel(id);
        this.rejectOverlaps = rejectOverlaps;
        // Bind handlers so they can be properly removed later
        this._onStop = () => this.handleTransportStop();
        this._onStart = () => { if (this._state !== 'disposed')
            this._state = 'playing'; };
        this._onPause = () => { if (this._state === 'playing')
            this._state = 'idle'; };
        Tone.Transport.on('stop', this._onStop);
        Tone.Transport.on('start', this._onStart);
        Tone.Transport.on('pause', this._onPause);
    }
    // ─── State ──────────────────────────────────────────────────────────────────
    get state() { return this._state; }
    get muted() { return this._muted; }
    get solo() { return this._solo; }
    get armed() { return this._armed; }
    get clipCount() { return this.clips.size; }
    get isEmpty() { return this.clips.size === 0; }
    // ─── Clip Management ─────────────────────────────────────────────────────────
    /**
     * Add a new clip. Throws if a clip with the same id already exists,
     * or (when `rejectOverlaps` is set) if it overlaps an existing clip.
     */
    addClip(config) {
        this.assertNotDisposed();
        if (this.clips.has(config.id)) {
            throw new Error(`Clip "${config.id}" already exists on track "${this.id}".`);
        }
        if (this.rejectOverlaps) {
            const conflict = this.findOverlap(config);
            if (conflict) {
                throw new Error(`Clip "${config.id}" (start=${config.startTime}, ` +
                    `end=${config.startTime + (config.duration ?? this.channel.context.sampleRate)}) ` +
                    `overlaps existing clip "${conflict.id}".`);
            }
        }
        const clip = new AudioClip(config, this.channel);
        // Bubble clip errors up to the track
        clip.on('error', ({ error }) => this.emit('error', { track: this, error }));
        this.clips.set(config.id, clip);
        this.emit('clipAdded', { track: this, clip });
        return clip;
    }
    /**
     * Remove and dispose a clip by id. No-op if the clip doesn't exist.
     */
    removeClip(clipId) {
        const clip = this.clips.get(clipId);
        if (!clip)
            return false;
        clip.dispose();
        this.clips.delete(clipId);
        this.emit('clipRemoved', { track: this, clipId });
        return true;
    }
    /**
     * Atomically replace a clip's config. The old clip is disposed and a new
     * one is scheduled in its place. Throws if `clipId` doesn't exist.
     */
    replaceClip(clipId, config) {
        this.assertNotDisposed();
        const previous = this.clips.get(clipId);
        if (!previous)
            throw new Error(`Clip "${clipId}" not found on track "${this.id}".`);
        previous.dispose();
        const next = new AudioClip({ ...config, id: clipId }, this.channel);
        next.on('error', ({ error }) => this.emit('error', { track: this, error }));
        this.clips.set(clipId, next);
        this.emit('clipReplaced', { track: this, previous, next });
        return next;
    }
    getClip(clipId) {
        return this.clips.get(clipId);
    }
    /**
     * All clips sorted by start time ascending.
     */
    getAllClips() {
        return [...this.clips.values()].sort((a, b) => (a.toJSON().startTime ?? 0) - (b.toJSON().startTime ?? 0));
    }
    /**
     * Clips whose state matches the given filter.
     */
    getClipsByState(state) {
        return this.getAllClips().filter((c) => c.state === state);
    }
    /**
     * Stop all clips without removing them. They can be rescheduled via
     * Tone.Transport restart.
     */
    stopAll() {
        for (const clip of this.clips.values()) {
            clip.stop();
        }
        this.emit('allStopped', { track: this });
    }
    /**
     * Dispose every clip and clear the map — useful for clearing the track
     * contents while keeping the track itself alive.
     */
    clearClips() {
        for (const clip of this.clips.values()) {
            clip.dispose();
        }
        this.clips.clear();
    }
    // ─── Track Controls ──────────────────────────────────────────────────────────
    setMute(muted) {
        if (this._muted === muted)
            return this;
        this._muted = muted;
        this.channel.setMute(muted);
        this.emit('muteChanged', { track: this, muted });
        return this;
    }
    setSolo(solo) {
        if (this._solo === solo)
            return this;
        this._solo = solo;
        // MixerChannel may expose .solo directly or via a method — support both
        if (typeof this.channel.setSolo === 'function') {
            this.channel.setSolo(solo);
        }
        else {
            this.channel.solo = solo;
        }
        this.emit('soloChanged', { track: this, solo });
        return this;
    }
    setArmed(armed) {
        if (this._armed === armed)
            return this;
        this._armed = armed;
        this.emit('armedChanged', { track: this, armed });
        return this;
    }
    setVolume(value) {
        this.channel.setVolume(clamp(value, 0, 1));
        this.emit('volumeChanged', { track: this, value });
        return this;
    }
    setPan(value) {
        this.channel.setPan(clamp(value, -1, 1));
        this.emit('panChanged', { track: this, value });
        return this;
    }
    // ─── Serialisation ────────────────────────────────────────────────────────────
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            state: this._state,
            muted: this._muted,
            solo: this._solo,
            armed: this._armed,
            clips: this.getAllClips().map((c) => c.toJSON()),
        };
    }
    // ─── Lifecycle ────────────────────────────────────────────────────────────────
    dispose() {
        if (this._state === 'disposed')
            return;
        // Remove Tone listeners before clearing clips to avoid re-entrant calls
        Tone.Transport.off('stop', this._onStop);
        Tone.Transport.off('start', this._onStart);
        Tone.Transport.off('pause', this._onPause);
        this.clearClips();
        this.channel.disconnect();
        this._state = 'disposed';
        this.emit('disposed', { track: this });
        this.listeners = {};
    }
    // ─── Event Emitter ────────────────────────────────────────────────────────────
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
    // ─── Private Helpers ─────────────────────────────────────────────────────────
    handleTransportStop() {
        if (this._state === 'disposed')
            return;
        this.stopAll();
        this._state = 'idle';
    }
    assertNotDisposed() {
        if (this._state === 'disposed') {
            throw new Error(`ClipTrack "${this.id}" has been disposed.`);
        }
    }
    /**
     * Returns the first existing clip that would overlap `incoming`, or null.
     * Overlap = the two time ranges intersect (exclusive of shared endpoints).
     */
    findOverlap(incoming) {
        const inStart = incoming.startTime;
        const inEnd = inStart + (incoming.duration ?? Infinity);
        for (const clip of this.clips.values()) {
            const { startTime, duration } = clip.toJSON();
            const exStart = startTime ?? 0;
            const exEnd = exStart + (duration ?? Infinity);
            if (inStart < exEnd && inEnd > exStart)
                return clip;
        }
        return null;
    }
}
// ─── Utilities ────────────────────────────────────────────────────────────────
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
