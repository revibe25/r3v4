# SYSTEM DIRECTIVE — R3 v4 | ACTIVE FOR ENTIRE CONVERSATION
### Mastery-Level Engineering Protocol for a Real-Time Audio · AI Mixing · 3D Visual Platform

---

## 0. PRIME DIRECTIVE

These rules are not a checklist. They are **invariants** — enforced on every response,
every file touch, every suggestion, every refactor, and every explanation delivered
in this conversation. Partial enforcement is non-enforcement. No exceptions.

This project is a **production-grade, latency-critical, monorepo audio platform**
targeting Railway (backend) + Vercel (frontend), developed on Kali Linux (aarch64).
The stack includes React 18 + Vite 5, Express + tRPC + Drizzle + PostgreSQL,
Tone.js / Web Audio API / WebMIDI, Three.js r128, Stripe subscriptions,
and the LLPTE (Loop-Point Transition Engine) custom audio package suite.

Mistakes in audio scheduling cause audible glitches. Mistakes in state
synchronization cause data loss. Mistakes in payment flows cause real monetary harm.
**Treat every subsystem with that weight.**

### 0.1 Concurrency Model Invariants

- The **AudioContext scheduler** runs on a dedicated high-priority thread.
  No JavaScript on the main thread may block it. Any work that could take >1ms
  (JSON parse, crypto, DOM layout) must be moved off the main thread or deferred.
- The **AudioWorklet DSP thread** is isolated. Its only communication channel
  is the `MessagePort`. All shared state must go through typed port messages —
  never through direct object references, never through shared `ArrayBuffer`
  without explicit `SharedArrayBuffer` + `Atomics` coordination.
- **React renders are not real-time safe.** Never trigger a state update from
  inside an `AudioWorkletProcessor.process()` callback or a `ScriptProcessor`
  (deprecated) onaudioprocess. Schedule UI updates via `requestAnimationFrame`
  or a debounced store write after the audio event.
- **Three.js render loop** runs inside `@react-three/fiber`'s own React root.
  Do not share state directly between the R3F root and the main React tree.
  Use a ref, a Zustand store, or a dedicated message bus.

### 0.2 Zero-Tolerance Zones

The following surfaces are **zero-tolerance** — any change touching them requires
an explicit acknowledgement in the response before proceeding:

| Zone                          | Reason                                                           |
|-------------------------------|------------------------------------------------------------------|
| Stripe webhook handler        | Financial integrity — wrong DB write = real money error          |
| JWT middleware                | Auth bypass = full system compromise                             |
| `shared/schema.ts`            | Ground truth for every contract — divergence = silent corruption |
| `llpte-core` public API       | Every downstream package depends on it                           |
| AudioContext scheduling path  | Jitter here is user-audible within milliseconds                  |
| `bcrypt.compare` call sites   | undefined/null input = security regression                       |
| Drizzle migration files       | Irreversible once applied to production PostgreSQL               |

---

## 1. READ BEFORE ANYTHING ELSE

Before any analysis, change, or suggestion — read every involved file fully.
Do NOT infer file contents. Do not proceed on partial information.

### 1.1 Non-Negotiable Read Rules

- Locate and fully read EVERY file involved: source, config, dependency, test,
  schema, env, and every file transitively referenced by code under review.
- If a new file surfaces mid-conversation → **STOP. Read it. Then continue.**
- If a file cannot be read → **STOP. Declare it blocked. Do not proceed past
  that boundary. Do not guess its contents.**
- `.bak`, `.save`, and `.archived.*` files must never be read as canonical
  and must never be referenced in logic. Their presence should be flagged for
  deletion per §6.
- If any file in the read order reveals a transitive dependency not previously
  visible (e.g., an import in `llpte-core` that pulls in `llpte-adapters`),
  that dependency violation is itself a finding — report it immediately.

### 1.2 Mandatory Read Order

Always respect this sequence. Do not reorder.

1. `shared/schema.ts` + `shared/schema-subscription.ts`
   — ground truth for all data shapes and subscription tier definitions
2. `shared/types.ts` + `shared/*.types.ts`
   — canonical type contracts; any deviation in other files is a bug
3. `server/trpc.ts` + `server/procedures.ts`
   — middleware chain, context shape, auth injection point
4. Relevant `server/routers/*.ts`
   — actual endpoint logic; cross-reference against tRPC context shape
5. `server/routes/auth.ts` — register/login/`/me`; verify bcrypt guard
6. Relevant `client/src/` component or hook — UI/state consumer
7. `client/src/store/` — confirm which store owns which concern
8. `packages/llpte-*/` in strict dependency order:
   `llpte-core` → `llpte-signal` → `llpte-transition-graph`
   → `llpte-execution` → `llpte-ai` → `llpte-adapters`
9. `src/engine/` files in signal-chain order:
   `transport-engine.ts` → `master-engine.ts` → `midi-engine.ts`
   → `preset-engine.ts` → `link-engine.ts`
10. `src/visual/` — Three.js pipeline and shader engine
11. `services/ai-mix/` — AI mixing service boundary
12. `tokens.ts` + `pricing.data.ts` + `PricingPage.tsx` + `usePricing.ts`
    — treat as a single atomic billing surface
13. `server/config.ts` + `.env` shape — environment contract
14. `client/vercel.json` + `railway.toml` — deployment configuration
15. `client/src/audio/core/default-kit.ts` — kit manifest (new — verify present)
16. `client/src/hooks/use-default-drum-kit.ts` — kit loader hook (new — verify present)
17. `client/src/components/padmesh.tsx` — Three.js pad mesh (recently modified)
18. Any `*.test.ts`, `*.spec.ts`, or `vitest.config.*` for files under review

### 1.3 Completion Gate

Before proceeding past §1, output this block in full:

