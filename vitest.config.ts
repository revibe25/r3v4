import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@llpte/llpte-core': path.resolve(__dirname, './packages/llpte-core/src'),
      '@llpte/llpte-signal': path.resolve(__dirname, './packages/llpte-signal/src'),
      '@llpte/llpte-ai': path.resolve(__dirname, './packages/llpte-ai/src'),
      '@llpte/llpte-adapters': path.resolve(__dirname, './packages/llpte-adapters/src'),
      '@llpte/llpte-execution': path.resolve(__dirname, './packages/llpte-execution/src'),
      '@llpte/llpte-transition-graph': path.resolve(__dirname, './packages/llpte-transition-graph/src'),
      '@r3vibe/shared': path.resolve(__dirname, './shared'),
    },
  },
  test: {
    include: [
      'packages/*/tests/**/*.test.ts',
      'packages/*/src/**/*.test.ts',
      'apps/*/src/**/*.test.ts',
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
      ],
      exclude: [
        'packages/*/src/**/*.test.ts',
        'node_modules/**',
      ],
    },
  },
});
