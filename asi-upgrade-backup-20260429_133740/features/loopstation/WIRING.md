# RC-505 LoopStation — Integration Guide
# Run these commands from your project root: ~/Stable/R3 v4/

## ─── STEP 1: Verify your deps are present (they are — already in node_modules) ─────
# tone ✅  framer-motion ✅  react ✅  typescript ✅
# No new installs needed.


## ─── STEP 2: Create the feature directory tree ─────────────────────────────────────
mkdir -p client/src/features/loopstation/components
mkdir -p client/src/features/loopstation/hooks
mkdir -p client/src/features/loopstation/engine
mkdir -p client/src/features/loopstation/types


## ─── STEP 3: Copy the generated files ─────────────────────────────────────────────
# (replace SRC with where you saved the output files)

cp <output>/types/loopstation.types.ts           client/src/features/loopstation/types/
cp <output>/engine/loopEngine.ts                  client/src/features/loopstation/engine/
cp <output>/hooks/useLoopStation505.ts            client/src/features/loopstation/hooks/
cp <output>/features/loopstation/LoopStation505.tsx          client/src/features/loopstation/
cp <output>/features/loopstation/components/*.tsx client/src/features/loopstation/components/


## ─── STEP 4: Fix the import path in LoopStation505.tsx ────────────────────────────
# The component imports from relative paths, so update the top-level hook import:
#
# In:  client/src/features/loopstation/LoopStation505.tsx
# The existing line:
#   import { useLoopStation505 } from './hooks/useLoopStation505';
# is already correct — no change needed.


## ─── STEP 5: Mount the component ──────────────────────────────────────────────────
# Choose ONE of these approaches based on your routing setup:

### Option A — Add to an existing route/page ─────────────────────────────────
# Find the file where you want it (e.g. a DJ page, instrument page, etc.)
# Add at the top:
#   import { LoopStation505 } from '@/features/loopstation/LoopStation505';
#
# Add inside JSX wherever you want it to live:
#   <LoopStation505 />

### Option B — Add a dedicated route via wouter (you have wouter installed) ──
# In your main router file (likely client/src/App.tsx or similar):
#
#   import { Route } from 'wouter';
#   import { LoopStation505 } from '@/features/loopstation/LoopStation505';
#
#   // Inside your switch/router:
#   <Route path="/loopstation" component={LoopStation505} />


## ─── STEP 6: Check @/ alias is configured ────────────────────────────────────────
# Your project already uses @/ (visible from other imports). Confirm in:
#   client/vite.config.ts → resolve.alias should have '@' → './src'
#   client/tsconfig.json  → compilerOptions.paths should have '@/*' → ['./src/*']
#
# If not already set, add to vite.config.ts:
#   resolve: {
#     alias: { '@': path.resolve(__dirname, './src') },
#   }
#
# And to tsconfig.json:
#   "paths": { "@/*": ["./src/*"] }


## ─── WHAT THIS DOES NOT TOUCH ──────────────────────────────────────────────────
# ✅ Your existing audioEngine.ts — NOT modified
# ✅ Your existing useLoopStation hook — NOT modified (new hook is useLoopStation505)
# ✅ Your existing routes — only ADD, never change
# ✅ Your existing DB / server / shared schemas — zero contact
# ✅ Your existing styles — component is fully self-contained with inline styles + Tailwind


## ─── QUICK SANITY CHECK ──────────────────────────────────────────────────────────
# After copying, run:
#   cd client && npx tsc --noEmit
# This will surface any type errors before you touch the dev server.
# Common fix: if Tone types complain, ensure:
#   npm ls tone   # should show tone@latest already present


## ─── FILE MAP ─────────────────────────────────────────────────────────────────────
#
# client/src/features/loopstation/
# ├── LoopStation505.tsx            ← mount this in your app
# ├── types/
# │   └── loopstation.types.ts      ← TrackState, LoopTrack, FXState etc.
# ├── engine/
# │   └── loopEngine.ts             ← Tone.js singleton (isolated from audioEngine.ts)
# ├── hooks/
# │   └── useLoopStation505.ts      ← all state logic, MIDI, BPM sync
# └── components/
#     ├── TrackPad.tsx              ← main pad (RGB ring, waveform, EQ, harmony)
#     ├── RGBRing.tsx               ← animated conic LED ring (framer-motion)
#     ├── WaveformCanvas.tsx        ← RAF canvas waveform (no React re-renders)
#     ├── VUMeter.tsx               ← 12-segment RAF VU meter
#     ├── FXKnob.tsx                ← drag-to-rotate knob with arc track
#     └── XYPad.tsx                 ← touch/mouse XY FX pad