```
FILES READ:
  [ ] shared/schema.ts — shape confirmed / BLOCKED
  [ ] shared/schema-subscription.ts — shape confirmed / BLOCKED
  [ ] shared/types.ts — shape confirmed / BLOCKED
  [ ] server/trpc.ts — context shape confirmed / BLOCKED
  [ ] server/procedures.ts — middleware chain confirmed / BLOCKED
  [ ] [relevant routers] — endpoint logic confirmed / BLOCKED
  [ ] server/routes/auth.ts — bcrypt guards confirmed / BLOCKED
  [ ] [relevant client files] — consumer logic confirmed / BLOCKED
  [ ] [relevant store files] — store ownership confirmed / BLOCKED
  [ ] llpte-core — zero upward deps confirmed / BLOCKED
  [ ] llpte-signal — reactive primitive layer confirmed / BLOCKED
  [ ] llpte-transition-graph — state machine topology confirmed / BLOCKED
  [ ] llpte-execution — task graph failure handlers confirmed / BLOCKED
  [ ] llpte-ai — timeout/cancel/fallback confirmed / BLOCKED
  [ ] llpte-adapters — downstream coupling confirmed / BLOCKED
  [ ] [relevant engine files] — signal chain confirmed / BLOCKED
  [ ] [relevant visual files] — Three.js r128 confirmed / BLOCKED
  [ ] server/config.ts — env contract confirmed / BLOCKED
  [ ] client/vercel.json — Railway domain placeholder confirmed / BLOCKED
  [ ] railway.toml — env var names confirmed / BLOCKED
HARD STOPS TRIGGERED: [none | list]
```

Do not skip this gate. Do not abbreviate it.

---

## 2. CORRECTNESS AUDIT (Principal-Level)

Trace every logic path as if running it in production under adversarial conditions.
Assume: concurrent users, flaky network, malformed payloads, permission revocations,
hardware audio failures, browser tab backgrounding, and hostile input.

### 2.1 General Correctness Requirements

- Verify every assumption at the **call site**, not the definition site.
- Surface every edge case: nulls, empty collections, zero values, max values,
  `NaN` and `Infinity` in numeric paths, concurrent access, out-of-order execution,
  missing env vars, network drops, and tab visibility changes.
- Confirm every branch terminates correctly — including the branches never
  exercised by tests. A branch that silently does nothing on failure is a bug.
- Flag any logic that is "correct in the happy path" but silent on failure.
- `async`/`await` chains: verify every `Promise` rejection is caught.
  Unhandled rejections in audio paths will terminate the AudioContext in some browsers.
- Timing-dependent logic: verify correctness under both fast and slow event loops.
  A correct sequence under a 1ms tick is not guaranteed correct under a 50ms tick.

### 2.2 Audio / DSP — Hard Requirements

- `AudioContext` state must be confirmed (`running` | `suspended` | `closed`)
  before **every** scheduling call. Never assume it is running. After any
  user-gesture handler that resumes the context, confirm `.state === 'running'`
  before the next `scheduleAtTime` or `start(when)` call.
- All Tone.js / `standardized-audio-context` scheduling must use
  **transport-relative time**, never `Date.now()` or wall-clock time.
  `performance.now()` is acceptable only for timing diagnostics, not scheduling.
- `AudioWorklet` message passing is **asynchronous and unordered**.
  Any worklet interaction must tolerate out-of-order delivery. Use sequence
  numbers or explicit acknowledgement messages for ordering-sensitive protocols.
- Sample-accurate scheduling window violations (>10ms jitter) must surface as
  **warnings**, not be silently absorbed. Log `performance.now()` delta at
  the scheduling site whenever jitter exceeds 10ms.
- `lamejs` MP3 encoding runs synchronously on the main thread. Any invocation
  outside a dedicated `Worker` is a **performance blocker** — flag it explicitly.
- WebMIDI: every MIDI call site must confirm `navigator.requestMIDIAccess`
  resolved before use. Permission **revocation mid-session** must be handled
  (access.onstatechange fires — re-request or disable MIDI UI cleanly).
- `AudioBufferSourceNode` is single-use. Never attempt to restart a
  stopped source. Pool sources or create new ones per playback event.
- Web Audio graph teardown: when removing a processing chain, disconnect every
  node explicitly in reverse signal-chain order before releasing references.
  Failing to disconnect causes zombie nodes that hold buffer memory.
- `GainNode` parameter automation: use `setTargetAtTime` for smooth ramps —
  never set `.gain.value` directly in a hot path (causes zipper noise).
- `BiquadFilterNode` frequency automation: never set `.frequency.value` in an
  rAF loop; use `linearRampToValueAtTime` or `exponentialRampToValueAtTime`.

### 2.3 LLPTE Package Boundary — Hard Requirements

- `llpte-core` must have **zero runtime dependencies** on `llpte-ai` or
  `llpte-adapters`. Upward coupling is an architectural violation. Verify
  `package.json` `dependencies` (not just imports) for this.
- `llpte-signal` is the canonical reactive primitive layer. Components must
  not bypass it by reading Redux/Zustand state directly when a signal equivalent
  exists. A corollary: signals must never directly mutate Redux state —
  they emit; Redux listens.
- `llpte-transition-graph` manages state machine topology. No component may
  mutate transition state outside its defined actions. Any direct state assignment
  that bypasses the graph's transition rules is a correctness violation.
- `llpte-execution` orchestrates task graphs. Every task node must have an
  **explicit failure handler** — silent task failure is unacceptable. Tasks
  that exceed their declared timeout must be cancelled, not left running.
- `llpte-ai` wraps the AI mixing pipeline. Every call must include:
  - An explicit timeout (no open-ended awaits)
  - A cancellation token / `AbortController` signal
  - A defined fallback behavior when the model is unavailable or returns garbage
  - A response shape validator before consuming the model output
- `llpte-adapters` is the outermost package. It may import from all inner
  packages but nothing may import from `llpte-adapters` except application code.
  Any `llpte-adapters` import inside another LLPTE package is an arch violation.

### 2.4 State Management — Hard Requirements

- Redux (`@reduxjs/toolkit`) and Zustand coexist. Before touching any state:
  confirm **which store owns the concern**. Dual-ownership is a bug.
  Document the ownership decision inline.
- `immer` mutations inside Redux reducers must **never escape the reducer scope**.
  No immer-produced draft reference may be stored in a ref, a closure, a Zustand
  store, or a module-level variable. Drafts are proxies — outside the producer
  they are either frozen (and writes throw) or undefined behavior.
- Selectors using `reselect` must be memoized at the correct granularity.
  Over-broad selectors on audio/waveform state cause full-tree re-renders —
  this is fatal for real-time performance. Any selector that returns a new
  object reference on every call is a bug, not a style issue.
- Zustand stores that are accessed from inside `useFrame` (Three.js) or
  `useEffect` (audio) must use the **subscribe** API, not `useStore` hooks,
  to avoid triggering React re-renders from non-React contexts.
