# R3 v4 — Personal Overrides (gitignored)
# This file loads after CLAUDE.md and takes precedence on conflicts.
# Add CLAUDE.local.md to .gitignore — never commit this file.

## Local Environment

- Dev server URL: http://localhost:3000
- Local DB connection: (set in .env — never put credentials here)
- Admin email: (set in .env as ADMIN_EMAIL)
- Test user credentials: (set in .env — never put credentials here)
- Railway project: (your Railway project URL)
- Vercel project: (your Vercel project URL)

## Railway Production

```bash
# Apply pending migrations to production
pnpm drizzle-kit migrate

# Check Railway logs
railway logs

# Open Railway dashboard
railway open
```

## Pending Actions (update as you work)

- [ ] P0: Apply migration 0005 to Railway (`pnpm drizzle-kit migrate`)
- [ ] P1: Wire aiDecisionLog writes into session-metrics.service.ts
- [ ] P2: Fix server/routes/presets.ts — 4 Drizzle `as any` casts
- [ ] P3: Replace console.log in server/index.ts:300-308 with logger
- [ ] P4: Mix Suggestion System backend
- [ ] P5: Create migration 0006 — mv_user_session_averages + mv_ai_acceptance_rates

## Personal Workflow Notes

- Always run `pnpm tsc --noEmit` after every patch
- Run `python3 r3_hygiene.py` before committing
- Check Railway deployment status after every push
- Demo environment: load 8-track session, confirm pro_artist tier, LLPTE animated

## Last Session Notes (2026-04-09)

- 11 routers wired in procedures.ts
- aiDecisionLog schema done — migration 0005 generated but NOT yet applied to Railway
- SessionChip + SessionSummaryPanel wired into DAW.tsx
- 15 any violations fixed across 8 files
- Hygiene script 3 bugs fixed
- PRD v4 published to docs/R3v4_PRD_v4.docx
