# R3 v4 — Claude Code Constitution
# AI-native browser DAW · pnpm monorepo · ~/Stable/R3 v4/
# Packages: @llpte/* (AI pipeline) · @r3vibe/* (app)

<!-- Rules in .claude/rules/ auto-load — do not @import them here -->

## Identity

R3 v4 is AI-first. LLPTE is the moat — never treat it as an afterthought.
Routing: Pricing → Login → Instrument → DAW → Loopstation
Tiers (Stripe only): `explorer` · `creator` · `pro_artist`

## Hard Guards — Non-Negotiable

- No `any` — use `unknown` + type guard
- No swallowed exceptions — all async functions handle errors explicitly
- No `console.log` in committed code
- No write without read first (Wire.txt protocol — see workflow rules)
- No patch applied without dry-run confirmation
- No Lemon Squeezy tier strings — ever
- Post-login redirect: `/instrument` only, never `/daw`
- No `hydrateFromToken()` inside `ProtectedRoute` render

## Commands

```
pnpm tsc --noEmit   ← run after every patch
pnpm test           ← Vitest suite
pnpm dev            ← dev server
```

## MVP Queue

1. ✅ AI Auto-Leveling — 6 layers, 20 Vitest tests
2. ✅ Smart Transitions — 9 files, 22 Vitest tests
3. 🔲 Time Savings Tracking  ← current
4. 🔲 Mix Suggestion System

PRD gates before sell / partnership talks:
≥65% AI suggestion acceptance · measurable time savings · 50–100 paying beta users

## Auto-Memory

SAVE: build quirks found this session, recurring bugs + their fixes, any
pattern that surfaced more than once.
DO NOT SAVE: one-off workarounds, anything already covered in this file.
