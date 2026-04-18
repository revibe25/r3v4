# R3 v4 — API Reference

**Version:** 2.0.0
**Last Updated:** 2026-04-12
**Transport:** tRPC (type-safe RPC over HTTP) — NOT REST
**Base URL:** `http://localhost:3000/trpc` (dev) | Railway URL (prod)
**Auth:** JWT via `Authorization: Bearer <token>` header on all protected procedures

---

## Overview

R3 v4 uses tRPC for all API communication. There are 11 routers exposed via
`server/procedures.ts`. All procedures are fully typed end-to-end — no manual
type casting required on the client.

```
appRouter
├── sessions          — session lifecycle
├── sessionMetrics    — AI metrics + time savings
├── admin             — admin panel + AGI agent
├── daw               — DAW state + arrangement
├── subscription      — Stripe billing + tier management
├── mixer             — mixer state + gain controls
├── dj                — DJ deck + crossfader controls
├── aiMix             — LLPTE AI mixing + decision logging
├── projects          — project CRUD
├── presets           — effect + DJ presets
├── settings          — user preferences
└── ping              — health check (public)
```

---

## Authentication

### POST /api/auth/login
Standard REST endpoint (not tRPC) for JWT issuance.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "tier": "creator",
    "isAdmin": false
  }
}
```

**Error (401):**
```json
{ "error": "Invalid credentials" }
```

---

## ping

### ping.health
Public procedure. Returns server status.

```ts
trpc.ping.health.query()
// → { status: 'ok', ts: '2026-04-12T...' }
```

---

## sessions

### sessions.start
Start a new DAW session. Returns `sessionId` for linking AI decisions.

```ts
trpc.sessions.start.mutate({
  bpm: 128,
  trackIds: ['track-1', 'track-2', '...']
})
// → { sessionId: 'uuid' }
```

### sessions.stop
End session, compute duration and time savings.

```ts
trpc.sessions.stop.mutate({
  sessionId: 'uuid'
})
// → { sessionId, durationSeconds, timeSavedSeconds, ... }
```

### sessions.getSummary
Retrieve session summary for SessionSummaryPanel.

```ts
trpc.sessions.getSummary.query({
  sessionId: 'uuid'
})
// → SessionMetricsSummary | null
```

---

## sessionMetrics

### sessionMetrics.getAcceptanceRate
Returns AI acceptance rate for a session. Powers the PRD ≥65% gate.

```ts
trpc.sessionMetrics.getAcceptanceRate.query({
  sessionId: 'uuid'
})
// → { accepted: number, total: number, rate: number }
```

### sessionMetrics.getTimeSavings
Returns time savings breakdown.

```ts
trpc.sessionMetrics.getTimeSavings.query({
  sessionId: 'uuid'
})
// → { totalSavedSeconds: number, percentageFaster: number }
```

---

## aiMix

Core LLPTE integration. All procedures require authentication.

### aiMix.analyze
Run the LLPTE pipeline on current mixer state. Fire-and-forget logs to
`aiDecisionLog` when `sessionId` is provided.

```ts
trpc.aiMix.analyze.mutate({
  genre: 'techno',
  targetLoudness: -14,        // LUFS
  enableStemSeparation: false,
  sessionId: 'uuid'           // optional — enables decision logging
})
// → {
//     suggestions: Array<{
//       channelId: string,
//       type: 'gain_adjust' | 'eq_suggest' | 'conflict_flag',
//       confidence: number,    // 0–1
//       decision: Record<string, unknown>,
//       decisionId: string     // use with recordOutcome
//     }>,
//     latencyMs: number
//   }
```

**Confidence gates applied automatically:**
- ≥0.65 → `auto_applied`
- ≥0.40 → `ignored` (surfaces as ghost knob suggestion)
- <0.40 → `discarded` (logged, not shown)

### aiMix.recordOutcome
Update outcome when user accepts or rejects a suggestion. Updates
`aiDecisionLog` for acceptance rate tracking.

```ts
trpc.aiMix.recordOutcome.mutate({
  decisionId: 'uuid',
  outcome: 'accepted' | 'rejected' | 'ignored'
})
// → void
```

### aiMix.getTransitions
Get available transition types for a track pair with Camelot scoring.

```ts
trpc.aiMix.getTransitions.query({
  fromTrackId: 'track-1',
  toTrackId: 'track-2'
})
// → {
//     transitions: Array<{
//       type: TransitionType,
//       confidence: number,
//       camelotScore: number
//     }>
//   }
```

---

## mixer

### mixer.getState
Get full mixer state.

```ts
trpc.mixer.getState.query()
// → { tracks: Track[], masterGain: number, ... }
```

### mixer.updateTrack
Update a track's gain, pan, mute, solo, or armed state.

```ts
trpc.mixer.updateTrack.mutate({
  trackId: 'track-1',
  gain: 0.8,
  mute: false,
  solo: false
})
```

### mixer.applyAISuggestion
Apply an AI gain suggestion to a track via `AudioParam.setTargetAtTime()`
(click-free, ramped).

```ts
trpc.mixer.applyAISuggestion.mutate({
  trackId: 'track-1',
  gainLinear: 0.75,
  decisionId: 'uuid'
})
```

---

## dj

### dj.setCrossfader
Set crossfader position (0 = full deck A, 1 = full deck B).

```ts
trpc.dj.setCrossfader.mutate({ position: 0.5 })
```

### dj.setHotCue
Set or clear a hot cue point.

```ts
trpc.dj.setHotCue.mutate({
  deckId: 'deck-a',
  cueIndex: 0,    // 0–7
  positionMs: 32000
})
```

### dj.getCues
Retrieve all cue points for a deck.

```ts
trpc.dj.getCues.query({ deckId: 'deck-a' })
// → { cues: Array<{ index, positionMs, label, color }> }
```

---

## subscription

### subscription.getStatus
Get current user's subscription tier and status.

```ts
trpc.subscription.getStatus.query()
// → {
//     tier: 'explorer' | 'creator' | 'pro_artist',
//     status: 'active' | 'canceled' | 'past_due',
//     currentPeriodEnd: string
//   }
```

### subscription.createCheckout
Create a Stripe checkout session for upgrade.

```ts
trpc.subscription.createCheckout.mutate({
  tier: 'creator',    // 'creator' | 'pro_artist'
  successUrl: 'https://app.r3vibe.com/instrument',
  cancelUrl: 'https://app.r3vibe.com/pricing'
})
// → { checkoutUrl: string }
```

### subscription.cancelSubscription
Cancel current subscription at period end.

```ts
trpc.subscription.cancelSubscription.mutate()
// → { canceledAt: string, expiresAt: string }
```

---

## projects

### projects.list
List all projects for the current user.

```ts
trpc.projects.list.query()
// → { projects: Array<{ id, name, createdAt, updatedAt }> }
```

### projects.get
Get full project including arrangement JSON.

```ts
trpc.projects.get.query({ projectId: 'uuid' })
// → { id, name, arrangementJSON, createdAt }
```

### projects.create
Create a new project.

```ts
trpc.projects.create.mutate({
  name: 'My Set',
  arrangementJSON: {}
})
// → { projectId: string }
```

### projects.update
Save project state.

```ts
trpc.projects.update.mutate({
  projectId: 'uuid',
  arrangementJSON: { /* full state */ }
})
```

### projects.delete

```ts
trpc.projects.delete.mutate({ projectId: 'uuid' })
```

---

## presets

### presets.listEffects

```ts
trpc.presets.listEffects.query()
// → { presets: EffectPreset[] }
```

### presets.createEffectPreset

```ts
trpc.presets.createEffectPreset.mutate({
  name: 'Warm Reverb',
  type: 'reverb',
  data: { roomSize: 0.7, wet: 0.3, dry: 0.7 },
  isFactory: false
})
```

### presets.updateEffectPreset

```ts
trpc.presets.updateEffectPreset.mutate({
  presetId: 'uuid',
  data: { wet: 0.4 }
})
```

### presets.deleteEffectPreset

```ts
trpc.presets.deleteEffectPreset.mutate({ presetId: 'uuid' })
```

---

## settings

### settings.get
Get all user settings (17 columns).

```ts
trpc.settings.get.query()
// → { theme, audioLatency, midiEnabled, autoSave, ... }
```

### settings.update

```ts
trpc.settings.update.mutate({
  theme: 'dark',
  audioLatency: 256,
  midiEnabled: true
})
```

---

## admin

Admin procedures require `users.isAdmin = true`.
All Anthropic API calls are server-side — never exposed to the browser.

### admin.checkAccess
Verify the current user has admin access.

```ts
trpc.admin.checkAccess.query()
// → { isAdmin: boolean }
```

### admin.agentChat
Send a message to the AGI command agent.

```ts
trpc.admin.agentChat.mutate({
  message: 'What is the current hygiene score?',
  history: []   // prior messages for context
})
// → { reply: string }
```

---

## Effects API (REST — Legacy)

These REST endpoints exist alongside tRPC for the effects/waveform surface.
See original API_REFERENCE v1.0.0 for full documentation.

| Endpoint | Method | Description |
|---|---|---|
| `/api/effects/presets` | GET | List all effect presets |
| `/api/effects/presets` | POST | Create effect preset |
| `/api/effects/presets/:id` | GET/PUT/DELETE | CRUD single preset |
| `/api/effects/chains` | GET/POST | Effect chain operations |
| `/api/waveform/analyze` | POST | Analyze audio file |
| `/api/waveform/slice` | POST | Slice by transients |
| `/api/waveform/edit` | POST | Apply edit operation |
| `/api/presets` | GET | All presets (effects + DJ) |
| `/api/presets/save` | POST | Save complete preset package |
| `/api/presets/:id` | GET/PUT/DELETE | CRUD single preset |

---

## Error Handling

tRPC errors use standard TRPCError codes:

| Code | HTTP | Meaning |
|---|---|---|
| `UNAUTHORIZED` | 401 | No valid JWT |
| `FORBIDDEN` | 403 | Authenticated but insufficient tier/role |
| `NOT_FOUND` | 404 | Resource not found |
| `BAD_REQUEST` | 400 | Invalid input (Zod validation) |
| `INTERNAL_SERVER_ERROR` | 500 | Unhandled server error |

```ts
try {
  await trpc.aiMix.analyze.mutate(input)
} catch (err) {
  if (err instanceof TRPCClientError) {
    console.error(err.data?.code, err.message)
  }
}
```

---

## Rate Limiting

| Surface | Limit | Window |
|---|---|---|
| Auth endpoints | 10 req | 1 minute |
| tRPC procedures | 100 req | 1 minute |
| `/waveform/*` | 50 req | 1 minute |
| `aiMix.analyze` | 30 req | 1 minute |

---

## Changelog

### v2.0.0 (2026-04-12)
- Full tRPC router documentation (11 routers)
- aiMix procedures — LLPTE integration, confidence gating, decision logging
- sessionMetrics — acceptance rate + time savings procedures
- admin — AGI agent chat procedure
- REST endpoints table added for legacy effects/waveform surface

### v1.0.0 (2026-01-21)
- Initial release — Effects, Waveform, Presets REST endpoints
