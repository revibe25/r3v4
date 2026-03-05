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

// Cross-environment: works in Node.js (process.env) and browser (window.__LLPTE_AI_URL)
function getAIServiceUrl(): string {
  // Node.js environment
  if (typeof process !== 'undefined' && process.env) {
    return process.env['LLPTE_AI_SERVICE_URL'] ?? 'http://localhost:8001';
  }
  // Browser environment with optional global override
  if (typeof window !== 'undefined') {
    return (window as Window & { __LLPTE_AI_URL?: string }).__LLPTE_AI_URL
      ?? 'http://localhost:8001';
  }
  return 'http://localhost:8001';
}

export async function getAIMixSuggestion(
  request: AIMixRequest,
): Promise<AIMixSuggestion> {
  const AI_SERVICE_URL = getAIServiceUrl();
  try {
    const res = await fetch(`${AI_SERVICE_URL}/suggest`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(request),
    });

    if (!res.ok) {
      throw new Error(`AI service returned ${res.status}: ${res.statusText}`);
    }

    return res.json() as Promise<AIMixSuggestion>;
  } catch (e) {
    // Graceful fallback — return neutral suggestion if AI service is unavailable
    console.warn('[llpte-ai] AI service unavailable, using fallback:', e);
    return {
      trackId:         request.toTrackId,
      transitionPoint: 0,
      confidence:      0,
      suggestedParams: { durationMs: 8000, curve: 'equal-power' },
    };
  }
}