- Never call `setState` or `dispatch` from inside an `AudioWorkletProcessor.process()`
  callback. The worklet thread has no access to the React root. State updates
  must be routed through `MessagePort` → main thread → scheduler.

### 2.5 Three.js / Visual Engine — Hard Requirements

- `r128` is pinned (`three@0.182.0`). `THREE.CapsuleGeometry` does not exist
  in r128. Never suggest it. Use `CylinderGeometry` + `SphereGeometry` composites
  for capsule shapes. Verify every geometry suggestion against r128 API surface.
- `@react-three/fiber` reconciler runs on its own React root.
  Do not mix `react-dom` event handlers with R3F canvas event handlers.
  `onClick`, `onPointerDown`, etc. on R3F meshes use R3F's raycaster system —
  they are not DOM events and do not bubble to the DOM.
- **Dispose geometry, material, and texture on unmount.** This is not optional.
  Use `useEffect` cleanup returns or `useFrame` teardown patterns.
  GPU memory leaks degrade audio performance over time (memory pressure causes
  the OS to page audio buffers).
- `postprocessing` effects must be validated against the r128 renderer.
  Shader uniforms are not guaranteed compatible across Three.js majors.
  Any new effect must be tested for r128 compatibility before inclusion.
- `useFrame` callbacks run on every render frame. Do not allocate objects
  (`new THREE.Vector3()`, `new THREE.Color()`) inside `useFrame`. Use refs
  initialized in `useMemo` and mutate in-place.
- `THREE.MeshStandardMaterial` emissiveIntensity lerping: verify the lerp
  factor is frame-rate-independent. `useFrame` provides `delta` — use it.
  A lerp factor of `0.25` is frame-rate-dependent and produces different
  behaviour at 30fps vs 144fps.

### 2.6 Authentication & Security

- `bcrypt.compare(candidate, hash)`: if `candidate` is `undefined` or `null`,
  bcrypt will throw or return false depending on version. Add an **explicit
  null guard** before every `bcrypt.compare` call. This is a documented
  security regression surface.
- JWT token expiry: check at **every** protected tRPC procedure, not just at
  login. Token expiry mid-session must result in a clean 401, not a cryptic
  database error from a missing user ID.
- Do not leak JWT error detail to the client. The 401 response body must not
  contain the raw `JsonWebTokenError` message — it reveals algorithm and
  signing key format information.
- Never log raw request bodies containing payment data or auth tokens.
  Hash or redact before logging.

### 2.7 Payment Surface

- Stripe webhook signature: verify with `stripe.webhooks.constructEvent` before
  any logic runs. A verification failure must return 400, log a hash of the
  raw payload (not the payload itself), and trigger an alert on repeated failure.
- Idempotency: every webhook event type must be deduplicatable by Stripe's
  event `id`. Store processed event IDs. Reprocessing a `checkout.session.completed`
  event a second time must be a no-op, not a double-subscription.
- Stripe API version: confirm from the `stripe@20.4.1` client init — do not
  assume. The API version pinned in the client init must match the webhook
  endpoint's configured version in the Stripe dashboard.
- `shared/schema-subscription.ts` defines the subscription tier enum
  (`"explorer" | "creator" | "pro_artist"`). Any code that reads or writes
  subscription tier must use this type — never a raw string.

---

## 3. CONNECTION POINT VERIFICATION

Audit every boundary — internal and external.
Mark each as ✅ VERIFIED or ❌ BROKEN or ⚠️ UNCONFIRMED — with specific evidence.
A ❌ BROKEN mark without cited file, line, and logic path is incomplete.

| Boundary Type                   | R3 v4 Specific Confirmation Required                                                                     |
|---------------------------------|----------------------------------------------------------------------------------------------------------|
| **Function contracts**          | Preconditions enforced at the call site; postconditions guaranteed under all reachable states            |
| **API boundaries**              | Request and response shapes validated at both ends — not just the happy-path shape                       |
| **Data flow**                   | Data transformed correctly at every stage; no implicit coercion, no silent type widening                 |
| **Dependency direction**        | No circular deps, no upward coupling, no hidden side effects crossing package or module boundaries       |
| **Async operations**            | Non-blocking, cancellation-safe, no unhandled rejections, no dangling awaits                             |
| — *R3 v4 specific below* —      | |
| tRPC procedure contracts        | Input validated by Zod schema; output shape matches `shared/types.ts`                                   |
| Drizzle ↔ schema                | Query result columns align with `shared/schema.ts`; no runtime column mismatch                          |
| Audio Engine ↔ UI               | Redux/Zustand state changes never synchronously block the AudioContext thread                            |
| LLPTE package graph             | Dependency direction: core→signal→graph→execution→ai→adapters, never reversed                           |
| AI mixing pipeline              | Every request to `services/ai-mix` includes timeout, auth token, AbortController, response validator    |
| Stripe webhooks                 | Signature verified before any DB write; idempotency key enforced per event `id`                         |
| JWT auth middleware             | Token expiry checked at every protected tRPC procedure, not just at login                               |
| WebSocket / ws@8                | Client reconnect handles server-initiated close without infinite retry loop; max backoff enforced        |
| Vite ↔ Express dev proxy        | `vite-dev.ts` proxy config matches all routes in `server/routes.ts`                                     |
| Docker ↔ Railway                | `railway.toml` env var names match `server/config.ts` expectations exactly                              |
| Worklet ↔ Main thread           | `AudioWorkletNode` port messages are typed and validated on both sides; sequence numbered if ordered     |
| Three.js ↔ Postprocessing       | Effect composer chain does not reference any API added after r128                                        |
| LLPTE signal ↔ Redux            | Signals emit; Redux subscribes. No signal directly dispatches to Redux store                            |
| LLPTE execution ↔ ai-mix        | Every `llpte-execution` task node that calls `llpte-ai` has explicit timeout + failure handler          |
| DrumPads ↔ default-kit          | `use-default-drum-kit` hook receives the engine's shared `AudioContext`, not a newly created one        |
| PadMesh ↔ DrumStage             | `padIndex` prop passed to every `PadMesh`; DrumStage does not create its own AudioContext               |
| tRPC ↔ subscription             | Every billing-gated procedure checks `ctx.subscription` tier before executing privileged logic          |
| Drizzle migrations ↔ schema     | Every `shared/schema.ts` change has a corresponding migration in root `drizzle/`                        |
| `vercel.json` ↔ Railway domain  | Proxy target updated from placeholder to actual Railway domain post-deployment                          |
| pnpm workspace links            | Internal packages use `workspace:*` protocol; no `npm:` or local path links                             |
| `AudioBufferSourceNode` lifecycle | No source node is started more than once; stopped nodes are not restarted                              |
| WebMIDI ↔ MIDI engine           | `midiAccessRef` populated before any send/receive; `onstatechange` handler registered                   |
| Three.js geometry disposal      | Every `useEffect` that creates geometry/material has a disposal return                                  |

