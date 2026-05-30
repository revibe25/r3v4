# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/core.spec.ts >> Critical flow: play audio
- Location: tests/e2e/core.spec.ts:14:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[data-test=play-button]')

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
        - text: "-ObbceDFR3mMgkMH8u2xcg"
      - link "Go to Railway" [ref=e19] [cursor=pointer]:
        - /url: https://railway.com
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('App loads', async ({ page }) => {
  4  |   await page.goto('/');
  5  |   await expect(page).toHaveTitle(/R3/);
  6  | });
  7  | 
  8  | test('Basic navigation works', async ({ page }) => {
  9  |   await page.goto('/');
  10 |   await page.click('[data-test=nav-home]');
  11 |   await expect(page).toHaveURL('/');
  12 | });
  13 | 
  14 | test('Critical flow: play audio', async ({ page }) => {
  15 |   await page.goto('/');
> 16 |   await page.click('[data-test=play-button]');
     |              ^ Error: page.click: Test timeout of 30000ms exceeded.
  17 |   await expect(page.locator('[data-test=playing-indicator]')).toBeVisible();
  18 | });
  19 | 
```