# R3 v4 — Audio Architecture

**Version:** 2.0.0  
**Last Updated:** 2026-04-12  
**Target Platform:** Browser (Web Audio API + AudioWorklets) — Railway backend + Vercel frontend

---

## 🎯 Audio Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Pad/Key Latency** | <10ms | Trigger to audio output |
| **Crossfader Latency** | <5ms | Position change to audio change |
| **Effect Chain CPU** | <30% | Single effect chain at full load |
| **Total CPU** | <40% | All audio processing |
| **RAM (Base)** | <500MB | Idle application |
| **RAM (Per Project)** | +200MB | Per session/project |
| **Sample Rate** | 44.1-96kHz | User configurable |
| **Buffer Size** | 128-2048 | User configurable |
| **Audio Quality** | 16/24/32-bit | User selectable |

---

## 🏗️ Audio Engine Architecture

### High-Level Audio Pipeline

```
┌──────────────────────────────────────────────────────────────┐
│  INPUT SOURCES                                               │
│  ├─ Drum Machine (16 pads)                                   │
│  ├─ Piano (12 keys + octave shift)                           │
│  ├─ Live Input (microphone/line-in)                          │
│  └─ Samples (loaded for playback)                            │
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│  SIGNAL ROUTING                                              │
│  ├─ Per-channel gain                                         │
│  ├─ Per-pad/key volume/pan                                   │
│  └─ Channel mute/solo                                        │
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│  EFFECT CHAIN (Serial)                                       │
│  1. Reverb (Room/Hall/Plate)                                 │
│  2. Delay (Tempo-synced or free)                             │
│  3. Filter (LP/HP/BP with resonance)                         │
│  4. Distortion (Amount + Tone control)                       │
│  5. Compressor (Dynamic range control)                       │
│  6. EQ (3-band parametric)                                   │
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│  DJ CONTROLS                                                 │
│  ├─ Crossfader (Channel A/B mixing)                          │
│  ├─ Tempo Control (Pitch/Speed independent)                  │
│  ├─ Loop Control (in/out, length)                            │
│  └─ Filter (Per-channel high/low pass)                       │
└────────────────┬─────────────────────────────────────────────┘
                 │
┌────────────────▼─────────────────────────────────────────────┐
│  MASTER OUTPUT                                               │
│  ├─ Master volume                                            │
│  ├─ Limiting (prevent clipping)                              │
│  ├─ Metering (RMS, Peak)                                     │
│  └─ Recording (WAV/MP3/FLAC)                                 │
└──────────────────────────────────────────────────────────────┘
```


> **Note:** The LLPTE (Low-Latency Processing Transition Engine) sits between
> the Effect Chain and Master Output layers. It runs as a 5-node TypeScript
> pipeline (inputRouter → spectralAnalyzer → aiMixEngine → transitionGraph →
> outputBus) with 10ms p50 inference. LLPTE decisions (gain_adjust, eq_suggest,
> conflict_flag) are applied click-free via `AudioParam.setTargetAtTime()`.
> See AI_MIXING.md for full LLPTE architecture.

---

## 🔊 Audio Buffer Configuration

### Buffer Sizes

| Size | CPU Load | Latency | Use Case |
|------|----------|---------|----------|
| **128** | High | ~2.7ms @ 48kHz | Live performance |
| **256** | Medium-High | ~5.3ms @ 48kHz | Live recording |
| **512** | Medium | ~10.7ms @ 48kHz | General use |
| **1024** | Low-Medium | ~21ms @ 48kHz | Mixing/editing |
| **2048** | Low | ~42ms @ 48kHz | Rendering |

### Sample Rate Considerations

| Rate | Nyquist | Typical Use | File Size |
|------|---------|-------------|-----------|
| **44.1kHz** | 22.05kHz | CD-quality, streaming | Baseline |
| **48kHz** | 24kHz | Professional audio, video | ~9% larger |
| **96kHz** | 48kHz | Mastering, recording | ~2x size |

**Latency Formula:**
```
Latency (ms) = Buffer Size / Sample Rate × 1000
Example: 256 / 48000 × 1000 = 5.33ms
```

