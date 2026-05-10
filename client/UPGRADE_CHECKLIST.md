# Production Upgrade Checklist

## Architecture
- [ ] Timeline moved to canvas renderer
- [ ] State isolated to Zustand stores
- [ ] Worker threads enabled (waveform.worker.ts)
- [ ] Audio engine separated (lazy singleton)
- [ ] @/ alias configured in vite.config.ts + tsconfig.json

## Collaboration
- [ ] yjs CRDT document wired (ydoc.ts)
- [ ] Liveblocks room connected (presence.ts → connectRoom)
- [ ] Cursor interpolation active
- [ ] Multiplayer undo via Y.UndoManager

## Visuals
- [ ] Motion token system in use (motion.ts)
- [ ] Glow system standardized (glow.ts)
- [ ] Canvas timeline rendering (timelineRenderer.ts)

## Performance
- [ ] react-window virtualization enabled
- [ ] measureFPS wired with cancel handle
- [ ] Memory profiled
- [ ] Audio drift tested

## Accessibility
- [ ] Keyboard shortcuts registered (shortcuts.ts)
- [ ] ARIA labels on all interactive elements
- [ ] prefers-reduced-motion respected
- [ ] Focus visibility confirmed

## Legal
- [ ] GSAP license verified for commercial use (or replaced with framer-motion)
- [ ] Liveblocks plan confirmed for user count
