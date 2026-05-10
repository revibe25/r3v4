# 🏛️  R3vibe Architecture Overview

## Overview

- **Monorepo:** `/Stable`
- **Frontend:** `/Stable/client`
  - React, Wouter, Vite
  - Routing in `src/App.tsx`
- **Backend:** `/Stable/server`
  - Node.js (TypeScript)
  - TRPC-based RPC
- **Database:** PostgreSQL, local instance in dev
- **Config:** Shared `.env` at project root

## Key Concepts

- **Routing:** Via `src/App.tsx`; Wouter not React Router; use `<Route ...>` blocks and `ProtectedRoute` for auth.
- **Auth:** JWT stored in localStorage, hydrated by `initAuth()`
- **Data:** Managed by TRPCProvider (React Query context)
- **Pages:** Self-contained, manage own scroll; nav height exported as custom CSS var

## Stack Decision Rationale

- **Why Wouter?** Lightweight, no SSR requirement.
- **Why TRPC?** Type safety between client/server for rapid development.

## Subsystem Diagram

```
Frontend (React+Wouter) <--> Backend TRPC (Node) <--> Postgres
                          ^
                    .env provides secrets, DB URL
```

## Key Flows

- Login → POST /api/auth/login → DB query → JWT in localStorage
- Page nav → `<Route>` swaps → Component renders

---

**See API_REFERENCE.md and DEVELOPMENT.md for more module-by-module info!**