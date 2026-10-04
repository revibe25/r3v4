import { randomUUID } from 'node:crypto';
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';

async function registerE2EUser(request: APIRequestContext): Promise<string> {
  const id = randomUUID().replaceAll('-', '');
  const email = `r3-v130-e2e-${id}@example.test`;
  const username = `r3v130e2e${id.slice(0, 20)}`;
  const password = 'R3v130-E2E!2026';

  const response = await request.post('/api/auth/register', {
    data: { email, username, password },
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
  test.describe.configure({ mode: 'serial' });
  test('unauthenticated access requests auth.html', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('r3_token');
      localStorage.removeItem('r3_user');
    });

    const authDocument = page.waitForRequest(
      (request) =>
        request.resourceType() === 'document' &&
        /\/auth\.html(?:\?|$)/.test(request.url()),
    );

    await page.goto('/multitrack', {
      waitUntil: 'domcontentloaded',
    });

    await authDocument;
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

    const engine = page.locator('#engBtn');
    const engineText = page.locator('#engTxt');

    await expect(engineText).toHaveText('Offline');

    await engine.click();
    await expect(engineText).toHaveText('Running', {
      timeout: 10000,
    });

    const play = page.locator('#bPlay');
    await expect(play).toHaveAttribute('aria-pressed', 'false');

    await play.click();
    await expect(play).toHaveAttribute('aria-pressed', 'true', {
      timeout: 10000,
    });

    await page.locator('#bStop').click();
    await expect(play).toHaveAttribute('aria-pressed', 'false');
  });
  test('V130 Record lifecycle toggles transport recording state', async ({
    page,
    request,
  }) => {
    await openAuthenticatedV130(page, request);

    const engine = page.locator('#engBtn');
    const engineText = page.locator('#engTxt');
    const record = page.locator('#bRec');

    await expect(engineText).toHaveText('Offline');
    await expect(record).toHaveAttribute('aria-pressed', 'false');

    await engine.click();
    await expect(engineText).toHaveText('Running', {
      timeout: 10000,
    });

    await record.click();
    await expect(record).toHaveAttribute('aria-pressed', 'true', {
      timeout: 10000,
    });

    await record.click();
    await expect(record).toHaveAttribute('aria-pressed', 'false', {
      timeout: 10000,
    });

    await page.locator('#bStop').click();
  });

  test('V130 deterministic controls update UI state', async ({
    page,
    request,
  }) => {
    await openAuthenticatedV130(page, request);

    const root = page.locator('[data-v130-root="true"]');

    // Transport-adjacent toggles.
    const loop = page.locator('#tbLoop');
    const snap = page.locator('#tbSnap');

    await expect(loop).toHaveAttribute('aria-pressed', 'false');
    await loop.click();
    await expect(loop).toHaveAttribute('aria-pressed', 'true');
    await loop.click();
    await expect(loop).toHaveAttribute('aria-pressed', 'false');

    await expect(snap).toHaveAttribute('aria-pressed', 'true');
    await snap.click();
    await expect(snap).toHaveAttribute('aria-pressed', 'false');

    await snap.dispatchEvent('click');
    await expect(snap).toHaveAttribute('aria-pressed', 'true');

    // Pad mode / quantize state is mirrored onto the V130 root.
    const padMode = page.locator('#pMode');
    const padQuant = page.locator('#pQ');

    await expect(padMode).toHaveValue('drum');
    await expect(root).toHaveAttribute('data-v130-pad-mode', 'drum');

    await padMode.selectOption('note');
    await expect(root).toHaveAttribute('data-v130-pad-mode', 'note');

    await expect(padQuant).toHaveValue('1');
    await padQuant.selectOption('2');
    await expect(root).toHaveAttribute('data-v130-pad-quant', '2');

    // Swing input is clamped/mirrored and updates its output.
    const swing = page.locator('#pSw');
    const swingOutput = page.locator('#pSwO');

    await expect(swing).toHaveValue('0');

    await swing.evaluate((el) => {
      const input = el as HTMLInputElement;
      input.value = '30';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });

    await expect(root).toHaveAttribute('data-v130-pad-swing', '30');
    await expect(swingOutput).toHaveText('30%');

    // Octave controls update the visible octave label.
    const octave = page.locator('#oLab');
    const octaveUp = page.locator('#oUp');
    const octaveDown = page.locator('#oDn');

    await expect(octave).toHaveText('C3');

    await octaveUp.click();
    await expect(octave).toHaveText('C4');

    await octaveDown.click();
    await expect(octave).toHaveText('C3');

    // Bank selection exposes a single pressed bank.
    const banks = page.locator('#banks button');

    await expect(banks).toHaveCount(4);
    await expect(banks.nth(0)).toHaveAttribute('aria-pressed', 'true');
    await expect(banks.nth(1)).toHaveAttribute('aria-pressed', 'false');

    await banks.nth(1).click();

    await expect(banks.nth(0)).toHaveAttribute('aria-pressed', 'false');
    await expect(banks.nth(1)).toHaveAttribute('aria-pressed', 'true');
  });

});
