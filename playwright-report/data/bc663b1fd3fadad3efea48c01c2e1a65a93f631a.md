# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/effects.spec.ts >> user can enable multiple effects
- Location: tests/e2e/effects.spec.ts:3:1

# Error details

```
Error: page.click: Test ended.
Call log:
  - waiting for locator('[data-test=effect-reverb]')

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('user can enable multiple effects', async ({ page }) => {
  4  |   await page.goto('/');
  5  |   const effects = ['reverb', 'delay', 'eq'];
  6  |   for (const effect of effects) {
> 7  |     await page.click(`[data-test=effect-${effect}]`);
     |                ^ Error: page.click: Test ended.
  8  |     await expect(page.locator(`[data-test=${effect}-active]`)).toBeVisible();
  9  |   }
  10 | });
  11 | 
```