import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/llpte-*/tests/**/*.test.ts',
      'packages/llpte-*/src/**/*.test.ts',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'packages/llpte-adapters/**',
      'tests/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      lines: 70,
      functions: 70,
      statements: 70,
      branches: 65,
    },
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
      '@r3vibe/shared': path.resolve(__dirname, './shared'),
      '@llpte/llpte-core': path.resolve(__dirname, './packages/llpte-core/src'),
      '@llpte/llpte-signal': path.resolve(__dirname, './packages/llpte-signal/src'),
      '@llpte/llpte-ai': path.resolve(__dirname, './packages/llpte-ai/src'),
      '@llpte/llpte-execution': path.resolve(__dirname, './packages/llpte-execution/src'),
      '@llpte/llpte-transition-graph': path.resolve(__dirname, './packages/llpte-transition-graph/src'),
    },
  },
});
