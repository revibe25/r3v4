# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: happy-path.spec.ts >> R3 v4 Happy Path >> Root path returns 404
- Location: tests/happy-path.spec.ts:19:3

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 404
Received: 502
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const BASE_URL = process.env.BASE_URL || 'https://r3v4-production.up.railway.app';
  4  | 
  5  | test.describe('R3 v4 Happy Path', () => {
  6  |   
  7  |   test('Health endpoint returns 200', async ({ request }) => {
  8  |     const response = await request.get(`${BASE_URL}/health`);
  9  |     expect(response.status()).toBe(200);
  10 |     const body = await response.json();
  11 |     expect(body.status).toBe('ok');
  12 |   });
  13 | 
  14 |   test('Server responds to requests', async ({ page }) => {
  15 |     await page.goto(BASE_URL, { waitUntil: 'networkidle' });
  16 |     expect(page.url()).toContain('r3v4');
  17 |   });
  18 | 
  19 |   test('Root path returns 404', async ({ request }) => {
  20 |     const response = await request.get(`${BASE_URL}/`);
> 21 |     expect(response.status()).toBe(404);
     |                               ^ Error: expect(received).toBe(expected) // Object.is equality
  22 |   });
  23 | 
  24 |   test('Server stays up (10 rapid requests)', async ({ request }) => {
  25 |     for (let i = 0; i < 10; i++) {
  26 |       const response = await request.get(`${BASE_URL}/health`);
  27 |       expect(response.status()).toBe(200);
  28 |     }
  29 |   });
  30 | });
  31 | 
```