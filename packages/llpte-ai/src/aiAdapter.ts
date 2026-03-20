/**
 * @llpte/llpte-ai — AI Mix Inference Adapter
 *
 * TypeScript bridge to the Python inference layer (server/ai_mix.py).
 * The server code should call this adapter rather than importing Python logic.
 *
 * NOTE: ai_mix.py and main.py remain in server/ — this adapter calls
 * the HTTP endpoint that the Python service exposes.
 */

import type { AIMixRequest, AIMixSuggestion } from './types';

const AI_FETCH_TIMEOUT_MS = 10_000; // 10 s — §4: every AI call must have timeout

// Cross-environment: works in Node.js (process.env) and browser (window.__LLPTE_AI_URL)
function getAIServiceUrl(): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env['LLPTE_AI_SERVICE_URL'] ?? 'http://localhost:8001';
  }
  if (typeof window !== 'undefined') {
    return (window as Window & { __LLPTE_AI_URL?: string }).__LLPTE_AI_URL
      ?? 'http://localhost:8001';
  }
  return 'http://localhost:8001';
}

export async function getAIMixSuggestion(
  request:      AIMixRequest,
  externalSignal?: AbortSignal, // caller can pass its own cancellation token
): Promise<AIMixSuggestion> {
  const AI_SERVICE_URL = getAIServiceUrl();

  // Internal timeout controller — always present regardless of caller signal
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(
    () => timeoutController.abort(new Error(`AI service timeout after ${AI_FETCH_TIMEOUT_MS}ms`)),
    AI_FETCH_TIMEOUT_MS,
  );

  // Merge internal timeout with any external cancellation signal
  const signal = externalSignal
    ? AbortSignal.any([timeoutController.signal, externalSignal])
    : timeoutController.signal;

  try {
    const res = await fetch(`${AI_SERVICE_URL}/suggest`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(request),
      signal,
    });

    if (!res.ok) {
      throw new Error(`AI service returned ${res.status}: ${res.statusText}`);
    }

    return res.json() as Promise<AIMixSuggestion>;
  } catch (e) {
    // §4: return last-known-good (neutral) suggestion; surface degraded state to caller
    console.warn('[llpte-ai] AI service unavailable, using fallback:', e);
    return {
      trackId:         request.toTrackId,
      transitionPoint: 0,
      confidence:      0,
      suggestedParams: { durationMs: 8000, curve: 'equal-power' },
    };
  /* v8 ignore next -- catch returns unconditionally; exception-propagation-through-finally is unreachable */
  } finally {
    clearTimeout(timeoutId);
  }
}
