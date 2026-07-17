# Demo Checklist — Pre-Investor QA (17 Items)

Run this checklist before any live demo to an investor, stakeholder, or user.

## Browser & Environment (3 items)
- [ ] Browser clean state (Incognito window, no cached auth)
- [ ] Console clean (no red errors after 5-second idle)
- [ ] Network tab ready (DevTools XHR filter on, all requests <500ms)

## Authentication (2 items)
- [ ] Login endpoint responds (test user credentials ready, <2 sec)
- [ ] Session persists after refresh (localStorage/JWT valid)

## Audio Playback (3 items)
- [ ] Microphone/speaker active (system audio working, not muted)
- [ ] Audio loads and renders (samples visible <1 sec, waveform renders)
- [ ] Playback works (Play/Stop, volume slider real-time, no lag)

## LLPTE Pipeline (3 items)
- [ ] AutoLevel runs (mix recommendations appear within 500ms)
- [ ] Transition graph updates (multi-track sequence loads, state syncs)
- [ ] Performance acceptable (FPS >30, CPU <60%, no frame drops)

## Real-time Collaboration (2 items)
- [ ] Room created (shareable link generated, URL has room ID)
- [ ] Multi-user sync (second browser joins, <500ms time-to-sync)

## Responsive Design (2 items)
- [ ] Desktop view (full sidebar visible, no content overflow)
- [ ] Mobile view (single-column layout, touch targets >44px)

## Cleanup & Handoff (1 item)
- [ ] Data reset (logout, clear session, browser storage clean)

---

**Status:** This checklist must pass all 17 items before any investor-facing demo.

**How to use:**
1. Open this file on a separate screen or printout
2. Check off each item as you verify it
3. If any item fails, stop the demo and troubleshoot before proceeding
4. After demo, note any items that took longer than expected (performance gap)

**Troubleshooting quick-links:**
- Console errors? Check `server/index.ts` error handlers and CORS config
- Audio not playing? Verify `Tone.js` initialization in `client/src/App.tsx`
- Collab not syncing? Check WebSocket connection in DevTools Network tab, verify `server/ws/collab.ts`
- FPS drops? Profile with Chrome DevTools Performance tab, check for excessive re-renders in React Components