---

## 💾 Memory Management

### Memory Allocation

```typescript
// Baseline memory usage
const BASELINE_MEMORY = {
  web_audio_api: 50,      // MB (Web Audio API overhead)
  tone_js: 30,            // MB (Tone.js library)
  effects_chain: 100,     // MB (6 effects × ~16MB each)
  ui_components: 50,      // MB (React components)
  state_management: 20,   // MB (Zustand store)
  miscellaneous: 160,     // MB (Other overhead)
  total: 410,             // MB
};

// Per-project memory
const PER_PROJECT = {
  sample_buffer: 50,      // MB (10 second sample @ 48kHz)
  undo_history: 50,       // MB (50 edits)
  recording_buffer: 100,  // MB (varies with duration)
  total: 200,             // MB
};
```

### Memory Optimization Strategies

1. **Sample Pooling**
   - Reuse AudioBuffer allocations
   - Avoid garbage collection during playback
   - Pre-allocate buffers for known sizes

2. **Undo/Redo Limits**
   - Default: 100 history entries
   - Configurable per session
   - Automatic pruning when exceeding limit

3. **Lazy Loading**
   - Load waveforms on-demand
   - Cache rendered waveforms
   - Unload presets not in use

---

## ⚡ Latency Optimization

### Latency Sources (Cumulative)

| Source | Latency | Notes |
|--------|---------|-------|
| OS Buffer | 1-3ms | System-dependent |
| Audio Driver | 1-2ms | Browser audio subsystem |
| Web Audio API | 0-1ms | Negligible |
| Tone.js | 0-1ms | Minimal overhead |
| Effect Chain | 0-5ms | Reverb adds ~2-3ms |
| UI Rendering | <1ms | Async from audio |
| **Total** | **3-13ms** | Typical range |

### Achieving <10ms

1. **Use Small Buffer Sizes (128-256)**
   ```typescript
   const context = new AudioContext({
     sampleRate: 48000,
     latencyHint: 'interactive' // <10ms
   });
   ```

2. **Disable Unnecessary Effects**
   - Reverb adds ~2-3ms per unit
   - Disabling effects reduces latency
   - Use simpler effects for live use

3. **Optimize JavaScript**
   - Avoid allocations during audio callback
   - Use pre-allocated buffers
   - Schedule audio with precise timing

4. **Monitor with Profiler**
   ```typescript
   const measureLatency = (startTime: number) => {
     const latency = performance.now() - startTime;
     // logger.info(`Latency: ${latency.toFixed(2)}ms`)
   };
   ```

### Browser-Specific Optimization

**Chrome (recommended)**
- Enable `chrome://flags/#enable-webrtc-hide-local-ips-with-mdns` for WebRTC
- Web Audio API is most stable and lowest latency in Chrome
- Use `latencyHint: 'interactive'` for live play, `'balanced'` for mixing

**Safari**
- Requires user gesture to start AudioContext
- `AudioContext.resume()` must be called after first user interaction
- Some AudioWorklet features may be limited

**Firefox**
- Slightly higher default latency than Chrome
- Full Web Audio API support
- AudioWorklets fully supported

---

## 🎹 Audio Implementation Details

### Drum Machine (Pad Triggering)

**Trigger Path:**
```
1. User clicks pad
2. Audio sample loaded from memory
3. Playback initiated immediately (<1ms)
4. Routed through effect chain
5. Mixed with other sources
6. Output to speakers
```

**Implementation:**
```typescript
// Minimal latency approach
triggerPad(padIndex: number, velocity: number) {
  const sample = this.samples[padIndex];
  const source = this.audioContext.createBufferSource();
  source.buffer = sample.buffer;
  source.playbackRate.value = velocity; // Velocity affects pitch
  
  // Connect directly to effects
  source.connect(this.effectChain.input);
  source.start(0);
  
  // Cleanup
  source.onended = () => source.disconnect();
}
```

**Latency Sources:**
- DOM event handling: <1ms
- Audio sample buffer lookup: <1ms
- Web Audio API scheduling: <1ms
- Audio driver callback: 1-3ms
- **Total: ~3-5ms (within 10ms target)**

