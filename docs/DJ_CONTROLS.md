# R3VIBE Native - DJ Controls Guide

**Version:** 1.0.0  
**Last Updated:** January 21, 2026

---

## 📚 Table of Contents

1. [Crossfader](#crossfader)
2. [Tempo Control](#tempo-control)
3. [Hot Cues](#hot-cues)
4. [Beat Sync](#beat-sync)
5. [Advanced Mixing](#advanced-mixing)
6. [Performance Tips](#performance-tips)

---

## 🎚️ Crossfader

### Overview

The crossfader allows smooth blending between two channels (A and B) with professional curves.

### Basic Usage

```typescript
import { Crossfader } from '../audio/dj-controls/crossfader';

// Initialize
const crossfader = new Crossfader(audioDestination);

// Connect channels
crossfader.connectChannelA(sourceA);
crossfader.connectChannelB(sourceB);

// Set position (-1 = Full A, 0 = Center, +1 = Full B)
crossfader.setPosition(-1);   // Full channel A
crossfader.setPosition(0);    // Even mix
crossfader.setPosition(1);    // Full channel B
crossfader.setPosition(0.5);  // 75% B, 25% A
```

### Curve Types

```typescript
type CurveType = 'linear' | 'easein' | 'easeout' | 'smooth';

// Set curve
crossfader.setConfig({ curve: 'smooth' });
```

#### Linear Crossfade

- **Behavior:** Straight-line volume change
- **Use Case:** Precise control, educational
- **Characteristic:** Equal volume change at all positions

```
A ██████░░░░░░ B
  ███░░░░░░░░░
  ░░░░░░░░░░██
```

#### Ease-In Curve

- **Behavior:** Slow start, fast end
- **Use Case:** Dramatic transitions
- **Characteristic:** A fades early, B fades late

#### Ease-Out Curve

- **Behavior:** Fast start, slow end
- **Use Case:** Smooth, gentle transitions
- **Characteristic:** A stays loud longer

#### Smooth Curve (Recommended)

- **Behavior:** Cubic curve - optimized for DJ mixing
- **Use Case:** Professional mixing
- **Characteristic:** Responsive in middle, smooth at edges

```
Professional DJ crossfader curve:
Maximum responsiveness at center position
Smooth falloff at extremes
```

### Latency Control

Target: **<5ms** response time

```typescript
// Enable latency monitoring
crossfader.setMeasureLatency(true);

// Check latency after fades
const latency = crossfader.getLatency();
console.log(`Crossfader latency: ${latency.toFixed(2)}ms`);

// Warn if exceeds target
if (latency > 5) {
  console.warn('High latency - consider reducing buffer size');
}
```

### Soft vs Hard Transitions

```typescript
// Soft crossfade (animate over duration)
crossfader.soften('B', 0.5); // Fade to B over 500ms

// Hard cut (instant)
crossfader.cut('B'); // Switch to B immediately
```

### Usage Example: DJ Mix

```typescript
// Transition from Track A to Track B over 4 bars
const transitionLength = 4000; // milliseconds

// Start at channel A
crossfader.setPosition(-1);

// Animate to center (mixing both)
setTimeout(() => {
  crossfader.soften('B', transitionLength);
}, 2000);

// Complete transition
setTimeout(() => {
  crossfader.setPosition(1); // Full B
}, 6000);
```

---

## 🎵 Tempo Control

### Overview

Independent tempo and pitch control for professional DJ workflows.

### Basic Usage

```typescript
import { TempoControl } from '../audio/dj-controls/tempo-control';

// Initialize
const tempo = new TempoControl(120); // Master BPM

// Change tempo
tempo.setBpm(128);           // Set to 128 BPM
tempo.setTempoRatio(1.2);    // 120% speed
tempo.setPitchShift(5);      // Shift +5 semitones

// Subscribe to changes
tempo.subscribe((state) => {
  console.log(`BPM: ${state.bpm}, Pitch: ${state.pitchShift}`);
});
```

### BPM Range

```typescript
// Constraints
const MIN_BPM = 40;
const MAX_BPM = 240;

// Common ranges
slow:     40-90 BPM   // Downtempo, ambient
medium:   90-150 BPM  // Hip-hop, pop, soul
fast:     150-180 BPM // Dance, electronic
veryFast: 180-240 BPM // Techno, drum & bass
```

### Tempo Ratios

```typescript
// Tempo ratio (1.0 = master BPM)
tempo.setTempoRatio(0.5);  // 50% speed (half BPM)
tempo.setTempoRatio(1.0);  // Normal speed
tempo.setTempoRatio(1.5);  // 150% speed (1.5x BPM)
tempo.setTempoRatio(2.0);  // 200% speed (double BPM)

// Adjust by percentage
tempo.adjustTempo(-10);    // Reduce by 10%
tempo.adjustTempo(+15);    // Increase by 15%
```

### Pitch Shift

```typescript
// Pitch shift in semitones (-50 to +50)
tempo.setPitchShift(-12);  // Down 1 octave
tempo.setPitchShift(-5);   // Down 5 semitones
tempo.setPitchShift(0);    // No shift
tempo.setPitchShift(5);    // Up 5 semitones
tempo.setPitchShift(12);   // Up 1 octave

// Quick shifts
tempo.quickShift(1);       // Up 1 semitone (capo)
tempo.quickShift(-1);      // Down 1 semitone
```

### Tempo Ratios vs Pitch Shift

```typescript
// Tempo ratio ONLY
tempo.setTempoRatio(1.1);  // 10% faster
tempo.setPitchShift(0);    // Normal pitch
// Result: Faster but same pitch (like speeding up a video)

// Pitch shift ONLY
tempo.setTempoRatio(1.0);  // Normal speed
tempo.setPitchShift(2);    // +2 semitones
// Result: Same speed but higher pitch

// Both (traditional vinyl behavior)
tempo.setTempoRatio(1.1);  // 10% faster
tempo.setPitchShift(2);    // Naturally pitched up
// Result: Faster AND higher (vinyl record pitch bend)
```

### Beat-Aligned Transitions

```typescript
// Enable for clean musical transitions
tempo.setBeatAligned(true);

// Tempo changes now snap to next beat
// This prevents stuttering or timing issues
```

### Smooth Acceleration

```typescript
// Accelerate from 120 BPM to 130 BPM over 8 seconds
tempo.accelerateToTempo(130, 8000);

// Subscribe to see each step
tempo.subscribe((state) => {
  console.log(`Current BPM: ${state.bpm}`);
});

// Output:
// 120 → 121 → 122 → ... → 129 → 130
```

### Master Sync

```typescript
// Sync deck to master BPM
tempo.syncToMaster(128); // Sets BPM to 128 from master

// Independent mode
tempo.setTempoRatio(1.0);
// Now can adjust independently

// Resync anytime
tempo.syncToMaster();
```

### Usage Example: BPM Matching

```typescript
// Match two tracks
const trackA_bpm = 120;
const trackB_bpm = 128;

// Set master to Track A
const tempoControl = new TempoControl(trackA_bpm);

// Match Track B by tempo ratio
const ratio = trackB_bpm / trackA_bpm; // 1.067
tempoControl.setTempoRatio(ratio);

// Now both play at same speed
// Crossfade when synchronized
```

---

## 🔴 Hot Cues

### Overview

8 hot cues per deck for instant jumping to marked positions.

### Basic Usage

```typescript
import { CueManager } from '../audio/dj-controls/cue-management';

// Initialize
const cues = new CueManager('track-001');

// Set a cue at current position
cues.setCue(1, 10.5);           // Cue 1 at 10.5 seconds
cues.setCue(2, 25.3, 'Verse');  // Cue 2 with label

// Jump to cue
const position = cues.jumpToCue(1); // Returns 10.5
console.log(`Jump to ${position}s`);

// Delete cue
cues.deleteCue(1);

// Get current cues
const activeCues = cues.getActiveCues();
console.log(`${activeCues.length} cues set`);
```

### Cue Slots

```typescript
// 8 cue slots per deck (indices 1-8)
// Right-click to delete
// Left-click to jump (if set) or set (if empty)

Layout:
┌────┬────┬────┬────┐
│ 1  │ 2  │ 3  │ 4  │
├────┼────┼────┼────┤
│ 5  │ 6  │ 7  │ 8  │
└────┴────┴────┴────┘
```

### Color Coding

```typescript
// Set cue color
cues.setCueColor(1, '#EF4444');  // Red
cues.setCueColor(2, '#10B981');  // Green
cues.setCueColor(3, '#3B82F6');  // Blue

// Available colors
const colors = {
  red:    '#EF4444',
  orange: '#F97316',
  yellow: '#EAB308',
  green:  '#22C55E',
  blue:   '#3B82F6',
  purple: '#8B5CF6',
  pink:   '#EC4899',
  white:  '#F5F5F5',
};
```

### Cue Labels

```typescript
// Add descriptive labels
cues.setCueLabel(1, 'Intro');
cues.setCueLabel(2, 'Verse 1');
cues.setCueLabel(3, 'Chorus');
cues.setCueLabel(4, 'Drop');
cues.setCueLabel(5, 'Outro');

// Labels display on hover
// Useful for navigation
```

### Cue Organization

```typescript
// Group related cues
const vocalTrack = {
  1: { position: 0,     label: 'Intro' },
  2: { position: 16,    label: 'Verse 1' },
  3: { position: 32,    label: 'Chorus' },
  4: { position: 48,    label: 'Verse 2' },
  5: { position: 64,    label: 'Drop' },
  6: { position: 80,    label: 'Breakdown' },
  7: { position: 96,    label: 'Final Chorus' },
  8: { position: 110,   label: 'Outro' },
};

// Load preset
cues.loadPreset(Object.entries(vocalTrack).map(([idx, data]) => ({
  index: parseInt(idx),
  position: data.position,
  label: data.label,
  color: '#3B82F6'
})));
```

### Cue Export/Import

```typescript
// Export cues as JSON
const cueData = cues.export();
// {
//   trackId: 'track-001',
//   cues: [
//     { index: 1, position: 10.5, label: 'Verse', color: '#...' }
//   ]
// }

// Save to file
const json = JSON.stringify(cueData);
localStorage.setItem('cues-track-001', json);

// Import later
const saved = JSON.parse(localStorage.getItem('cues-track-001'));
cues.import(saved);
```

### Usage Example: Live Mixing

```typescript
// Set up cues for live set
const track = new CueManager('live-track-001');

// Quick cue setup
const cuePoints = [
  { index: 1, time: 0, label: 'Start' },
  { index: 2, time: 16, label: 'Buildup' },
  { index: 3, time: 32, label: 'Drop' },
  { index: 4, time: 48, label: 'Second Drop' },
  { index: 5, time: 80, label: 'Breakdown' },
  { index: 6, time: 96, label: 'Final Drop' },
  { index: 7, time: 120, label: 'Outro Start' },
  { index: 8, time: 130, label: 'End' },
];

cuePoints.forEach(({ index, time, label }) => {
  track.setCue(index, time, label);
  track.setCueColor(index, getColorForSection(label));
});

// Jump between sections during performance
function jumpToSection(sectionName) {
  const cue = track.getActiveCues().find(c => c.label === sectionName);
  if (cue) {
    track.jumpToCue(cue.index);
  }
}
```

---

## 📍 Beat Sync

### Overview

Automatic beat grid detection and synchronization for tempo-locked mixing.

### Basic Usage

```typescript
import { BeatSync } from '../audio/dj-controls/beat-sync';

// Initialize
const beatSync = new BeatSync(120); // Master BPM

// Generate beat grid
const grid = beatSync.generateBeatGrid(180); // 3 minute track
// Grid contains beat markers at intervals

// Snap position to nearest beat
const snappedTime = beatSync.snapToBeat(15.25);
// Returns 15 (nearest beat)

// Subscribe to grid changes
beatSync.subscribe((grid) => {
  if (grid) {
    console.log(`Beat grid: ${grid.markers.length} beats`);
  }
});
```

### Beat Grid Structure

```typescript
// Beat grid contains markers
interface BeatGrid {
  bpm: number;                    // 120
  downbeatOffset: number;         // Offset to first beat (ms)
  markers: [
    {
      position: 0,                // In seconds
      beatNumber: 0,              // 0, 1, 2, 3, 4, ...
      isMajorBeat: true          // Every 4 beats
    },
    {
      position: 0.5,
      beatNumber: 1,
      isMajorBeat: false
    }
    // ... more markers
  ]
}
```

### Beat Quantization

```typescript
// Snap to specific grid divisions
beatSync.quantize(15.3, 'bar');       // Snap to nearest bar (4 beats)
beatSync.quantize(15.3, 'beat');      // Snap to nearest beat
beatSync.quantize(15.3, 'eighth');    // Snap to 1/8 note
beatSync.quantize(15.3, 'sixteenth'); // Snap to 1/16 note
```

### Beat Calculation

```typescript
// Get beat number at position
const beatNum = beatSync.getBeatNumber(15.5); // Returns beat index

// Get bar number
const barNum = beatSync.getBarNumber(15.5); // Returns bar index

// Time to next beat
const timeToNextBeat = beatSync.timeToNextBeat(15.3);
// Returns milliseconds until next beat

// Time to next bar
const timeToNextBar = beatSync.timeToNextMajorBeat(15.3);
```

### Loop Calculations

```typescript
// Calculate loop length in beats
const loopStart = 32; // seconds
const loopEnd = 64;   // seconds
const lengthInBeats = beatSync.calculateLoopLength(loopStart, loopEnd);
// Returns 128 beats (assuming 120 BPM)

// Set beat-locked loop (always whole bars)
const quantizedStart = beatSync.quantize(loopStart, 'bar');
const quantizedEnd = beatSync.quantize(loopEnd, 'bar');
setLoop(quantizedStart, quantizedEnd);
```

### BPM Detection

```typescript
// Detect BPM from audio
const audioBuffer = await loadAudioFile('track.mp3');
const detectedBpm = await beatSync.detectBpm(audioBuffer);
// Returns estimated BPM

// Update beat sync
beatSync.setMasterBpm(detectedBpm);
beatSync.generateBeatGrid(audioBuffer.duration);
```

### Snap Threshold

```typescript
// Configure snap sensitivity
beatSync.setConfig({
  snapThreshold: 50,  // milliseconds
  // Will only snap if within 50ms of beat
});

// Strict snapping (only on beat)
beatSync.setConfig({ snapThreshold: 10 });

// Loose snapping (forgiving)
beatSync.setConfig({ snapThreshold: 100 });
```

### Usage Example: Tempo-Locked Looping

```typescript
// Create beat-locked loop
const beatSync = new BeatSync(120);
beatSync.generateBeatGrid(300); // 5 minute track

// Set loop at beats (not arbitrary positions)
function setBeatLockedLoop(startBeat: number, lengthBeats: number) {
  // Convert beat numbers to time
  const beatDuration = 60 / beatSync.getMasterBpm();
  
  const startTime = startBeat * beatDuration;
  const endTime = (startBeat + lengthBeats) * beatDuration;
  
  // Snap to ensure accuracy
  const snappedStart = beatSync.snapToBeat(startTime);
  const snappedEnd = beatSync.snapToBeat(endTime);
  
  setLoop(snappedStart, snappedEnd);
}

// Create 16-beat loop
setBeatLockedLoop(32, 16);
// Starts at beat 32, ends at beat 48
```

---

## 🎛️ Advanced Mixing

### Multi-Track Mixing

```typescript
// Mix 4 decks
class DJMixer {
  private decks: Map<string, DJDeck> = new Map();
  
  addDeck(id: string) {
    const deck = new DJDeck(id);
    this.decks.set(id, deck);
  }
  
  // Crossfade between any two decks
  crossfadeDecks(fromId: string, toId: string, duration: number) {
    const fromDeck = this.decks.get(fromId);
    const toDeck = this.decks.get(toId);
    
    // Use crossfader between them
    fromDeck.crossfader.soften('B', duration);
  }
}
```

### Channel Filters

```typescript
// Per-channel filtering
const channelFilter = {
  type: 'lowpass',           // lowpass, highpass, bandpass
  frequency: 8000,           // Hz
  resonance: 5,              // Q factor
};

// Sweep filter during mix
function sweepChannelFilter(channel: 'A' | 'B', duration: number) {
  // Sweep from 20Hz to 20kHz
  beatSync.quantize(duration, 'beat'); // Quantize to beat
  
  // Animate filter sweep
  const startFreq = 20;
  const endFreq = 20000;
  
  for (let i = 0; i < duration; i += 50) {
    const progress = i / duration;
    const freq = startFreq * Math.pow(endFreq / startFreq, progress);
    setChannelFilter(channel, freq);
  }
}
```

### DJ Scratching (Advanced)

```typescript
// Manual scratching with crossfader
async function scratchEffect(tempo: TempoControl) {
  // Back-and-forth crossfader movement
  for (let i = 0; i < 8; i++) {
    // Scratch direction 1
    crossfader.setPosition(-0.8);
    await sleep(50);
    
    // Scratch direction 2
    crossfader.setPosition(0.8);
    await sleep(50);
  }
  
  // End at center
  crossfader.setPosition(0);
}

// Pitch bend (tempo wobble)
async function pitchBend(tempo: TempoControl, strength: number) {
  const originalBpm = tempo.getState().bpm;
  
  // Oscillate tempo
  for (let t = 0; t < 2000; t += 50) {
    const wave = Math.sin((t / 2000) * Math.PI * 2);
    const newBpm = originalBpm + wave * strength;
    tempo.setBpm(newBpm);
    await sleep(50);
  }
  
  tempo.setBpm(originalBpm);
}
```

---

## 🎯 Performance Tips

### 1. Smooth Fades

```typescript
// ❌ Bad: Abrupt changes cause clicks
crossfader.setPosition(1);
crossfader.setPosition(-1); // Instant click

// ✅ Good: Use smooth transitions
crossfader.soften('B', 500);
setTimeout(() => crossfader.soften('A', 500), 500);
```

### 2. Beat-Aligned Changes

```typescript
// ❌ Bad: Random timing
tempo.setBpm(128);

// ✅ Good: Wait for beat
const timeToNextBeat = beatSync.timeToNextBeat(currentTime);
setTimeout(() => tempo.setBpm(128), timeToNextBeat);
```

### 3. Latency Monitoring

```typescript
// Monitor crossfader latency during performance
if (crossfader.getLatency() > 5) {
  console.warn('High crossfader latency');
  // Reduce effects, lower buffer if possible
}
```

### 4. Cue Management

```typescript
// Pre-set cues before live set
// Don't modify cues during performance
// Use keyboard shortcuts for jumping
```

### 5. CPU Optimization

```typescript
// Disable reverb/delay on busy tracks
track.effectChain.bypass('reverb');

// Reduce polyphony if needed
synth.maxVoices = 4; // Instead of 32

// Monitor and warn
if (cpuLoad > 70) {
  console.warn('Reduce complexity');
}
```

---

## 🎓 Best Practices

### For Live DJing

1. **Set cues before performance**
2. **Use beat-aligned transitions**
3. **Monitor crossfader latency**
4. **Keep effects simple**
5. **Use keyboard shortcuts**

### For Mixing

1. **Match BPM before crossfading**
2. **Snap loops to beats**
3. **Use smooth curves**
4. **Monitor CPU load**
5. **Test on target hardware**

---

## 📚 Examples

See `examples/dj-controls/` for:
- Live mixing workflow
- Beat matching
- Loop creation
- DJ scratch effects
- Complete performance setup