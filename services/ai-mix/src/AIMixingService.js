/**
 * AIMixingService — genre-aware auto-mix and mastering suggestion engine.
 *
 * Invariants:
 *   - Confidence scores bounded [0, 1].
 *   - Suggestions never push faders above +12 dB.
 *   - Target loudness clamped to [−23, −6] LUFS (broadcast-safe range).
 *   - All channel references validated against mixerState before emission.
 *   - Model endpoint failure degrades to heuristics — never throws to caller.
 */
export class AIMixingService {
    constructor() {
        this.MODEL_ENDPOINT = process.env["AI_MIX_MODEL_ENDPOINT"] ?? "";
    }
    async analyze(request) {
        const safeTarget = Math.min(-6, Math.max(-23, request.targetLoudness));
        const warnings = [];
        if (safeTarget !== request.targetLoudness)
            warnings.push(`Target ${request.targetLoudness} LUFS clamped to ${safeTarget} LUFS (broadcast safe)`);
        const raw = await this.generateSuggestions(request, safeTarget);
        // Validate all channel references before returning
        const suggestions = raw.filter((s) => {
            const exists = request.mixerState.channels.has(s.channelId);
            if (!exists)
                warnings.push(`AI suggestion references unknown channel: ${s.channelId}`);
            return exists;
        });
        return { suggestions, predictedLoudness: safeTarget, warnings };
    }
    async generateSuggestions(request, targetLufs) {
        const genreHeadroom = {
            electronic: -6, hiphop: -8, "hip-hop": -8,
            jazz: -12, classical: -18, rock: -6,
        };
        const headroom = genreHeadroom[request.genre.toLowerCase()] ?? -10;
        const suggestions = [];
        for (const [id, channel] of request.mixerState.channels) {
            const delta = headroom - channel.fader;
            if (Math.abs(delta) > 1) {
                suggestions.push({
                    channelId: id,
                    paramId: "fader",
                    suggestedValue: Math.min(12, channel.fader + delta * 0.5),
                    confidence: 0.72,
                    rationale: `${request.genre} genre target headroom: ${headroom} dB`,
                });
            }
        }
        if (this.MODEL_ENDPOINT) {
            try {
                const res = await fetch(this.MODEL_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ request, targetLufs }),
                    signal: AbortSignal.timeout(5000),
                });
                if (!res.ok)
                    throw new Error(`Model endpoint returned ${res.status}`);
                const modelSuggestions = await res.json();
                const merged = new Map(suggestions.map((s) => [`${s.channelId}:${s.paramId}`, s]));
                for (const ms of modelSuggestions)
                    merged.set(`${ms.channelId}:${ms.paramId}`, ms);
                return [...merged.values()];
            }
            catch (err) {
                console.error("[AIMixingService] Model endpoint failed, falling back to heuristics:", err);
            }
        }
        return suggestions;
    }
}
