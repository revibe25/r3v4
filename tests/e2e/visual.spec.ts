import { test, expect } from '@playwright/test';

test('waveform renders correctly', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('[data-test=file-input]', 'tests/e2e/fixtures/sample.wav');
  await page.click('[data-test=play-button]');
  await page.waitForSelector('[data-test=waveform]');
  expect(await page.locator('[data-test=waveform]').screenshot()).toMatchSnapshot('waveform.png');
});

test('effects panel renders correctly', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-test=open-effects]');
  expect(await page.locator('[data-test=effects-panel]').screenshot()).toMatchSnapshot('effects-panel.png');
});
