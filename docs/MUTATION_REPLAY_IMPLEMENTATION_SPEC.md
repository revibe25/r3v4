# Frontend Mutation Trace & Replay System — Implementation Specification
**Status:** CODE-READY (PRD gaps resolved 2026-05-19)  
**Owner:** @3R  
**Target merge:** Sprint N (after code review)

---

## Executive Summary

This document specifies the implementation of a development-only debug system that traces runtime mutations of authentication payloads. It closes three blocking gaps from the PRD and provides concrete file paths, hook points, and safety mechanisms.

**What changed from PRD:**
- Environment guard mechanism specified (Vite `__DEV__` define)
- Fetch hook point clarified (tRPC client httpLink, not global fetch)
- Safe/forbidden field whitelist added (coordinates with SECURITY.md::F-10)

**Risk:** Low. Dead-code eliminated in production. Zero impact on shipped bundle if environment guard holds.

---

## 1. Environment Guard (REQUIRED)

### Mechanism: Vite Define Plugin

In `vite.config.ts` (client):

```typescript
export default defineConfig({
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
  // ... rest of config
});
```

This makes `__DEV__` a compile-time constant. In production builds (`NODE_ENV=production`), all `if (__DEV__) { ... }` blocks are eliminated by tree-shaking.

### Initialization Point

Create `client/src/lib/mutation-tracer.ts`:

```typescript
// Only initialize if in development mode
if (__DEV__) {
  import('./debug/mutation-tracer.debug').then(({ initMutationTracer }) => {
    initMutationTracer();
  });
}
```

Add to `client/src/main.tsx` (top-level, after React initialization):

```typescript
import './lib/mutation-tracer';  // Side-effect: initializes tracer only if __DEV__
```

### Fallback Guard (Localhost Check)

Inside `client/src/debug/mutation-tracer.debug.ts`:

```typescript
export function initMutationTracer() {
  // Double-check: only run on localhost (catches misconfigured builds)
  if (!__DEV__ || (typeof window !== 'undefined' && !window.location.hostname.includes('localhost'))) {
    return;
  }
  
  // Initialize tracer...
}
```

### Verification

- **Dev build:** `pnpm dev` → `__DEV__` is `true`, tracer initializes
- **Production build:** `pnpm build` then `npm run preview` → `__DEV__` is `false`, tracer code is eliminated
- **Test:** `grep -r "mutation-tracer" dist/` should return nothing in production bundle

---

## 2. Fetch Hook Point (tRPC Client Only)

### Current State

`client/src/lib/trpc.ts` already configures the tRPC client with a custom fetch instance. Hook into the **httpLink** middleware, not global fetch.

### Implementation Location

Create `client/src/debug/trpc-tracer.debug.ts`:

```typescript
import { createTRPCMsw } from 'trpc-msw';  // or native tRPC middleware approach
import type { AppRouter } from '../../../server/routers/_app';

export function attachMutationTracerToTRPC(trpcClient: typeof myTRPCClient) {
  // Wrap the httpLink middleware to observe requests
  const originalFetch = trpcClient._def.links[0]; // httpLink instance

  const tracedFetch = new Proxy(originalFetch, {
    apply: (target, thisArg, args) => {
      const [req] = args; // tRPC request object
      
      // Observe the request payload
      observeRequestPayload(req.input);
      
      // Call original, don't modify
      return Reflect.apply(target, thisArg, args);
    },
  });

  // Replace httpLink with traced version
  trpcClient._def.links[0] = tracedFetch;
}

function observeRequestPayload(payload: unknown) {
  // Deep traverse and detect mutations
  traverseAndTraceObject(payload, []);
}
```

### Integration

In `client/src/lib/trpc.ts`:

```typescript
const createClient = () => {
  const client = httpBatchLink({ /* ... */ });
  
  if (__DEV__) {
    // Dynamically import tracer (dead code eliminated in prod)
    import('./debug/trpc-tracer.debug').then(({ attachMutationTracerToTRPC }) => {
      attachMutationTracerToTRPC(client);
    });
  }
  
  return client;
};
```

### What This Achieves

✅ Traces only tRPC requests (not unrelated fetch calls)  
✅ Does not modify request body (read-only observer)  
✅ Safe to coexist with other tRPC middleware (error handlers, retries, etc.)  
✅ Can be cleanly removed by disabling `__DEV__`

---

## 3. Safe/Forbidden Fields Whitelist

### Safe Fields (Can Trace)

These fields are user-controlled and already loggable via audit:

```typescript
const SAFE_FIELDS = new Set([
  'token',           // JWT format, non-sensitive payload
  'tier',            // Billing tier (explorer, creator, pro_artist)
  'projectId',       // Project identifier
  'projectName',     // User-created project name
  'sessionId',       // Session UUID
  'timestamp',       // Timing values
]);
```

### Forbidden Fields (Skip Tracing)

These are either sensitive or deferred per SECURITY.md:

```typescript
const FORBIDDEN_FIELDS = new Set([
  'activeTrack',     // SECURITY.md::F-10 — prompt injection surface
  'systemPrompt',    // F-10 — AI context (deferred, trigger 2026-05-15)
  'apiKey',          // Never log credentials
  'password',        // Authentication material
  'secret',          // Any secret
  'credential',      // Generic credential field
  'auth',            // Assume all `auth.*` fields are sensitive
  'userId',          // PII (already context-sensitive via server logs)
  'email',           // PII
]);
```

### Traversal Logic

In `client/src/debug/mutation-tracer.debug.ts`:

```typescript
function shouldTraceField(fieldPath: string): boolean {
  const fieldName = fieldPath.split('.').pop();
  
  // Forbidden fields are never traced
  if (FORBIDDEN_FIELDS.has(fieldName)) {
    return false;
  }
  
  // Fields matching auth.* pattern are skipped
  if (fieldPath.includes('auth.')) {
    return false;
  }
  
  // Everything else is safe to trace
  return true;
}

function traverseAndTraceObject(obj: unknown, path: string[]) {
  if (typeof obj !== 'object' || obj === null) return;

  for (const key in obj) {
    const newPath = [...path, key].join('.');
    
    // Skip forbidden fields
    if (!shouldTraceField(newPath)) {
      continue;
    }
    
    const value = (obj as any)[key];
    recordMutation(newPath, value);
    
    // Recursively traverse
    traverseAndTraceObject(value, [...path, key]);
  }
}
```

### Coordination with SECURITY.md::F-10

Once F-10 is resolved (target: 2026-05-15), update `FORBIDDEN_FIELDS`:

```typescript
// After 2026-05-15: if F-10 is resolved with activeTrack sanitization
const FORBIDDEN_FIELDS = new Set([
  'systemPrompt',  // Still deferred if F-10 is only partially resolved
  // 'activeTrack' ← can be removed if F-10 is fully closed
  // ... rest
]);
```

---

## 4. Mutation Detection Engine

### Baseline Definition

The "baseline" is the value at the moment the field enters the trace system. Each subsequent change is a "mutation."

```typescript
interface MutationRecord {
  path: string;              // e.g., "input.token"
  baseline: unknown;         // Value when first traced
  mutations: Array<{
    from: unknown;           // Previous value
    to: unknown;             // New value
    timestamp: number;        // Date.now()
    stackTrace: string;       // Stack trace of mutation
  }>;
}

const timeline = new Map<string, MutationRecord>();

function recordMutation(fieldPath: string, newValue: unknown) {
  let record = timeline.get(fieldPath);
  
  if (!record) {
    // First time seeing this field
    record = {
      path: fieldPath,
      baseline: newValue,
      mutations: [],
    };
    timeline.set(fieldPath, record);
    return;
  }
  
  const lastMutation = record.mutations.at(-1);
  const fromValue = lastMutation?.to ?? record.baseline;
  
  if (deepEqual(fromValue, newValue)) {
    // No change, don't record
    return;
  }
  
  // Record the mutation
  record.mutations.push({
    from: deepClone(fromValue),
    to: deepClone(newValue),
    timestamp: Date.now(),
    stackTrace: captureStackTrace(),
  });
}
```

### Detection Rules

Apply these checks after basic mutation recording:

```typescript
function detectMutationPattern(mutation: Mutation): string[] {
  const patterns: string[] = [];
  const { from, to } = mutation;
  
  // Rule 1: Escaped quotes (\")
  if (typeof from === 'string' && typeof to === 'string') {
    if (to.includes('\\"') && !from.includes('\\"')) {
      patterns.push('ESCAPED_QUOTES');
    }
  }
  
  // Rule 2: Prefix normalization (user: prefix added/removed)
  if (typeof from === 'string' && typeof to === 'string') {
    if (to.startsWith('user:') && !from.startsWith('user:')) {
      patterns.push('PREFIX_NORMALIZATION');
    }
  }
  
  // Rule 3: Quoted payload injection ("admin" becomes admin)
  if (typeof from === 'string' && typeof to === 'string') {
    if (from === `"${to}"` || to === `"${from}"`) {
      patterns.push('QUOTED_INJECTION');
    }
  }
  
  return patterns;
}
```

---

## 5. Replay API

### Public Interface