### Piano/Synthesizer (Key Press)

**Trigger Path:**
```
1. User presses key
2. Tone synthesizer starts
3. Velocity mapped to amplitude
4. Sustain pedal affects release time
5. Routed through effect chain
```

**Implementation:**
```typescript
keyDown(note: string, velocity: number) {
  const synth = new Tone.PolySynth(Tone.Synth).toDestination();
  synth.triggerAttack(note, Tone.now());
  
  // Store for release
  this.activeNotes.set(note, synth);
}

keyUp(note: string) {
  const synth = this.activeNotes.get(note);
  if (synth) {
    synth.triggerRelease(Tone.now() + 0.2); // Release with tail
    this.activeNotes.delete(note);
  }
}
```

**Latency Sources:**
- Same as pads (~3-5ms)
- Synthesizer startup: <1ms

---

## 🔗 Effect Chain Signal Flow

### Serial Effect Routing

```
Input → Reverb → Delay → Filter → Distortion → Compressor → EQ → Output
                  ↓                                               ↓
              Pre-Delay                                      Post-EQ
              (optional)                                    Limiting
```

### Effect Parameter Smoothing

Parameters are smoothed to prevent clicks/pops:

```typescript
// Abrupt change (bad - causes clicks)
filter.frequency.value = 2000;

// Smooth ramping (good - clean)
filter.frequency.rampTo(2000, 0.1); // 100ms ramp
```

**Ramp Times:**
| Parameter | Ramp Time | Notes |
|-----------|-----------|-------|
| Gain | 0.01-0.05s | Quick response |
| Frequency | 0.05-0.1s | Smooth sweep |
| Reverb | 0.1-0.2s | Slow, natural |
| Distortion | 0.05-0.1s | Medium |

---

## 🎚️ DJ Control Latency

### Crossfader Response Time

**Target: <5ms**

```typescript
// Latency measurement
private measureCrossfaderLatency() {
  const startTime = performance.now();
  
  this.setPosition(position);
  
  const latency = performance.now() - startTime;
  // logger.info(`Crossfader latency: ${latency.toFixed(2)}ms`)
  
  // Target <5ms, warn if >10ms
  if (latency > 10) {
    // logger.warn('High crossfader latency detected')
  }
}
```

**Optimization:**
- Use immediate `setValueAtTime` instead of `rampTo`
- Schedule 1-2 buffer cycles ahead
- Bypass ramps for 0-1 position range

### Tempo Control

**Latency: <50ms (acceptable, non-critical)**

- Pitch shift is done offline/asynchronously
- Tempo change syncs to next beat (musically correct)
- Gradual acceleration prevents artifacts

---

## 📊 Performance Monitoring

### Built-in Metrics

```typescript
interface AudioMetrics {
  latency: number;           // ms, average
  cpuLoad: number;           // %, estimated
  bufferUnderrun: number;    // count per minute
  droppedFrames: number;     // count per minute
  activeVoices: number;      // synth voices
  effectsActive: number;     // effects enabled
}
```

### Monitor CPU Usage

```typescript
// Measure effect chain CPU
const startTime = performance.now();

// Process audio block
effectChain.process(inputBuffer, outputBuffer);

const processingTime = performance.now() - startTime;
const blockDuration = (bufferSize / sampleRate) * 1000; // ms
const cpuLoad = (processingTime / blockDuration) * 100;

// logger.info(`CPU Load: ${cpuLoad.toFixed(1)}%`)
```

**Thresholds:**
- <20%: Excellent, plenty of headroom
- 20-40%: Good, normal operation
- 40-60%: Caution, monitor for glitches
- >60%: Critical, reduce complexity

### Performance Profiling

Use Chrome DevTools:
```javascript
// Mark audio processing
performance.mark('audio-process-start');
// ... audio processing
performance.mark('audio-process-end');
performance.measure('audio-process', 'audio-process-start', 'audio-process-end');

// Retrieve measurements
const measures = performance.getEntriesByName('audio-process');
measures.forEach(m => // logger.info(`Processing time: ${m.duration.toFixed(2)}ms`))
```

