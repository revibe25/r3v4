import { test, expect } from '@playwright/test';

test('App loads', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/R3/);
});

test('Basic navigation works', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test=nav-home]');
  await expect(page).toHaveURL('/');
});

test('Critical flow: play audio', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test=play-button]');
  await expect(page.locator('[data-test=playing-indicator]')).toBeVisible();
});
