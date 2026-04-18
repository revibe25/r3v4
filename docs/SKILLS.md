# R3 v4 — Skills.md
# Patterns, failure modes, and learned techniques from active development.
# Updated: 2026-04-12 | Source: multi-session engineering thread
# Use alongside CLAUDE.md and WIRE.txt — not a replacement for either.

---

## 1. Python Patch Scripts — Terminal Delivery

### Problem
On Termux/Android, heredoc syntax (`cat << 'EOF' > file.py`) does not work when
the user pastes the entire block into nano — they copy the shell wrapper along
with the Python content, causing `SyntaxError: invalid syntax` on the `cat` line.

### Root Cause
User opens nano, then pastes the full block including the outer shell command.
nano saves literally what was pasted — the Python file then starts with bash.

### Fix
Deliver Python patches via stdin directly — skip file creation entirely:

```bash
python3 - << 'EOF'
# pure python only — no cat, no PYEOF, no shell wrapper
import shutil
...
EOF
```

This runs Python from stdin. No file is created. No nano required.

### Fallback (if heredoc also fails on the target shell)
Create the file manually via nano by opening it and pasting ONLY from `import`
onwards — never including the `python3 -` or `EOF` lines.

---

## 2. Git History — Large File Removal

### Problem
A 1.6GB archive (`archives/r3v4_source_*.tar.gz`) was committed and pushed.
GitHub rejected with GH001 (100MB limit). `git rm --cached` + amend is not
sufficient — the blob remains in history and git still tries to push it.

### Fix
Use `git filter-branch` to purge from entire history:

```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch archives/r3v4_source_*.tar.gz' \
  --prune-empty --tag-name-filter cat -- --all
git push origin main --force
```

### Prevention
Add to `.gitignore` immediately after any archive operation:
```
archives/*.tar.gz
archives/*.gz
archives/*.zip
secrets/
logs/
```

### Pattern
The `r3zip.sh` and `r3zip-secrets.sh` scripts already exclude `archives/` and
`secrets/` from r3zip — but git does not know about these exclusions.
Always verify `.gitignore` covers these dirs before committing.

---

## 3. Double Transport Bar — Root Cause Pattern

### Problem
`/mixer` route rendered two transport bars — one from `PageNav` (global) and
one from `MultitrackView`'s own internal transport section.

### Root Cause
`MultitrackView` was designed as a standalone component with its own transport.
When embedded in a routed app that already has a global nav/transport (`PageNav`),
the internal one doubles up.

### Fix Pattern
Add an optional `hideTransport?: boolean` prop to any component that owns its
own transport bar. Default `false` for standalone use. Pass `hideTransport={true}`
from the route wrapper that lives inside a nav-aware shell.

```tsx
// In the component
interface Props {
  hideTransport?: boolean;
}
const Component = ({ hideTransport = false }) => (
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

### JSX Pitfall
When wrapping JSX with `{condition && (...)}`, if the first child inside the
parens is a comment `{/* ... */}` followed by a JSX element, Babel/esbuild
will throw `Unexpected token` because a comment is not a valid single JSX
expression. Always wrap with a fragment `<>...</>`:

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

---

## 4. Multi-Machine Environment Management

### Machines in Use
| Machine | Path | Node | Purpose |
|---|---|---|---|
| Kali (`r3v`) | `~/Stable` | 22.x | Canonical dev — use this |
| Penguin (`v4`) | `~/R3v4` | 18.20.4 | Chromebook Linux container — migration only |
| Termux (`v4`) | `~/r3v4_extracted` | 18.x | Android — UI testing only |

### Rules
- **All development on Kali only.** Penguin and Termux are for running specific
  commands only — never for writing or patching code.
- Penguin and Termux both run Node 18.x — incompatible with the project (requires 22.x).
  Running `pnpm dev` on either will fail with esbuild transform errors.
- `~/r3v4_extracted` on Termux is a separate extracted archive — NOT the canonical
  repo. Changes there must be cherry-picked or the files must be copied back to Kali.

### Railway DB URL
- Never stored in `.env` or `.env.production` on any machine.
- Must be fetched from Railway dashboard → PostgreSQL service → Connect tab.
- Never paste the URL into chat — type it directly in the terminal.
- Rotate the password immediately if accidentally exposed.
- The public URL (`ballast.proxy.rlwy.net:PORT`) is required from outside Railway.
  The private URL only works inside Railway's network.

---

## 5. Railway Migration — Confirmed Pattern

### drizzle-kit migrate Ambiguity
`pnpm drizzle-kit migrate` prints an animated spinner but gives no explicit
success/failure message on completion. This is NOT a confirmation of success.

### Verification Required
Always verify after every `drizzle-kit migrate` run:

```bash
DATABASE_URL="postgresql://..." node -e "
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

