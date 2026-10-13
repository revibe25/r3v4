import { test, expect, type Page } from '@playwright/test';

// A real test account in the disposable r3_e2e database. Registration is
// idempotent: 409 means the account already exists, so we just log in.
const E2E = { username: 'e2e_loopstation', email: 'e2e-loopstation@example.com', password: process.env.E2E_PASSWORD ?? 'e2e-test-password-123' };
const API = process.env.E2E_API_URL ?? 'http://localhost:3000';

// Signs in through the real API and seeds the same keys authStore reads.
async function signIn(page: Page) {
  const reg = await page.request.post(`${API}/api/auth/register`, {
    data: { email: E2E.email, username: E2E.username, password: E2E.password },
  });
  if (reg.status() !== 201 && reg.status() !== 409) {
    throw new Error(`register failed: ${reg.status()} ${await reg.text()}`);
  }
  const login = await page.request.post(`${API}/api/auth/login`, {
    data: { credential: E2E.username, password: E2E.password },
  });
  if (!login.ok()) throw new Error(`login failed: ${login.status()} ${await login.text()}`);
  const { token, user } = await login.json();
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('r3_token', token);
    localStorage.setItem('r3_user', JSON.stringify(user));
  }, { token, user });
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
