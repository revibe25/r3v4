# R3 v4 — Personal Overrides (gitignored)
# This file loads after CLAUDE.md and takes precedence on conflicts.
# Add CLAUDE.local.md to .gitignore — never commit this file.

## Local Environment

- Dev server URL: http://localhost:3000
- Local DB connection: (set in .env — never put credentials here)
- Admin email: (set in .env as ADMIN_EMAIL)
- Test user credentials: (set in .env — never put credentials here)
- Railway DB host: ballast.proxy.rlwy.net:25291 (public URL — password from dashboard)
- Railway project: https://railway.app/project/681d053a-c749-43f6-b3b2-0f5ff4f202f3
- Vercel project: (your Vercel project URL)

## Railway Production

```bash
# Apply pending migrations — requires real password from Railway dashboard
DATABASE_URL="postgresql://postgres:REALPASSWORD@ballast.proxy.rlwy.net:25291/railway" \
  pnpm drizzle-kit migrate

# Verify table exists after migration
DATABASE_URL="postgresql://postgres:REALPASSWORD@ballast.proxy.rlwy.net:25291/railway" \
  node -e "
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query(\"SELECT COUNT(*) FROM ai_decision_log\")
  .then(r => { console.log('TABLE EXISTS ✅'); pool.end(); })
  .catch(e => { console.error('MISSING ❌', e.message); pool.end(); });
"
```

## Pending Actions (update as you work)

- [ ] P0: Apply migration 0005 to Railway — get password from railway.app dashboard
- [x] P1: logAIDecision + updateAIDecisionOutcome — DONE (session-metrics.service.ts)
- [ ] P2: Fix server/routes/presets.ts — 4 Drizzle `as any` casts (lines 10,11,16,17)
- [ ] P2: Replace console.log in server/index.ts:300-308 with morgan
- [ ] P3: Mix Suggestion System backend (read server/services/ first)
- [ ] P4: Migration 0006 — mv_user_session_averages + mv_ai_acceptance_rates
- [ ] P4: Fix vitest.config.ts include pattern
- [ ] P5: Consolidate 9 phantom directories

## Personal Workflow Notes

- Always run `pnpm tsc --noEmit` after every patch
- Run `python3 r3_hygiene.py` before committing
- Check Railway deployment status after every push
- Demo environment: load 8-track session, confirm pro_artist tier, LLPTE animated
- Dev machine: Kali ~/Stable — do NOT develop on Penguin (Node 18.x) or Termux

## Last Session Notes (2026-04-12)

- MultitrackView double transport bar fixed — hideTransport={true} prop added
- Acid-techno theme applied to /mixer page
- SKILLS.md created (22 engineering patterns) in docs/SKILLS.md
- DEMO_CHECKLIST.md created in docs/DEMO_CHECKLIST.md
- PRD v4.1 published to docs/R3v4_PRD_v4.1.pdf
- P1 confirmed already implemented — logAIDecision fully wired in aiMix.router.ts
- Migration 0005 applied to local DB — Railway apply still pending (P0)
- Real Railway password needed from dashboard — never store here

## Previous Session Notes (2026-04-09)

- 11 routers wired in procedures.ts
- aiDecisionLog schema + migration 0005 generated
- SessionChip + SessionSummaryPanel wired into DAW.tsx
- 15 any violations fixed across 8 files
- Hygiene script 3 bugs fixed
- PRD v4.0 published
