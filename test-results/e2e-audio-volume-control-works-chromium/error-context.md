# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/audio.spec.js >> volume control works
- Location: tests/e2e/audio.spec.js:9:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[data-test=volume-slider]')

```

# Page snapshot

```yaml
- main [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - img [ref=e5]
      - heading "Application failed to respond" [level=1] [ref=e8]
    - generic [ref=e9]:
      - paragraph [ref=e10]: This error appears to be caused by the application.
      - paragraph [ref=e11]:
        - text: If this is your project, check out your
        - link "deploy logs" [ref=e12] [cursor=pointer]:
          - /url: https://docs.railway.com/guides/logs
        - text: to see what went wrong. Refer to our
        - link "docs on Fixing Common Errors" [ref=e13] [cursor=pointer]:
          - /url: https://docs.railway.com/guides/fixing-common-errors
        - text: for help, or reach out over our
        - link "Help Station" [ref=e14] [cursor=pointer]:
          - /url: https://station.railway.com
        - text: .
      - paragraph [ref=e15]: If you are a visitor, please contact the application owner or try again later.
      - paragraph [ref=e17]:
        - text: "Request ID:"
        - text: _PRE0RLuT8W5D1yJezItjw
      - link "Go to Railway" [ref=e19] [cursor=pointer]:
        - /url: https://railway.com
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | test('user can play and stop audio', async ({ page }) => {
  3  |     await page.goto('/');
  4  |     await page.click('[data-test=play-button]');
  5  |     await expect(page.locator('[data-test=playing-indicator]')).toBeVisible();
  6  |     await page.click('[data-test=stop-button]');
  7  |     await expect(page.locator('[data-test=playing-indicator]')).toHaveCount(0);
  8  | });
  9  | test('volume control works', async ({ page }) => {
  10 |     await page.goto('/');
  11 |     const slider = page.locator('[data-test=volume-slider]');
> 12 |     await slider.fill('0.7');
     |                  ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  13 |     await expect(slider).toHaveValue('0.7');
  14 | });
  15 | 
```