### railway.toml — No Auto-Migrate
`railway.toml` `startCommand = "pnpm exec tsx index.ts"` does NOT run migrations.
Migrations must be applied manually. Consider changing to:
```toml
startCommand = "pnpm drizzle-kit migrate && pnpm exec tsx index.ts"
```
This ensures every Railway deploy applies pending migrations before starting.

---

## 6. pnpm Install — Permission Error on Shared Systems

### Problem
`npm install -g pnpm` fails with `EACCES: permission denied` on systems where
`/usr/local/lib/node_modules` is owned by root (Chromebook Linux, shared Termux).

### Fix
```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
npm install -g pnpm
pnpm --version   # expect 10.33.0
```

---

## 7. Theme Migration — Tailwind to Inline Style

### Problem
Pages using Tailwind CSS theme tokens (`bg-card`, `bg-background`, `bg-muted`,
`text-blue-400`, `rounded-lg`) look inconsistent with pages using the canonical
acid-techno inline style palette (DAW.tsx, Instrument.tsx).

### Canonical Acid-Techno Palette
```ts
const T = {
  bg:        '#0a0a0a',   // page background
  surface:   '#0d0d0d',   // panel background
  border:    '#1c1c1c',   // borders
  border2:   '#2a2a2a',   // secondary borders
  text:      '#e5e5e5',   // primary text
  dim:       '#555',      // secondary text
  accent:    '#a3e635',   // acid green — primary accent
  accentDim: 'rgba(163,230,53,0.12)',
  rec:       '#ef4444',   // record red
  recDim:    'rgba(239,68,68,0.15)',
  font:      '"IBM Plex Mono", "JetBrains Mono", monospace',
}
```

### Migration Pattern
Replace Tailwind classes with inline styles matching the palette above.
Key swaps:
- `bg-card` → `style={{ background: '#0d0d0d' }}`
- `bg-background` → `style={{ background: '#0a0a0a' }}`
- `bg-muted` → `style={{ background: 'rgba(255,255,255,0.04)' }}`
- `text-blue-400` → `style={{ color: '#a3e635' }}`
- `rounded-lg` → remove (zero radius is canonical)
- `from-blue-600 to-blue-700` (play button) → `background: rgba(163,230,53,0.12)`, `border: 1px solid rgba(163,230,53,0.4)`, `color: #a3e635`

---

## 8. Node Version Mismatch — esbuild Transform Error

### Symptom
```
Error [TransformError]: Transform failed with 1 error:
/path/index.ts:29:0: ERROR: Expected "from" but found "import"
```

### Root Cause
Running `tsx` under Node 18.x on a codebase that uses syntax or modules
requiring Node 22.x. esbuild version mismatch (0.27.7 resolved instead of
pinned 0.25.12) compounds this.

### Fix
Do not run `pnpm dev` on machines with Node < 22.x. Check:
```bash
node --version   # must be v22.x
```
If wrong: install Node 22.x via `nvm` or `n`:
```bash
nvm install 22 && nvm use 22
```

### Prevention
Add `.nvmrc` to project root:
```
22
```

---

## 9. GPG Secrets Archive — Cross-Machine Decrypt