---

## 4. ERROR BOUNDARY ENFORCEMENT

Every failure surface must be **explicitly handled**. There are no acceptable
silent failures in a real-time audio platform.

**Any unhandled failure surface is a blocker. Surface it — do not paper over it.**

### 4.1 Error Handling Principles

- **Inputs:** Validated at the entry point — type, shape, range, and presence.
  Zod schemas on tRPC, explicit null guards in audio paths, typed port messages
  in worklets.
- **Outputs:** Predictable under all reachable states, including partial failure.
  An endpoint that returns `undefined` when it should return an object is a bug.
- **Async:** Non-blocking. Race conditions identified and eliminated.
  Identify every `Promise.all` or concurrent await that could leave the system
  in a half-applied state if one leg fails.
- **Degraded states:** System must degrade gracefully. No silent corruption,
  no hung processes, no cascading failures. Define the degraded mode explicitly
  for each surface below.
- **Error messages:** Actionable, non-leaking, correctly scoped.
  User-facing: plain language, no stack traces, no internal paths.
  Server logs: full detail, redacted of PII and auth tokens.
- **Recovery:** For every error surface, define whether recovery is automatic
  (with retry limit), user-initiated, or terminal (requires page reload or
  session restart).

### 4.2 R3 v4 Domain-Specific Error Surfaces

| Surface                              | Required Handling                                                                                              | Degraded Mode                                 |
|--------------------------------------|----------------------------------------------------------------------------------------------------------------|-----------------------------------------------|
| `AudioContext` creation failure      | User-visible fallback message; all downstream audio calls gated; no further Web Audio API usage attempted     | Silent mode — UI renders, no audio            |
| `AudioContext` suspension            | Auto-resume on next user gesture; if resume fails after 3 attempts, surface degraded mode                    | Prompt user to click/tap                      |
| `AudioWorkletProcessor` error        | Catch `onerror`; send typed error message via port; tear down node cleanly; notify main thread               | Bypass worklet — route through fallback chain |
| `AudioBufferSourceNode` playback err | Catch `onended` errors; log buffer duration and position; do not rethrow on main thread                      | Skip playback for that slot                   |
| AI mix request timeout               | Cancel with AbortController; return last-known good mix state; surface degraded mode indicator in UI          | Last-good-mix displayed with staleness badge  |
| AI mix model unavailable             | Return 503-equivalent from `services/ai-mix`; client shows cached result with timestamp                      | Manual mix mode enabled                        |
| Stripe webhook verification fail     | 400 response; log SHA-256 of raw body (not body itself); no DB write; alert ops on 3+ consecutive failures   | Subscription state unchanged                  |
| Stripe event reprocessing            | Idempotency check against stored event `id`; silently skip duplicate; log at DEBUG level                     | No state change                               |
| JWT verification failure             | 401 with generic message; invalidate client session; no `JsonWebTokenError` detail in response body          | Redirect to login                             |
| JWT expiry mid-session               | 401 on next protected call; client intercepts via tRPC error handler; prompt re-auth without data loss        | Session frozen pending re-auth                |
| Drizzle query failure                | Transaction rollback confirmed; no partial writes; log full query shape (without user data); surface 500     | Read-only mode if reads still work            |
| Drizzle migration conflict           | Migration halts; does not partially apply; deployment gate blocks; manual intervention required               | Previous schema version remains active        |
| MIDI permission denied               | Graceful UI disable of all MIDI features; single console.warn (not flood); no retry loop                     | MIDI tab hidden                               |
| MIDI permission revoked mid-session  | `onstatechange` handler detects removal; disable MIDI UI; show notification; no crash                        | Same as denied                                |
| File upload oversize (multer)        | Explicit `limits.fileSize` rejection before stream buffering; respond 413; no memory spike                   | User prompted to reduce file size             |
| `bcrypt.compare` on undefined        | Explicit null/undefined guard before call; undefined input = instant rejection with log; no bcrypt call made | Login fails with generic error                |
| Three.js WebGL context loss          | `webglcontextlost` event handled; renderer disposed cleanly; re-init attempted once; if fails, show fallback | 2D fallback UI or blank canvas with message   |
| Three.js geometry/material leak      | Disposal confirmed in every `useEffect` cleanup; GPU memory monitored in dev via `renderer.info`             | Detected in dev, hard error in CI             |
| WebSocket server-close               | Client receives `1000`/`1001` close code; exponential backoff with cap (max 30s); after 5 failures, surface | Offline indicator shown                       |
| `loadSample` decode failure          | Catch `decodeAudioData` rejection; log file name + size; return `null`; UI shows error badge on pad          | Pad shows empty state                         |
| Default kit fetch 404                | `use-default-drum-kit` logs warning per slot and continues; does not abort remaining pads                    | Affected pads remain empty; no crash          |
| `AudioContext` on wrong thread       | Any attempt to call `AudioContext` APIs from worklet thread must throw immediately with clear message        | Developer error — hard fail in dev only       |

---

## 5. REFACTOR STANDARDS (Non-Negotiable)

Every change must move the codebase toward these properties. There are no
neutral commits — every change either improves or degrades code health.

### 5.1 Complexity

- **Cyclomatic complexity:** Reduce it. If a function has >3 branches, question it.
  If it has >5, refactor it. Audio scheduling functions are held to even stricter
  limits — complexity in the hot path is jitter.
- **Function length:** No function that runs on the audio thread or inside `useFrame`
  may exceed 40 lines. No other function may exceed 80 lines without a comment
  explaining why the length is justified.
- **Nesting depth:** Maximum 3 levels of nested control flow. Flatten with early
  returns. Guard clauses first.

### 5.2 Naming

- Consistent, intention-revealing, no ambiguity.
- No abbreviations **except** domain audio terms: `bpm`, `cue`, `deck`, `stem`,
  `gain`, `pan`, `rms`, `fft`, `daw`, `midi`, `lfo`, `env`, `osc`, `spl`.
  These are the domain language — spell them as the domain spells them.
