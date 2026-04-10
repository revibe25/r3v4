# R3 v4 — Pre-Demo QA Checklist
# Run this 30 minutes before any investor meeting.
# Source: PRD v4 §15 + §21
# ALL items must be ✅ before proceeding. No exceptions.

---

## Environment Setup

- [ ] Load demo session: 8 pre-selected tracks, 128 BPM, key of A minor
- [ ] Confirm tier: **pro_artist** (NOT "Pro" — check top nav badge)
- [ ] Dim room lights — screen is the only light source
- [ ] Close all other applications
- [ ] Disable notifications

---

## LLPTE Node Graph (Zone 4B)

- [ ] All 5 nodes rendering: inputRouter, spectralAnalyzer, llpte-core, transitionGraph, outputBus
- [ ] **Connector lines animated** — 5px dash / 5px gap, moving toward outputBus
  - Static connectors = **DEMO FAILURE** — reload page
- [ ] `inference 10ms` badge updating every 100ms on LLPTE Core node
  - Static badge = **DEMO FAILURE** — restart server
- [ ] Hover Transition Graph node → tooltip shows: `847 active edges | last tick 0.8ms`
  - No tooltip = **DEMO FAILURE** — check WebSocket connection
- [ ] Signal oscilloscope animated below graph (≥30fps)
  - Static waveform = **DEMO FAILURE** — audio engine not running
- [ ] LLPTE Core arc spinner rotating continuously

---

## Audio & Playback

- [ ] Press Space → audio plays without dropout in first 30 seconds
- [ ] VU meters active on all 6 channel strips
- [ ] Playhead moving with cyan glow #00F5FF
- [ ] No audio dropouts in 5-minute sustained test
  - Any dropout = **DEMO FAILURE** — reduce track count, retest
- [ ] CPU meter below 60% at 8 tracks

---

## AI Features

- [ ] AI Auto-Leveling fires within 2 bars — ghost knobs appear
  - No suggestion = **DEMO FAILURE** — check LLPTE pipeline
- [ ] Toast fires: "AI Mix updated — confidence 94%"
- [ ] Ghost knobs visible on mixer strips (translucent violet overlays)
- [ ] Confidence score badge shows on AI MIX track

---

## Session & Time Savings

- [ ] SessionChip visible in top nav (shows ● Live when active)
- [ ] Session summary appears on playback stop (press Space)
- [ ] Session summary shows real data (not zeros)
  - Zeros = aiDecisionLog migration 0005 not applied to Railway
- [ ] **Export PNG working** — generates and previews
  - Export fails = **DEMO FAILURE**

---

## UI & Navigation

- [ ] Pro badge (pro_artist tier) visible in top nav
  - Missing = **DEMO FAILURE** — check session/DB tier
- [ ] Right-click on VOCAL CHOP clip → "Send to AI" option visible
- [ ] Effects rack: Reverb, Delay, Compressor loading without errors
- [ ] Keyboard shortcut bar visible at bottom

---

## Demo Flow Dry Run (5 minutes)

Run through the full 12-minute script once quickly:

- [ ] Scene 1: Space bar → LLPTE animates → SessionChip activates
- [ ] Scene 2: Toast fires within 2 bars
- [ ] Scene 3: Accept All → knobs animate → override demo works
- [ ] Scene 4: Suggestion panel fires with frequency conflict
- [ ] Scene 5: Right-click → Send to AI → Key-Match Crossfade → Accept
- [ ] Scene 6: Node graph tooltip shows 847 edges / 0.8ms
- [ ] Scene 7: Stop → SessionSummaryPanel → Export PNG

---

## Demo Failure Conditions — Do Not Proceed If Any Are True

| Condition | Action |
|---|---|
| `inference 10ms` badge is static | Restart server |
| Connector lines not animated | Reload page |
| Transition Graph tooltip missing | Check WebSocket |
| Signal oscilloscope static | Restart audio engine |
| Session summary shows zeros | Apply migration 0005 to Railway |
| Audio dropout in first 2 minutes | Reduce track count, retest |
| Pro badge missing from top nav | Check DB tier for demo user |
| Export PNG fails | Check storage/S3 config |

---

## Post-Demo

- [ ] Note any questions investor asked about LLPTE
- [ ] Note any feature they asked for
- [ ] Send follow-up within 24 hours with Time Savings export PNG

---

*PRD Reference: v4.0 §15 (MVP Checklist) + §21 (Demo Script)*
*Last updated: 2026-04-09*