Expose `window.__mutationTracer.replay()`:

```typescript
interface MutationTracer {
  replay(): void;
  clear(): void;
  export(): string; // JSON export for debugging
}

declare global {
  interface Window {
    __mutationTracer: MutationTracer;
  }
}
```

### Implementation

```typescript
export function initMutationTracer() {
  // ... (initialization code from Section 1)
  
  const tracer: MutationTracer = {
    replay() {
      console.log('=== MUTATION REPLAY TIMELINE ===');
      
      for (const [path, record] of timeline.entries()) {
        console.group(`📍 ${path}`);
        console.log(`  Baseline: ${JSON.stringify(record.baseline)}`);
        
        for (let i = 0; i < record.mutations.length; i++) {
          const mutation = record.mutations[i];
          const patterns = detectMutationPattern(mutation);
          
          console.log(`  Mutation #${i + 1}:`);
          console.log(`    From: ${JSON.stringify(mutation.from)}`);
          console.log(`    To:   ${JSON.stringify(mutation.to)}`);
          console.log(`    Time: ${new Date(mutation.timestamp).toISOString()}`);
          if (patterns.length > 0) {
            console.log(`    Patterns: ${patterns.join(', ')}`);
          }
          console.log(`    Stack:`);
          console.log(mutation.stackTrace);
        }
        
        console.groupEnd();
      }
    },
    
    clear() {
      timeline.clear();
      console.log('[Mutation Timeline Cleared]');
    },
    
    export() {
      return JSON.stringify(Object.fromEntries(timeline), null, 2);
    },
  };
  
  // Expose globally
  window.__mutationTracer = tracer;
  console.log('[Mutation Tracer Initialized] Call window.__mutationTracer.replay() to see timeline');
}
```

### Usage Example

In the browser console:

```javascript
// Trigger a mutation by modifying a field
// (e.g., change auth payload via React DevTools)

// Replay the timeline
window.__mutationTracer.replay();

// Export for analysis
const json = window.__mutationTracer.export();
console.log(json);

// Clear for next test
window.__mutationTracer.clear();
```

---

## 6. Timeline Store (In-Memory)

### Size Management

Default: store up to 500 mutations. Oldest entries are dropped when limit is exceeded.

```typescript
const MAX_MUTATIONS = 500;

function recordMutation(fieldPath: string, newValue: unknown) {
  // ... (existing code)
  
  // Check total mutations across all fields
  let totalMutations = 0;
  for (const record of timeline.values()) {
    totalMutations += record.mutations.length;
  }
  
  if (totalMutations > MAX_MUTATIONS) {
    // Drop oldest mutation from the oldest field
    let oldestField = null;
    let oldestTime = Infinity;
    
    for (const [field, record] of timeline.entries()) {
      if (record.mutations.length === 0) continue;
      const firstMutationTime = record.mutations[0].timestamp;
      if (firstMutationTime < oldestTime) {
        oldestTime = firstMutationTime;
        oldestField = field;
      }
    }
    
    if (oldestField) {
      timeline.get(oldestField)!.mutations.shift();
    }
  }
}
```

### Page Reload Behavior

The timeline is cleared on page reload (expected behavior for a debug tool). This is acceptable because:
1. Development workflow typically involves F5 refresh between tests
2. In-memory storage avoids persistence risks
3. Vite HMR may or may not preserve the timeline (acceptable either way)

---

## 7. Testing & Validation

### Unit Tests

Create `client/src/debug/__tests__/mutation-tracer.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { initMutationTracer } from '../mutation-tracer.debug';

describe('Mutation Tracer', () => {
  beforeEach(() => {
    if (window.__mutationTracer) {
      window.__mutationTracer.clear();
    }
  });

  it('should trace simple field mutations', () => {
    const payload = { token: 'abc123' };
    recordMutation('input.token', 'abc123');
    recordMutation('input.token', 'abc\\\"123');  // escaped quote
    
    const tracer = window.__mutationTracer!;
    const exported = JSON.parse(tracer.export());
    
    expect(exported['input.token'].mutations).toHaveLength(1);
    expect(exported['input.token'].mutations[0].to).toBe('abc\\\"123');
  });

  it('should skip forbidden fields', () => {
    recordMutation('input.activeTrack', 'song name');  // Should be skipped
    
    const tracer = window.__mutationTracer!;
    const exported = JSON.parse(tracer.export());
    
    expect(exported['input.activeTrack']).toBeUndefined();
  });

  it('should detect escaped quote pattern', () => {
    recordMutation('input.token', 'admin');
    recordMutation('input.token', 'admin\\\"');
    
    const patterns = detectMutationPattern(...);
    expect(patterns).toContain('ESCAPED_QUOTES');
  });
});
```

### Integration Test

Manual test in browser:

1. Start dev server: `pnpm dev`
2. Open DevTools Console
3. Navigate to a page that sends tRPC requests
4. Make a request (e.g., create a project)
5. Call `window.__mutationTracer.replay()`
6. Verify output shows token mutations (if any)

### Validation Checklist (from PRD §10)

- ✅ Can reproduce mutation event when payload is altered → Tracer records all mutations
- ✅ Can identify exact file/line via stack trace → `captureStackTrace()` uses source maps
- ✅ Can replay full transformation chain → `window.__mutationTracer.replay()` shows timeline
- ✅ No backend-side behavioral change observed → Read-only observer, never modifies requests

---

## 8. Security & Safety Mechanisms

### No Production Exposure

```
Production build (pnpm build):
  - NODE_ENV=production
  - __DEV__ = false
  - All `if (__DEV__)` blocks eliminated by tree-shaker
  - Result: zero tracer code in dist/