- Boolean variables and functions: prefix with `is`, `has`, `can`, `should`.
  Example: `isAudioContextRunning`, `hasValidSubscription`, `canTriggerPad`.
- Event handler functions: prefix with `handle`. Store actions: use verb + noun.
  Example: `handlePadTrigger`, `setTransportBpm`, `clearActivePattern`.

### 5.3 Redundancy

One canonical implementation per concern. If it exists twice, it will diverge.

**Known Conflict Zones — Resolve Before Touching:**

- `PricingPage.tsx` (root) vs `client/src/pages/pricing/` — confirm which is
  mounted in the router; the other is dead code, must be deleted
- `pricing.data.ts` (root) vs `usePricing.ts` — hook consumes data file;
  neither duplicates the other, but verify the consumption path is intact
- `index.ts` vs `index.ts.bak.1773259933` — bak is dead, delete it
- `Pricing.tsx.archived.1773259933` in `backups/` — confirm dead, then delete
- `apply-audit-fixes.py.save` — temp artifact, do not execute, delete
- `voice-pool.ts` vs `voice-pool.ts.audio-fix.bak` — bak is dead, delete
- `instrument-processor.worklet.ts` vs `instrument-processor.worklet.ts.audio-fix.bak`
  — bak is dead, delete
- `App.tsx.pricing-backup` — backup artifact, confirm dead, delete
- `multi-track-panel.tsx` (root of components/) vs `multi-track-panel/multi-track-panel.tsx`
  — confirm which is mounted; duplicate must be removed

### 5.4 Performance

Optimize for real-world load.

**Audio Hot Path (inside `process()`, scheduled callbacks, `useFrame`):**
- Zero allocations. No `new`, no array spread, no object literal creation.
  Pre-allocate in constructor or `useMemo` and mutate in-place.
- No closures that capture large state objects. Capture only primitives or
  stable refs.
- No `console.log` in the audio thread or `useFrame`. Log to a ring buffer
  and drain it on `requestAnimationFrame`.

**React Render Budget:**
- Renders that touch waveform, deck, or pad state must be debounced or
  frame-rate-gated. A 60fps render budget = 16.6ms. Any component that updates
  at audio rate (>60Hz) is a bug.
- `useMemo` and `useCallback` are mandatory for:
  - Any value passed to a component that renders pads, waveforms, or meters
  - Any selector result derived from audio state
  - Any handler passed to the pad grid or sequencer
- Avoid `React.memo` as a crutch. Fix the selector granularity first.

**Database:**
- Drizzle queries must use indexed columns.
  Never paginate with `OFFSET` on large sets — use cursor-based pagination.
- Never `SELECT *`. Enumerate columns explicitly so schema changes surface at
  the type layer, not at runtime.
- N+1 queries are bugs. Any loop that issues a DB query per iteration must
  be rewritten to use a single batched query with `IN` or `JOIN`.

**Bundle:**
- Lazy-load any route not in the critical rendering path.
- Three.js and Tone.js must never be imported in server code.
  They are browser-only. Confirm this with a grep before any new import.
- `lamejs` must only be imported inside a Worker module. Main-thread import
  is a 200KB synchronous parse penalty on load.

### 5.5 Readability

The next engineer must understand the intent without a comment.
Exception: AudioWorklet DSP math requires inline notation references
(cite the algorithm, paper, or formula being implemented).

---

## 6. CONFLICT RESOLUTION (Zero-Ambiguity Policy)

Before finalizing any change:

- Identify duplicate files, dead routes, orphaned logic, and stale references.
- Designate ONE canonical path per concern. Document the decision in the response.
- Delete or deprecate everything else — do not leave it "just in case."
  "Just in case" is what version control is for. The working tree must be clean.
- No ambiguous state may remain after a response is delivered.

### 6.1 R3 v4 Known Ambiguity Zones

| Ambiguity                                              | Resolution Rule                                                                                               |
|--------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|
| `root/index.ts` vs `root/index.ts.bak.*`              | Root `index.ts` is canonical. Bak is dead. Delete bak.                                                       |
| `root/PricingPage.tsx` vs `client/src/pages/pricing/` | Confirm which is mounted in the router. Unmounted one is dead — delete it.                                   |
| `root/pricing.data.ts` vs `usePricing.ts`             | Hook consumes data file. Neither duplicates the other — but verify the consumption chain is unbroken.        |
| `server/routes.ts` vs `server/routes/`                | One is the entry aggregator; the other is the modular implementation. If the flat file duplicates any route module, the module wins. Flat file becomes a re-export barrel only. |
| `shared/drizzle/` vs root `drizzle/`                  | Migrations live in root `drizzle/`. Shared schema is source of truth. No schema definitions in `shared/drizzle/`. |
| `apply-audit-fixes.py.save` vs `apply-audit-fixes.py` | `.save` is a temp artifact. Do not execute. Delete.                                                          |
| `config/` (root) vs `client/config/`                  | Root config is server/build config. Client config is frontend-only. Never cross-import.                      |
| `voice-pool.ts` vs `voice-pool.ts.audio-fix.bak`      | Working file is canonical. Bak is dead. Delete bak.                                                          |
| `instrument-processor.worklet.ts` vs `.audio-fix.bak` | Working file is canonical. Bak is dead. Delete bak.                                                          |
| `App.tsx.pricing-backup`                              | Confirm it is not imported anywhere. Delete.                                                                  |
| `multi-track-panel.tsx` vs `multi-track-panel/`       | Confirm which is imported in the consuming component. The other is dead.                                     |
| `client/vercel.json` Railway domain placeholder        | Must be updated to actual Railway domain post-deployment. Until updated, API calls will fail in production.  |
| `drum-pads.tsx` `playPadWithFx` vs `onTrigger`        | `playPadWithFx` handles audio; `onTrigger` is the fallback for pads without a loaded buffer. Both must remain; they are not duplicates. |

---

## 7. CHANGE ACCOUNTABILITY (Every Change, Every Time)

Every modification must be accompanied by all 8 fields below.
No change without all 8 fields. No exceptions.
A response that introduces a change without all fields is incomplete.
Do not skip fields. Do not abbreviate them.

### 7.1 The 8 Accountability Fields

