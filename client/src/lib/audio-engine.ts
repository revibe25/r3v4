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
}

export interface RecordedEvent {
  type: 'pad' | 'key';
  idx: number;
  when: number;
}

const PAD_KEYS = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];

const PIANO_KEYS = [
  'z', 's', 'x', 'd', 'c', 'v', 'g', 'b', 'h', 'n', 'm', ',',
  '1', '!', '2', '@', '3', '4', '$', '5', '%', '6', '^', '7'
];

const PIANO_NOTES = [
  'C4', 'C#4', 'D4', 'D#4', 'E4', 'F4', 'F#4', 'G4', 'G#4', 'A4', 'A#4', 'B4',
  'C5', 'C#5', 'D5', 'D#5', 'E5', 'F5', 'F#5', 'G5', 'G#5', 'A5', 'A#5', 'B5'
];

export { PAD_KEYS, PIANO_KEYS, PIANO_NOTES };

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private voicePool: { gain: GainNode; inUse: boolean; lastUsed: number }[] = [];
  private filterNode: BiquadFilterNode | null = null;
  private metronomeInterval: number | null = null;
  private playbackTimeout: number | null = null;

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
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.95;
    this.masterGain.connect(this.ctx.destination);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.connect(this.masterGain);

    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = 20000;
    this.filterNode.connect(this.analyser);

    for (let i = 0; i < 32; i++) {
      const g = this.ctx.createGain();
      g.gain.value = 1;
      g.connect(this.filterNode);
      this.voicePool.push({ gain: g, inUse: false, lastUsed: 0 });
    }

    await this.generateDefaultSamples();
  }

  private async generateDefaultSamples() {
    if (!this.ctx) return;

    for (let i = 0; i < 16; i++) {
      const buffer = this.generateDrumSample(i);
      this.state.pads[i].sample = buffer;
    }

    for (let i = 0; i < 24; i++) {
      const buffer = this.generatePianoSample(i);
      this.state.keys[i].sample = buffer;
    }

    this.notify();
  }

  private generateDrumSample(padIndex: number): AudioBuffer {
    if (!this.ctx) throw new Error('Audio context not initialized');
    const sampleRate = this.ctx.sampleRate;
    const duration = padIndex < 4 ? 0.5 : 0.2;
    const length = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const baseFreq = 60 + padIndex * 20;
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * (padIndex < 4 ? 4 : 15));
      const noise = (Math.random() * 2 - 1) * 0.3;
      const tone = Math.sin(2 * Math.PI * baseFreq * t * Math.exp(-t * 2));
      data[i] = (tone * 0.7 + noise * (padIndex > 7 ? 0.5 : 0.2)) * envelope;
    }
    return buffer;
  }

  private generatePianoSample(keyIndex: number): AudioBuffer {
    if (!this.ctx) throw new Error('Audio context not initialized');
    const sampleRate = this.ctx.sampleRate;
    const duration = 1.5;
    const length = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    const freq = 261.63 * Math.pow(2, keyIndex / 12);
    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      const envelope = Math.exp(-t * 2);
      const wave = Math.sin(2 * Math.PI * freq * t) * 0.5 +
                   Math.sin(4 * Math.PI * freq * t) * 0.25 +
                   Math.sin(6 * Math.PI * freq * t) * 0.125;
      data[i] = wave * envelope;
    }
    return buffer;
  }

  private getFreeVoice() {
    for (const v of this.voicePool) {
      if (!v.inUse) {
        v.inUse = true;
        v.lastUsed = performance.now();
        return v;
      }
    }
    let lru = this.voicePool[0];
    for (const v of this.voicePool) {
      if (v.lastUsed < lru.lastUsed) lru = v;
    }
    lru.inUse = true;
    lru.lastUsed = performance.now();
    return lru;
  }

  private applyReverse(buffer: AudioBuffer): AudioBuffer {
    if (!this.ctx) return buffer;
    const n = buffer.numberOfChannels;
    const len = buffer.length;
    const rate = buffer.sampleRate;
    const rb = this.ctx.createBuffer(n, len, rate);
    for (let ch = 0; ch < n; ch++) {
      const src = buffer.getChannelData(ch);
      const dst = rb.getChannelData(ch);
      for (let i = 0; i < len; i++) dst[i] = src[len - 1 - i];
    }
    return rb;
  }

  playBuffer(buffer: AudioBuffer | null, vol = 1) {
    if (!this.ctx || !buffer) return;

    let bufToUse = buffer;
    if (this.state.fx.reverse) {
      bufToUse = this.applyReverse(buffer);
    }

    const voice = this.getFreeVoice();
    const now = this.ctx.currentTime;
    voice.gain.gain.setValueAtTime(vol, now);

    const src = this.ctx.createBufferSource();
    src.buffer = bufToUse;
    src.playbackRate.value = Math.pow(2, this.state.pitchSemitones / 12);
    src.onended = () => {
      voice.inUse = false;
      voice.lastUsed = performance.now();
    };
    src.connect(voice.gain);
    src.start(now);
  }

  triggerPad(index: number) {
    const pad = this.state.pads[index];
    if (!pad) return;

    pad.isActive = true;
    this.notify();
    setTimeout(() => {
      pad.isActive = false;
      this.notify();
    }, 150);

    this.playBuffer(pad.sample);

    if (this.state.isRecording) {
      if (!this.state.recordStart) this.state.recordStart = performance.now();
      this.state.recordedEvents.push({
        type: 'pad',
        idx: index,
        when: performance.now() - this.state.recordStart,
      });
    }
  }

  triggerKey(index: number) {
    const key = this.state.keys[index];
    if (!key) return;

    key.isActive = true;
    this.notify();
    setTimeout(() => {
      key.isActive = false;
      this.notify();
    }, 150);

    this.playBuffer(key.sample);

    if (this.state.isRecording) {
      if (!this.state.recordStart) this.state.recordStart = performance.now();
      this.state.recordedEvents.push({
        type: 'key',
        idx: index,
        when: performance.now() - this.state.recordStart,
      });
    }
  }

  toggleFX(fx: keyof FXState) {
    this.state.fx[fx] = !this.state.fx[fx];
    this.notify();
  }

  setFilter(value: number) {
    this.state.filterVal = value;
    if (this.filterNode && this.ctx) {
      const minFreq = 100;
      const maxFreq = 20000;
      this.filterNode.frequency.value = minFreq + (maxFreq - minFreq) * value;
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
    const interval = (60 / this.state.bpm) * 1000;
    const click = () => {
      const buffer = this.ctx!.createBuffer(1, this.ctx!.sampleRate * 0.05, this.ctx!.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.sin(2 * Math.PI * 880 * (i / this.ctx!.sampleRate)) * Math.exp(-i / data.length * 5);
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

    const startTime = performance.now();
    const playEvent = (index: number) => {
      if (!this.state.isPlaying || index >= this.state.recordedEvents.length) {
        this.state.isPlaying = false;
        this.notify();
        return;
      }

      const event = this.state.recordedEvents[index];
      const elapsed = performance.now() - startTime;
      const delay = event.when - elapsed;

      this.playbackTimeout = window.setTimeout(() => {
        if (event.type === 'pad') {
          this.triggerPad(event.idx);
        } else {
          this.triggerKey(event.idx);
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
    this.notify();
  }

  getAnalyserData(): Uint8Array | null {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    return data;
  }

  getWaveformData(): Uint8Array | null {
    if (!this.analyser) return null;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteTimeDomainData(data);
    return data;
  }

  async loadSample(file: File): Promise<AudioBuffer | null> {
    if (!this.ctx) return null;
    try {
      const arrayBuffer = await file.arrayBuffer();
      return await this.ctx.decodeAudioData(arrayBuffer);
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
      const data = JSON.parse(json);
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
}

export const audioEngine = new AudioEngine();