# R3 v4 — Effects Guide

**Version:** 2.0.0  
**Last Updated:** 2026-04-12

---

## 🎚️ Effects Overview

R3 v4 includes 6 professional audio effects that can be used within the DAW FX rack. Note: LLPTE AI suggestions (gain_adjust, eq_suggest, conflict_flag) are applied upstream of this FX chain — see AI_MIXING.md. These effects are user-controlled per-track inserts.

R3 v4 includes 6 professional audio effects that can be chained in series:

| Effect | Purpose | CPU Impact | Typical Latency |
|--------|---------|-----------|-----------------|
| **Reverb** | Space/ambience | 10-15% | 2-3ms |
| **Delay** | Rhythm/texture | 5-10% | 1-2ms |
| **Filter** | Tone shaping | 3-5% | <1ms |
| **Distortion** | Harmonics/grit | 5-8% | <1ms |
| **Compressor** | Dynamic control | 5-8% | <1ms |
| **EQ** | Frequency balance | 3-5% | <1ms |

---

## 🔄 Reverb

### Overview

Reverb simulates acoustic spaces (rooms, halls, plates) using convolution-based algorithms.

### Parameters

```typescript
interface ReverbParams {
  enabled: boolean;          // On/Off
  type: 'room' | 'hall' | 'plate';  // Space type
  roomSize: number;          // 0-1 (affects decay)
  damping: number;           // 0-1 (high-freq attenuation)
  width: number;             // 0-1 (stereo width)
  wet: number;               // 0-1 (effect amount)
  dry: number;               // 0-1 (original signal)
}
```

### Effect Types

#### Room Reverb
- **Decay:** ~1.5 seconds
- **Character:** Tight, intimate
- **Use:** Vocals, drums, acoustic instruments
- **CPU:** 10%

```typescript
const roomReverb = {
  type: 'room',
  roomSize: 0.3,
  damping: 0.8,
  width: 0.8,
  wet: 0.2,
  dry: 0.8,
};
```

#### Hall Reverb
- **Decay:** ~2.5 seconds
- **Character:** Spacious, natural
- **Use:** Orchestral, grand piano, choirs
- **CPU:** 12%

```typescript
const hallReverb = {
  type: 'hall',
  roomSize: 0.7,
  damping: 0.5,
  width: 1,
  wet: 0.35,
  dry: 0.65,
};
```

#### Plate Reverb
- **Decay:** ~3 seconds
- **Character:** Bright, vintage
- **Use:** Vocals, snare, rock drums
- **CPU:** 15%

```typescript
const plateReverb = {
  type: 'plate',
  roomSize: 0.9,
  damping: 0.3,
  width: 1,
  wet: 0.4,
  dry: 0.6,
};
```

### Room Size

- **0.0** - Tiny (closet)
- **0.5** - Medium room
- **1.0** - Large hall

```typescript
// More room = longer decay
reverb.roomSize = 0.3;  // Short, tight decay
reverb.roomSize = 0.7;  // Medium, natural decay
reverb.roomSize = 1.0;  // Long, ambient decay
```

### Damping

Controls how quickly high frequencies decay (compared to lows).

- **0.0** - No damping (bright, unnatural)
- **0.5** - Balanced (most natural)
- **1.0** - High damping (dark, muffled)

```typescript
// Bright reverb (cymbals)
reverb.damping = 0.2;

// Dark reverb (smooth vocals)
reverb.damping = 0.8;
```

### Wet/Dry Mix

```typescript
// 100% wet (pure effect)
reverb.wet = 1.0;
reverb.dry = 0.0;

// 50/50 mix
reverb.wet = 0.5;
reverb.dry = 0.5;

// Mostly dry (subtle)
reverb.wet = 0.1;
reverb.dry = 0.9;
```

### Presets

| Name | Type | Use | Decay |
|------|------|-----|-------|
| `tight` | Room | Vocals, Drums | 1.5s |
| `room` | Room | Acoustic | 1.5s |
| `hall` | Hall | Orchestra, Piano | 2.5s |
| `plate` | Plate | Snare, Vocals | 3.0s |
| `lush` | Plate | Ambient, Synths | 3.0s |

### Usage Example

```typescript
import { ReverbEffect, REVERB_PRESETS } from '../audio/effects/reverb';

// Create reverb
const reverb = new ReverbEffect(audioContext);

// Use preset
reverb.setParams(REVERB_PRESETS.hall);

// Customize
const customReverb = {
  ...REVERB_PRESETS.room,
  roomSize: 0.5,  // Adjust room size
  wet: 0.25,      // Less wet signal
};
reverb.setParams(customReverb);
```

