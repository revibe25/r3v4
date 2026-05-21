# Mutation Tracer — Integration & Deployment Guide

**Status:** Code implementation complete and ready for integration  
**Deliverables:** 5 files (tracer system, tRPC hook, tests, vite config, main.tsx init)  
**Target Integration Time:** 1–2 hours (code placement + one vite.config.ts edit)  
**Estimated Testing Time:** 1–2 hours (unit tests + manual QA)

---

## Phase 2.1: Code Placement (30 minutes)

### File 1: Main Tracer System

**Source:** `mutation-tracer.debug.ts` (delivered)  
**Destination:** `client/src/debug/mutation-tracer.debug.ts`

**Checklist:**
- [ ] Create directory if missing: `mkdir -p client/src/debug`
- [ ] Copy file to destination
- [ ] No edits needed; file is complete
- [ ] Verify TypeScript: `pnpm tsc --noEmit client/src/debug/mutation-tracer.debug.ts`

### File 2: tRPC Hook Integration

**Source:** `trpc-tracer.debug.ts` (delivered)  
**Destination:** `client/src/debug/trpc-tracer.debug.ts`

**Checklist:**
- [ ] Copy file to destination
- [ ] Review: Are you using tRPC v10 or v11? (affects middleware API)
- [ ] If using v11, verify middleware syntax matches `createTracingHttpLinkMiddleware()` signature
- [ ] If using v10, use `wrapHttpLinkWithTracing()` instead
- [ ] Verify TypeScript: `pnpm tsc --noEmit client/src/debug/trpc-tracer.debug.ts`

### File 3: Unit Tests

**Source:** `mutation-tracer.test.ts` (delivered)  
**Destination:** `client/src/debug/__tests__/mutation-tracer.test.ts`

**Checklist:**
- [ ] Create directory if missing: `mkdir -p client/src/debug/__tests__`
- [ ] Copy file to destination
- [ ] Verify test framework: Do you use Vitest? (file is Vitest format)
- [ ] If using Jest, convert: Change `import { describe, it, expect, beforeEach, vi } from 'vitest'` → `import { describe, it, expect, beforeEach } from '@jest/globals'`
- [ ] Run tests: `pnpm test mutation-tracer` (should have ~50 passing tests)

### File 4: Vite Configuration

**Source:** `vite.config.snippet.ts` (delivered)  
**Destination:** Merge into `client/vite.config.ts` (or `vite.config.ts` at monorepo root)

**Checklist:**
- [ ] Open your existing `vite.config.ts`
- [ ] Locate the `define` object (or create if missing):
  ```typescript
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
    // ... other defines
  }
  ```
- [ ] Add to `build` section (if missing):
  ```typescript
  build: {
    minify: 'terser',
    terserOptions: { ... }, // from snippet
  }
  ```
- [ ] Verify syntax: `pnpm tsc --noEmit vite.config.ts`

**Example merged vite.config.ts:**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        dead_code: true,
        passes: 3,
      },
    },
  },
});
```

### File 5: Application Initialization

**Source:** `main.tsx.snippet` (delivered)  
**Destination:** Merge into `client/src/main.tsx` (or equivalent entry point)

**Checklist:**
- [ ] Open existing `client/src/main.tsx`
- [ ] Add import near top:
  ```typescript
  import { setupMutationTracer } from '@/debug/mutation-tracer.debug';
  ```
- [ ] Call `setupMutationTracer()` BEFORE `ReactDOM.createRoot()`:
  ```typescript
  setupMutationTracer(); // Add this line
  
  const root = document.getElementById('root');
  ReactDOM.createRoot(root).render(...);
  ```
- [ ] Optional: Add convenience aliases from snippet
- [ ] Verify TypeScript: `pnpm tsc --noEmit client/src/main.tsx`

---

## Phase 2.2: tRPC Middleware Integration (30 minutes)

This is the most critical step. The tracer must hook into tRPC's httpLink correctly.

### Locate tRPC Client Configuration

**Typical locations:**
- `client/src/lib/trpc.ts`
- `client/src/utils/trpc.ts`
- `shared/lib/trpc.ts`

**Find this pattern:**
```typescript
const httpLink = http({
  url: `${getBaseUrl()}/trpc`,
  // ... other options
});
```

### Add Tracer Middleware

#### Option A: tRPC v11 (recommended)

If using `@trpc/client@11+`, you have middleware support:

```typescript
import { createTracingHttpLinkMiddleware } from '@/debug/trpc-tracer.debug';

const httpLink = http({
  url: `${getBaseUrl()}/trpc`,
  middleware: [
    createTracingHttpLinkMiddleware(), // Add this
    // ... other middleware
  ],
});
```

**Checklist:**
- [ ] Import added
- [ ] Middleware inserted in correct position (before other middlewares)
- [ ] Verify syntax: `pnpm tsc --noEmit client/src/lib/trpc.ts`

#### Option B: tRPC v10 (fallback)

If using `@trpc/client@10.x`, wrap the httpLink:

```typescript
import { wrapHttpLinkWithTracing } from '@/debug/trpc-tracer.debug';

