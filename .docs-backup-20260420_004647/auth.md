---
paths:
  - "**/auth*"
  - "**/login*"
  - "**/routes*"
  - "**/middleware*"
  - "**/App.tsx"
  - "**/ProtectedRoute*"
---

# Auth & Routing Rules

## Auth Store
- Canonical store: `hooks/authStore` — import ONLY from here
- Dead stub `store/auth-store.ts` is neutralized — never resurrect it

## ProtectedRoute
- Must NOT call `hydrateFromToken()` on every mount — causes session destruction
- `hydrateFromToken()` must set `isLoading: true` before any async fetch begins

## tRPC
- Middleware must be mounted on `/trpc` — no other path is valid

## Layout
- Post-login redirect: `/instrument` — never `/daw`
- Nav height: `NAV_HEIGHT_PX` constant + `--nav-h` CSS variable
- Root layout: flex-column, `ThemeProvider` wraps everything
- No overflow without explicit containment
- `PageNav` reads from `hooks/authStore` only
