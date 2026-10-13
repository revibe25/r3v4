import { defineConfig } from '@playwright/test';

// Phase 0: instrument-page tests. Only tests/e2e/instrument is run here; the legacy
// tests/e2e specs are not used by this config.
export default defineConfig({
  testDir: 'tests/e2e/instrument',
  outputDir: 'playwright-output',  // kept out of the tracked test-results/ folder
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    // Optional override for machines where the matching browser cannot be downloaded:
    // PW_CHROMIUM=/path/to/chrome-headless-shell pnpm exec playwright test
    launchOptions: {
      args: ['--no-sandbox'],
      executablePath: process.env.PW_CHROMIUM || undefined,
    },
  },
  webServer: {
    command: 'pnpm --filter @r3vibe/client dev --port 5173 --strictPort',
    url: 'http://localhost:5173/instrument',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
