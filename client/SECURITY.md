# SECURITY.md

Tracks deferred security findings under the Mythos triage discipline
(see Mythos-Skills.pdf / red.anthropic.com Apr 7 2026 writeup).

Every entry below is either:
  - a deferred finding with **owner + trigger + interim control** (Lesson 5), OR
  - a documented audit gap (Lesson 2)

Deferred findings missing any required field are **unmanaged** and will block
builds. N-day (publicly disclosed CVE) deferrals require a **date** trigger
within the SLA window — not a vague event like "post-MVP".

## Deferred findings

### CVE-EXAMPLE-vite5-path-traversal — vite@5.x

- **Status:** Deferred
- **Advisory status:** public
- **Advisory published:** 2025-XX-XX  <!-- TODO: replace with real CVE pub date -->
- **Surface:** dev-build-supply-chain  <!-- vite is a build tool; bundle output ships -->
- **Our severity assessment:** High — path traversal in dev server has no
  5.x backport; build-time exposure during local dev and CI.
- **Advisory severity:** High
- **Mythos-class re-price:** "attacker would need a dev to run a malicious
  page locally" — under Mythos-class, mass exploitation of dev environments
  via crafted dependency README/changelog content is in scope. Friction-only.
- **Why deferred:** vite 5→6 is a breaking migration; touches every page-level
  import, plugin, and config across apps/api-server and apps/r3-agi.
- **Interim control:** dev-server bound to 127.0.0.1 only (barrier-class for
  remote attackers); no exposure to public networks during dev. CI runs vite
  build only, never dev server.
- **Revisit trigger:** YYYY-MM-DD  <!-- TODO: set a date ≤30d from advisory -->
- **Owner:** @ty
- **Upgrade path:** vite 5 → 6 migration; sequence after MVP ships.

## Audit gaps

(Lesson 2: known queue is a floor. List surfaces never independently audited.)

- LLPTE inference pipeline node boundaries — never independently audited for
  prototype pollution in node-config merging or untrusted-input deserialization.
- WebSocket/SharedArrayBuffer audio-engine boundary — never audited for
  cross-origin isolation bypass shapes.
- tRPC router input validators — surveyed but no formal review against
  the auth-bypass shapes catalogued in the Mythos writeup.
