import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAIMixSuggestion } from '../src/aiAdapter';
import type { AIMixRequest } from '../src/types';

const BASE_REQUEST: AIMixRequest = {
  fromTrackId: 'track-a',
  toTrackId:   'track-b',
  fromBpm:     128,
  toBpm:       130,
  fromKey:     '8A',
  toKey:       '9A',
};

const MOCK_SUGGESTION = {
  trackId:         'track-b',
  transitionPoint: 32,
  confidence:      0.87,
  suggestedParams: { durationMs: 6000, curve: 's-curve' },
};

describe('getAIMixSuggestion', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('successful response', () => {
    beforeEach(() => {
      vi.mocked(fetch).mockResolvedValue({
        ok:   true,
        json: () => Promise.resolve(MOCK_SUGGESTION),
      } as Response);
    });

    it('returns the AI suggestion', async () => {
      const result = await getAIMixSuggestion(BASE_REQUEST);
      expect(result).toEqual(MOCK_SUGGESTION);
    });
    it('POSTs to /suggest with correct Content-Type', async () => {
      await getAIMixSuggestion(BASE_REQUEST);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/suggest'),
        expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' } }),
      );
    });
    it('serializes full request as JSON body', async () => {
      await getAIMixSuggestion(BASE_REQUEST);
      const [, init] = vi.mocked(fetch).mock.calls[0];
      expect(JSON.parse((init as RequestInit).body as string)).toEqual(BASE_REQUEST);
    });
    it('returned trackId matches toTrackId', async () => {
      const result = await getAIMixSuggestion(BASE_REQUEST);
      expect(result.trackId).toBe(BASE_REQUEST.toTrackId);
    });
    it('confidence is within 0–1 range', async () => {
      const result = await getAIMixSuggestion(BASE_REQUEST);
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
    it('suggestedParams includes durationMs and curve', async () => {
      const result = await getAIMixSuggestion(BASE_REQUEST);
      expect(result.suggestedParams).toHaveProperty('durationMs');
      expect(result.suggestedParams).toHaveProperty('curve');
    });
  });

  describe('fallback on failure', () => {
    it('returns fallback when fetch throws', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('network error'));
      const result = await getAIMixSuggestion(BASE_REQUEST);
      expect(result.trackId).toBe(BASE_REQUEST.toTrackId);
      expect(result.confidence).toBe(0);
      expect(result.transitionPoint).toBe(0);
    });
    it('returns fallback on non-ok HTTP status', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false, status: 503, statusText: 'Service Unavailable' } as Response);
      const result = await getAIMixSuggestion(BASE_REQUEST);
      expect(result.confidence).toBe(0);
    });
    it('fallback durationMs is a positive number', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('offline'));
      const result = await getAIMixSuggestion(BASE_REQUEST);
      expect(result.suggestedParams.durationMs).toBeGreaterThan(0);
    });
    it('fallback curve is a non-empty string', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('offline'));
      const result = await getAIMixSuggestion(BASE_REQUEST);
      expect(typeof result.suggestedParams.curve).toBe('string');
      expect(result.suggestedParams.curve.length).toBeGreaterThan(0);
    });
  });

  describe('URL resolution', () => {
    it('defaults to localhost:8001', async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve(MOCK_SUGGESTION) } as Response);
      await getAIMixSuggestion(BASE_REQUEST);
      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(url as string).toContain('localhost:8001');
    });
  });

  describe('externalSignal support', () => {
    it('accepts an external AbortSignal — covers AbortSignal.any() merge path', async () => {
      // Line 42: externalSignal ? AbortSignal.any([...]) : timeoutController.signal
      // Passing any AbortSignal forces the ternary true branch.
      vi.mocked(fetch).mockResolvedValue({
        ok:   true,
        json: () => Promise.resolve(MOCK_SUGGESTION),
      } as Response);
      const controller = new AbortController();
      const result = await getAIMixSuggestion(BASE_REQUEST, controller.signal);
      expect(result).toEqual(MOCK_SUGGESTION);
    });
  });
});

describe('URL resolution — window and bare fallback', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  // lines 20-21: window.__LLPTE_AI_URL path in getAIServiceUrl()
  it('uses window.__LLPTE_AI_URL when process.env is absent', async () => {
    const origEnv = (process as any).env;
    try {
      (process as any).env = undefined;
      vi.stubGlobal('window', { __LLPTE_AI_URL: 'http://custom-ai:9000' });
      vi.mocked(fetch).mockResolvedValue(
        { ok: true, json: () => Promise.resolve(MOCK_SUGGESTION) } as Response);
      await getAIMixSuggestion(BASE_REQUEST);
      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(url as string).toContain('custom-ai:9000');
    } finally {
      (process as any).env = origEnv;
    }
  });

  // line 22: window defined but __LLPTE_AI_URL absent → ?? fallback
  it('falls back to localhost:8001 when window has no __LLPTE_AI_URL', async () => {
    const origEnv = (process as any).env;
    try {
      (process as any).env = undefined;
      vi.stubGlobal('window', {});
      vi.mocked(fetch).mockResolvedValue(
        { ok: true, json: () => Promise.resolve(MOCK_SUGGESTION) } as Response);
      await getAIMixSuggestion(BASE_REQUEST);
      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(url as string).toContain('localhost:8001');
    } finally {
      (process as any).env = origEnv;
    }
  });

  // lines 24-25: both process.env and window absent → bare return
  it('falls back to localhost:8001 when both process.env and window are absent', async () => {
    const origEnv = (process as any).env;
    try {
      (process as any).env = undefined;
      vi.stubGlobal('window', undefined);
      vi.mocked(fetch).mockResolvedValue(
        { ok: true, json: () => Promise.resolve(MOCK_SUGGESTION) } as Response);
      await getAIMixSuggestion(BASE_REQUEST);
      const [url] = vi.mocked(fetch).mock.calls[0];
      expect(url as string).toContain('localhost:8001');
    } finally {
      (process as any).env = origEnv;
    }
  });
});
