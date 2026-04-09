import { test, expect } from '@playwright/test';

test('audio playback starts quickly', async ({ page }) => {
  await page.goto('/');
  const start = Date.now();
  await page.click('[data-test=play-button]');
  await page.waitForSelector('[data-test=playing-indicator]');
  const elapsed = Date.now() - start;
  console.log(`Playback start latency: ${elapsed}ms`);
  expect(elapsed).toBeLessThan(1000);
});