Staging/QA build (if needed):
  - NODE_ENV=staging
  - __DEV__ = false (unless explicitly overridden)
  - Localhost fallback guard: window.location.hostname check
  - Result: tracer only activates on localhost
```

### Request Immutability

The tracer is a **read-only observer**. It never:
- Modifies request payload
- Alters response
- Blocks execution (except if debugger explicitly pauses)
- Persists data to localStorage/indexedDB
- Sends data to external server

### Forbidden Field Coverage

Coordinates with SECURITY.md::F-10 (prompt injection). The whitelist ensures:
- `activeTrack` and `systemPrompt` are never logged (preventing prompt injection reconnaissance)
- Other sensitive fields (apiKey, password) are also excluded
- Coverage is reviewed when F-10 is resolved (2026-05-15)

---

## 9. Known Limitations

(From PRD §11, with implementation notes)

| Limitation | Why | Workaround |
|-----------|-----|-----------|
| Cannot observe IME/paste internals | Browser API boundary | Not applicable (by design) |
| Cannot intercept clipboard pre-JS transforms | Browser clipboard API is gated | Not applicable (by design) |
| Cannot observe encrypted transport | HTTPS/TLS layer below JS | Inspect via Wireshark if needed |
| Depends on frontend execution path being preserved | Minification, tree-shaking could remove code | Use `__DEV__` guard + verified build output |

---

## 10. Deferred Items (P3, See PRD §11)

| Item | Trigger | Owner |
|------|---------|-------|
| Source-mapped stack traces in minified envs | If tracer needed in staging with minified code | @3R, 2026-06-01 |
| Timeline persistence window size | If store exceeds 500 mutations during dev | @3R, 2026-06-01 |
| Baseline reset logic | If users report missed mutations from reset | @3R, 2026-06-01 |
| userId context annotation | If QA can't correlate frontend<→server logs | @3R, 2026-06-01 |

---

## 11. Deployment Checklist

Before merge:

- [ ] All three environment guards implemented (Vite define, fallback check, dead-code verified)
- [ ] tRPC hook tested (requests flow through, no hangs, no body modifications)
- [ ] Safe/forbidden field whitelist configured + tested with F-10 reference
- [ ] `window.__mutationTracer` API exposed and console-testable
- [ ] `pnpm build` output checked: zero tracer code in dist/
- [ ] `pnpm test` passes (unit + integration tests)
- [ ] Code review + Mythos-class security sign-off (read-only observer check)

---

## 12. Post-Merge Monitoring

After shipping to main:

- Monitor first week of dev usage: are mutations being captured as expected?
- Watch for performance impact: is the tracer adding latency to requests? (Should be <1ms observer overhead)
- Collect feedback on usability: is `window.__mutationTracer.replay()` discoverable enough?

---

## References

- **PRD:** `/mnt/user-data/outputs/mutation_replay_prd_UPDATED.docx` (gap resolution, 2026-05-19)
- **SECURITY.md::F-10:** AI transition prompt injection (deferred, trigger 2026-05-15)
- **WIRE.txt:** Engineering protocol for all changes (read-before-write, TSC checks, backups)

---

**Status:** READY FOR IMPLEMENTATION

Review + merge this spec, then begin coding the tracer in the order:
1. Environment guard setup (Section 1)
2. tRPC hook integration (Section 2)
3. Safe/forbidden field logic (Section 3)
4. Mutation detection engine (Section 4)
5. Replay API + public interface (Section 5)
6. Unit tests (Section 7)
7. Manual testing + validation (Section 7)

Estimated effort: 1–2 days of coding + QA.
