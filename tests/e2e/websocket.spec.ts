import { test, expect } from '@playwright/test';

test('WebSocket session sync', async ({ browser }) => {
  const contextA = await browser.newContext();
  const pageA = await contextA.newPage();
  await pageA.goto('/');
  await pageA.click('[data-test=start-session]');

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await pageB.goto('/');
  await pageB.click('[data-test=join-session]');

  await pageA.waitForSelector('[data-test=session-active]');
  await pageB.waitForSelector('[data-test=session-active]');
  expect(await pageB.locator('[data-test=waveform]').isVisible()).toBeTruthy();
});
