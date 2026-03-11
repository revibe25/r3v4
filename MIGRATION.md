# R3 v4 — Architecture Migration Checklist

All 5 steps from the migration guide are implemented in this repo.
Follow this checklist when applying to your existing project.

---

## Step 1 · pnpm + Turborepo ✅

Files created/updated:
- `pnpm-workspace.yaml` — workspace roots
- `package.json` (root) — turbo scripts, no npm scripts
- `turbo.json` — build/dev/test/lint pipeline with caching
- `tsconfig.json` (root) — base TypeScript config all packages extend
- `Dockerfile` — replaced `npm ci` with `pnpm install --frozen-lockfile`
- `.dockerignore` — excludes `**/node_modules`, `.turbo`, `dist`

**Run after applying:**
```bash
# Remove old lockfiles
rm -rf node_modules client/node_modules server/node_modules
rm -f package-lock.json client/package-lock.json server/package-lock.json

npm install -g pnpm
pnpm install

# Checkpoint
pnpm run build
```

---

## Step 2 · Zustand Only (Redux removed) ✅

Files created:
- `client/src/stores/mixerStore.ts` — mixer + deck state with `subscribeWithSelector`
- `client/src/stores/effectsStore.ts` — effects chain state
- `client/src/stores/index.ts` — barrel + migration cheatsheet

**Remove Redux packages:**
```bash
pnpm remove react-redux @reduxjs/toolkit redux redux-thunk --filter @r3/client
pnpm list react-redux  # should show nothing
```

**Migration pattern:**
```ts
// BEFORE (Redux)
const bpm = useSelector((s) => s.mixer.bpm)
const dispatch = useDispatch()
dispatch(setBpm(130))

// AFTER (Zustand)
const bpm = useMixerStore((s) => s.bpm)
const setBpm = useMixerStore((s) => s.setBpm)
setBpm(130)
```

**Audio engine subscription outside React:**
```ts
useMixerStore.subscribe(
  state => state.bpm,
  bpm => audioEngine.setBpm(bpm)
)
```

---

## Step 3 · Root Cleanup ✅

Delete these on your machine (they are NOT in this repo since they're temp files):
```bash
rm -rf temp/ _dev/ _arch_snapshots/
rm -f fix-nested-buttons.js fix-tailwind.sh
rm -f llpte_commands.sh llpte_restructure_v2.sh ls505_enhance.py
rm -f client/client_setup.sh client/client_setup_v2_backup.sh
```

**Config consolidation:**
```bash
# Compare before deleting
diff config/tailwind.config.ts client/tailwind.config.ts
diff config/tsconfig.json client/tsconfig.json

# client/tsconfig.json now extends root (already done in this repo)
```

**Keep:** `docker-compose.yml`, `Dockerfile`, `drizzle.config.ts`, `README.md`

---

## Step 4 · Python AI Mix Sidecar ✅

Files created:
- `services/ai-mix/src/app.py` — FastAPI wrapper with typed request/response
- `services/ai-mix/requirements.txt`
- `services/ai-mix/Dockerfile` — python:3.12-slim with healthcheck
- `docker-compose.yml` — updated with `ai-mix` service + health dependency
- `server/services/aiMixClient.ts` — typed Node.js HTTP client

**Move existing Python files:**
```bash
mkdir -p services/ai-mix/src
mv server/ai_mix.py services/ai-mix/src/
mv server/main.py services/ai-mix/src/
```

**Replace `child_process.spawn` calls:**
```ts
// BEFORE
const result = await new Promise((res) => {
  const proc = spawn('python', ['server/ai_mix.py', trackA, trackB])
  // ...
})

// AFTER
import { analyzeMix } from './services/aiMixClient'
const result = await analyzeMix({ trackAId, trackBId, crossfadePosition })
```

**Checkpoint:**
```bash
docker compose up
curl localhost:8001/health  # → {"status":"ok"}
curl localhost:8001/docs    # OpenAPI UI
```

---

## Step 5 · llpte-* Package Audit ✅

Files created per package:
- `packages/llpte-signal/` — full: types, core impl, public index, vitest tests
- `packages/llpte-transition-graph/` — full: types, graph API, serialize/deserialize, vitest tests
- `packages/llpte-{core,ai,adapters,execution}/` — stubbed with correct package.json exports map
- `eslint.config.js` (root) — `no-restricted-imports` blocks `@llpte/*/src/*`

**Add vitest to remaining packages as you audit them:**
```bash
pnpm add -D vitest @vitest/coverage-v8 --filter @llpte/core
pnpm add -D vitest @vitest/coverage-v8 --filter @llpte/ai
```

**Checkpoint:**
```bash
pnpm test --filter @llpte/signal
pnpm test --filter @llpte/transition-graph
pnpm build
```

---

## Final Validation

| # | Check | Command |
|---|-------|---------|
| 1 | Single pnpm-lock.yaml at root | `ls **/pnpm-lock.yaml` |
| 2 | pnpm build succeeds from root | `pnpm build` |
| 3 | No react-redux in dep tree | `pnpm list react-redux` |
| 4 | temp/, _dev/ deleted | `ls temp/ _dev/` |
| 5 | docker compose starts both services | `docker compose up` |
| 6 | AI Mix health endpoint responds | `curl localhost:8001/health` |
| 7 | All llpte-* have index.ts exports | `cat packages/*/src/index.ts` |
| 8 | Core IP packages pass tests | `pnpm test --filter @llpte/*` |
