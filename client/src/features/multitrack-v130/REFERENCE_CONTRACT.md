# R3 NATIVE Multitrack v1.3.0 — Frozen Reference Contract

## Source identity

- Reference: `r3-native-multitrack-v1.3.0-CORRECTED.html`
- SHA256: `b38da47b26317782f54fad381925379f203760e4193419aa7d050bd271c2e9b0`
- Bytes: `194850`
- Lines: `42`
- Contract revision: 20260927-002129

## Source sections

1. core
2. canvas
3. sidebar
4. data
5. mixer
6. dsp
7. engine
8. panels
9. app

## Logical viewport

- DESIGN_W = 1536
- DESIGN_H = 1024
- scale = min(viewportWidth / 1536, viewportHeight / 1024)
- stage is represented in logical design coordinates before visual scaling
- canvas backing dimensions account for devicePixelRatio
- pointer coordinates are mapped back into logical coordinates

## Layout

### Global rows

```
58px
26px
minmax(0,474fr)
minmax(0,434fr)
32px
```

### Horizontal geometry

- sidebar: 150px
- arrangement rail: 44px
- right workspace: 300px
- right rail: 30px
- bottom-left controller region: 318px
- mixer: 490px
- DSP: 330px
- analyzer: flexible

### Right stack

- routing: flexible
- takes: 162px

## Panels

```
side
arr
routing
takes
padsP
pianoP
mixer
dsp
ana
```

Panel lifecycle:

- collapse
- expand
- maximize
- restore
- 2D / 3D toggle
- collapse all
- expand all
- reset
- empty-state when all panels are collapsed
- panel-layout persistence

## Timeline

- 48 bars
- 16 steps/bar
- 7 tracks
- playhead
- clips
- waveform rendering
- markers
- automation
- pointer editing
- anchored automation endpoints

## Data

Top-level reference state includes:

- SESSION
- TRACKS
- BUSES
- MARKERS
- CLIPS
- TAKES
- CH
- SYN
- REV0
- MIX_TRIM
- S
- DSP_DEF
- VOX_DEF
- AUTO_DEF
- SENDROWS

State domains include:

- transport
- tempo
- loop
- recording
- selection
- pad state
- keyboard/octave
- routing
- sends
- mixer
- DSP
- vocal processing
- analyzer
- automation
- recording events
- UI/panel state

## Audio ownership

Reference realtime engine:

`new (window.AudioContext || window.webkitAudioContext)(...)`

This is **reference behavior only**.

Final React implementation:

- MUST use `client/src/audio/core/audio-context.ts`
- MUST NOT create another application realtime AudioContext

Reference offline rendering uses OfflineAudioContext in isolated render paths.

Offline contexts are not realtime application ownership.

## MIDI ownership

Reference:

- navigator.requestMIDIAccess()
- MIDI input enumeration
- onmidimessage
- onstatechange
- 0x80 note-off
- 0x90 note-on
- 0x90 velocity-zero release

Final React implementation must adapt this to the canonical R3 MIDI subsystem.

## Persistence

Reference panel persistence:

`localStorage` key `r3n.ui.v1`

This represents UI/panel state.

It MUST NOT become a second canonical project-persistence system.

Canonical R3 project persistence remains:

`client/src/project/daw-project-state.ts`

## Transport

Reference transport functions include:

- ensureEngine
- scheduleStep
- pump
- play
- pause
- stop
- seek
- updatePos
- toggleRec
- syncTransport
- jumpMarker

The final implementation must adapt transport behavior to canonical R3 transport/state ownership.

Rendering may use requestAnimationFrame for visual updates.

## Renderer

The reference renderer is Canvas 2D.

Its 3D presentation is a 2D projection treatment rather than an independent Three.js scene.

Renderer responsibilities include:

- canvas lifecycle
- backing resolution
- logical coordinate mapping
- arrangement drawing
- waveform drawing
- automation drawing
- take drawing
- analyzer drawing
- master meter drawing
- 2D/3D projection

## Mixer

Seven tracks plus master.

Controls/features include:

- mute
- solo
- arm
- bus assignment
- input assignment
- gain/fader
- pan
- send/reverb
- meters

## Routing

Includes:

- bus routing
- input routing
- sends
- routing visualization

Actual processing must ultimately connect to canonical R3 audio graph ownership.

## Takes

Includes:

- take sets
- take selection
- take audition
- keyboard interaction
- take visualization

## Pads / piano

Includes:

- pad banks
- pad triggering
- swing
- quantization
- velocity interaction
- octave control
- two-octave keyboard
- MIDI key state

## DSP

Includes reference controls/components for:

- master processing
- vocal processing
- compression
- EQ
- de-essing
- reverb
- saturation
- limiting
- send/return processing
- DSP visualization
- target switching

Actual DSP runtime must be adapted to the existing R3 audio architecture.

## Analyzer

Includes:

- spectrum
- LUFS
- RMS
- phase/correlation
- stereo width
- master meters
- true-peak-related display
- gain reduction

Analyzer values in the final application must come from real signal analysis rather than synthetic random values.

## History

Reference history checkpoints protect reversible state mutations.

Final implementation must retain equivalent undo/redo semantics.

## Accessibility

Reference uses:

- role=menu
- role=listbox
- role=option
- role=status
- aria-pressed
- aria-expanded
- aria-selected
- aria-current
- aria-haspopup
- accessible labels for transport/panels/track controls

Keyboard behavior includes:

- Space transport
- Esc restore
- menu navigation
- Enter activation

## Public controller

Reference exposes:

`window.R3Multitrack`

with:

- state
- data
- history
- panels
- dsp
- play
- pause
- stop
- seek
- render
- setMode
- padHit
- setTake
- engine

The React implementation does not need this global object.

Equivalent behavior must be reachable through explicit feature APIs.

## Non-negotiable migration rules

1. Reference HTML is the visual/behavioral source of truth.
2. Existing R3 runtime authorities remain authoritative.
3. No duplicate realtime AudioContext.
4. No duplicate global MIDI access.
5. No duplicate canonical project persistence.
6. No synthetic transport.
7. No synthetic analyzer/meter values.
8. No global CSS leakage.
9. No route switch until parity gates pass.
10. No silent loss of v1.3-only persisted fields.