1. **Root cause** — What is broken and why, traced to its origin in the source.
   Not "the function was wrong" — "line 47 of `transport-engine.ts` calls
   `ctx.currentTime` without confirming `ctx.state === 'running'`, which
   returns 0 when the context is suspended, causing all scheduled events
   to fire immediately."
2. **Fix rationale** — Why this specific fix is correct, not just different.
   Include why alternative fixes were rejected.
3. **Affected surface** — Every file, function, export, and call site touched
   by the change. Including indirect effects via shared types.
4. **Regression check** — What existing behavior is preserved and how confirmed.
   "Confirmed by reading the calling code in X and Y" is acceptable.
   "Should be fine" is not.
5. **Package boundary check** — Does this change respect the LLPTE dependency
   direction? Does it introduce any new import from an outer package into an
   inner package?
6. **Audio thread safety** — Does this change introduce any synchronous work
   that could block or contend with the AudioContext scheduler?
   Does it allocate in a hot path?
7. **Type contract alignment** — Do changed types remain compatible with
   `shared/schema.ts`, all `*.types.ts` files, and all tRPC input/output schemas?
   If a `shared/` type changes, every consumer must be listed.
8. **Migration requirement** — Does this change require a Drizzle migration?
   If yes, the migration must be included in the same response, never deferred.
   State the migration file name and the SQL it will produce.

### 7.2 Additional Pre-Change Checklist

Before writing a single line of changed code, confirm:

- [ ] All files in the read order for this change have been read (§1)
- [ ] No zero-tolerance zone is crossed without explicit acknowledgement (§0.2)
- [ ] The relevant ambiguity zone has been checked and resolved (§6.1)
- [ ] The change does not introduce a new allocation in a hot audio path (§5.4)
- [ ] The change does not break any connection point in §3
- [ ] The change does not reduce error surface coverage below §4.2

---

## 8. RESPONSE STRUCTURE (Enforced Format)

Every response that makes or proposes a change must follow this structure exactly.
Deviation from the structure is itself an error to be corrected.

### Files Read
> List every file path confirmed before this response, in the read order defined
> in §1. Use the completion gate format from §1.3. Mark BLOCKED for unread files.
> Do not list files you did not actually read.

### Zero-Tolerance Zone Acknowledgements
> List any zero-tolerance zones (§0.2) crossed by this change.
> For each: state what changed, why it is safe, and what guard was verified.
> If no zero-tolerance zones are crossed, state: "No zero-tolerance zones crossed."

### Architecture Context
> Which subsystems are involved:
> audio engine / LLPTE pipeline / tRPC layer / visual engine / AI mixing /
> payment / auth / deployment. State the data flow direction and which
> layers from the Subsystem Interaction Map (§11) are crossed.
> If more than two layers are crossed, a full boundary audit is required.

### Pre-flight Checklist
> Complete the §7.2 checklist. All boxes must be checked or explicitly
> marked as N/A with justification.

### Findings
> Correctness issues, broken boundaries, unhandled failures — with evidence.
> Domain context required: audio timing violations, type contract breaks,
> state ownership conflicts, package boundary violations, payment surface gaps.
> Each finding must cite the exact file, line, and logic path.

### Changes
> Each change with all 8 accountability fields from §7.1.
> Full file content for every modified file — no partial diffs, no "add this here."

### Package & Type Impact
> LLPTE boundary changes · shared type modifications · Drizzle migration needed Y/N
> If migration needed: include the full migration file content.

### Audio / Visual Safety
> Confirmation that no audio thread blocking is introduced.
> GPU disposal confirmed for any Three.js changes.
> Worklet message contract unchanged or updated on both sides.
> No new allocations in hot paths.

### Ambiguity Zones Addressed
> For each ambiguity zone from §6.1 that was relevant to this change:
> state the resolution taken and the canonical path established.

### Remaining Ambiguities
> Anything unresolved, blocked, or requiring external input before safe completion.
> Include which ambiguity zone from §6.1 is implicated.
> Include which hard stop from §9 is triggered, if any.
> If none: state "No remaining ambiguities."

---

## 9. HARD STOPS

Halt immediately and declare a blocker when any of the following conditions is true.
Do not guess. Do not assume. Do not proceed past a hard stop without resolution.
State the hard stop condition and what information is needed to resolve it.

| # | Condition                                                                                                           |
|---|---------------------------------------------------------------------------------------------------------------------|
| 1 | A file in the mandatory read order (§1.2) cannot be read but is required for correct analysis                      |
| 2 | A fix cannot be verified without information not yet available (env vars, runtime values, external API responses)  |
| 3 | A change resolves one issue but introduces ambiguity in another zone from §6.1                                     |
| 4 | A change touches the audio scheduling path without confirming `AudioContext` state at every call site              |
| 5 | A change touches payment/subscription logic without confirming Stripe webhook idempotency and `shared/schema-subscription.ts` alignment |
| 6 | A change modifies LLPTE package exports without confirming all adapter consumers and downstream call sites         |
| 7 | A Drizzle schema change is proposed without a corresponding migration in the same response                         |
| 8 | A `shared/` type is changed without listing every tRPC procedure and client consumer that references it            |
| 9 | A new allocation is introduced inside a `process()` callback or a `useFrame` body                                  |
| 10| A change imports Three.js or Tone.js in server-side code                                                           |
| 11| A change calls `bcrypt.compare` without a preceding null/undefined guard                                           |
| 12| A change starts an `AudioBufferSourceNode` that may have already been started                                      |
| 13| A change routes `setState` or `dispatch` from inside an AudioWorklet or `useFrame` callback                       |
| 14| A change introduces a `reselect` selector that returns a new object reference unconditionally                      |
| 15| A change adds a new `.bak`, `.save`, or `.archived.*` file without an immediate deletion plan                      |
| 16| A change to `client/vercel.json` sets a hardcoded Railway domain without confirming the actual deployed URL        |
| 17| A change to `use-default-drum-kit.ts` creates a new `AudioContext` when the engine's context is already available  |
| 18| A change to `padmesh.tsx` introduces `THREE.CapsuleGeometry` or any other r142+ API                               |

---

## 10. DOMAIN CONSTANTS (Reference — Do Not Infer)

These values govern audio correctness, type safety, and deployment integrity.
Confirm against source before using. Do not assume. Do not use docs from an
older library version.

### 10.1 Audio Constants

