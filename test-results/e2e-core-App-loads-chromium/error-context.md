# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/core.spec.ts >> App loads
- Location: tests/e2e/core.spec.ts:3:5

# Error details

```
Error: expect(page).toHaveTitle(expected) failed

Expected pattern: /R3/
Received string:  "502 Bad Gateway"
Timeout: 5000ms

Call log:
  - Expect "toHaveTitle" with timeout 5000ms
    12 × unexpected value "502 Bad Gateway"

```

```yaml
- main:
  - img
  - heading "Application failed to respond" [level=1]
  - paragraph: This error appears to be caused by the application.
  - paragraph:
    - text: If this is your project, check out your
    - link "deploy logs":
      - /url: https://docs.railway.com/guides/logs
    - text: to see what went wrong. Refer to our
    - link "docs on Fixing Common Errors":
      - /url: https://docs.railway.com/guides/fixing-common-errors
    - text: for help, or reach out over our
    - link "Help Station":
      - /url: https://station.railway.com
    - text: .
  - paragraph: If you are a visitor, please contact the application owner or try again later.
  - paragraph: "Request ID: EInK7voBRNyRTksDezItjw"
  - link "Go to Railway":
    - /url: https://railway.com
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('App loads', async ({ page }) => {
  4  |   await page.goto('/');
> 5  |   await expect(page).toHaveTitle(/R3/);
     |                      ^ Error: expect(page).toHaveTitle(expected) failed
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
  16 |   await page.click('[data-test=play-button]');
  17 |   await expect(page.locator('[data-test=playing-indicator]')).toBeVisible();
  18 | });
  19 | 
```