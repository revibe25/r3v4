# INTEGRATION PATCH — R3 v4 Admin Agent Suite
# Wire.txt §16 REQUIRED RESPONSE STRUCTURE

---

## Files Read (confirm before applying any patch)

| Path | Purpose |
|---|---|
| `server/routers/adminRouter.ts` | NEW — admin tRPC router (produced) |
| `client/src/components/admin/AgentSuite.tsx` | NEW — Expert Agent Suite TSX (produced) |
| `client/src/components/admin/AgentMeshPanel.tsx` | NEW — Agent Mesh Panel TSX (produced) |
| `client/src/pages/admin/AgentSuitePage.tsx` | NEW — Admin page with gate (produced) |
| `server/procedures.ts` | PATCH — add `admin: adminRouter` to appRouter |
| `client/src/App.tsx` | PATCH — add `/admin/agents` route with ProtectedRoute |
| `shared/schema.ts` | VERIFY — confirm `users.isAdmin` column exists |
| `.env` / `.env.production` | VERIFY — confirm `ANTHROPIC_API_KEY` is set |

---

## Findings

### 1. users.isAdmin column
Wire.txt §6 Data Agent documents `users → id, email, username, passwordHash, isAdmin, createdAt`.
**Verify** this column exists in `shared/schema.ts` before applying.
If missing → **HARD STOP** — add a Drizzle migration first (`pnpm drizzle-kit generate` → `pnpm drizzle-kit migrate`).

### 2. ANTHROPIC_API_KEY env var
The `adminRouter.agentChat` procedure calls Anthropic server-side (Wire.txt §7 — all client-server comms through tRPC; API key never exposed to browser).
Verify `ANTHROPIC_API_KEY` is present in all deployment environments.
If missing → server will throw `INTERNAL_SERVER_ERROR` with clear message.

### 3. tRPC client import path
`AgentSuite.tsx` and `AgentMeshPanel.tsx` import from `@/lib/trpc`.
Verify this alias matches your actual tRPC React client export location.
Common locations: `client/src/lib/trpc.ts` · `client/src/utils/trpc.ts` · `client/hooks/trpc.ts`.
Update the import line if needed — it is the only non-self-contained import.

### 4. Wouter route
The route `/admin/agents` uses `ProtectedRoute` (auth gate) plus the page's own `trpc.admin.checkAccess` query (admin gate).
Two-layer protection. Auth.md Hard Guard #8 is not violated — `hydrateFromToken()` is not called in ProtectedRoute render.

---

## Changes

### PATCH 1 — `server/procedures.ts`
Add `admin` router to `appRouter`. Dry-run: read the file, confirm the anchor appears exactly once.

```python
#!/usr/bin/env python3
"""
Patch: Add adminRouter to appRouter in server/procedures.ts
Anchor: must be unique — verify count before applying.
Dry-run: True
"""
import sys, shutil
from pathlib import Path

TARGET  = Path("server/procedures.ts")
# ANCHOR: the last import line before the appRouter definition
# Update ANCHOR to exactly match a unique line in your procedures.ts
ANCHOR      = """import { subsRouter } from "./routers/subsRouter";"""
REPLACEMENT = """import { subsRouter } from "./routers/subsRouter";
import { adminRouter } from "./routers/adminRouter";"""

DRY_RUN = True  # Wire.txt §14 — set False only after r3 confirmation

def patch():
    src = TARGET.read_text(encoding="utf-8")
    count = src.count(ANCHOR)
    if count != 1:
        sys.exit(f"ABORT: anchor found {count} times (expected 1). Update ANCHOR.")
    if DRY_RUN:
        print("DRY RUN — no files written.")
        print(f"Would insert adminRouter import after: {ANCHOR[:60]}…")
        return
    shutil.copy(TARGET, TARGET.with_suffix(TARGET.suffix + ".bak"))
    TARGET.write_text(src.replace(ANCHOR, REPLACEMENT), encoding="utf-8")
    print(f"✓ Patched {TARGET}")

if __name__ == "__main__":
    patch()
```

Then add `admin: adminRouter` to the `appRouter` object:

```python
#!/usr/bin/env python3
"""
Patch: Add admin: adminRouter to appRouter export
Dry-run: True
"""
import sys, shutil
from pathlib import Path

TARGET = Path("server/procedures.ts")
# Update ANCHOR to exactly match the subscriptions line in your appRouter
ANCHOR      = """  subscriptions: subsRouter,"""
REPLACEMENT = """  subscriptions: subsRouter,
  admin: adminRouter,"""

DRY_RUN = True

def patch():
    src = TARGET.read_text(encoding="utf-8")
    count = src.count(ANCHOR)
    if count != 1:
        sys.exit(f"ABORT: anchor found {count} times (expected 1). Update ANCHOR.")
    if DRY_RUN:
        print("DRY RUN — no files written.")
        return
    shutil.copy(TARGET, TARGET.with_suffix(TARGET.suffix + ".bak"))
    TARGET.write_text(src.replace(ANCHOR, REPLACEMENT), encoding="utf-8")
    print(f"✓ Patched {TARGET}")

if __name__ == "__main__":
    patch()
```

---

### PATCH 2 — `client/src/App.tsx`
Add `/admin/agents` route. The route sits AFTER all existing routes, uses `ProtectedRoute`.

Wouter pattern (matches the project's confirmed router — auth.md §WOUTER ROUTES):

```tsx
// Add this import at the top of App.tsx with other page imports:
import { AdminAgentSuitePage } from "@/pages/admin/AgentSuitePage";

// Add this route in the <Switch> block — AFTER all existing routes, BEFORE the 404 catch-all:
<Route path="/admin/agents">
  <ProtectedRoute>
    <AdminAgentSuitePage />
  </ProtectedRoute>
</Route>
```

Python patch script — update ANCHOR to exactly match a unique line in your Switch block:

```python
#!/usr/bin/env python3
"""
Patch: Add /admin/agents route to App.tsx
Dry-run: True
"""
import sys, shutil
from pathlib import Path

TARGET = Path("client/src/App.tsx")

# ANCHOR: the last route before your 404/redirect catch-all — update to match exactly.
ANCHOR = """      <Route>
        <Redirect to="/instrument" />
      </Route>"""

REPLACEMENT = """      <Route path="/admin/agents">
        <ProtectedRoute>
          <AdminAgentSuitePage />
        </ProtectedRoute>
      </Route>
      <Route>
        <Redirect to="/instrument" />
      </Route>"""

DRY_RUN = True

def patch():
    src = TARGET.read_text(encoding="utf-8")
    count = src.count(ANCHOR)
    if count != 1:
        sys.exit(f"ABORT: anchor found {count} times (expected 1). Update ANCHOR.")
    if DRY_RUN:
        print("DRY RUN — no files written.")
        return
    shutil.copy(TARGET, TARGET.with_suffix(TARGET.suffix + ".bak"))
    TARGET.write_text(src.replace(ANCHOR, REPLACEMENT), encoding="utf-8")
    print(f"✓ Patched {TARGET}")

if __name__ == "__main__":
    patch()
```

---

## Remaining Ambiguities

| Item | Status | Action Required |
|---|---|---|
| `users.isAdmin` column | UNVERIFIED | Read `shared/schema.ts` — confirm field exists before applying server router |
| tRPC client alias `@/lib/trpc` | UNVERIFIED | Confirm actual path; update import in AgentSuite.tsx + AgentMeshPanel.tsx if different |
| `subsRouter` import name in procedures.ts | UNVERIFIED | Update PATCH 1 ANCHOR to match your exact last import line |
| Switch catch-all route in App.tsx | UNVERIFIED | Update PATCH 2 ANCHOR to match your exact redirect/404 block |
| `ANTHROPIC_API_KEY` in all envs | UNVERIFIED | Confirm in `.env`, `.env.production`, Railway/Docker env config |
| Drizzle migration for isAdmin | CONDITIONAL | Only required if column is missing — do NOT apply router until migration runs |

---

## Post-Patch Verification Sequence (Wire.txt §14 §15)

```bash
# 1. Type-check — must be zero errors
pnpm tsc --noEmit

# 2. Full test suite — must remain 42 passing
pnpm test

# 3. Manual smoke test
#    Login as admin user → navigate to /admin/agents
#    Verify: Expert Agents sidebar loads, quick actions fire via tRPC
#    Navigate to Agent Mesh tab → run a task on @llpte/spectral
#    Verify: bus log fires, confidence bar updates, dry-run banner appears on patch response
#    Login as non-admin → navigate to /admin/agents
#    Verify: AdminForbidden screen renders, no agent panel visible
```