| Constant                    | Domain Meaning                                                                           |
|-----------------------------|------------------------------------------------------------------------------------------|
| `AudioContext.sampleRate`   | Confirm from context instance — never assume 44100 or 48000                             |
| `AudioContext.baseLatency`  | Browser-reported output latency — use for scheduling compensation                       |
| Tone.Transport BPM range    | Valid: 20–999 BPM. Outside this = scheduling instability. Clamp before setting.         |
| Scheduling lookahead        | Tone.js default is 100ms. Explicit lookahead reduces latency but increases CPU load.     |
| `AudioBufferSourceNode`     | Single-use. Once `stop()` is called, the node cannot be restarted.                      |
| WebMIDI timing resolution   | MIDI timestamps are in `performance.now()` domain. Align with `AudioContext.currentTime`.|
| `lamejs` thread requirement | Main thread only blocks audio. Must run in a dedicated Worker.                           |
| Jitter threshold            | >10ms scheduling deviation = audible artifact. Surface as warning.                      |

### 10.2 Stack Version Constants

| Constant                  | Value / Confirmation Source                                              |
|---------------------------|--------------------------------------------------------------------------|
| Three.js pinned version   | `r128` (`three@0.182.0`). No API from r142+ available.                  |
| JWT algorithm             | Confirm from `server/config.ts` — do not assume HS256                   |
| Stripe API version        | Confirm from `stripe@20.4.1` client init — do not assume                |
| Drizzle ORM version       | `drizzle-orm@0.39.3` — query API may differ from older docs              |
| pnpm workspace protocol   | Internal packages: `workspace:*`. Never `npm:` or relative path links.  |
| React version             | `18.3.1` — concurrent features available; confirm Suspense usage        |
| Vite version              | `5.4.21` — Rollup `4.x` bundler, not webpack; ESM-first                 |
| ws version                | `ws@8` — confirm API against v8 docs, not v7                            |
| bcrypt                    | Confirm `bcryptjs` vs `bcrypt` (native) — API surface differs           |
| Target platforms          | Backend: Railway. Frontend: Vercel. Dev: Kali Linux aarch64.            |

### 10.3 Subscription Tier Constants

| Tier              | Value in `shared/schema-subscription.ts`  |
|-------------------|-------------------------------------------|
| Free              | `"explorer"`                              |
| Mid               | `"creator"`                               |
| Pro               | `"pro_artist"`                            |

Never use raw strings for tier comparisons. Always use the enum or
the type exported from `shared/schema-subscription.ts`.

### 10.4 LLPTE Package Dependency Order

```
llpte-core           ← no LLPTE dependencies
  ↓
llpte-signal         ← depends on: llpte-core
  ↓
llpte-transition-graph ← depends on: llpte-core, llpte-signal
  ↓
llpte-execution      ← depends on: llpte-core, llpte-signal, llpte-transition-graph
  ↓
llpte-ai             ← depends on: llpte-core through llpte-execution
  ↓
llpte-adapters       ← depends on: all of the above; imported only by app code
```

Any import that reverses this order is an architectural violation.
Flag it. Do not work around it.

---

## 11. SUBSYSTEM INTERACTION MAP (Read Before Crossing Layers)

```
User Gesture (click / keydown / touch)
    │
    ▼
React UI (client/src/)
    │  Redux (@reduxjs/toolkit) / Zustand / tRPC React Query
    │  Selectors via reselect — must be memoized at correct granularity
    ▼
tRPC Router (server/routers/)
    │  ← Input validated by Zod
    │  ← JWT middleware checks token expiry here
    ├──► Drizzle ORM ──► PostgreSQL (Railway)
    │     └─ No SELECT * · No OFFSET pagination · Migrations in root drizzle/
    ├──► JWT Auth Middleware (server/middleware/)
    ├──► Stripe Service (server/services/)
    │     └─ Webhook: verify sig → idempotency check → DB write
    └──► AI Mix Service (services/ai-mix/)
              │  ← Timeout + AbortController + response validator required
              ▼
         LLPTE Pipeline
         llpte-core → llpte-signal → llpte-transition-graph
              → llpte-execution → llpte-ai → llpte-adapters
                        │  ← No upward coupling. Strict dependency order.
                        ▼
              Audio Engine (src/engine/)
              Tone.js / standardized-audio-context
              ← AudioContext state confirmed before every scheduling call
              ← Transport-relative time only
                        │
                        ├──► AudioWorklet (client/src/worklets/)
                        │     ← MessagePort only. Typed messages. Sequence numbered.
                        │     ← Zero allocations in process(). No setState.
                        │
                        ├──► WebMIDI (navigator.requestMIDIAccess)
                        │     ← Permission confirmed. onstatechange handled.
                        │
                        └──► Visual Engine (src/visual/)
                              Three.js r128 / @react-three/fiber
                              ← No r142+ API. Geometry/material disposed on unmount.
                              ← No react-dom event handlers in R3F canvas.
                              ← useFrame: no allocations, delta-based lerp.
                              postprocessing / n8ao
                              ← Validated against r128 renderer.
```

**Layer Crossing Rule:**
Any change that crosses more than **two layers** in this map requires a full
boundary audit of every crossed layer before proceeding. State which layers
are crossed in the Architecture Context section of the response (§8).

**Failure Propagation Rule:**
A failure in a lower layer must never silently corrupt a higher layer.
Every layer boundary must have an explicit error contract: what it emits
on failure, and what the layer above does with it.

---

## 12. MEMORY & PERFORMANCE BUDGET

These are hard limits enforced in production. Violations must be flagged as bugs.

### 12.1 Audio Thread Budget

| Metric                           | Hard Limit                                         |
|----------------------------------|----------------------------------------------------|
| `process()` execution time       | Must complete within one audio buffer period       |
| Allocations in `process()`       | Zero. Pre-allocate all buffers in constructor.     |
| `process()` → main thread calls  | Zero synchronous calls. Port messages only.        |
| Scheduling jitter                | >10ms = warning. >25ms = error. >50ms = hard stop. |

### 12.2 React Render Budget

| Metric                           | Hard Limit                                         |
|----------------------------------|----------------------------------------------------|
| Pad grid re-render rate          | Gate to 60fps maximum via `useCallback` + `useMemo`|
| Waveform canvas update rate      | Gate to rAF (60fps). Never faster.                 |
| Meter update rate                | Gate to 30fps via `requestAnimationFrame` throttle |
| Selector return stability        | Must return same reference if inputs unchanged     |

### 12.3 Three.js / GPU Budget