---

## ⏱️ Delay

### Overview

Delays create echoes and rhythmic textures by repeating the input signal.

### Parameters

```typescript
interface DelayParams {
  enabled: boolean;
  time: number;              // 1-2000ms
  feedback: number;          // 0-0.9 (repeat intensity)
  syncToTempo: boolean;      // Sync to master BPM
  tempoMultiplier: number;   // 0.25 | 0.5 | 1 | 2 | 4
  wet: number;               // 0-1 (effect amount)
  dry: number;               // 0-1 (original signal)
}
```

### Tempo Sync

When enabled, delay time syncs to the master BPM:

```typescript
// Master BPM = 120
const beatDuration = 60 / 120 = 0.5 seconds = 500ms

// Tempo multipliers
const delays = {
  '1/16':  125,   // Sixteenth note
  '1/8':   250,   // Eighth note
  '1/4':   500,   // Quarter note
  '1/2':   1000,  // Half note
  '1 Bar': 2000,  // Full bar (4 beats)
};
```

### Delay Types

#### Slapback
- **Time:** 150ms
- **Feedback:** 0.1 (minimal repeat)
- **Use:** Rockabilly, retro
- **Character:** Single, slappy echo

```typescript
const slapback = {
  time: 150,
  feedback: 0.1,
  syncToTempo: false,
  wet: 0.3,
  dry: 0.7,
};
```

#### Ping-Pong
- **Time:** 375ms (dotted eighth at 120 BPM)
- **Feedback:** 0.5
- **Use:** Stereo width, rhythmic interest
- **Character:** Bounces between speakers

```typescript
const pingPong = {
  time: 375,
  feedback: 0.5,
  syncToTempo: true,
  tempoMultiplier: 0.75,  // Dotted eighth
  wet: 0.4,
  dry: 0.6,
};
```

#### Dub Delay
- **Time:** 750ms
- **Feedback:** 0.7
- **Use:** Reggae, dub, experimental
- **Character:** Multiple repeating echoes

```typescript
const dubDelay = {
  time: 750,
  feedback: 0.7,
  syncToTempo: true,
  tempoMultiplier: 1.5,  // Triplet
  wet: 0.5,
  dry: 0.5,
};
```

#### Quarter Note
- **Time:** 500ms (at 120 BPM)
- **Feedback:** 0.35
- **Use:** General mixing, electronic music
- **Character:** Syncopated echo

```typescript
const quarterNote = {
  time: 500,
  feedback: 0.35,
  syncToTempo: true,
  tempoMultiplier: 1,  // Quarter note
  wet: 0.3,
  dry: 0.7,
};
```

### Feedback Control

Feedback determines how many repeats you get:

```typescript
// No feedback (single echo)
delay.feedback = 0.0;  // Original + 1 repeat

// Low feedback (few echoes)
delay.feedback = 0.3;  // 3-4 audible repeats

// High feedback (many echoes)
delay.feedback = 0.7;  // 8-10 audible repeats

// Infinite feedback (careful!)
delay.feedback = 0.95; // Repeats fade very slowly
```

### Presets

| Name | Time | Feedback | Sync | Use |
|------|------|----------|------|-----|
| `eighthNote` | 250ms | 0.4 | Yes | Rhythmic |
| `quarterNote` | 500ms | 0.35 | Yes | Standard |
| `halfNote` | 1000ms | 0.3 | Yes | Ambient |
| `slapback` | 150ms | 0.1 | No | Vintage |
| `pingPong` | 375ms | 0.5 | Yes | Stereo |
| `dubDelay` | 750ms | 0.7 | Yes | Dub/Reggae |

### Usage Example

```typescript
import { DelayEffect, DELAY_PRESETS } from '../audio/effects/delay';

// Create delay synced to 120 BPM
const delay = new DelayEffect(audioContext, 120);

// Apply preset
delay.setParams(DELAY_PRESETS.quarterNote);

// Update master BPM (delay stays synced)
delay.setMasterBpm(140);

// Manual tempo-free delay
const customDelay = {
  ...DELAY_PRESETS.slapback,
  time: 200,    // 200ms echo
};
delay.setParams(customDelay);

// Clear delay buffer
delay.clearBuffer(); // Removes all repeating echoes
```

---

## 🎚️ Filter

