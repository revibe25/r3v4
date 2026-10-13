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
  // The grid mounts only in the CLIPS view (view === 'clips'). Select it as a user would.
  await page.getByRole('button', { name: /CLIPS/ }).click();
  // CLIP_ROWS = 8; checking the first and last row confirms the whole grid rendered
  await expect(page.getByTestId('clip-row-1')).toBeVisible();
  await expect(page.getByTestId('clip-row-8')).toBeVisible();
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
  // Errors from the missing API (tRPC requests that fail with an empty body) are expected
  // in UI tests. Anything else is an app bug and should fail the test.
  // Only the two known API responses are expected in UI tests:
  //  - the API unreachable (empty body)            -> 'Unexpected end of JSON input'
  //  - the API up, no session (server/trpc.ts:108) -> 'You must be logged in...'
  const EXPECTED_API_ERRORS = [
    'Unexpected end of JSON input',
    'You must be logged in to access this resource.',
  ];
  const appErrors = pageErrors.filter(m => !EXPECTED_API_ERRORS.some(e => m.includes(e)));
  expect(appErrors).toEqual([]);
});
