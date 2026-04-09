import { test, expect } from '@playwright/test';

test('user can play and stop audio', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test=play-button]');
  await expect(page.locator('[data-test=playing-indicator]')).toBeVisible();
  await page.click('[data-test=stop-button]');
  await expect(page.locator('[data-test=playing-indicator]')).toHaveCount(0);
});

test('volume control works', async ({ page }) => {
  await page.goto('/');
  const slider = page.locator('[data-test=volume-slider]');
  await slider.fill('0.7');
  await expect(slider).toHaveValue('0.7');
});
