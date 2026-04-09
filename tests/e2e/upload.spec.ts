import { test, expect } from '@playwright/test';

test('upload and play audio', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('[data-test=file-input]', 'tests/e2e/fixtures/sample.wav');
  await page.click('[data-test=play-button]');
  await expect(page.locator('[data-test=waveform]')).toBeVisible();
});
