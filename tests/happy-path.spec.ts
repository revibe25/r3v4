import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('R3 v4 Happy Path', () => {
  
  test('Health endpoint returns 200', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/health`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('Server responds to requests', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    expect(page.url()).toContain('r3v4');
  });

  test('Root path serves SPA', async ({ request }) => {
    const response = await request.get(`${BASE_URL}/`);
    expect(response.status()).toBe(200);
  });

  test('Server stays up (10 rapid requests)', async ({ request }) => {
    for (let i = 0; i < 10; i++) {
      const response = await request.get(`${BASE_URL}/health`);
      expect(response.status()).toBe(200);
    }
  });
});