### The `r3zip-secrets.sh` Script
Encrypts `.env.production` and other secret files into
`~/Stable/secrets/r3v4_secrets_<timestamp>.tar.gz.gpg` using AES-256.

### Decrypt on any machine
```bash
cd ~/Stable
./r3zip-secrets.sh --decrypt
# Prompts for passphrase — min 16 chars
# Restores .env.production and other env files to project root
```

### Cross-machine transfer issue
The archive is created on Kali and lives in `~/Stable/secrets/`.
On Penguin, the `secrets/` directory is empty — the archive was never copied over.
Options:
1. SSH transfer (if SSH available): `scp ~/Stable/secrets/*.gpg penguin:~/Stable/secrets/`
2. Chrome OS Files app drag-and-drop into Linux files
3. Just get the Railway URL from the dashboard directly — fastest

---

## 10. Promo Code System — Deferred

**Do not implement until P3 is complete.**

Implementation notes for when the time comes:
- New `promoCodes` Drizzle table: `code, tier_granted, expires_at, uses_remaining, used_by`
- New migration required (0007 or later)
- tRPC procedure: `subscription.redeemPromo`
- Frontend: code input on pricing/login page
- Admin: `admin.generatePromoCode` — 6-digit, cryptographically random
- Stripe: grant `pro_artist` without charging via `subscriptions.create({ trial_period_days })` or direct DB tier update for pure promo flow
- Read `server/routers/subscription.ts` + `server/db/schema.ts` before writing

Reminder: this was noted for follow-up after P3 completes.

---

## 11. CLAUDE.local.md — Keep Updated

After every session, update `CLAUDE.local.md`:
- Move completed items from Pending Actions to a dated completion note
- Update Last Session Notes with what actually happened
- Add the Railway URL field (without the password) so future sessions know the host

**Never commit CLAUDE.local.md** — it is gitignored by design.

---

## 12. GitHub Authentication — Personal Access Token Required

### Problem
```
remote: Invalid username or token. Password authentication is not supported
fatal: Authentication failed
```

### Root Cause
GitHub deprecated password authentication for git operations in 2021.
HTTPS pushes require a **Personal Access Token (PAT)**, not your GitHub password.

### Fix
1. Go to github.com → Settings → Developer Settings → Personal Access Tokens → Tokens (classic)
2. Generate new token — select `repo` scope (full)
3. Copy the token — it looks like `ghp_xxxxxxxxxxxxxxxxxxxx`
4. When git prompts for password, paste the PAT instead of your password

### Permanent Fix (avoid re-entering every push)
```bash
git remote set-url origin https://YOUR_GITHUB_USERNAME:YOUR_PAT@github.com/Berryboy93/r3v4.git
```

Or use git credential store:
```bash
git config --global credential.helper store
# next push: enter username + PAT once, then it's cached
```

---

## 13. DATABASE_URL — Local vs Railway Override Pattern

### Problem
Both `.env` and `.env.production` point to `localhost:5432/r3vibe` on all machines.
`drizzle.config.ts` reads `process.env.DATABASE_URL` which resolves from `.env`.
Running `pnpm drizzle-kit migrate` without overriding hits the local DB, not Railway.

### Rule
**Never trust the `.env` DATABASE_URL for Railway operations.**
Always explicitly override:

```bash
# Correct — hits Railway
DATABASE_URL="postgresql://postgres:PASSWORD@ballast.proxy.rlwy.net:25291/railway" \
  pnpm drizzle-kit migrate

# Wrong — hits localhost (silent success, wrong database)
pnpm drizzle-kit migrate
```

### Verify which DB you just hit
After any migration, always run the column-count verification query (see Skill 5).
If it fails with `ECONNREFUSED` — you hit localhost and postgres isn't running.
If it returns columns — you hit the right database.

### For local dev connecting to Railway
When no local PostgreSQL is available (Termux, Penguin), update `.env` directly:
```bash
sed -i 's|DATABASE_URL=.*|DATABASE_URL=postgresql://postgres:PASSWORD@ballast.proxy.rlwy.net:25291/railway|' .env
```
Type the real password in the terminal — never in chat.

