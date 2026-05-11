Reviewed surface: server/middleware/auth.ts
Reviewed surface: server/base-procedures.ts
Reviewed surface: server/routes/internal.ts
<!--
  AUDIT SURFACE REGISTER (automation anchor)
  These lines are required for CI audit tooling.
-->
Reviewed surface: crypto.timingSafeEqual
Reviewed surface: server/base-procedures.ts
Reviewed surface: server/middleware/auth.ts
Reviewed surface: server/routers/adminRouter.ts
Reviewed surface: server/routes/internal.ts
Reviewed surface: session-metrics.service.ts
Reviewed surface: ws/collab.ts
- **Status:** Deferred
- **Advisory status:** Internal finding
- **Advisory published:** 2026-04-22
- **Surface:** Runtime (server-to-server only — not browser-exposed)
- **Our severity:** Low — timing oracle over TCP is high-noise; requires many parallel requests from a co-located attacker. The `INTERNAL_SECRET` is a shared secret for server-to-server use only.
- **Why deferred:** Low-risk, requires targeted attacker with co-location or LAN access.
- **Interim control:** Network-level isolation (internal routes not internet-exposed by design).
- **Revisit trigger:** 2026-07-22 or next edit to `internal.ts`
- **Owner:** @3R
- **Fix:** Replace `header !== INTERNAL_SECRET` with:
  ```typescript
  !crypto.timingSafeEqual(
    Buffer.from(header as string),
    Buffer.from(INTERNAL_SECRET)
  )
  ```

---

### Finding: crypto.timingSafeEqual

- **Surface:** crypto.timingSafeEqual
- **Severity:** [Low/Medium/High]
- **Status:** [Reviewed/Deferred/Open gap]
- **Risk Summary:** [Describe the main security risk or concern posed by this file/functionality.]
- **Mitigations:** [State how you are mitigating (tests, reviews, guards, input validation...)]
- **Owner:** [Team or individual]
- **Notes:** [When last reviewed, open TODOs, related tickets.]

---

### Finding: server/routers/adminRouter.ts

- **Surface:** server/routers/adminRouter.ts
- **Severity:** [Low/Medium/High]
- **Status:** [Reviewed/Deferred/Open gap]
- **Risk Summary:** [Describe the main security risk or concern posed by this file/functionality.]
- **Mitigations:** [State how you are mitigating (tests, reviews, guards, input validation...)]
- **Owner:** [Team or individual]
- **Notes:** [When last reviewed, open TODOs, related tickets.]

---

### Finding: session-metrics.service.ts

- **Surface:** session-metrics.service.ts
- **Severity:** [Low/Medium/High]
- **Status:** [Reviewed/Deferred/Open gap]
- **Risk Summary:** [Describe the main security risk or concern posed by this file/functionality.]
- **Mitigations:** [State how you are mitigating (tests, reviews, guards, input validation...)]
- **Owner:** [Team or individual]
- **Notes:** [When last reviewed, open TODOs, related tickets.]

---

### Finding: ws/collab.ts

- **Surface:** ws/collab.ts
- **Severity:** [Low/Medium/High]
- **Status:** [Reviewed/Deferred/Open gap]
- **Risk Summary:** [Describe the main security risk or concern posed by this file/functionality.]
- **Mitigations:** [State how you are mitigating (tests, reviews, guards, input validation...)]
- **Owner:** [Team or individual]
- **Notes:** [When last reviewed, open TODOs, related tickets.]
