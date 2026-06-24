/**
 * vitest.config.ts — workspace root
 *
 * Coverage thresholds enforce quality on the packages that matter most:
 * the llpte-* pipeline engine and server services. UI components are excluded
 * (they're hard to test in isolation and low-risk to change).
 *
 * Run:
 *   pnpm vitest run --coverage          # all packages
 *   pnpm vitest run --coverage --watch  # watch mode
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'packages/*/tests/**/*.test.ts',
      'packages/*/src/**/*.test.ts', 'apps/*/src/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        branches:   70,
        functions:  75,
        lines:      75,
        statements: 75,
      },
      include: [
        'packages/llpte-core/src/**',
        'packages/llpte-execution/src/**',
        'packages/llpte-signal/src/**',
        'packages/llpte-transition-graph/src/**',
        'packages/llpte-adapters/src/**',
        'packages/llpte-ai/src/**',
      ],
      exclude: [
        '**/*.types.ts',
        '**/*.d.ts',
        '**/dist/**',
        '**/node_modules/**',
        '**/benchmarks/**',
        '**/src/**/index.ts',
      ],
    },
  },
});
