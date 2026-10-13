import type { Page } from '@playwright/test';

/**
 * Builds a mono 16-bit PCM WAV with an exponentially decaying sine.
 * Generated in code so the repo carries no binary fixtures.
 */
export function makeWav(freq: number, seconds: number, sampleRate = 44100): Buffer {
  const frames = Math.round(sampleRate * seconds);
  const data = Buffer.alloc(frames * 2);
  for (let i = 0; i < frames; i++) {
    const env = Math.exp(-i / (sampleRate * 0.3));
    const sample = Math.round(32767 * 0.8 * env * Math.sin((2 * Math.PI * freq * i) / sampleRate));
    data.writeInt16LE(sample, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);            // PCM
  header.writeUInt16LE(1, 22);            // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

export const KICK_WAV = makeWav(60, 0.6);     // 0.6 s, used for the drum tests
export const PIANO_WAV = makeWav(261.63, 1.5); // 1.5 s, used for the piano test

const USER = { id: 1, email: 'test@example.com', username: 'tester', tier: 'pro_artist', is_admin: false };

/**
 * Signs in without the backend: /api/auth/me returns a test user, tRPC calls are aborted
 * (the instrument page does not need them to load audio), and a token is set in localStorage.
 */
export async function mockSession(page: Page) {
  await page.route('**/api/**', route => {
    const url = route.request().url();
    if (url.includes('/trpc/')) return route.abort();
    if (url.includes('/api/auth/me')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: USER }) });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
  await page.addInitScript(() => {
    try { localStorage.setItem('r3_token', 'test-token'); } catch { /* storage disabled */ }
  });
}

/** Records the duration of every AudioBuffer started, so tests can check what actually plays. */
export async function recordBufferStarts(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __starts: number[] };
    w.__starts = [];
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args: Parameters<AudioBufferSourceNode['start']>) {
      w.__starts.push(this.buffer ? Number(this.buffer.duration.toFixed(2)) : -1);
      return original.apply(this, args);
    };
  });
}

export async function openInstrument(page: Page) {
  await mockSession(page);
  await recordBufferStarts(page);
  await page.goto('/instrument', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="pad-0"]').waitFor({ timeout: 30_000 });
}

/** The page is covered by an overlay until the first click; that click starts the audio engine. */
export async function initAudio(page: Page) {
  await page.mouse.click(700, 400);
  await page.locator('button', { hasText: 'UPL' }).first().waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'UPL');
    return !!b && !(b as HTMLButtonElement).disabled;
  });
}
