# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: e2e/upload.spec.ts >> upload and play audio
- Location: tests/e2e/upload.spec.ts:3:5

# Error details

```
Error: ENOENT: no such file or directory, stat 'tests/e2e/fixtures/sample.wav'
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
        - text: J9VpB4-xScaVb3ywo3UVLg
      - link "Go to Railway" [ref=e19] [cursor=pointer]:
        - /url: https://railway.com
```

# Test source

```ts
  1 | import { test, expect } from '@playwright/test';
  2 | 
  3 | test('upload and play audio', async ({ page }) => {
  4 |   await page.goto('/');
> 5 |   await page.setInputFiles('[data-test=file-input]', 'tests/e2e/fixtures/sample.wav');
    |   ^ Error: ENOENT: no such file or directory, stat 'tests/e2e/fixtures/sample.wav'
  6 |   await page.click('[data-test=play-button]');
  7 |   await expect(page.locator('[data-test=waveform]')).toBeVisible();
  8 | });
  9 | 
```