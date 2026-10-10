/**
 * auth.setup.ts — Playwright global setup: authenticate once, persist storageState.
 *
 * Runs before every test project that declares `dependencies: ['setup']`.
 * Auth state is reused across all worker processes — login happens exactly once
 * per test run. The .auth/user.json file is gitignored; regenerated on each run.
 *
 * Required environment variables (set in .env.test, never committed):
 *   TEST_EMAIL     — test account email address
 *   TEST_PASSWORD  — test account password
 *
 * Output: tests/e2e/.auth/user.json
 *
 * CLAUDE.md Hard Guard #7:
 *   Post-login redirect target is /instrument — NEVER /daw.
 *   This fixture asserts the URL after login; if the target drifts,
 *   the entire test suite fails fast here rather than with confusing
 *   "element not found" errors downstream.
 */
import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const AUTH_FILE = path.join(__dirname, '../.auth/user.json');
setup('authenticate', async ({ page }) => {
  const email    = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      [
        '',
        'Missing test credentials.',
        'Copy .env.test.example → .env.test and fill in TEST_EMAIL + TEST_PASSWORD.',
        'Use a dedicated test account, not your dev credentials.',
        '',
      ].join('\n')
    );
  }
  await page.goto('/auth');
  // Wait for the auth form to be interactive before filling
  await page.waitForSelector('[data-test=email]', { timeout: 10_000 });
  await page.fill('[data-test=email]',    email);
  await page.fill('[data-test=password]', password);
  await page.click('[data-test=submit]');
  // ── Hard Guard #7 ────────────────────────────────────────────────────────
  // Post-login redirect MUST land on /instrument.
  // If this assertion fails: audit AuthPage redirect logic and ProtectedRoute.
  // "Check redirect targets — /daw is always wrong" (AgentMeshPanel.tsx)
  await page.waitForURL('**/instrument', { timeout: 15_000 });
  await expect(
    page,
    'Hard Guard #7 violation: post-login redirect landed somewhere other than /instrument. ' +
    'Check AuthPage.tsx Wouter redirect and ProtectedRoute.tsx.'
  ).toHaveURL(/\/instrument/);
  // Persist session cookies + localStorage to disk; shared across all workers
  await page.context().storageState({ path: AUTH_FILE });
});
