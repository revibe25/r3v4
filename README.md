# R3 v4

AI-native browser-based DAW and DJ platform. Acid-techno design system, proprietary LLPTE audio pipeline, JWT auth, Stripe billing.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 6, TypeScript 5.9, Tailwind 3, Wouter |
| API | Express 4, tRPC 11, Zod |
| Auth | JWT (jsonwebtoken 9) — no Passport.js |
| Database | PostgreSQL, Drizzle ORM 0.45, drizzle-kit |
| Billing | Stripe |
| Audio | Tone.js, Web Audio API, LLPTE pipeline (6 packages) |
| 3D | Three.js r128 |
| State | Zustand |
| Runtime | Node.js 22, pnpm 10 |
| Deploy | Railway (server), Vercel (client) |

---

## Monorepo layout

```
.
├── client/          # React SPA (@r3vibe/client)
├── server/          # Express + tRPC server (@r3vibe/server)
├── shared/          # Types, Drizzle schema, Zod contracts
├── packages/        # LLPTE pipeline packages
│   ├── llpte-core
│   ├── llpte-signal
│   ├── llpte-ai
│   ├── llpte-adapters
│   ├── llpte-execution
│   └── llpte-transition-graph
├── services/        # Background services
├── drizzle/         # Migration history
└── scripts/         # Dev tooling
```

---

## Prerequisites

- Node.js 22
- pnpm 10 (`npm install -g pnpm`)
- PostgreSQL 15+

---

## Local setup

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env — see Environment variables section below

# 3. Create local database
createdb r3vibe
psql r3vibe -c "CREATE USER r3 WITH PASSWORD 'your_password';"
psql r3vibe -c "GRANT ALL PRIVILEGES ON DATABASE r3vibe TO r3;"

# 4. Run migrations
./db.sh migrate

# 5. Start dev server (server + client concurrently)
pnpm dev
```

Client runs on `http://localhost:5173`, server on `http://localhost:3000`.

---

## Environment variables

Copy `.env.example` to `.env`. All values are required for full functionality.

| Variable | Description |
|---|---|
| `NODE_ENV` | `development` or `production` |
| `PORT` | Server port (default `3000`) |
| `APP_URL` | Public URL of the app |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Min 32 chars — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_EXPIRES_IN` | Token lifetime (default `7d`) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_CREATOR_MONTHLY_PRICE_ID` | Stripe price ID |
| `STRIPE_CREATOR_YEARLY_PRICE_ID` | Stripe price ID |
| `STRIPE_PRO_ARTIST_MONTHLY_PRICE_ID` | Stripe price ID |
| `STRIPE_PRO_ARTIST_YEARLY_PRICE_ID` | Stripe price ID |
| `STORAGE_BUCKET` | S3/R2 bucket name |
| `STORAGE_REGION` | Region (`auto` for R2) |
| `STORAGE_ENDPOINT` | R2: `https://<account-id>.r2.cloudflarestorage.com` |
| `STORAGE_ACCESS_KEY_ID` | Storage access key |
| `STORAGE_SECRET_ACCESS_KEY` | Storage secret key |
| `STORAGE_PUBLIC_URL` | Public CDN URL for uploads |

---

## Common commands

```bash
# Development
pnpm dev                          # start server + client
pnpm dev:server                   # server only
pnpm dev:client                   # client only

# Type checking
pnpm --filter @r3vibe/client check       # client TSC
pnpm --filter @r3vibe/server typecheck   # server TSC
pnpm typecheck                           # both

# Database
./db.sh status                    # test connection
./db.sh migrate                   # run drizzle-kit push
./db.sh shell                     # open psql
./db.sh query "SELECT COUNT(*) FROM users;"
./db.sh backup                    # dump to SQL file

# Tests (LLPTE pipeline)
pnpm test:coverage                # vitest with coverage

# Build
pnpm build                        # compile server
pnpm --filter @r3vibe/client build  # bundle client
```

---

## Auth

JWT-based, stateless. No sessions table, no Passport.js.

| Route | Method | Description |
|---|---|---|
| `/api/auth/register` | POST | `{ email, username, password }` → `{ token, user }` |
| `/api/auth/login` | POST | `{ credential, password }` → `{ token, user }` — credential is email or username |
| `/api/auth/me` | GET | Bearer token → `{ user }` |
| `/api/auth/logout` | POST | Client-side token clear (stateless) |
| `/api/auth/change-password` | POST | `{ currentPassword, newPassword }` |

Token is stored in `localStorage` as `r3_token`. The tRPC client reads it via `useAuthStore.getState().token` on every request.

---

## Subscription tiers

| Tier | ID |
|---|---|
| Free | `explorer` |
| Mid | `creator` |
| Top | `pro_artist` |

Tier is cached on `users.tier` (denormalized) and canonical in the `subscriptions` table. Stripe webhooks keep them in sync.

---

## Database

Drizzle ORM. Schema split across:
- `server/db/schema.ts` — users, sessions, projects, samples, presets, settings, MIDI mappings, AI decision log, session metrics
- `shared/schema-subscription.ts` — subscriptions, stripe events, AI transition usage
- `shared/schema.ts` — barrel re-export

Migrations live in `drizzle/migrations/`. Latest: `0007_conscious_peter_parker.sql`.

Run migrations:
```bash
./db.sh migrate
# or directly:
cd server && npx drizzle-kit push --config drizzle.config.ts --force
```

---

## LLPTE pipeline

Proprietary audio processing pipeline. 6 packages under `packages/`:

- `llpte-core` — base types and interfaces
- `llpte-signal` — DSP signal processing
- `llpte-ai` — AI transition engine
- `llpte-adapters` — DAW/DJ adapters
- `llpte-execution` — execution runtime
- `llpte-transition-graph` — transition graph engine

105 Vitest tests, 100% coverage. Run with `pnpm test:coverage`.

---

## Design system

Acid-techno. Hard constraints — do not deviate:

| Token | Value |
|---|---|
| Background | `#060606` |
| Accent green | `#a3e635` |
| Accent cyan | `#22d3ee` |
| Font | IBM Plex Mono |
| Border radius | `0` (zero — no rounded corners) |
| Border style | Left acid neon border on active elements |

---

## Deployment

### Railway (server)

1. Connect GitHub repo to Railway
2. Set all environment variables from `.env.example` in the Railway dashboard
3. Railway auto-deploys on push to `main`
4. Node version: 22 (set `NODE_VERSION=22` in Railway env if not defaulting correctly)

### Vercel (client)

1. Connect GitHub repo, set root to `client/`
2. Build command: `pnpm build`
3. Output dir: `dist`
4. Set `VITE_API_URL` to your Railway server URL

---

## Engineering protocol (WIRE.txt)

All engineering work follows:

1. **Read before write** — audit the file before editing
2. **Dry-run before apply** — patch scripts run with `--dry-run` first
3. **Triple-check** — verify the change matches the intent
4. **TSC zero after every change** — `pnpm --filter @r3vibe/client check` must pass

Python patch scripts preferred over shell heredocs for multi-line file writes.