### Overview

Filters shape tone by boosting/cutting specific frequency ranges.

### Parameters

```typescript
interface FilterParams {
  enabled: boolean;
  type: 'lowpass' | 'highpass' | 'bandpass';
  frequency: number;        // 20-20000 Hz
  resonance: number;        // 0-40 (Q factor)
  drive: number;            // 0-1 (pre-filter gain)
  wet: number;              // 0-1 (effect amount)
  dry: number;              // 0-1 (original signal)
}
```

### Filter Types

#### Low-Pass Filter (LPF)
- **Removes:** High frequencies
- **Keeps:** Lows and mids
- **Use:** Smooth, warm, tame brightness
- **Characteristic:** "Muffled" sound

```typescript
const warmFilter = {
  type: 'lowpass',
  frequency: 8000,    // Reduce highs above 8kHz
  resonance: 3,
  wet: 1,
  dry: 0,
};
```

#### High-Pass Filter (HPF)
- **Removes:** Low frequencies
- **Keeps:** Mids and highs
- **Use:** Remove rumble, brighten
- **Characteristic:** "Thin" sound

```typescript
const brightFilter = {
  type: 'highpass',
  frequency: 200,     // Remove lows below 200Hz
  resonance: 2,
  wet: 1,
  dry: 0,
};
```

#### Band-Pass Filter (BPF)
- **Keeps:** Only a specific frequency range
- **Use:** Isolate instruments, create tunnel effect
- **Characteristic:** "Nasal" or "telephone" sound

```typescript
const bandPass = {
  type: 'bandpass',
  frequency: 1000,    // Center at 1kHz
  resonance: 30,      // Narrow, focused
  wet: 1,
  dry: 0,
};
```

### Resonance (Q Factor)

Higher resonance emphasizes the cutoff frequency:

```typescript
// Low resonance (smooth)
filter.resonance = 2;

// Medium resonance (pronounced)
filter.resonance = 10;

// High resonance (peaky, self-resonant)
filter.resonance = 40;
```

### Drive (Pre-Filter Gain)

Drive adds harmonic content before filtering:

```typescript
// No drive (clean)
filter.drive = 0;

// Medium drive (colored)
filter.drive = 0.5;  // Adds saturation

// High drive (heavy)
filter.drive = 1;    // Adds harmonics
```

### Frequency Ranges

```typescript
// Common filter frequencies
const frequencies = {
  subBass:    40,     // Sub-bass rumble
  bass:       100,    // Bass notes
  lowMid:     250,    // Low-mid body
  mid:        1000,   // Vocal/presence
  highMid:    4000,   // Presence/clarity
  treble:     8000,   // Brightness
  air:        15000,  // Air/shimmer
};
```

### Presets

| Name | Type | Frequency | Use |
|------|------|-----------|-----|
| `warm` | Lowpass | 8kHz | Smooth vocals |
| `bright` | Highpass | 200Hz | Remove mud |
| `sweep` | Lowpass | 12kHz | Resonant sweep |
| `vocoder` | Bandpass | 1kHz | Telephone effect |
| `deepLowpass` | Lowpass | 2kHz | Dark, warm |
| `resonantHighpass` | Highpass | 5kHz | Thin, piercing |

### Usage Example

```typescript
import { FilterEffect, FILTER_PRESETS, FILTER_FREQUENCIES } from '../audio/effects/filter';

// Create filter
const filter = new FilterEffect(audioContext);

// Use preset
filter.setParams(FILTER_PRESETS.warm);

// Automate filter sweep (classic DJ move)
filter.sweepFrequency(20000, 100, 4); // Sweep 20kHz→100Hz over 4 seconds

// Frequency-specific filtering
const removeRumble = {
  type: 'highpass',
  frequency: FILTER_FREQUENCIES.bass,
  resonance: 5,
  wet: 1,
  dry: 0,
};
filter.setParams(removeRumble);
```

---

## 🎸 Distortion

### Overview

Distortion adds grit, character, and harmonic content through saturation.

### Parameters

```typescript
interface DistortionParams {
  enabled: boolean;
  amount: number;           // 0-1 (saturation intensity)
  tone: number;             // 0-1 (warm to bright)
  oversample: 'none' | '2x' | '4x';  // Quality/CPU tradeoff
  wet: number;              // 0-1 (effect amount)
  dry: number;              // 0-1 (original signal)
}
```

### Distortion Types