---

## 🐛 Common Audio Issues & Solutions

### Issue: Audio Crackling/Glitching

**Causes:**
- Buffer too small (increase to 256-512)
- CPU overload (disable effects, reduce polyphony)
- Sample rate mismatch (ensure consistent rate)

**Solutions:**
```typescript
// Increase buffer size
const context = new AudioContext({
  latencyHint: 'balanced' // 256-512 samples
});

// Monitor and warn
if (cpuLoad > 70) {
  // logger.warn('High CPU load — reducing effects')
  disableNonEssentialEffects();
}
```

### Issue: Latency Too High (>20ms)

**Causes:**
- Large buffer size (1024+)
- Reverb enabled on all tracks
- System resource contention

**Solutions:**
```typescript
// Use interactive latency hint
const context = new AudioContext({
  latencyHint: 'interactive' // Target <10ms
});

// Disable reverb on drum tracks
drumTrack.effectChain.bypassEffect('reverb');
```

### Issue: Memory Leak

**Signs:**
- RAM usage grows over time
- Performance degrades after hours
- Browser becomes unresponsive

**Solutions:**
```typescript
// Proper cleanup
dispose() {
  this.effects.forEach(e => e.dispose());
  this.synths.forEach(s => s.dispose());
  this.samples.clear();
  this.recordingBuffer = null;
}

// Limit history
this.editHistory = this.editHistory.slice(-100);
```

---

## 🔧 Configuration

### Audio Context Setup

```typescript
import * as Tone from 'tone';

// Initialize with optimal settings
export async function initializeAudio() {
  // Set sample rate
  await Tone.start();
  
  const context = Tone.Context.getContext();
  
  // Configure for low latency
  context.latencyHint = 'interactive'; // <10ms
  context.sampleRate = 48000; // Professional rate
  
  return context;
}
```

### Environment Variables

```bash
# .env
AUDIO_SAMPLE_RATE=48000      # 44100, 48000, 96000
AUDIO_BUFFER_SIZE=256        # 128, 256, 512, 1024, 2048
AUDIO_LATENCY_HINT=interactive # interactive, balanced, playback
MAX_POLYPHONY=32             # Maximum simultaneous voices
MAX_RECORDING_DURATION=3600  # Max 1 hour
```

---

## 📈 Scaling & Capacity

### Maximum Capabilities

| Feature | Limit | Notes |
|---------|-------|-------|
| Simultaneous Voices | 32 | Synth polyphony |
| Effect Chain Length | 6 | Serial effects |
| Recording Duration | 2 hours | Per session |
| Sample Library | 1000 | Loaded samples |
| Undo/Redo Depth | 100 | History entries |
| Hot Cues | 8 | Per deck |

### Headroom Recommendations

- Keep CPU <40% for safety margin
- Keep RAM <80% for system stability
- Use efficient sample formats (WAV)
- Compress older sessions

---

## 🚀 Advanced Topics

### Real-Time Audio Processing

```typescript
// Implement custom audio processor
class CustomProcessor extends AudioWorkletProcessor {
  process(inputs: Float32Array[][], outputs: Float32Array[][], parameters: Record<string, Float32Array[]>) {
    const input = inputs[0];
    const output = outputs[0];
    
    for (let ch = 0; ch < output.length; ch++) {
      for (let i = 0; i < output[ch].length; i++) {
        // Process each sample with <1µs latency
        output[ch][i] = input[ch][i] * parameters.gain[0];
      }
    }
    
    return true;
  }
}
```

### Multi-Channel Processing

```typescript
// Stereo processing
const leftChannel = audioBuffer.getChannelData(0);
const rightChannel = audioBuffer.getChannelData(1);

// Process independently
processChannel(leftChannel, leftGain);
processChannel(rightChannel, rightGain);
```

---

## 📚 References

- **Web Audio API:** https://www.w3.org/TR/webaudio/
- **Tone.js Docs:** https://tonejs.org/
- **Audio Processing:** https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- **Real-Time Audio:** https://developers.google.com/web/updates/2017/12/audio-worklet