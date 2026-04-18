/**
 * server/services/aiMixClient.ts
 *
 * Typed HTTP client for the AI Mix sidecar (services/ai-mix).
 * Replaces any child_process.spawn / exec calls to ai_mix.py or main.py.
 *
 * Usage:
 *   import { analyzeMix } from './aiMixClient'
 *   const result = await analyzeMix({ trackAId: '...', trackBId: '...', crossfadePosition: 0.5 })
 */

const AI_MIX_URL = process.env['AI_MIX_URL'] ?? 'http://localhost:8001'

// ── Types (mirror Python Pydantic models) ─────────────────────────────────

export interface MixRequest {
  trackAId: string
  trackBId: string
  /** 0.0 = full Deck A, 1.0 = full Deck B */
  crossfadePosition: number
  bpmTarget?: number
}

export interface MixResponse {
  suggestedBpm: number
  transitionPoints: number[]
  energyCurve: number[]
}

// ── Client ────────────────────────────────────────────────────────────────

/**
 * Analyze a mix transition via the Python AI Mix sidecar.
 * Throws on non-2xx responses with the sidecar's error detail.
 */
export async function analyzeMix(req: MixRequest): Promise<MixResponse> {
  const res = await fetch(`${AI_MIX_URL}/mix/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      track_a_id: req.trackAId,
      track_b_id: req.trackBId,
      crossfade_position: req.crossfadePosition,
      bpm_target: req.bpmTarget ?? null,
    }),
  })

  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as { detail?: string }
      if (body.detail) detail = body.detail
    } catch {
      // ignore parse error
    }
    throw new Error(`AI Mix error: ${detail}`)
  }

  // Map snake_case response to camelCase
  const raw = (await res.json()) as {
    suggested_bpm: number
    transition_points: number[]
    energy_curve: number[]
  }

  return {
    suggestedBpm: raw.suggested_bpm,
    transitionPoints: raw.transition_points,
    energyCurve: raw.energy_curve,
  }
}

/**
 * Check if the AI Mix sidecar is alive.
 * Useful for startup health assertions in your Node server.
 */
export async function checkAiMixHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${AI_MIX_URL}/health`, { method: 'GET' })
    return res.ok
  } catch {
    return false
  }
}
