import { test, expect } from '@playwright/test';
import { openInstrument, initAudio, KICK_WAV, PIANO_WAV } from './helpers';

test.beforeEach(async ({ page }) => {
  await openInstrument(page);
  await initAudio(page);
});

test('drum picker loads a WAV and assigns it to the selected pad', async ({ page }) => {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.locator('button', { hasText: 'UPL' }).first().click(),
  ]);
  await chooser.setFiles({ name: 'kick.wav', mimeType: 'audio/wav', buffer: KICK_WAV });
  await expect(page.getByText('Loaded: kick.wav')).toBeVisible();
  await page.locator('button', { hasText: 'ASN' }).first().click();
  await expect(page.getByText('Assigned: kick.wav')).toBeVisible();
});

// Some systems report a WAV with a non-standard or empty MIME type; the drop must still load it.
for (const mimeType of ['audio/wav', 'audio/x-wav', '']) {
  test(`dropping a WAV onto a drum pad loads it (MIME "${mimeType}")`, async ({ page }) => {
    const b64 = KICK_WAV.toString('base64');
    await page.evaluate(
      ({ data, type }: { data: string; type: string }) => {
        const bin = Uint8Array.from(atob(data), c => c.charCodeAt(0));
        const file = new File([bin], 'kick.wav', { type });
        const transfer = new DataTransfer();
        transfer.items.add(file);
        const pad = document.querySelector('[data-testid="pad-2"]') as HTMLElement;
        for (const eventType of ['dragenter', 'dragover', 'drop']) {
          pad.dispatchEvent(new DragEvent(eventType, { bubbles: true, cancelable: true, dataTransfer: transfer }));
        }
      },
      { data: b64, type: mimeType },
    );
    await expect(page.getByText('Dropped: kick.wav')).toBeVisible();
  });
}

test('a WAV reported as audio/x-wav loads onto a piano key and plays from it, with no alert', async ({ page }) => {
  const dialogs: string[] = [];
  page.on('dialog', d => { dialogs.push(d.message()); void d.dismiss(); });

  const key = page.locator('[data-testid="piano-key-0"]');
  await key.locator('xpath=..').locator('input[type=file]').setInputFiles({
    name: 'piano.wav',
    mimeType: 'audio/x-wav',
    buffer: PIANO_WAV,
  });
  await page.waitForTimeout(1500);
  expect(dialogs).toEqual([]);

  await page.evaluate(() => { (window as unknown as { __starts: number[] }).__starts = []; });
  // Click the lower-left of the white key: the black key next to it overlaps the upper part.
  await key.click({ position: { x: 4, y: 80 } });
  await expect.poll(() =>
    page.evaluate(() => (window as unknown as { __starts: number[] }).__starts)
  ).toContain(1.5);
});
