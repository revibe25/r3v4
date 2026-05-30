# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/audio.spec.ts >> user can play and stop audio
- Location: tests/e2e/audio.spec.ts:3:5

# Error details

```
Error: page.click: Test ended.
Call log:
  - waiting for locator('[data-test=play-button]')

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('user can play and stop audio', async ({ page }) => {
  4  |   await page.goto('/');
> 5  |   await page.click('[data-test=play-button]');
     |              ^ Error: page.click: Test ended.
  6  |   await expect(page.locator('[data-test=playing-indicator]')).toBeVisible();
  7  |   await page.click('[data-test=stop-button]');
  8  |   await expect(page.locator('[data-test=playing-indicator]')).toHaveCount(0);
  9  | });
  10 | 
  11 | test('volume control works', async ({ page }) => {
  12 |   await page.goto('/');
  13 |   const slider = page.locator('[data-test=volume-slider]');
  14 |   await slider.fill('0.7');
  15 |   await expect(slider).toHaveValue('0.7');
  16 | });
  17 | 
```