---

## 14. pnpm Lockfile — Version Drift on Fresh Clones

### Problem
Fresh `pnpm install` on Penguin resolved `esbuild@0.27.7` instead of the pinned
`esbuild@0.25.12`, causing `TransformError` on startup. The project pinned 0.25.12
in `devDependencies` but pnpm resolved a different version on a machine with no
existing `node_modules`.

### Root Cause
`pnpm-lock.yaml` must be committed and must match the working tree.
On Penguin, the lock file may have been from a different state.

### Fix
Always install with the lockfile enforced:
```bash
pnpm install --frozen-lockfile
```
This fails loudly if `pnpm-lock.yaml` is out of sync rather than silently
resolving different versions.

### Prevention
- Always commit `pnpm-lock.yaml`
- Never run bare `pnpm install` on secondary machines — use `--frozen-lockfile`
- Check esbuild version after install on any non-Kali machine:
  ```bash
  ls node_modules/.pnpm/ | grep esbuild
  # expect: esbuild@0.25.12
  ```

---

## 15. Git Push — Interrupted Transfer Recovery

### Problem
User hit Ctrl+C during a large `git push` (1.6GB object transfer).
The push was mid-flight. It was unclear whether it succeeded or failed.

### Behavior
Git push is **idempotent and safe to re-run**. If interrupted:
- Objects already transferred are cached by the remote
- Re-running `git push` resumes or confirms the state
- If remote already has the commit: `Everything up to date`
- If remote does not: transfer resumes from where it left off

### Fix
```bash
git push
# Or if force was involved:
git push --force-with-lease
```

### Note
The 1.6GB push failing was not due to the Ctrl+C — it was due to the 100MB
large file limit (GH001). The Ctrl+C was a separate event that caused confusion.

---

## 16. Admin Login — Verification Pattern

### Three-step admin credential check
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

Common failure causes:
- `isAdmin` column missing from `users` table in production DB (schema drift)
- Admin user was created in local DB but not Railway production
- JWT secret differs between environments

---

## 17. r3zip-secrets.sh — Archive Not on Current Machine

### Problem
`./r3zip-secrets.sh --decrypt` fails with:
```
✗  No encrypted archives found in /home/v4/Stable/secrets
```

### Root Cause
The `.gpg` archive was created on Kali (`~/Stable/secrets/`) and never transferred
to the current machine. The script hardcodes `PROJECT_ROOT/secrets/` as the
search location.

### Fix Applied
Added `--archive=PATH` flag to the script so any `.gpg` file can be decrypted
regardless of location:
```bash
./r3zip-secrets.sh --archive=/path/to/r3v4_secrets_20260410_011139_tar_gz.gpg --decrypt
```

### Transfer methods (fastest to slowest)
1. **Railway dashboard** — just get the DB URL directly. Fastest by far.
2. **Chrome OS Files app** — drag `.gpg` from Downloads into Linux files → `~/Stable/secrets/`
3. **SCP** (if SSH enabled on penguin):
   ```bash
   scp ~/Stable/secrets/*.gpg v4@penguin:~/Stable/secrets/
   ```
4. **Git** (not recommended — secrets should never be in git)

### Key insight
For Railway operations specifically, decrypting the archive is almost never the
fastest path. Opening railway.app in a browser and copying the DB URL takes
30 seconds. Use that first.

---

## 18. PRD Version Verification — Triple-Check Process

### Pattern
When updating a PRD or technical document, stale claims accumulate across
tables, prose paragraphs, changelogs, and glossaries. A single pass misses them.

### Three-Pass Process
**Pass 1 — Targeted search for known wrong values:**
```bash
grep -n "OLD_VALUE\|stale_string\|wrong_count" file.js
```

**Pass 2 — Cross-reference all numerical claims:**
- Count items manually and compare to stated counts
- Verify math (e.g. $4.8M / $120K ARR = 40×, not 4×)
- Check version numbers against pinned stack

