/**
 * Mutation Tracer Unit Tests
 * Test framework: Vitest
 * 
 * Coverage:
 * - Environment guard (dev mode activation)
 * - Mutation recording and baseline detection
 * - Safe/forbidden field filtering
 * - Timeline circular buffer (max 500)
 * - Replay API
 * - Error handling (no crashes)
 * 
 * @module client/src/debug/__tests__/mutation-tracer.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  setupMutationTracer,
  recordMutationFromMiddleware,
} from '../mutation-tracer.debug';

// ─────────────────────────────────────────────────────────────────────────
// SETUP
// ─────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Clear window.__mutationTracer between tests
  if ((window as any).__mutationTracer) {
    (window as any).__mutationTracer.clear();
  }
});

// ─────────────────────────────────────────────────────────────────────────
// ENVIRONMENT GUARD TESTS
// ─────────────────────────────────────────────────────────────────────────

describe('Environment Guard', () => {
  it('should initialize tracer in dev mode (__DEV__ = true)', () => {
    // In test environment, __DEV__ is typically true
    setupMutationTracer();
    expect((window as any).__mutationTracer).toBeDefined();
    expect(typeof (window as any).__mutationTracer.replay).toBe('function');
  });

  it('should expose public API on window.__mutationTracer', () => {
    setupMutationTracer();
    const tracer = (window as any).__mutationTracer;

    expect(tracer.replay).toBeDefined();
    expect(tracer.export).toBeDefined();
    expect(tracer.clear).toBeDefined();
    expect(tracer.getState).toBeDefined();
    expect(tracer.setRecording).toBeDefined();
    expect(tracer.setMaxMutations).toBeDefined();
  });

  it('should not initialize twice', () => {
    setupMutationTracer();
    const first = (window as any).__mutationTracer;

    setupMutationTracer();
    const second = (window as any).__mutationTracer;

    expect(first).toBe(second);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// BASELINE AND MUTATION DETECTION TESTS
// ─────────────────────────────────────────────────────────────────────────

describe('Baseline and Mutation Detection', () => {
  beforeEach(() => {
    setupMutationTracer();
  });

  it('should establish baseline on first mutation for a field', () => {
    recordMutationFromMiddleware('tier', undefined, 'pro');

    const state = (window as any).__mutationTracer.getState();
    expect(state.timeline.baselineValues['tier']).toBe(undefined);
  });

  it('should record mutation when value deviates from baseline', () => {
    // First record: baseline = 'free'
    recordMutationFromMiddleware('tier', 'free', 'free');

    // Second record: deviation from baseline
    recordMutationFromMiddleware('tier', 'free', 'pro');

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBe(1);
    expect(mutations[0].field).toBe('tier');
    expect(mutations[0].newValue).toBe('pro');
    expect(mutations[0].baseline).toBe('free');
  });

  it('should not record mutation when value same as baseline', () => {
    // Establish baseline
    recordMutationFromMiddleware('tier', 'free', 'free');

    // Record same value again (no deviation)
    recordMutationFromMiddleware('tier', 'free', 'free');

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBe(0);
  });

  it('should generate deviation description', () => {
    recordMutationFromMiddleware('tier', 'free', 'pro');

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations[0].deviation).toBeDefined();
    expect(mutations[0].deviation).toContain('tier');
  });

  it('should handle deep object mutations', () => {
    const oldUser = { id: '1', name: 'Alice' };
    const newUser = { id: '1', name: 'Bob' };

    recordMutationFromMiddleware('user', oldUser, newUser);

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBe(1);
    expect(mutations[0].newValue).toEqual(newUser);
  });

  it('should treat null and undefined as different from objects', () => {
    recordMutationFromMiddleware('token', null, 'abc123');

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBe(1);
    expect(mutations[0].oldValue).toBeNull();
    expect(mutations[0].newValue).toBe('abc123');
  });
});

// ─────────────────────────────────────────────────────────────────────────
// SAFE/FORBIDDEN FIELD FILTERING TESTS
// ─────────────────────────────────────────────────────────────────────────

describe('Safe/Forbidden Field Filtering', () => {
  beforeEach(() => {
    setupMutationTracer();
  });

  it('should record mutations on SAFE_FIELDS', () => {
    const safeFields = ['token', 'tier', 'projectId', 'userId'];

    for (const field of safeFields) {
      recordMutationFromMiddleware(field, 'old', 'new');
    }

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBe(safeFields.length);
  });

  it('should NOT record mutations on FORBIDDEN_FIELDS', () => {
    const forbiddenFields = ['activeTrack', 'systemPrompt', 'apiKey', 'password'];

    for (const field of forbiddenFields) {
      recordMutationFromMiddleware(field, 'old', 'new');
    }

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBe(0); // None should be recorded
  });

  it('should NOT record mutations on unknown fields (whitelist model)', () => {
    recordMutationFromMiddleware('unknownField', 'old', 'new');
    recordMutationFromMiddleware('randomProp', 'old', 'new');

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBe(0); // Default: forbid unknown fields
  });

  it('should allow safe fields even if they look sensitive', () => {
    // 'userId' is safe (explicit whitelist)
    recordMutationFromMiddleware('userId', 'user1', 'user2');

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBe(1);
  });

  it('should forbid apiKey even if it sounds safe', () => {
    // 'apiKey' is forbidden (explicit blacklist)
    recordMutationFromMiddleware('apiKey', 'key1', 'key2');

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// TIMELINE MANAGEMENT TESTS
// ─────────────────────────────────────────────────────────────────────────

describe('Timeline Management', () => {
  beforeEach(() => {
    setupMutationTracer();
  });

  it('should enforce max 500 mutations (circular buffer)', () => {
    // Record 550 mutations
    for (let i = 0; i < 550; i++) {
      recordMutationFromMiddleware('token', `old${i}`, `new${i}`);
    }

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBeLessThanOrEqual(500);
  });

  it('should evict oldest mutations when buffer full (FIFO)', () => {
    // Set max to 10 for easy testing
    (window as any).__mutationTracer.setMaxMutations(10);

    // Record 15 mutations
    for (let i = 0; i < 15; i++) {
      recordMutationFromMiddleware('tier', `old${i}`, `new${i}`);
    }

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBe(10);

    // First mutation should be gone (FIFO eviction)
    expect(mutations[0].newValue).not.toBe('new0');
    // Last mutations should be present
    expect(mutations[mutations.length - 1].newValue).toBe('new14');
  });

  it('should track mutation count correctly', () => {
    for (let i = 0; i < 5; i++) {
      recordMutationFromMiddleware('token', 'old', `new${i}`);
    }

    const state = (window as any).__mutationTracer.getState();
    expect(state.timeline.mutationCount).toBe(5);
  });

  it('should generate unique mutation IDs', () => {
    for (let i = 0; i < 3; i++) {
      recordMutationFromMiddleware('token', 'old', `new${i}`);
    }

    const mutations = (window as any).__mutationTracer.replay();
    const ids = mutations.map((m: any) => m.id);
    const uniqueIds = new Set(ids);

    expect(uniqueIds.size).toBe(mutations.length);
  });

  it('should record timestamp for each mutation', () => {
    const before = Date.now();
    recordMutationFromMiddleware('token', 'old', 'new');
    const after = Date.now();

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations[0].timestamp).toBeGreaterThanOrEqual(before);
    expect(mutations[0].timestamp).toBeLessThanOrEqual(after);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// REPLAY API TESTS
// ─────────────────────────────────────────────────────────────────────────

describe('Replay API', () => {
  beforeEach(() => {
    setupMutationTracer();
  });

  it('should return empty array when no mutations', () => {
    const mutations = (window as any).__mutationTracer.replay();
    expect(Array.isArray(mutations)).toBe(true);
    expect(mutations.length).toBe(0);
  });

  it('should return copy of mutations (not reference)', () => {
    recordMutationFromMiddleware('token', 'old', 'new');

    const mutations1 = (window as any).__mutationTracer.replay();
    const mutations2 = (window as any).__mutationTracer.replay();

    expect(mutations1).not.toBe(mutations2); // Different array references
    expect(mutations1).toEqual(mutations2); // Same content
  });

  it('should export full timeline', () => {
    recordMutationFromMiddleware('token', 'old', 'new');

    const timeline = (window as any).__mutationTracer.export();
    expect(timeline.mutations).toBeDefined();
    expect(timeline.baselineValues).toBeDefined();
    expect(timeline.mutationCount).toBe(1);
  });

  it('should clear mutations and reset baseline', () => {
    recordMutationFromMiddleware('token', 'old', 'new');
    expect((window as any).__mutationTracer.replay().length).toBe(1);

    (window as any).__mutationTracer.clear();
    expect((window as any).__mutationTracer.replay().length).toBe(0);

    const state = (window as any).__mutationTracer.getState();
    expect(Object.keys(state.timeline.baselineValues).length).toBe(0);
  });

  it('should pause and resume recording', () => {
    recordMutationFromMiddleware('token', 'old', 'new1');
    expect((window as any).__mutationTracer.replay().length).toBe(1);

    (window as any).__mutationTracer.setRecording(false);
    recordMutationFromMiddleware('token', 'new1', 'new2');
    expect((window as any).__mutationTracer.replay().length).toBe(1); // No new mutations

    (window as any).__mutationTracer.setRecording(true);
    recordMutationFromMiddleware('token', 'new1', 'new3');
    expect((window as any).__mutationTracer.replay().length).toBe(2); // Recording resumed
  });
});

// ─────────────────────────────────────────────────────────────────────────
// ERROR HANDLING TESTS
// ─────────────────────────────────────────────────────────────────────────

describe('Error Handling', () => {
  beforeEach(() => {
    setupMutationTracer();
  });

  it('should not crash on circular object reference', () => {
    const obj: any = { name: 'test' };
    obj.self = obj; // Circular reference

    expect(() => {
      recordMutationFromMiddleware('field', {}, obj);
    }).not.toThrow();
  });

  it('should not crash on very large payloads', () => {
    const largeString = 'x'.repeat(1000000); // 1MB string

    expect(() => {
      recordMutationFromMiddleware('field', 'old', largeString);
    }).not.toThrow();
  });

  it('should handle null/undefined gracefully', () => {
    expect(() => {
      recordMutationFromMiddleware('field', null, undefined);
      recordMutationFromMiddleware('field', undefined, null);
    }).not.toThrow();
  });

  it('should not crash on symbols or functions', () => {
    const sym = Symbol('test');
    const fn = () => {};

    expect(() => {
      recordMutationFromMiddleware('field', sym, fn);
    }).not.toThrow();
  });

  it('should continue working after an error', () => {
    // Record something that might error
    recordMutationFromMiddleware('field', {}, { bad: Symbol('error') });

    // Should still work
    recordMutationFromMiddleware('token', 'old', 'new');
    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// INTEGRATION TESTS
// ─────────────────────────────────────────────────────────────────────────

describe('Integration', () => {
  beforeEach(() => {
    setupMutationTracer();
  });

  it('should track multiple mutations across different fields', () => {
    recordMutationFromMiddleware('token', 'old1', 'new1');
    recordMutationFromMiddleware('tier', 'free', 'pro');
    recordMutationFromMiddleware('projectId', '1', '2');

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBe(3);
    expect(mutations.map((m: any) => m.field)).toEqual(['token', 'tier', 'projectId']);
  });

  it('should detect real-world scenario: user upgrade', () => {
    // Simulate user tier upgrade flow
    recordMutationFromMiddleware('tier', 'free', 'free'); // Initial (baseline)
    recordMutationFromMiddleware('tier', 'free', 'pro'); // Upgrade
    recordMutationFromMiddleware('tier', 'pro', 'pro'); // Re-confirm (no mutation)
    recordMutationFromMiddleware('tier', 'pro', 'enterprise'); // Further upgrade

    const mutations = (window as any).__mutationTracer.replay();
    expect(mutations.length).toBe(2); // Only deviations
    expect(mutations[0].newValue).toBe('pro');
    expect(mutations[1].newValue).toBe('enterprise');
  });

  it('should provide complete audit trail', () => {
    recordMutationFromMiddleware('token', 'tok1', 'tok1');
    recordMutationFromMiddleware('token', 'tok1', 'tok2');

    const mutation = (window as any).__mutationTracer.replay()[0];

    expect(mutation).toHaveProperty('id');
    expect(mutation).toHaveProperty('timestamp');
    expect(mutation).toHaveProperty('field');
    expect(mutation).toHaveProperty('oldValue');
    expect(mutation).toHaveProperty('newValue');
    expect(mutation).toHaveProperty('baseline');
    expect(mutation).toHaveProperty('deviation');
    expect(mutation).toHaveProperty('source');
  });
});