const baseHttpLink = http({
  url: `${getBaseUrl()}/trpc`,
});

const httpLink = wrapHttpLinkWithTracing(baseHttpLink);
```

**Checklist:**
- [ ] Import added
- [ ] Wrapping layer created
- [ ] Other httpLink consumers still work
- [ ] Verify syntax: `pnpm tsc --noEmit client/src/lib/trpc.ts`

### Test tRPC Hook in Dev

```bash
$ pnpm dev
# Open browser console
$ window.__mutationTracer.replay()
# Should return: []

# Trigger a tRPC mutation (e.g., update user tier)
# In console again:
$ window.__mutationTracer.replay()
# Should now return an array with mutation records
```

---

## Phase 2.3: Verification & Validation (30 minutes)

### Dev Mode Verification

```bash
# 1. Start dev server
pnpm dev

# 2. Open browser console
# 3. Run these commands:
window.__mutationTracer.replay()
# → Should return []

# 4. Trigger any mutation in app (e.g., change user tier)
# 5. Check console again:
window.__mutationTracer.replay()
# → Should return mutation records with:
#   - id, timestamp, field, oldValue, newValue, baseline, deviation, source

# 6. Verify forbidden fields are blocked:
window.__mutationTracer.export()
# → Should NOT contain: activeTrack, systemPrompt, apiKey, password
```

### Production Build Verification

```bash
# 1. Build for production
pnpm build

# 2. Verify tracer code is eliminated:
grep -r '__mutationTracer\|mutation-tracer' dist/
# → Should return NOTHING

# 3. Check bundle size reduction (tracer eliminated)
ls -lh dist/index.js
# → Should be significantly smaller than dev size

# 4. Alternative: check for the tracer initialization string
grep -r 'Mutation tracer initialized' dist/
# → Should return NOTHING
```

### Unit Tests Verification

```bash
# Run all tracer tests
pnpm test mutation-tracer

