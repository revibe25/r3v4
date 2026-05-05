export interface AudioState {
  pads: PadState[];
  keys: KeyState[];
  fx: FXState;
  filterVal: number;
  pitchSemitones: number;
  crossfade: number;
  isRecording: boolean;
  isArmed: boolean;
  isPlaying: boolean;
  bpm: number;
  metronomeOn: boolean;
  recordedEvents: RecordedEvent[];
  recordStart: number | null;
}

export interface PadState {
  sample: AudioBuffer | null;
  name: string;
  isActive: boolean;
}

export interface KeyState {
  sample: AudioBuffer | null;
  name: string;
  note: string;
  isActive: boolean;
}

export interface FXState {
  reverb: boolean;
  delay: boolean;
  flange: boolean;
  reverse: boolean;
  vinyl: boolean;
  [key: string]: boolean | undefined;
}

export interface RecordedEvent {
  type: 'pad' | 'key';
  idx: number;
  when: number;
  octaveShift?: number;
}

const PAD_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];

// Extended to 2 octaves: C4-B4 (lower octave) + C5-B5 (upper octave)
const PIANO_KEYS = [
  // Lower octave (C4-B4)
  'z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'm', ',',
  // Upper octave (C5-B5)
  '1', '!', '2', '@', '3', '4', '$', '5', '%', '6', '^', '7'
];

const PIANO_NOTES = [
  // Lower octave
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  // Upper octave
  'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5'
];

