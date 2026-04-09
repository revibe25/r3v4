import { test, expect } from '@playwright/test';

test('user can enable multiple effects', async ({ page }) => {
  await page.goto('/');
  const effects = ['reverb', 'delay', 'eq'];
  for (const effect of effects) {
    await page.click(`[data-test=effect-${effect}]`);
    await expect(page.locator(`[data-test=${effect}-active]`)).toBeVisible();
  }
});