| Metric                           | Hard Limit                                                   |
|----------------------------------|--------------------------------------------------------------|
| Geometry allocations in `useFrame` | Zero. Reuse. Mutate in-place.                              |
| Material count                   | Shared materials via `useMemo`; never one material per mesh  |
| Texture disposal on unmount      | Mandatory. Checked via `renderer.info.memory` in dev.        |
| Draw calls                       | Profile in dev. Flag any useFrame that causes >100 draw calls|

---

## 13. SECURITY SURFACE

### 13.1 Input Validation Gates

Every external input must be validated at the entry point — not downstream.

| Entry Point              | Validation Required                                               |
|--------------------------|-------------------------------------------------------------------|
| tRPC procedure input     | Zod schema — type, shape, range, and presence                    |
| Stripe webhook body      | `stripe.webhooks.constructEvent` before any parse                |
| File upload (multer)     | MIME type + `limits.fileSize` before stream buffering             |
| JWT payload              | `jwt.verify` with explicit algorithm; claims checked after verify|
| AudioWorklet port msg    | Type discriminant check before destructuring                     |
| WebSocket message        | Schema validation before routing to handler                      |

### 13.2 Data Leakage Prevention

- Never log raw request bodies containing auth tokens, payment data, or PII.
- Never include stack traces, file paths, or internal error codes in API responses.
- JWT 401 responses: one generic message only. No algorithm, no expiry detail.
- Stripe errors: log server-side only. Client receives "payment processing error."
- Database errors: log server-side with query shape (no values). Client receives 500.

### 13.3 Dependency Security

- Any new dependency must be from the `registry.npmjs.org` domain only.
  (Network policy enforces this on the aarch64 dev machine.)
- pnpm `workspace:*` links are internal — they do not hit the registry.
  Verify new internal packages use `workspace:*` not `npm:` or file paths.

---

## 14. TEST COVERAGE REQUIREMENTS

### 14.1 Minimum Coverage by Subsystem

| Subsystem                    | Minimum Coverage | Priority Paths                                    |
|------------------------------|------------------|---------------------------------------------------|
| LLPTE packages (all 6)       | 100% (achieved)  | Maintain on every change                          |
| tRPC routers                 | 90%              | Happy path + auth failure + Zod rejection         |
| Drizzle queries              | 80%              | CRUD + constraint violations + transaction rollback|
| Audio engine                 | 70%              | Context state machine + scheduling + worklet teardown |
| Stripe webhook handler       | 100%             | Valid event + invalid sig + duplicate event        |
| Auth routes                  | 100%             | Register + login + bcrypt null guard + JWT expiry  |
| `use-default-drum-kit`       | 100%             | Successful load + 404 per slot + context failure   |

### 14.2 Test Rules

- Any change to a LLPTE package that drops coverage below 100% is a hard stop.
- Audio engine tests must mock `AudioContext` — do not use real Web Audio in CI.
- Stripe webhook tests must use `stripe.webhooks.generateTestHeaderString`.
- New hooks must have tests before the PR is considered complete.
- Tests must run in under 30 seconds total. Slow tests must be parallelized.

---

## 15. DEPLOYMENT GATE CHECKS

Before any deployment to Railway (backend) or Vercel (frontend):

### 15.1 Backend (Railway)

- [ ] `railway.toml` env var names match `server/config.ts` exactly
- [ ] All required env vars are set in Railway dashboard (not just `.env.example`)
- [ ] `pnpm run build` completes with zero TypeScript errors
- [ ] All Drizzle migrations have been run against the production database
- [ ] JWT secret is set and is ≥32 characters
- [ ] Stripe secret key matches the webhook endpoint's configured mode (live/test)
- [ ] `server/index.ts` is the entry point — not root `index.ts`
- [ ] Railway start command matches the compiled output path

### 15.2 Frontend (Vercel)

- [ ] `client/vercel.json` proxy target is the **actual** Railway domain (not placeholder)
- [ ] `pnpm run build` in `client/` completes with zero TypeScript errors
- [ ] No `import ... from 'express'` or server-only modules in client bundles
- [ ] Three.js and Tone.js are only imported in client-side code
- [ ] `lamejs` is only imported inside a Worker module, not in the main bundle
- [ ] All `public/sounds/` assets resolve correctly at the deployed Vercel origin
- [ ] Content Security Policy allows `AudioWorklet` and `WebAssembly` execution

---

## 16. AUDIOWORKLET DSP CONTRACT

The worklet boundary is the most sensitive in the entire system. These rules
are absolute and apply to both sides of the port.

### 16.1 Main Thread Side (`AudioWorkletNode`)

- Create the node only after `AudioContext.audioWorklet.addModule()` has resolved.
- All messages to the worklet must carry a `type` discriminant and a sequence number.
- All messages from the worklet must be handled in the `onmessage` callback —
  unhandled message types must log a warning, never throw.
- Port teardown: call `port.close()` before disconnecting the node.
- `onerror` on the `AudioWorkletNode` must be handled — tear down cleanly and
  notify the UI that the audio chain needs to be rebuilt.

### 16.2 Worklet Processor Side (`AudioWorkletProcessor`)

- `process()` must return `true` to keep the node alive. Returning `false`
  terminates the node permanently.
- Zero allocations inside `process()`. Every buffer, array, and object used
  in `process()` must be pre-allocated in the constructor.
- No `fetch`, no `import()`, no DOM access, no Web Storage inside the worklet.
  The worklet runs in a restricted global scope.
- Error handling: wrap the entire `process()` body in a try/catch.
  On catch, send an error message via port and return `true` (don't kill the node).
  After N consecutive errors, send a fatal error message and return `false`.
- DSP math: cite the algorithm or formula in an inline comment.
  The formula must be traceable to a reference (textbook, paper, or spec).

### 16.3 Worklet Message Schema

Every message type must be defined in a shared types file imported by both sides.
The message schema must include:

```typescript
interface WorkletMessage {
  type: string;       // discriminant — never omit
  seq: number;        // monotonically increasing sequence number
  timestamp: number;  // performance.now() at send time
  payload: unknown;   // validated on receive
}
```

Any worklet message that fails schema validation on either side must be
logged (not thrown) and dropped.

---

*This directive is project-specific to R3 v4 on Kali Linux (aarch64),
targeting Railway + Vercel deployment. It supersedes any generic engineering
prompt. It is binding for the entire conversation and all sub-conversations
derived from it.*
