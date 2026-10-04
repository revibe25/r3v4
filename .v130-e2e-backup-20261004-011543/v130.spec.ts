import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

async function registerE2EUser(request: APIRequestContext): Promise<string> {
  const email = `r3-v130-e2e-${Date.now()}@example.test`;
  const password = 'R3v130-E2E!2026';

  const response = await request.post('/api/auth/register', {
    data: { email, password },
  });

  expect(response.ok()).toBeTruthy();

  const body = (await response.json()) as {
    token?: string;
  };

  expect(body.token).toBeTruthy();

  return body.token as string;
}

async function openAuthenticatedV130(
  page: Page,
  request: APIRequestContext,
): Promise<void> {
  const token = await registerE2EUser(request);

  await page.addInitScript(({ authToken }) => {
    localStorage.setItem('r3_token', authToken);
  }, { authToken: token });

  await page.goto('/multitrack', {
    waitUntil: 'domcontentloaded',
  });

  await expect(
    page.locator('[data-v130-root="true"]'),
  ).toBeAttached();
}

test.describe('R3 NATIVE Multitrack v1.3.0', () => {
  test('unauthenticated access is redirected to auth', async ({ page }) => {
    await page.goto('/multitrack', {
      waitUntil: 'domcontentloaded',
    });

    await expect(page).toHaveURL(/\/auth(?:\.html)?$/);
  });

  test('authenticated V130 shell exposes core controls and transport', async ({
    page,
    request,
  }) => {
    await openAuthenticatedV130(page, request);

    await expect(
      page.locator('[data-v130-root="true"]'),
    ).toHaveAttribute(
      'aria-label',
      'R3 NATIVE Multitrack v1.3.0',
    );

    for (const selector of [
      '#bStop',
      '#bPlay',
      '#bRec',
      '#bpm',
      '#tbLoop',
      '#tbSnap',
      '#tbMet',
      '#cvS',
      '#cvO',
      '#cvA',
      '#cvM',
      '#pMode',
      '#pQ',
      '#pSw',
      '#oDn',
      '#oLab',
      '#oUp',
      '#tkAud',
      '#dspTgt',
      '#sL',
      '#sT',
      '#sR',
      '#sP',
      '#sW',
      '#sG',
      '#mOut',
    ]) {
      await expect(page.locator(selector)).toHaveCount(1);
    }

    const bpm = page.locator('#bpm');
    await expect(bpm).toHaveValue('128.00');

    await bpm.fill('132');
    await bpm.press('Tab');
    await expect(bpm).toHaveValue(/132/);

    const play = page.locator('#bPlay');
    await expect(play).toHaveAttribute('aria-pressed', 'false');

    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#bStop').click();
    await expect(play).toHaveAttribute('aria-pressed', 'false');
  });
});