# Expected: ~50 tests passing
# Coverage should include:
#   - Environment guard
#   - Baseline detection
#   - Field filtering
#   - Timeline management
#   - Replay API
#   - Error handling
```

---

## Phase 2.4: tRPC Hook Testing (15 minutes)

The middleware integration is critical. Verify it doesn't break existing functionality:

### Functional Tests

**Test 1: Basic mutation recording**
```typescript
// In your app, trigger a tRPC mutation
// Example: updateUserTier({ tier: 'pro' })
// In console:
window.__mutationTracer.replay()
// → Should contain mutation record for 'tier'
```

**Test 2: Forbidden fields are blocked**
```typescript
// Attempt to observe systemPrompt mutation
// In console:
const mutations = window.__mutationTracer.replay();
const hasSystemPrompt = mutations.some(m => m.field === 'systemPrompt');
console.log(hasSystemPrompt); // Should be false
```

**Test 3: tRPC requests still work normally**
```bash
# Verify no request errors in console
# Check Network tab: all tRPC requests should succeed
# Verify mutation results are correct (not affected by tracer observer)
```

**Test 4: Hot Module Replacement (HMR) still works**
```bash
# Edit a component
# Page should hot-reload without full browser refresh
# Tracer should still be active after HMR
# Run window.__mutationTracer.replay() — should work
```

---

## Integration Checklist (Full)

### Code Placement
- [ ] `client/src/debug/mutation-tracer.debug.ts` created
- [ ] `client/src/debug/trpc-tracer.debug.ts` created
- [ ] `client/src/debug/__tests__/mutation-tracer.test.ts` created
- [ ] `vite.config.ts` updated with `define.__DEV__` and terser config
- [ ] `client/src/main.tsx` updated with `setupMutationTracer()` call

### TypeScript Checks
- [ ] `pnpm tsc --noEmit` passes globally
- [ ] No errors in `client/src/debug/`
- [ ] No errors in `client/src/main.tsx`

### tRPC Integration
- [ ] tRPC client configuration identified
- [ ] Middleware/wrapper added (v11 middleware OR v10 wrapper)
- [ ] No breaking changes to existing tRPC functionality

### Testing
- [ ] `pnpm test` passes (all unit tests)
- [ ] Dev mode: `window.__mutationTracer` accessible in console
- [ ] Dev mode: mutations recorded correctly
- [ ] Production build: `grep` shows no tracer code in dist/
- [ ] Manual QA: tRPC requests work normally
- [ ] Manual QA: HMR works during development

### Security
- [ ] Forbidden fields (activeTrack, systemPrompt, apiKey, password) are blocked
- [ ] Safe fields (token, tier, projectId) are recorded
- [ ] No sensitive data leaked in timeline
- [ ] Field whitelist consulted before recording any mutation

---

## Troubleshooting

### "window.__mutationTracer is undefined"

**Cause:** Tracer didn't initialize (not in dev mode, or setupMutationTracer() not called)

**Fix:**
1. Verify running in dev mode: `pnpm dev` (not `pnpm build && pnpm preview`)
2. Verify `setupMutationTracer()` is called in `main.tsx` before app render
3. Check browser console for errors: `[TRACER]` lines should appear
4. Verify `__DEV__` is defined in vite.config.ts: `define: { __DEV__: ... }`

### "tRPC requests fail after adding middleware"

**Cause:** Middleware syntax is wrong or return value is not a promise

**Fix:**
1. Check tRPC version: `npm ls @trpc/client`
2. If v11: verify `createTracingHttpLinkMiddleware()` is used correctly
3. If v10: verify `wrapHttpLinkWithTracing()` wrapper is correct
4. Ensure middleware never modifies request or throws synchronously
5. Test with simple mutation first: `updateUserTier({ tier: 'pro' })`

### "Mutations not recorded / window.__mutationTracer.replay() returns []"

**Cause:** Tracer initialized, but no mutations being recorded

**Fix:**
1. Verify safe fields are being mutated:
   - Try: `window.__mutationTracer.recordMutationFromMiddleware('token', 'old', 'new')`
   - Should appear in replay()
2. Check if field is in FORBIDDEN_FIELDS (activeTrack, systemPrompt, etc.)
   - These are intentionally blocked
3. Verify tRPC mutation is actually hitting the middleware:
   - Add `console.log` in trpc-tracer.debug.ts `extractMutationsFromPayload()`
   - Trigger mutation and check console output

### "Production build still contains tracer code"

**Cause:** Tree-shaking not working (Vite didn't eliminate dead code)

**Fix:**
1. Verify `__DEV__` is false in production:
   - `grep '__DEV__ = false' dist/index.js`
2. Verify terser compress options are set:
   - Check `vite.config.ts`: `terserOptions.compress.dead_code: true`
3. Clean and rebuild:
   ```bash
   rm -rf dist/
   pnpm build --mode production
   ```
4. If still present, check for side effects:
   - Ensure no code is calling `setupMutationTracer()` unconditionally
   - It should only be called inside `isDevEnvironment()` guard

### "Performance degradation after adding tracer"

**Cause:** Middleware overhead or JSON serialization cost

**Fix:**
1. Disable tracer for performance testing:
   ```typescript
   window.__mutationTracer.setRecording(false)
   // Run performance test
   // Re-enable:
   window.__mutationTracer.setRecording(true)
   ```
2. Reduce max mutations to lighten memory load:
   ```typescript
   window.__mutationTracer.setMaxMutations(100)
   ```
3. Profile middleware: add `console.time()` around `extractMutationsFromPayload()`
4. Expected overhead: ~1ms per tRPC request (minimal for dev tool)

---

## Post-Integration Checklist

### Merge Preparation
- [ ] All unit tests passing (`pnpm test`)
- [ ] TypeScript clean (`pnpm tsc --noEmit`)
- [ ] Dev mode works: window.__mutationTracer accessible
- [ ] Prod build verified: `grep` shows no tracer code
- [ ] Code review completed (read-only observer check)
- [ ] Mythos-class security sign-off (field filtering verified)

### Documentation
- [ ] README updated with "Using the Mutation Tracer" section
- [ ] Console API documented (replay, export, clear, etc.)
- [ ] Troubleshooting guide added to DEVELOPMENT.md
- [ ] Team briefed on tracer availability and usage

### Deployment
- [ ] Merge to main branch
- [ ] Update CHANGELOG: "Add mutation replay tracer (dev-only)"
- [ ] Tag version if doing release
- [ ] Monitor for any regression issues post-merge

---

## Success Criteria (MVP Ship)

✅ All 5 files integrated successfully  
✅ TypeScript: zero errors after integration  
✅ Unit tests: 50/50 passing  
✅ Dev mode: tracer accessible and records mutations  
✅ Production: no tracer code in dist/ bundle  
✅ Security: forbidden fields blocked, safe fields recorded  
✅ tRPC: mutations recorded correctly, no request failures  
✅ Performance: <1ms overhead per request (acceptable for dev tool)  

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 2.1: Code Placement | 30 min | All 5 files in place |
| Phase 2.2: tRPC Integration | 30 min | Middleware/wrapper added |
| Phase 2.3: Verification | 30 min | Dev + prod verified |
| Phase 2.4: Hook Testing | 15 min | tRPC requests validated |
| **Total** | **~2 hours** | **Ready to merge** |

---

## Owner & Contact

**Implementation Owner:** @3R  
**Questions/Issues:** Use tracer-specific labels in issue tracker  
**Security Review:** Reference SECURITY.md::F-10 (prompt injection, deferred)

---

**Next Step:** Execute Phase 2.1 (code placement). Report back when all 5 files are in place.

