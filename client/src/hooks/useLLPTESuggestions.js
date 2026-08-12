import { useCallback, useRef, useState } from 'react';
/**
 * Hook for AI-powered mixing suggestions via LLPTE.
 * Tracks suggestion lifecycle and metrics.
 *
 * @example
 * const { suggestions, metrics, acceptSuggestion, rejectSuggestion } = useLLPTESuggestions({
 *   confidenceThreshold: 0.65,
 *   onSuggestion: (suggestion) => console.log(suggestion)
 * });
 */
export function useLLPTESuggestions({ confidenceThreshold = 0.65, onSuggestion, enabled = true, }) {
    const [suggestions, setSuggestions] = useState([]);
    const [metrics, setMetrics] = useState({
        latency: 0,
        edgeCount: 0,
        throughput: 0,
        confidenceGate: confidenceThreshold,
    });
    const suggestionHistoryRef = useRef([]);
    const lastProcessTimeRef = useRef(0);
    const suggestionCountRef = useRef(0);
    /**
     * Process incoming suggestion from AI engine
     */
    const processSuggestion = useCallback((suggestion) => {
        if (!enabled)
            return;
        const now = performance.now();
        const latency = now - (lastProcessTimeRef.current || now);
        lastProcessTimeRef.current = now;
        // Auto-apply high-confidence suggestions
        if (suggestion.confidence >= confidenceThreshold) {
            suggestion.outcome = 'auto_applied';
        }
        suggestionCountRef.current++;
        suggestionHistoryRef.current.push(suggestion);
        setSuggestions((prev) => {
            const updated = [...prev, suggestion];
            // Keep only last 20 suggestions
            return updated.slice(-20);
        });
        onSuggestion?.(suggestion);
        // Update metrics
        setMetrics((prev) => ({
            ...prev,
            latency: Math.round(latency),
            edgeCount: suggestionHistoryRef.current.length,
            throughput: suggestionCountRef.current / ((Date.now() - (lastProcessTimeRef.current - 1000)) / 1000 || 1),
        }));
    }, [enabled, confidenceThreshold, onSuggestion]);
    /**
     * Accept a suggestion and apply it
     */
    const acceptSuggestion = useCallback((id) => {
        setSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, outcome: 'accepted' } : s));
    }, []);
    /**
     * Reject a suggestion
     */
    const rejectSuggestion = useCallback((id) => {
        setSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, outcome: 'rejected' } : s));
    }, []);
    /**
     * Ignore a suggestion (no learning impact)
     */
    const ignoreSuggestion = useCallback((id) => {
        setSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, outcome: 'ignored' } : s));
    }, []);
    /**
     * Discard suggestion (user indicated it's wrong)
     */
    const discardSuggestion = useCallback((id) => {
        setSuggestions((prev) => prev.map((s) => s.id === id ? { ...s, outcome: 'discarded' } : s));
    }, []);
    /**
     * Get pending suggestions (not yet acted on)
     */
    const getPending = useCallback(() => suggestions.filter((s) => s.outcome === 'auto_applied' || !['accepted', 'rejected', 'ignored', 'discarded'].includes(s.outcome)), [suggestions]);
    /**
     * Get metrics summary
     */
    const getMetricsSummary = useCallback(() => {
        const history = suggestionHistoryRef.current;
        const accepted = history.filter((s) => s.outcome === 'accepted').length;
        const rejected = history.filter((s) => s.outcome === 'rejected').length;
        const avgConfidence = history.length > 0
            ? history.reduce((sum, s) => sum + s.confidence, 0) / history.length
            : 0;
        return {
            totalProcessed: history.length,
            accepted,
            rejected,
            acceptanceRate: history.length > 0 ? (accepted / history.length) * 100 : 0,
            avgConfidence,
            latency: metrics.latency,
        };
    }, [metrics.latency]);
    /**
     * Clear history (cleanup)
     */
    const clearHistory = useCallback(() => {
        suggestionHistoryRef.current = [];
        suggestionCountRef.current = 0;
        setSuggestions([]);
    }, []);
    return {
        suggestions,
        metrics,
        processSuggestion,
        acceptSuggestion,
        rejectSuggestion,
        ignoreSuggestion,
        discardSuggestion,
        getPending,
        getMetricsSummary,
        clearHistory,
    };
}
/**
 * Generate a default suggestion based on track analysis
 */
export function generateMixingSuggestion(trackId, type, confidence, parameters) {
    const labels = {
        gain_adjust: 'Adjust track gain',
        eq_suggest: 'EQ adjustment recommended',
        conflict_flag: 'Frequency conflict detected',
        transition: 'Add transition effect',
        compression: 'Apply compression',
        frequency_balance: 'Balance frequency response',
    };
    return {
        trackId,
        type,
        confidence,
        displayedConfidence: confidence,
        decision: { parameters },
        label: labels[type],
        reasoning: `AI analysis suggests ${labels[type].toLowerCase()} for better mix clarity.`,
        parameters,
    };
}