#### Light Crunch
- **Amount:** 0.2
- **Tone:** 0.7 (bright)
- **Character:** Subtle breakup
- **Use:** Rock guitars, aggressive drums
- **CPU:** 5%

```typescript
const lightCrunch = {
  amount: 0.2,
  tone: 0.7,
  oversample: 'none',
  wet: 0.5,
  dry: 0.5,
};
```

#### Medium Drive
- **Amount:** 0.5
- **Tone:** 0.5 (neutral)
- **Character:** Warm drive
- **Use:** Vocals, bass, keys
- **CPU:** 6%

```typescript
const mediumDrive = {
  amount: 0.5,
  tone: 0.5,
  oversample: '2x',
  wet: 0.6,
  dry: 0.4,
};
```

#### Heavy Distortion
- **Amount:** 0.8
- **Tone:** 0.4 (warm)
- **Character:** Aggressive saturation
- **Use:** Metal, industrial
- **CPU:** 8%

```typescript
const heavyDistortion = {
  amount: 0.8,
  tone: 0.4,
  oversample: '4x',
  wet: 0.7,
  dry: 0.3,
};
```

#### Digital Lo-Fi
- **Amount:** 0.9
- **Tone:** 0.3 (dark)
- **Character:** Bit-crushed
- **Use:** Retro, experimental
- **CPU:** 5%

```typescript
const loFi = {
  amount: 0.9,
  tone: 0.3,
  oversample: 'none',
  wet: 0.4,
  dry: 0.6,
};
```

### Tone Control

Tone adjusts post-distortion filtering:

```typescript
// Warm tone (low frequencies emphasized)
distortion.tone = 0.2;  // Muffles highs

// Neutral tone (balanced)
distortion.tone = 0.5;  // Natural saturation

// Bright tone (high frequencies)
distortion.tone = 0.8;  // Aggressive, cutting
```

### Oversampling

Higher oversampling = better quality but more CPU:

```typescript
// No oversampling (lowest CPU)
distortion.oversample = 'none';

// 2x oversampling (good quality)
distortion.oversample = '2x';

// 4x oversampling (best quality)
distortion.oversample = '4x';
```

### Presets

| Name | Amount | Tone | Use |
|------|--------|------|-----|
| `light` | 0.2 | 0.7 | Subtle color |
| `medium` | 0.5 | 0.5 | Balanced drive |
| `heavy` | 0.8 | 0.4 | Aggressive |
| `bitCrush` | 0.9 | 0.3 | Lo-fi/digital |
| `warmOverdrive` | 0.6 | 0.3 | Smooth saturation |
| `digitalHarsh` | 0.95 | 0.9 | Harsh/cutting |

### Usage Example

```typescript
import { DistortionEffect, DISTORTION_PRESETS } from '../audio/effects/distortion';

// Create distortion
const distortion = new DistortionEffect(audioContext);

// Use preset
distortion.setParams(DISTORTION_PRESETS.warmOverdrive);

// Gradually increase amount
let amount = 0;
const interval = setInterval(() => {
  amount += 0.05;
  if (amount > 0.8) clearInterval(interval);
  
  const params = {
    ...DISTORTION_PRESETS.medium,
    amount,
  };
  distortion.setParams(params);
}, 100);
```

---

## 🔧 Compressor

### Overview

Compressor controls dynamic range by reducing loud parts and boosting quiet parts.

### Parameters

```typescript
interface CompressorParams {
  enabled: boolean;
  threshold: number;   // -100 to 0 dB (triggers compression)
  ratio: number;       // 1-20 (compression amount)
  attack: number;      // 0-1000 ms (response time)
  release: number;     // 10-3000 ms (recovery time)
  makeup: number;      // 0-40 dB (output gain)
  knee: number;        // 0-40 dB (hardness of curve)
  wet: number;         // 0-1 (effect amount)
  dry: number;         // 0-1 (original signal)
}
```

### Key Parameters

#### Threshold
Signals above this level get compressed:

```typescript
// Aggressive (low threshold)
compressor.threshold = -50;  // Compress everything loud

// Moderate (middle threshold)
compressor.threshold = -20;  // Compress peaks

// Gentle (high threshold)
compressor.threshold = -10;  // Only compress extreme peaks
```

#### Ratio
How much compression is applied:

```typescript
// Light compression (barely noticeable)
compressor.ratio = 2;   // 2:1 ratio

// Moderate compression (obvious)
compressor.ratio = 4;   // 4:1 ratio

// Heavy compression (obvious)
compressor.ratio = 8;   // 8:1 ratio

// Limiting (prevents peaks)
compressor.ratio = 10;  // 10:1 ratio
```