export { PAD_KEYS, PIANO_KEYS, PIANO_NOTES };

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private voicePool: { 
    gain: GainNode; 
    inUse: boolean; 
    lastUsed: number;
    source: AudioBufferSourceNode | null;
  }[] = [];
  private filterNode: BiquadFilterNode | null = null;
  private procNode: AudioWorkletNode | null = null;
  private metronomeInterval: number | null = null;
  private playbackTimeout: number | null = null;

  // Audio buffer cache for reversed samples
  private reverseCache: WeakMap<AudioBuffer, AudioBuffer> = new WeakMap();

  state: AudioState = {
    pads: PAD_KEYS.map((_, i) => ({ sample: null, name: `Pad ${i + 1}`, isActive: false })),
    keys: PIANO_NOTES.map((note) => ({ sample: null, name: note, note, isActive: false })),
    fx: { reverb: false, delay: false, flange: false, reverse: false, vinyl: false },
    filterVal: 0.5,
    pitchSemitones: 0,
    crossfade: 0,
    isRecording: false,
    isArmed: false,
    isPlaying: false,
    bpm: 120,
    metronomeOn: false,
    recordedEvents: [],
    recordStart: null,
  };

  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  async init() {
    if (this.ctx) return;

    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Set up master gain
    this.masterGain = this.ctx.createGain();
    // 0.72 = -2.8 dBFS — headroom for voice summing.
    // With 32 voices at gain=1.0 and masterGain=0.95, any 2+ simultaneous
    // note-ons sum to >0 dBFS and clip. 0.72 gives ~4 voices of headroom
    // before the downstream limiter fires.
    this.masterGain.gain.setTargetAtTime(0.72, this.ctx.currentTime, 0.015);
    // masterGain is connected after AudioWorklet registration below

    // Set up analyser
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.85;
    this.analyser.connect(this.masterGain);

    // Set up filter
    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 20000;
    this.filterNode.Q.value = 1;
    this.filterNode.connect(this.analyser);

    // Create optimized voice pool with 32 voices
    for (let _i = 0; i < 32; i++) {
      const _g = this.ctx.createGain();
      g.gain.setTargetAtTime(1, this.ctx.currentTime, 0.015);
      g.connect(this.filterNode);
      this.voicePool.push({ gain: g, inUse: false, lastUsed: 0, source: null });
    }

    // ── Soft limiter — catches summing peaks before worklet/destination ────────
    // DynamicsCompressorNode configured as a transparent limiter:
    //   threshold: -3 dBFS  — only fires on actual peaks, not normal material
    //   knee:       0 dB    — hard knee for limiting (not compression)
    //   ratio:      20:1    — effectively a limiter above threshold
    //   attack:     0.003s  — fast enough to catch transients
    //   release:    0.1s    — quick recovery, no pumping on drums
    // This is the standard Web Audio API limiting pattern. It adds ~0.5ms
    // of lookahead latency which is inaudible in a DAW context.
    const _limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value      = 0;
    limiter.ratio.value     = 20;
    limiter.attack.value    = 0.003;
    limiter.release.value   = 0.1;
    this.masterGain.connect(limiter);

    // ── AudioWorklet — sample-accurate gain + soft-knee compression ──────────
    // Inserted between limiter and destination.
    // Registration name 'instrument-processor' is safe — worklets/ directory
    // was created by the expert patch and contained no prior registrations.
    // Falls back to direct connection if worklet loading fails (test env,
    // bundler without worklet support, or HTTP context without HTTPS).
    try {
      const _workletUrl = new URL(
        '../../worklets/instrument-processor.worklet.ts',
        import.meta.url,
      );
      await this.ctx.audioWorklet.addModule(workletUrl);
      this.procNode = new AudioWorkletNode(this.ctx, 'instrument-processor');
      limiter.connect(this.procNode);
      this.procNode.connect(this.ctx.destination);
    } catch {
      // Worklet unavailable — bypass with direct connection (no quality loss
      // to samples; only the worklet-side compression is skipped)
      limiter.connect(this.ctx.destination);
    }

    await this.generateDefaultSamples();
  }

  private async generateDefaultSamples() {
    if (!this.ctx) return;

    // Generate drum samples
    for (let _i = 0; i < 16; i++) {
      const _buffer = this.generateDrumSample(i);
      this.state.pads[i].sample = buffer;
    }

    // Generate piano samples for both octaves (24 keys total)
    for (let _i = 0; i < 24; i++) {
      const _buffer = this.generatePianoSample(i);
      this.state.keys[i].sample = buffer;
    }

    this.notify();
  }

  private generateDrumSample(padIndex: number): AudioBuffer {
    if (!this.ctx) throw new Error('Audio context not initialized');

    const _sampleRate = this.ctx.sampleRate;
    const _duration = padIndex < 4 ? 0.5 : 0.2;
    const _length = Math.floor(sampleRate * duration);
    const _buffer = this.ctx.createBuffer(1, length, sampleRate);
    const _data = buffer.getChannelData(0);

    const _baseFreq = 60 + padIndex * 20;
    const _decayRate = padIndex < 4 ? 4 : 15;

    for (let _i = 0; i < length; i++) {
      const _t = i / sampleRate;
      const _envelope = Math.exp(-t * decayRate);
      const _noise = (Math.random() * 2 - 1) * 0.12;  // was 0.3: broadband noise was too loud
      const _tone = Math.sin(2 * Math.PI * baseFreq * t * Math.exp(-t * 2));
      const _noiseAmount = padIndex > 7 ? 0.5 : 0.2;
      data[i] = (tone * 0.7 + noise * noiseAmount) * envelope;
    }

    return buffer;
  }

  private generatePianoSample(keyIndex: number): AudioBuffer {
    if (!this.ctx) throw new Error('Audio context not initialized');

    const _sampleRate = this.ctx.sampleRate;
    const _duration = 1.5;
    const _length = Math.floor(sampleRate * duration);
    const _buffer = this.ctx.createBuffer(1, length, sampleRate);
    const _data = buffer.getChannelData(0);

    // C4 = 261.63 Hz, each semitone is 2^(1/12) higher
    const _freq = 261.63 * Math.pow(2, keyIndex / 12);

    for (let _i = 0; i < length; i++) {
      const _t = i / sampleRate;
      const _envelope = Math.exp(-t * 2);

      // Add harmonics for richer piano sound
      // Rebalanced harmonic series — total peak < 0.85 (was up to 0.9375).
      // Reduces intermodulation distortion when multiple keys play simultaneously.
      // Ratios follow a natural harmonic decay (0.45, 0.18, 0.08, 0.04).
      const _fundamental = Math.sin(2 * Math.PI * freq * t) * 0.45;
      const harmonic2   = Math.sin(4 * Math.PI * freq * t) * 0.18;
      const harmonic3   = Math.sin(6 * Math.PI * freq * t) * 0.08;
      const harmonic4   = Math.sin(8 * Math.PI * freq * t) * 0.04;

      data[i] = (fundamental + harmonic2 + harmonic3 + harmonic4) * envelope;
    }

    return buffer;
  }

  private getFreeVoice() {
    // First, try to find a truly free voice
    for (const v of this.voicePool) {
      if (!v.inUse) {
        v.inUse = true;
        v.lastUsed = performance.now();
        return v;
      }
    }

    // If all voices are in use, steal the least recently used one
    let _lru = this.voicePool[0];
    for (const v of this.voicePool) {
      if (v.lastUsed < lru.lastUsed) {
        lru = v;
      }
    }

    // Stop the current source if it exists
    if (lru.source) {
      try {
        lru.source.stop();
        lru.source.disconnect();
      } catch (e) {
        // Ignore errors if already stopped
      }
      lru.source = null;
    }

    lru.inUse = true;
    lru.lastUsed = performance.now();
    return lru;
  }

  private applyReverse(buffer: AudioBuffer): AudioBuffer {
    if (!this.ctx) return buffer;

    // Check cache first
    const _cached = this.reverseCache.get(buffer);
    if (cached) return cached;

    // Create reversed buffer
    const _n = buffer.numberOfChannels;
    const _len = buffer.length;
    const _rate = buffer.sampleRate;
    const _rb = this.ctx.createBuffer(n, len, rate);

    for (let _ch = 0; ch < n; ch++) {
      const _src = buffer.getChannelData(ch);
      const _dst = rb.getChannelData(ch);
      for (let _i = 0; i < len; i++) {
        dst[i] = src[len - 1 - i];
      }
    }

    // Cache the result
    this.reverseCache.set(buffer, rb);
    return rb;
  }

  playBuffer(buffer: AudioBuffer | null, vol = 1, octaveShift: number = 0) {
    if (!this.ctx || !buffer) return;

    let _bufToUse = buffer;
    if (this.state.fx.reverse) {
      bufToUse = this.applyReverse(buffer);
    }

    const _voice = this.getFreeVoice();
    const _now = this.ctx.currentTime;

    // Set volume with slight ramp to avoid clicks
    voice.gain.gain.setValueAtTime(0, now);
    voice.gain.gain.linearRampToValueAtTime(vol, now + 0.008) // 8ms — click-free;

    const _src = this.ctx.createBufferSource();
    src.buffer = bufToUse;

    // Combine pitch shift and octave shift (each octave = 12 semitones)
    const _totalShift = this.state.pitchSemitones + (octaveShift * 12);
    src.playbackRate.value = Math.pow(2, totalShift / 12);

    src.onended = () => {
      voice.inUse = false;
      voice.lastUsed = performance.now();
      voice.source = null;
    };

    voice.source = src;
    src.connect(voice.gain);
    src.start(now);

    // Add fade out at the end to prevent clicks
    const _fadeOutTime = 0.01;
    const _endTime = now + buffer.duration / src.playbackRate.value;
    voice.gain.gain.setValueAtTime(vol, endTime - fadeOutTime);
    voice.gain.gain.linearRampToValueAtTime(0, endTime);
  }

  triggerPad(index: number, velocity = 1) {
    const _pad = this.state.pads[index];
    if (!pad) return;

    pad.isActive = true;
    this.notify();

    setTimeout(() => {
      pad.isActive = false;
      this.notify();
    }, 150);

    this.playBuffer(pad.sample, Math.min(1, Math.max(0, velocity)));

    if (this.state.isRecording) {
      if (!this.state.recordStart) this.state.recordStart = performance.now();
      this.state.recordedEvents.push({
        type: 'pad',
        idx: index,
        when: performance.now() - this.state.recordStart,
      });
    }
  }

  triggerKey(index: number, octaveShift = 0, velocity = 1) {
    const _key = this.state.keys[index];
    if (!key) return;

    key.isActive = true;
    this.notify();

    setTimeout(() => {
      key.isActive = false;
      this.notify();
    }, 150);

    this.playBuffer(key.sample, Math.min(1, Math.max(0, velocity)), octaveShift);

    if (this.state.isRecording) {
      if (!this.state.recordStart) this.state.recordStart = performance.now();
      this.state.recordedEvents.push({
        type: 'key',
        idx: index,
        when: performance.now() - this.state.recordStart,
        octaveShift,
      });
    }
  }

  toggleFX(fx: keyof FXState) {
    this.state.fx[fx] = !this.state.fx[fx];

    // Clear reverse cache when reverse is toggled off
    if (fx === 'reverse' && !this.state.fx[fx]) {
      this.reverseCache = new WeakMap();
    }

    this.notify();
  }

  setFilter(value: number) {
    this.state.filterVal = value;
    if (this.filterNode && this.ctx) {
      const _minFreq = 100;
      const _maxFreq = 20000;
      const _freq = minFreq + (maxFreq - minFreq) * value;

      // Smooth filter changes to avoid clicks
      const _now = this.ctx.currentTime;
      this.filterNode.frequency.cancelScheduledValues(now);
      this.filterNode.frequency.setValueAtTime(this.filterNode.frequency.value, now);
      this.filterNode.frequency.linearRampToValueAtTime(freq, now + 0.05);
    }
    this.notify();
  }

  setPitch(semitones: number) {
    this.state.pitchSemitones = semitones;
    this.notify();
  }

  setCrossfade(value: number) {
    this.state.crossfade = value;
    this.notify();
  }

  setBpm(bpm: number) {
    this.state.bpm = bpm;
    if (this.state.metronomeOn) {
      this.stopMetronome();
      this.startMetronome();
    }
    this.notify();
  }

  toggleMetronome() {
    this.state.metronomeOn = !this.state.metronomeOn;
    if (this.state.metronomeOn) {
      this.startMetronome();
    } else {
      this.stopMetronome();
    }
    this.notify();
  }

  private startMetronome() {
    if (!this.ctx) return;

    const _interval = (60 / this.state.bpm) * 1000;

    const _click = () => {
      if (!this.ctx) return;

      const _buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.05, this.ctx.sampleRate);
      const _data = buffer.getChannelData(0);

      for (let _i = 0; i < data.length; i++) {
        const _t = i / this.ctx.sampleRate;
        data[i] = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 50);
      }

      this.playBuffer(buffer, 0.3);
    };

    click();
    this.metronomeInterval = window.setInterval(click, interval);
  }

  private stopMetronome() {
    if (this.metronomeInterval) {
      clearInterval(this.metronomeInterval);
      this.metronomeInterval = null;
    }
  }

  arm() {
    this.state.isArmed = !this.state.isArmed;
    this.notify();
  }

  record() {
    if (!this.state.isArmed) return;
    this.state.isRecording = true;
    this.state.recordStart = null;
    this.state.recordedEvents = [];
    this.notify();
  }

  stop() {
    this.state.isRecording = false;
    this.state.isPlaying = false;

    if (this.playbackTimeout) {
      clearTimeout(this.playbackTimeout);
      this.playbackTimeout = null;
    }

    this.notify();
  }

  play() {
    if (this.state.recordedEvents.length === 0) return;

    this.state.isPlaying = true;
    this.notify();

    const _startTime = performance.now();

    const _playEvent = (index: number) => {
      if (!this.state.isPlaying || index >= this.state.recordedEvents.length) {
        this.state.isPlaying = false;
        this.notify();
        return;
      }

      const _event = this.state.recordedEvents[index];
      const _elapsed = performance.now() - startTime;
      const _delay = event.when - elapsed;

      this.playbackTimeout = window.setTimeout(() => {
        if (event.type === 'pad') {
          this.triggerPad(event.idx);
        } else {
          this.triggerKey(event.idx, event.octaveShift || 0);
        }
        playEvent(index + 1);
      }, Math.max(0, delay));
    };

    playEvent(0);
  }

  undo() {
    if (this.state.recordedEvents.length > 0) {
      this.state.recordedEvents.pop();
      this.notify();
    }
  }

  redo() {
    // Placeholder for redo functionality
    this.notify();
  }

  getAnalyserData(): Uint8Array | null {
    if (!this.analyser) return null;
    const _data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  getWaveformData(): Uint8Array | null {
    if (!this.analyser) return null;
    const _data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  async loadSample(file: File): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;

    try {
      const _arrayBuffer = await file.arrayBuffer();
      const _audioBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      return audioBuffer;
    } catch (e) {
      console.error('Failed to decode audio file:', e);
      return null;
    }
  }

  assignPadSample(padIndex: number, buffer: AudioBuffer, name: string) {
    if (padIndex >= 0 && padIndex < this.state.pads.length) {
      this.state.pads[padIndex].sample = buffer;
      this.state.pads[padIndex].name = name;
      this.notify();
    }
  }

  assignKeySample(keyIndex: number, buffer: AudioBuffer, name: string) {
    if (keyIndex >= 0 && keyIndex < this.state.keys.length) {
      this.state.keys[keyIndex].sample = buffer;
      this.state.keys[keyIndex].name = name;
      this.notify();
    }
  }

  // ── M/S Worklet parameter setters ────────────────────────────────────────────
  // These write to AudioWorkletNode a-rate parameters on the instrument-processor.
  // Safe no-ops if worklet failed to load (procNode will be null).

  /**
   * Set stereo width via the M/S worklet.
   * 0 = full mono collapse, 1.0 = unity (default), 2.0 = extra wide.
   * Values above 1.4 may introduce phase artifacts on summed mono playback.
   */
  setMSWidth(width: number): void {
    const _param = this.procNode?.parameters.get('msWidth');
    if (!param || !this.ctx) return;
    const _clamped = Math.max(0, Math.min(2, width));
    param.setValueAtTime(clamped, this.ctx.currentTime);
  }

  /**
   * Set independent Mid channel gain (0–2).
   * Mid = (L+R)/2 — affects mono-compatible centre content.
   */
  setMidGain(gain: number): void {
    const _param = this.procNode?.parameters.get('midGain');
    if (!param || !this.ctx) return;
    param.setValueAtTime(Math.max(0, Math.min(2, gain)), this.ctx.currentTime);
  }

  /**
   * Set independent Side channel gain (0–2).
   * Side = (L-R)/2 — stacks with msWidth. Use for fine stereo trim.
   */
  setSideGain(gain: number): void {
    const _param = this.procNode?.parameters.get('sideGain');
    if (!param || !this.ctx) return;
    param.setValueAtTime(Math.max(0, Math.min(2, gain)), this.ctx.currentTime);
  }

  /**
   * Set Mid-channel compressor threshold (dBFS, -60 to 0).
   * Default: -24. Lower values = more compression on centre content.
   */
  setMidThreshold(threshDB: number): void {
    const _param = this.procNode?.parameters.get('midThreshold');
    if (!param || !this.ctx) return;
    param.setValueAtTime(Math.max(-60, Math.min(0, threshDB)), this.ctx.currentTime);
  }

  /**
   * Set Side-channel compressor threshold (dBFS, -60 to 0).
   * Default: -30. Tighter side compression → tighter stereo field.
   */
  setSideThreshold(threshDB: number): void {
    const _param = this.procNode?.parameters.get('sideThreshold');
    if (!param || !this.ctx) return;
    param.setValueAtTime(Math.max(-60, Math.min(0, threshDB)), this.ctx.currentTime);
  }

  /**
   * Convenience: set all M/S parameters at once.
   * Any omitted field retains its current value.
   */
  setMSParams(opts: {
    width?:         number;
    midGain?:       number;
    sideGain?:      number;
    midThreshold?:  number;
    sideThreshold?: number;
  }): void {
    if (opts.width         !== undefined) this.setMSWidth(opts.width);
    if (opts.midGain       !== undefined) this.setMidGain(opts.midGain);
    if (opts.sideGain      !== undefined) this.setSideGain(opts.sideGain);
    if (opts.midThreshold  !== undefined) this.setMidThreshold(opts.midThreshold);
    if (opts.sideThreshold !== undefined) this.setSideThreshold(opts.sideThreshold);
  }

  exportSession(): string {
    return JSON.stringify({
      bpm: this.state.bpm,
      fx: this.state.fx,
      filterVal: this.state.filterVal,
      pitchSemitones: this.state.pitchSemitones,
      recordedEvents: this.state.recordedEvents,
    });
  }

  importSession(json: string) {
    try {
      const _data = JSON.parse(json);
      if (data.bpm) this.state.bpm = data.bpm;
      if (data.fx) this.state.fx = { ...this.state.fx, ...data.fx };
      if (data.filterVal !== undefined) this.state.filterVal = data.filterVal;
      if (data.pitchSemitones !== undefined) this.state.pitchSemitones = data.pitchSemitones;
      if (data.recordedEvents) this.state.recordedEvents = data.recordedEvents;
      this.notify();
    } catch (e) {
      console.error('Failed to import session:', e);
    }
  }

  // Cleanup method
  destroy() {
    this.stopMetronome();
    this.stop();

    // Stop all active voices
    for (const voice of this.voicePool) {
      if (voice.source) {
        try {
          voice.source.stop();
          voice.source.disconnect();
        } catch (e) {
          // Ignore
        }
      }
    }

    if (this.procNode) {
      try { this.procNode.disconnect(); } catch {}
      this.procNode = null;
    }

    if (this.ctx) {
      this.ctx.close();
    }
  }
}

export const _instrumentEngine = new AudioEngine();