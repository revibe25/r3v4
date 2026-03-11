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
});