#### Attack & Release

Attack = how fast compression engages  
Release = how fast compression disengages

```typescript
// Fast attack (slams down immediately)
compressor.attack = 1;    // 1ms

// Medium attack (responds quickly)
compressor.attack = 10;   // 10ms

// Slow attack (lets peaks through)
compressor.attack = 50;   // 50ms

// Fast release (bounces back quick)
compressor.release = 50;  // 50ms

// Medium release (smooth recovery)
compressor.release = 100; // 100ms

// Slow release (smooth, musical)
compressor.release = 500; // 500ms
```

#### Knee
Knee smooths the transition into compression:

```typescript
// Hard knee (on/off)
compressor.knee = 0;   // Sharp trigger

// Soft knee (gradual)
compressor.knee = 10;  // Smoother feel
```

### Compressor Styles

#### Vocal Compression
```typescript
const vocalCompressor = {
  threshold: -20,
  ratio: 4,
  attack: 5,        // Quick catch
  release: 100,     // Smooth tail
  makeup: 4,
  knee: 6,
  wet: 0.8,
  dry: 0.2,
};
// Result: Controlled, punchy vocals
```

#### Drum Compression
```typescript
const drumCompressor = {
  threshold: -30,
  ratio: 6,
  attack: 1,        // Very fast
  release: 50,      // Quick bounce
  makeup: 6,
  knee: 2,
  wet: 0.9,
  dry: 0.1,
};
// Result: Tight, punchy drums
```

#### Glue Compression
```typescript
const glueCompressor = {
  threshold: -15,
  ratio: 2,
  attack: 20,       // Slow, musical
  release: 150,
  makeup: 2,
  knee: 12,
  wet: 0.6,
  dry: 0.4,
};
// Result: Transparent, cohesive mix
```

#### Limiting
```typescript
const limiter = {
  threshold: -6,
  ratio: 10,        // Prevents peaks
  attack: 0.5,      // Instant
  release: 30,
  makeup: 5,
  knee: 0,
  wet: 1,
  dry: 0,
};
// Result: Peak protection
```

### Presets

| Name | Use | Character |
|------|-----|-----------|
| `vocal` | Vocals | Smooth, controlled |
| `drum` | Drums | Tight, punchy |
| `bass` | Bass | Warm glue |
| `glue` | Mix bus | Transparent |
| `limiting` | Peak control | Hard ceiling |
| `punch` | Impact | Aggressive |

### Usage Example

```typescript
import { CompressorEffect, COMPRESSOR_PRESETS } from '../audio/effects/compressor';

// Create compressor
const compressor = new CompressorEffect(audioContext);

// Apply vocal preset
compressor.setParams(COMPRESSOR_PRESETS.vocal);

// Adjust for heavier compression
const heavierVocal = {
  ...COMPRESSOR_PRESETS.vocal,
  ratio: 6,        // More compression
  threshold: -25,  // More aggressive
};
compressor.setParams(heavierVocal);

// Check reduction amount (for metering)
const reduction = compressor.getReductionAmount();
// log via structured logger: logger.info(`Gain reduction: ${reduction.toFixed(1)} dB`)
```

---

## 🎛️ EQ (Equalization)

### Overview

EQ shapes tone by boosting or cutting frequency bands.

### Parameters

```typescript
interface EQParams {
  enabled: boolean;
  low: number;         // -12 to +12 dB @ 60Hz
  mid: number;         // -12 to +12 dB @ 1kHz
  high: number;        // -12 to +12 dB @ 12kHz
  lowFreq: number;     // 20-200 Hz (adjustable)
  midFreq: number;     // 200-4000 Hz (adjustable)
  highFreq: number;    // 4000-20000 Hz (adjustable)
  wet: number;         // 0-1 (effect amount)
  dry: number;         // 0-1 (original signal)
}
```

### EQ Bands

#### Low Band (Bass)
```typescript
eq.low = 6;        // +6dB boost (more bass)
eq.low = 0;        // No change (flat)
eq.low = -6;       // -6dB cut (less bass)
eq.lowFreq = 60;   // Adjust center (20-200Hz)
```

#### Mid Band (Presence)
```typescript
eq.mid = 3;        // +3dB boost (more presence)
eq.mid = 0;        // No change (flat)
eq.mid = -3;       // -3dB cut (less presence)
eq.midFreq = 1000; // Adjust center (200-4000Hz)
```

