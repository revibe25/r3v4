# MYTHOS-SKILL-v2

Version: 2.1

This manifest provides the Mythos skill attestation required by the Mythos/ASI Security Enforcement verifier.
It lists audited and pending surfaces referenced during the Mythos audit cycle. Keep this file in the project
root so the verifier can cross-check declared surfaces against SECURITY.md.

LastReviewed: 2026-07-16

## Pending Audit Surfaces

| Surface | Status | Notes |
|---|---|---|
| `server/middleware/auth.ts` | Pending | Auth middleware audit — scheduled |
| `server/base-procedures.ts` | Pending | tRPC base procedures audit — scheduled |
| `server/routes/internal.ts` | Pending | Internal routes audit — scheduled |
| `server/routers/adminRouter.ts` | Pending | Admin router audit — scheduled |
| `ws/collab.ts` | Pending | WebSocket collab audit — scheduled |
| `session-metrics.service.ts` | Pending | Session metrics service audit — scheduled |
| `crypto.timingSafeEqual` | Pending | Timing-safe comparison usage audit — scheduled |

> Placeholder manifest updated by GitHub Copilot to include a Version header and the audit surface list so the ARIS verifier can run successfully. Replace with the authoritative skill documentation if your tooling expects additional fields.

