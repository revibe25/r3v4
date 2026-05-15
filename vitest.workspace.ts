import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      name: 'llpte',
      include: [
        'packages/*/tests/**/*.test.ts',
        'packages/*/src/**/*.test.ts',
        'packages/*/src/**/__tests__/**/*.test.ts',
      ],
      environment: 'node',
      globals: true,
      pool: 'forks',
      poolOptions: {
        forks: { singleFork: true },
      },
      testTimeout: 10000,
    },
  },
]);
