import { test, expect, type Page } from '@playwright/test';

const E2E_USER = {
  id: 'e2e-user',
  email: 'e2e@example.com',
  username: 'e2e_user',
  tier: 'pro_artist' as const,
  isAdmin: false,
};

// Seeds the keys authStore reads and answers /api/auth/me locally,
// so the protected route renders without a running API.
async function signIn(page: Page) {
  await page.addInitScript(({ user }) => {
    localStorage.setItem('r3_token', 'e2e-token');
    localStorage.setItem('r3_user', JSON.stringify(user));
  }, { user: E2E_USER });
  await page.route('**/api/auth/me', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ user: E2E_USER }) }),
  );
}

const pageErrors: string[] = [];

test.beforeEach(async ({ page }) => {
  pageErrors.length = 0;
  page.on('pageerror', e => pageErrors.push(e.message));
  await signIn(page);
  await page.goto('/loopstation');
  await expect(page).toHaveURL(/\/loopstation/);
  await expect(page.getByTestId('quantize-instant')).toBeVisible();
});

test('quantise offers all six options', async ({ page }) => {
  for (const q of ['instant', '1/4', '1/2', '1m', '2m', 'free']) {
    await expect(page.getByTestId(`quantize-${q}`)).toBeVisible();
  }
});

test('clip grid renders its rows', async ({ page }) => {
  await expect(page.locator('[data-test^="clip-row-"]').first()).toBeVisible();
});

test('scene bank has 16 slots', async ({ page }) => {
  await expect(page.getByTestId('scene-bank').locator('> *')).toHaveCount(16);
});

test('hardware REC is disabled until capture exists', async ({ page }) => {
  const rec = page.locator('button', { has: page.getByText('REC', { exact: true }) }).first();
  await expect(rec).toBeDisabled();
});

test('no uncaught page errors on mount', async ({ page }) => {
  await page.waitForTimeout(1500);
  expect(pageErrors).toEqual([]);
});
