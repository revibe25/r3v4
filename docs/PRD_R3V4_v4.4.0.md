# R3v4: Pro-Grade AI Browser DAW
**Product Requirements Document (PRD)**  
Version: v4.4.0 (2026-04-29)  
Author: [Your Team]  
Reference: CLAUDE.md, SKILLS.md, WIRE.txt, repo tree, canonical code patterns  
Changelog:  
- v4.4.0 — Triple-check bug pass: fixed Railway verify command missing DATABASE_URL prefix (§7.5), added palette disambiguation note (#bfff00 vs #a3e635, §4.2), added `git remote set-url` PAT method (§7.9), added `--force-with-lease` safety note (§8.5), qualified hardcoded DAW.tsx line numbers (§8.4), resolved §2/§3.1 rule duplication, disambiguated Penguin/Termux v4 alias, qualified migration number (§9), normalized Wire reference  
- v4.3.0 — SKILLS.md full integration (env table, palette T-object, Railway ops, JSX hygiene, deferred roadmap items, operational runbooks)

---

## 📐 1. Project Scope & Mission

**Mission:**  
Deliver a fully browser-based DAW that sets a new standard for speed, clarity, musical intelligence, and live instrument UI.  
- Hybrid AI-First: AI as creative collaborator, not just an assist tool  
- Production-Grade: Zero drift between type contract, UI, data, and musical intent  
- Extensible & Modular: Built for future integrated node-based VJ and multiplayer DAW features.

---

## 🛠 2. Stack and Unbreakable Architecture Rules

**Tech Stack (✱ = Hard Guard in codebase):**  
| Area           | Library/Standard                 | Version/Pinned      | Notes                         |
|----------------|----------------------------------|---------------------|-------------------------------|
| Language       | TypeScript ✱                     | 5.9.3               | No `any` except whitelisted   |
| UI Framework   | React ✱                          | 18.x                | Functional components only    |
| State          | Zustand ✱                        | 4.x                 | No Redux                      |
| Routing        | Wouter ✱                         | 2.x                 | No react-router-dom           |
| Styling        | TailwindCSS ✱                    | 4.2.4               | *darkMode: 'class'*           |
| Theme System   | CSS Variables via theme.css ✱    | —                   | Neon/Acid default palette     |
| Package Mgmt   | pnpm ✱                           | 10.33.x             | Monorepo workspace setup      |
| Auth           | JWT                              | —                   | No session cookies            |
| Payments       | Stripe ✱                         | 20.4.1              | No alt vendor refs            |
| ORM/DB Client  | drizzle-orm                      | 0.39.3              | See migration rules           |
| DB             | PostgreSQL                       | ≥14.x (Railway)     | Split DB, never SQLite        |
| Audio          | Web Audio API                    | —                   | All analysis in browser       |
| Realtime       | ws                               | 8.20.0              | Collab, control, VJ sync      |
| Testing        | Vitest                           | 1.6.1               | ≥42 cases, piped to CI        |
| Node           | Node.js ✱                        | 22.x (LTS)          | Critical for all CLI          |
| esbuild        | esbuild (pinned)                 | 0.25.12             | Never allow 0.27.x resolution |

> **Node enforcement:** `.nvmrc` in project root contains `22`. Run `nvm install 22 && nvm use 22` on any machine before `pnpm dev`. Penguin and Termux both run Node 18.x — `pnpm dev` will fail with esbuild `TransformError` on either. Never run builds on those machines.

**Multi-Machine Environment:**
| Machine | Alias | Path | Node | Purpose |
|---|---|---|---|---|
| Kali | `r3v` | `~/Stable` | 22.x | **Canonical dev — all patches authored here** |
| Penguin (Chromebook Linux) | `v4` | `~/R3v4` | 18.20.4 | Migration/transfer only |
| Termux (Android) | `v4` | `~/r3v4_extracted` | 18.x | UI testing only (not canonical repo) |

> Both Penguin and Termux share the `v4` project alias but are separate machines on separate hardware. Paths disambiguate them (`~/R3v4` vs `~/r3v4_extracted`).

**Workspace Rules:**
- **All development on Kali only.** Penguin and Termux are for running specific commands only — never for writing or patching code.
- `~/r3v4_extracted` on Termux is a separate extracted archive — NOT the canonical repo. Changes there must be cherry-picked back to Kali.
- All patch scripts must be read-then-write, never blind apply (`WIRE.txt` protocol).
- Penguin has two git remotes (`gitsafe-backup` and `origin`). Always push to `origin` explicitly — `git push origin main`. Do not delete `gitsafe-backup`.
- No imports across phantom dirs (see hygiene baseline).
- Only one source of truth for Tailwind config, theme tokens, palette.

---

## 🧩 3. Product & App Architecture

### 3.1 Monorepo Layout  
```
/
  client/
    src/
      context/             # ThemeProvider, DAW providers
      components/
      pages/
      hooks/
      styles/
    config/
    stores/
    shared/
  server/
    db/
    routers/
    services/
    routes/
    trpc.ts
  shared/                  # Universal types, schema, adapters
  packages/llpte-*         # Individual AI/Mix/Pipeline packages
  tests/
  tools/                   # Patch, audit, automation scripts
```
*(Import hygiene and config lock rules: see §2 and §8.)*

### 3.2 Canonical Pipeline (LLPTE — Locked)  
```
inputRouter → spectralAnalyzer → aiMixEngine → transitionGraph → outputBus
```
- Node order must never change (locked in PRD + Charter)
- Each node exposes hooks for live visual intelligence layer

---

## 🎨 4. UI & Theming Contract

### 4.1 Style Union (Enforced)
- **Base:** Black (`#000`), soft white (`#eaeaea`)
- **Accent:** Neon lime (`#bfff00`), soft neon (`#dfff66`), border glow  
- **No random greens:** Only neon palette allowed
- **Theme Switcher:** Only two themes: `dark` (default), `light`
- UI colors must reflect canonical tokens (`bg-background`, `border-border`, etc.)

### 4.2 Canonical Inline Style Palette (T-Object)
For DAW core pages (`DAW.tsx`, `Instrument.tsx`) and any component migrating off Tailwind theme classes, use the canonical inline palette:

> **Palette disambiguation:** The CSS variable system (§4.1, Appendix A) uses `#bfff00` as `--neon-lime`. The T-object inline palette uses `#a3e635` as `accent`. These are intentionally separate — the CSS var system drives Tailwind/theme.css tokens; the T-object drives DAW core inline styles. Do NOT unify them or substitute one for the other.

```ts
const T = {
  bg:        '#0a0a0a',               // page background
  surface:   '#0d0d0d',               // panel background
  border:    '#1c1c1c',               // primary borders
  border2:   '#2a2a2a',               // secondary borders
  text:      '#e5e5e5',               // primary text
  dim:       '#555',                  // secondary/muted text
  accent:    '#a3e635',               // acid green — primary accent
  accentDim: 'rgba(163,230,53,0.12)', // accent tint for hover states
  rec:       '#ef4444',               // record red
  recDim:    'rgba(239,68,68,0.15)',  // record tint
  font:      '"IBM Plex Mono", "JetBrains Mono", monospace',
}
```

**Tailwind → Inline Migration Swaps:**
| Tailwind Class | Inline Replacement |
|---|---|
| `bg-card` | `background: '#0d0d0d'` |
| `bg-background` | `background: '#0a0a0a'` |
| `bg-muted` | `background: 'rgba(255,255,255,0.04)'` |
| `text-blue-400` | `color: '#a3e635'` |
| `rounded-lg` | *(remove — zero radius is canonical)* |
| `from-blue-600 to-blue-700` (play btn) | `background: rgba(163,230,53,0.12)`, `border: 1px solid rgba(163,230,53,0.4)`, `color: #a3e635` |

### 4.3 Neon Effects
- Buttons, panels, indicators: `neon-border`, `neon-panel`, `.neon-hover` classes
- Only use `box-shadow` and `border-color` for glow, never inline RGB hack
- Animation speed: Default 220ms. No infinite blur spam.

### 4.4 Audio/Beat/Section/VJ Integration
- UI livesyncs to: master output, active tracks, beat, bar, drop, and MIDI
- Use global context: `useVisualIntelligence`, `useAudioReactivity`, `useMusicClock`

### 4.5 Accessibility
- All live themes pass WCAG AA for contrast on both backgrounds  
- Focus rings: Neon, always visible

---

## ⚡ 5. AI, Visual, and Realtime Intelligence

| Layer                     | Function                                | Requirement           |
|---------------------------|-----------------------------------------|-----------------------|
| Audio Analyzer            | Level, waveform, FFT bands              | 60fps, smoothed       |
| Beat Clock                | Beat/bar/phrase counters                | BPM lock, 4/8/16 bar  |
| Drop Detector             | Energy spike → UI explosion             | Smoothing, 20ms delay |
| Section Detection         | AI classifies verse/build/drop          | Heuristics + ML       |
| Visual Intelligence Layer | Aggregates signals, feeds VJ/reactive UI| Central, not per-comp |
| MIDI Handler              | Per-user, per-session, triggers UI      | Web MIDI, low-latency |
| Node-Based VJ Graph       | Shader logic built visually             | ReactFlow + WebGL     |
| Collaborative Editing     | CRDT graph (Yjs) w/ undo                | Multi-user, no merge  |

- VJ visuals (WebGL shader canvas) driven by VIL data, not React state  
- AI copilots allowed, but must patch via diff/patch system, not raw writes

---

## 💸 6. Monetization & User Flow

| Tier         | Feature Locks                                  | Enforcement             |
|--------------|------------------------------------------------|-------------------------|
| explorer     | Limited tracks, basic AI, branding             | Stripe/canonical only   |
| creator      | Full tracks/effects, MIDI, DAW/VJ collab       | Stripe validated        |
| pro_artist   | All features, multiplayer, live visuals, export| Stripe, audit required  |

- On login: always redirect `/instrument`, never `/daw`.
- Stripe is the only payment gateway (no alt vendors).
- No "Pro" or "Studio" strings — only `creator` or `pro_artist`.

---

## 🧑‍💻 7. Dev/Test/Deployment Protocols

### 7.1 Zero Drift Rule
- `pnpm tsc --noEmit` must return zero errors after any patch (see CLI guard in CLAUDE.md)
- Always run `pnpm tsc --noEmit` immediately after `git pull` to catch JSX/type errors introduced from other machines.
- Patch scripts must perform read-first (`WIRE.txt` protocol)

### 7.2 pnpm Install — Frozen Lockfile Required
Always install with the lockfile enforced on all machines:
```bash
pnpm install --frozen-lockfile
```
Never run bare `pnpm install` on secondary machines — it may silently resolve wrong versions (e.g., `esbuild@0.27.7` instead of pinned `0.25.12`).

Verify esbuild after install on any non-Kali machine:
```bash
ls node_modules/.pnpm/ | grep esbuild
# expect: esbuild@0.25.12
```

**pnpm Permission Fix (Shared/Chromebook Systems):**
```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
npm install -g pnpm
pnpm --version   # expect 10.33.x
```

### 7.3 Theme Preflight
Before every deploy, run grep across all UI for non-token colors:
```bash
grep -rn "bg-black\|text-white\|border-green\|#[0-9a-fA-F]\{3,6\}" client/src/
```

### 7.4 Config Lock
- Only one live `tailwind.config.ts` in `client/` root
- No dev on Termux/Penguin except isolated UI run
- `.env` DB_URL must always be manually verified (Railway only)

### 7.5 Railway Database — Migration Protocol
**Critical: `drizzle-kit migrate` prints a spinner but gives no explicit success message. Always verify.**

```bash
# Always explicitly override DATABASE_URL for Railway — never trust .env
DATABASE_URL="postgresql://postgres:PASSWORD@ballast.proxy.rlwy.net:PORT/railway" \
  pnpm drizzle-kit migrate

# Verify immediately after every migration — carry the same DATABASE_URL override
DATABASE_URL="postgresql://postgres:PASSWORD@ballast.proxy.rlwy.net:PORT/railway" \
node -e "
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query(\"SELECT column_name FROM information_schema.columns WHERE table_name = 'ai_decision_log' ORDER BY ordinal_position\")
  .then(r => {
    console.log(r.rows.length > 0 ? 'TABLE EXISTS — ' + r.rows.length + ' cols ✅' : 'TABLE MISSING ❌');
    r.rows.forEach(c => console.log('  ' + c.column_name));
    pool.end();
  })
  .catch(e => { console.error('ERROR:', e.message); pool.end(); });
"
```

**railway.toml — Auto-Migrate on Deploy:**  
The default `startCommand = "pnpm exec tsx index.ts"` does NOT run migrations. Use:
```toml
startCommand = "pnpm drizzle-kit migrate && pnpm exec tsx index.ts"
```

**DATABASE_URL Rules:**
- Never stored in `.env` or `.env.production` on any machine.
- Must be fetched from Railway dashboard → PostgreSQL service → Connect tab.
- Never paste the URL into chat — type it directly in the terminal.
- If accidentally exposed, rotate the password immediately.
- The public URL (`ballast.proxy.rlwy.net:PORT`) is required from outside Railway. The private URL only works inside Railway's internal network.

**Railway CLI — Architecture Mismatch Workaround:**  
If `railway` binary throws `exec format error` (wrong CPU arch), skip the CLI entirely:
```bash
# Instead of: railway run pnpm drizzle-kit migrate
DATABASE_URL="postgresql://postgres:PASSWORD@ballast.proxy.rlwy.net:PORT/railway" \
  pnpm drizzle-kit migrate
```

### 7.6 Admin Login Verification Pattern
When admin login fails or behavior is unexpected:
```bash
# Step 1 — Confirm admin user exists in DB
cd ~/Stable && node -e "
require('dotenv/config');
const {Pool} = require('pg');
const pool = new Pool({connectionString: process.env.DATABASE_URL});
pool.query('SELECT id, email, \"isAdmin\", tier FROM users WHERE \"isAdmin\" = true')
  .then(r => { console.log('Admin users:', r.rows); pool.end(); })
  .catch(e => { console.error(e.message); pool.end(); });
"

# Step 2 — Confirm ADMIN_EMAIL env var is set
grep "ADMIN_EMAIL" ~/Stable/.env

# Step 3 — Test the auth endpoint directly
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"YOUR_ADMIN_EMAIL","password":"YOUR_PASSWORD"}' \
  | head -c 200
```

Common failure causes: `isAdmin` column missing in production DB (schema drift), admin created in local DB but not Railway, JWT secret differs between environments.

### 7.7 Python Patch Script Delivery
On Termux/Android, heredoc syntax fails when pasted into nano. Always deliver Python patches via stdin directly — no file creation, no nano required:
```bash
python3 - << 'EOF'
# pure python only — no cat, no PYEOF, no shell wrapper
import shutil
...
EOF
```

### 7.8 GPG Secrets Archive
```bash
# Encrypt
cd ~/Stable && ./r3zip-secrets.sh

# Decrypt on any machine
./r3zip-secrets.sh --decrypt

# If archive is on a different machine, use --archive flag
./r3zip-secrets.sh --archive=/path/to/r3v4_secrets_TIMESTAMP.tar.gz.gpg --decrypt
```

For Railway operations, opening `railway.app` in a browser and copying the DB URL is almost always faster than decrypting the archive. Use that first.

### 7.9 GitHub Authentication
GitHub deprecated password authentication. HTTPS pushes require a **Personal Access Token (PAT)**:
1. github.com → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
2. Generate new token — `repo` scope (full)
3. When git prompts for password, paste the PAT

Permanent fix (choose one):
```bash
# Option A — embed credentials in the remote URL directly
git remote set-url origin https://YOUR_GITHUB_USERNAME:YOUR_PAT@github.com/Berryboy93/r3v4.git

# Option B — credential store (prompted once, then cached)
git config --global credential.helper store
# enter username + PAT once on next push — then cached
```

### 7.10 Ctrl+C / Interrupted Operation Recovery
Any operation interrupted by Ctrl+C should be assumed **incomplete**. Check state explicitly before continuing.

```bash
# git push interrupted
git log --oneline -3   # confirm local commit exists
git push               # re-run — idempotent, safe

# pnpm install interrupted
rm -rf node_modules && pnpm install --frozen-lockfile

# tar extraction interrupted (Termux only — ~/r3v4_extracted is not on Kali)
ls -la ~/r3v4_extracted/
# If partial: rm -rf ~/r3v4_extracted && re-extract from archive
```

### 7.11 CRDT/Realtime Layer
All multiplayer/VJ graph state is Yjs-CRDT, never plain Zustand or raw WebSocket.

### 7.12 AI Integrations
All AI code must use `type: "ai.generate" | "ai.modify"` meta nodes for graph patches (never raw mutation).

### 7.13 CLAUDE.local.md
After every session, update `CLAUDE.local.md`:
- Move completed items from Pending Actions to a dated completion note
- Update Last Session Notes with what actually happened
- Add the Railway URL field (without the password)

**Never commit `CLAUDE.local.md`** — it is gitignored by design.

---

## ⚠️ 8. Hygiene & Canonical Violations

### 8.1 Style & Type Guards
- NO: `bg-black`, `text-white`, `border-green-500` (except in inline DAW core palette by explicit design)
- NO: Direct color hex in `className` props outside `styles/theme.css` or DAW core
- NO: Committing `console.log` — use structured logging everywhere
- NO: `any` types — must use `unknown` with guard, unless CLAUDE-exempt file
- NO: Phantom directories — never new UI in `client/client`, `client/src/context(s)`, etc.
- NO: Multiple tailwind configs — only `client/tailwind.config.ts` is canonical
- DO: ESLint + TS strict enforced before any merge

### 8.2 Double Transport Bar — Prevention Pattern
Components that own an internal transport bar must accept `hideTransport?: boolean`. Pass `hideTransport={true}` from any route wrapper that lives inside a nav-aware shell:

```tsx
// In the component definition
interface Props {
  hideTransport?: boolean;
}
const Component = ({ hideTransport = false }: Props) => (
  <>
    {!hideTransport && (<>
      {/* internal transport */}
    </>)}
    {/* rest of component */}
  </>
);

// In App.tsx route
<Component hideTransport={true} ... />
```

### 8.3 JSX Fragment Pitfall
When wrapping JSX with `{condition && (...)}`, if the first child inside the parens is a comment, Babel/esbuild will throw `Unexpected token`. Always wrap with a fragment:
```tsx
// WRONG
{!hideTransport && (
  {/* comment */}
  <div>...</div>
)}

// CORRECT
{!hideTransport && (<>
  {/* comment */}
  <div>...</div>
</>)}
```

### 8.4 Unterminated JSX — StatusBar Pattern
A stray `</>` with no matching opening `<>` produces `Unterminated JSX contents` at build time. Diagnosis (line range approximate — use grep first):
```bash
grep -n "StatusBar\|const StatusBar" ~/Stable/client/src/pages/DAW.tsx
# then inspect surrounding lines:
sed -n '1840,1870p' ~/Stable/client/src/pages/DAW.tsx  # line numbers as of v4.3; may drift
```
Fix:
```tsx
// Wrong — stray closing fragment
return (
  <div>...</div>
  </>
);

// Correct
return (<>
  <div>...</div>
</>);
```

### 8.5 Git Large File Rules
Never commit archives, secrets, or logs. Verify `.gitignore` before any commit:
```
archives/*.tar.gz
archives/*.gz
archives/*.zip
secrets/
logs/
```

**If a large file is already in history:**
```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch archives/r3v4_source_*.tar.gz' \
  --prune-empty --tag-name-filter cat -- --all
git push origin main --force
```

> **Safer alternative for regular force-push situations** (not filter-branch): use `--force-with-lease` instead of `--force` — it aborts if the remote has commits you haven't fetched, preventing accidental overwrites:
> ```bash
> git push --force-with-lease
> ```

### 8.6 PRD Version Triple-Check Process
When updating this PRD or any technical document, run three passes:

**Pass 1 — Targeted search for known wrong values:**
```bash
grep -n "OLD_VALUE\|stale_string\|wrong_count" file.md
```
**Pass 2 — Cross-reference all numerical claims:** count items, verify math, check version numbers against pinned stack.  
**Pass 3 — Context sweep:** search every instance of key terms across ALL sections. Changelog, glossary, and prose paragraphs hold stale values longest.

---

## 🚀 9. Roadmap: Next-Level Features (Modular Plan)

**Immediate**
- Neon/Acid theme full migration (~1d)
- Theme/dark mode indicator multi-pass audit
- Audio reactivity engine, beat/section detection
- Node-based VJ visual composer (single-user)

**Staged**
- Multiplayer collaborative VJ for ≥pro_artist
- AI co-creator nodes (backed by codegen/LLM)
- Live drop detection w/ visual cues
- Visual automation lanes for modulation
- Preset system for VJ patches/scenes

**Deferred (do not implement until P3 is complete)**
- **Promo Code System:** New `promoCodes` Drizzle table (`code, tier_granted, expires_at, uses_remaining, used_by`), new migration (next available number after current max, estimated 0007+), tRPC procedure `subscription.redeemPromo`, frontend input on pricing/login page, admin `generatePromoCode` (6-digit cryptographically random), Stripe `pro_artist` grant via `trial_period_days` or direct DB update. Read `server/routers/subscription.ts` + `server/db/schema.ts` before implementing.

---

## 📎 10. Appendix A: Canonical Color/Theme Token Map

```
--bg:             #000000
--fg:             #eaeaea
--neon-lime:      #bfff00
--neon-lime-soft: #dfff66
--border:         #bfff00
--panel:          #050505
--glow-1:         0 0 4px #bfff00
--glow-2:         0 0 8px #bfff00, 0 0 16px #bfff00
--glow-3:         0 0 12px #bfff00, 0 0 24px #bfff00, 0 0 48px #bfff00
```

## 📎 11. Appendix B: Inline Style Palette (DAW Core Reference)

```ts
const T = {
  bg:        '#0a0a0a',
  surface:   '#0d0d0d',
  border:    '#1c1c1c',
  border2:   '#2a2a2a',
  text:      '#e5e5e5',
  dim:       '#555',
  accent:    '#a3e635',
  accentDim: 'rgba(163,230,53,0.12)',
  rec:       '#ef4444',
  recDim:    'rgba(239,68,68,0.15)',
  font:      '"IBM Plex Mono", "JetBrains Mono", monospace',
}
```

---

*This PRD must be reviewed alongside `CLAUDE.md`, `SKILLS.md`, and `WIRE.txt` before every feature or patch. No deviations permitted without RFC and maintainer review.*