**Pass 3 — Context sweep:**
- Search every instance of key terms across ALL sections
- Changelog, glossary, and prose paragraphs hold stale copies longest
- Section cross-references (e.g. "Per PRD §22") must match actual section numbers

### Errors caught in this session (10 total across 3 passes)
| Error | Where hidden |
|---|---|
| Three.js `0.182.0` → `0.128.0` | Stack table |
| Router count `10` → `11` | Cover + prose + changelog (4 instances) |
| `any` violations `13` → `5` | Hygiene table + hard guards section |
| Valuation `4–8×` → `40–80×` ARR | Valuation table |
| `trackId` missing from column list | Schema table |
| Node `20.x` → `22.x` | Stack table |

**Rule:** The changelog and glossary are always last to be checked — which is
exactly where stale values hide longest.

---

## 19. DAW.tsx — Unterminated JSX (StatusBar Component)

### Symptom
```
Pre-transform error: DAW.tsx: Unterminated JSX contents. (1866:7)
  1865 |       </div>
> 1866 |     </>
```

### Root Cause
Separate from the transport bar fix. `StatusBar` component inside `DAW.tsx`
has a stray `</>` with no matching opening `<>`. Returns a closing fragment
that was never opened.

### Diagnosis
```bash
sed -n '1840,1870p' ~/Stable/client/src/pages/DAW.tsx
grep -n "StatusBar\|const StatusBar" ~/Stable/client/src/pages/DAW.tsx
```

### Fix Pattern
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

### Note
This appeared after a git pull from Termux changes. Always run
`pnpm tsc --noEmit` immediately after pulling to catch JSX errors.

---

## 20. Railway CLI — exec format error (Architecture Mismatch)

### Symptom
```
zsh: exec format error: railway
```

### Root Cause
Railway CLI binary compiled for wrong CPU architecture (x86_64 vs ARM).
Common on Chromebook Linux containers and some Kali VMs.

### Fix — Skip CLI entirely
Use explicit `DATABASE_URL` prefix instead of `railway run`:
```bash
# Instead of: railway run pnpm drizzle-kit migrate
DATABASE_URL="postgresql://postgres:PASSWORD@ballast.proxy.rlwy.net:PORT/railway" \
  pnpm drizzle-kit migrate
```

This covers all Railway DB operations without needing the CLI binary.

### If CLI is required
```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
npm install -g @railway/cli
railway --version
# If still exec format error — binary is wrong arch, use DATABASE_URL= approach
```

---

## 21. gitsafe-backup Remote on Penguin

### Observation
Penguin (`~/R3v4`) has two git remotes:
```
gitsafe-backup  git://gitsafe:5418/backup.git
origin          https://github.com/Berryboy93/r3v4.git
```

### Rules
- Always push to `origin` explicitly — not `gitsafe-backup`
- `git push` without a remote name defaults to `origin` ✅
- Do not delete `gitsafe-backup` — part of automated backup strategy
- If push fails unexpectedly on Penguin:
  ```bash
  git remote -v          # verify remotes
  git push origin main   # explicit remote to avoid ambiguity
  ```

---

## 22. Ctrl+C During Long Operations — State Recovery

### Rule
Any operation interrupted by Ctrl+C should be assumed **incomplete**.
Check state explicitly before continuing.

**git push interrupted:**
```bash
git log --oneline -3   # confirm local commit exists
git push               # re-run — idempotent, safe
```

**tar extraction interrupted:**
```bash
ls -la ~/r3v4_extracted/   # check if complete
# If partial: rm -rf ~/r3v4_extracted && re-extract
```

**pnpm install interrupted:**
```bash
rm -rf node_modules && pnpm install --frozen-lockfile
```

### Note from session
The Ctrl+C during the 1.6GB push created confusion — the push failure was
actually due to GH001 (large file), not the interruption. The Ctrl+C was a
separate event. Check `git log` and `git status` to separate these concerns.

---

*This file is a living document. Add entries whenever a new pattern surfaces
more than once, or whenever a non-obvious failure mode is encountered.*
*Format: Problem → Root Cause → Fix → Prevention*