#### High Band (Treble)
```typescript
eq.high = 4;       // +4dB boost (more air)
eq.high = 0;       // No change (flat)
eq.high = -4;      // -4dB cut (less treble)
eq.highFreq = 12000; // Adjust center (4000-20000Hz)
```

### EQ Techniques

#### Boost Presence
```typescript
const boostPresence = {
  low: 0,
  mid: 5,     // Boost mids for presence
  high: 3,    // Lift highs for air
};
eq.setParams(boostPresence);
// Result: Forward, present sound
```

#### Cut Mud
```typescript
const cutMud = {
  low: -4,    // Reduce boominess
  mid: -2,    // Tighten midrange
  high: 0,
};
eq.setParams(cutMud);
// Result: Cleaner, more defined
```

#### Warm It Up
```typescript
const warmItUp = {
  low: 3,     // More bass
  mid: -1,    // Less midrange harshness
  high: -3,   // Less treble
};
eq.setParams(warmItUp);
// Result: Smooth, warm tone
```

#### Make It Bright
```typescript
const makeBright = {
  low: -2,
  mid: 0,
  high: 6,    // Significant high boost
};
eq.setParams(makeBright);
// Result: Airy, cutting sound
```

### Presets

| Name | Low | Mid | High | Use |
|------|-----|-----|------|-----|
| `flat` | 0 | 0 | 0 | Reference |
| `warm` | +3 | -2 | -5 | Smooth, dark |
| `bright` | -2 | +1 | +6 | Cutting, air |
| `presence` | +1 | +3 | +2 | Punchy, vocal |
| `scoop` | +4 | -6 | +4 | Pronounced lows/highs |
| `cutting` | -4 | +2 | +4 | Tight, present |
| `dark` | +2 | -1 | -8 | Smooth, muffled |
| `aggressive` | -6 | +5 | +7 | Harsh, in-your-face |

### Usage Example

```typescript
import { EQEffect, EQ_PRESETS } from '../audio/effects/eq';

// Create EQ
const eq = new EQEffect(audioContext);

// Use preset
eq.setParams(EQ_PRESETS.warm);

// Customize individual bands
eq.setLowBand(6);   // Boost bass by 6dB
eq.setMidBand(0);   // Leave mids flat
eq.setHighBand(-3); // Cut treble by 3dB

// Set all at once
eq.setParams({
  ...EQ_PRESETS.bright,
  lowFreq: 80,  // Adjust low band center
});
```

---

## 🔗 Effect Chain Usage

### Typical Chain Order

```
Input → Distortion → Compressor → Filter → Delay → Reverb → EQ → Output
        (character)  (control)   (tone)   (rhythm) (space)  (final mix)
```

### Example Chains

#### Vocal Chain
```typescript
const vocalChain = [
  { type: 'compressor', params: COMPRESSOR_PRESETS.vocal },
  { type: 'delay', params: DELAY_PRESETS.eighthNote },
  { type: 'reverb', params: REVERB_PRESETS.hall },
  { type: 'eq', params: EQ_PRESETS.presence },
];
```

#### Drum Chain
```typescript
const drumChain = [
  { type: 'compressor', params: COMPRESSOR_PRESETS.drum },
  { type: 'distortion', params: DISTORTION_PRESETS.light },
  { type: 'reverb', params: REVERB_PRESETS.room },
  { type: 'eq', params: EQ_PRESETS.bright },
];
```

#### Electronic/Synth Chain
```typescript
const synthChain = [
  { type: 'filter', params: FILTER_PRESETS.sweep },
  { type: 'distortion', params: DISTORTION_PRESETS.medium },
  { type: 'delay', params: DELAY_PRESETS.pingPong },
  { type: 'reverb', params: REVERB_PRESETS.plate },
  { type: 'eq', params: EQ_PRESETS.bright },
];
```

---

## 💡 Best Practices

1. **Start with presets** - Don't reinvent the wheel
2. **Use ear training** - A/B compare for reference
3. **Avoid over-processing** - Less is usually more
4. **Monitor CPU** - Effects add latency and CPU load
5. **Automate wisely** - Smooth transitions over clicks/pops
6. **Save presets** - Build your own library

---

## 📚 Further Reading

- Web Audio API Effects: https://www.w3.org/TR/webaudio/
- Tone.js Effects: https://tonejs.org/
- Audio Effects Explained: https://www.sweetwater.com/