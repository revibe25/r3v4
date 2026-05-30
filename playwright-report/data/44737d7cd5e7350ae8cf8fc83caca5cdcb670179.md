# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/visual.spec.ts >> effects panel renders correctly
- Location: tests/e2e/visual.spec.ts:11:5

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[data-test=open-effects]')

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
        - text: l_H_MnSSSEisjg-aaP71AA
      - link "Go to Railway" [ref=e19] [cursor=pointer]:
        - /url: https://railway.com
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('waveform renders correctly', async ({ page }) => {
  4  |   await page.goto('/');
  5  |   await page.setInputFiles('[data-test=file-input]', 'tests/e2e/fixtures/sample.wav');
  6  |   await page.click('[data-test=play-button]');
  7  |   await page.waitForSelector('[data-test=waveform]');
  8  |   expect(await page.locator('[data-test=waveform]').screenshot()).toMatchSnapshot('waveform.png');
  9  | });
  10 | 
  11 | test('effects panel renders correctly', async ({ page }) => {
  12 |   await page.goto('/');
> 13 |   await page.click('[data-test=open-effects]');
     |              ^ Error: page.click: Test timeout of 30000ms exceeded.
  14 |   expect(await page.locator('[data-test=effects-panel]').screenshot()).toMatchSnapshot('effects-panel.png');
  15 | });
  16 | 
```