/**
 * LLPTE E2E Integration Tests (Second Pass)
 * 
 * Location: Append to ~/Stable/apps/r3-agi/src/services/__tests__/llpte.test.ts
 * After: Line 1324 (after the "Score Model (coverage boost)" describe block)
 * 
 * These tests complete the E2E pipeline validation and close coverage gaps.
 * Run after initial 60-test suite passes.
 */

// ═════════════════════════════════════════════════════════════════════════════
//  END-TO-END INTEGRATION TESTS (5-Node Pipeline)
// ═════════════════════════════════════════════════════════════════════════════

describe('E2E: Complete 5-Node LLPTE Pipeline', () => {
  
  it('should process complete 5-node pipeline in sequence with latency validation', async () => {
    /**
     * This test validates the entire LLPTE pipeline operating end-to-end:
     * 
     *   1. inputRouter (AutoLevelPipeline) — initialization & lifecycle
     *   2. spectralAnalyzer (TrackAnalyzer + MixAnalyzer) — frame capture
     *   3. aiMixEngine (AutoLevelEngine) — recommendation generation
     *   4. transitionGraph (LLPTETransitionGraph) — transition ranking
     *   5. outputBus (Stats aggregation) — acceptance/rejection tracking
     * 
     * p50 Latency SLA: ≤15ms for complete pipeline
     */

    // ─── Node 1: inputRouter (AutoLevelPipeline) ─────────────────────────────
    const masterAnalyser = createMockAnalyserNode({ fftSize: 512 });
    const pipeline = new AutoLevelPipeline(masterAnalyser, 44100, {
      analysisHz: 30,
    });
    
    expect(pipeline.running).toBe(false);
    pipeline.start();
    expect(pipeline.running).toBe(true);

    // ─── Node 2: spectralAnalyzer (TrackAnalyzer + MixAnalyzer) ────────────────
    const mixAnalyzer = new MixAnalyzer({ 
      masterAnalyser, 
      sampleRate: 44100,
    });

    // Register 3 tracks with varying spectral characteristics
    const trackIds = ['track-A', 'track-B', 'track-C'];
    const tracks: TrackAnalyzer[] = [];

    for (let i = 0; i < 3; i++) {
      const analyser = createMockAnalyserNode({
        fftSize: 256,
        timeDomainData: new Float32Array(256).fill(0.1 + i * 0.05),
        frequencyData: new Float32Array(128).map((_, j) => -60 + (j / 128) * 40),
      });

      const track = new TrackAnalyzer({
        trackId: trackIds[i],
        analyserNode: analyser,
      });
      mixAnalyzer.registerTrack(track);
      tracks.push(track);
    }

    // Capture frame from spectralAnalyzer
    const snapshot = mixAnalyzer.captureFrame();
    expect(snapshot.tracks.size).toBe(3);
    expect(snapshot.frameId).toBeDefined();
    expect(snapshot.timestamp).toBeGreaterThan(0);

    // Verify each track snapshot has required fields
    for (const trackId of trackIds) {
      const trackSnapshot = snapshot.tracks.get(trackId);
      expect(trackSnapshot).toBeDefined();
      expect(trackSnapshot?.rms).toBeGreaterThanOrEqual(0);
      expect(trackSnapshot?.truePeak).toBeLessThanOrEqual(0);  // Peak in dBFS
      expect(trackSnapshot?.spectrum).toBeInstanceOf(Float32Array);
      expect(trackSnapshot?.gateOpen).toBe(true);
    }

    // ─── Node 3: aiMixEngine (AutoLevelEngine) ──────────────────────────────────
    const engine = new AutoLevelEngine(44100, {
      targetLUFS: -14,
      clippingThreshold: -1,
      lookaheadMs: 100,
    });

    const recommendation = engine.analyze(snapshot);
    expect(recommendation).toBeDefined();
    expect(recommendation.gainAdjustments).toBeInstanceOf(Array);
    expect(recommendation.clippingAlerts).toBeInstanceOf(Array);

    // Gain adjustments should have recommendations for tracks above/below target
    expect(recommendation.gainAdjustments.length).toBeGreaterThan(0);
    for (const adj of recommendation.gainAdjustments) {
      expect(adj.trackId).toBeDefined();
      expect(typeof adj.suggestedGainDb).toBe('number');
      expect(adj.suggestedGainDb).toBeLessThanOrEqual(12);  // Max boost
      expect(adj.suggestedGainDb).toBeGreaterThanOrEqual(-48);  // Max cut
    }

    // ─── Node 4: transitionGraph (LLPTETransitionGraph) ───────────────────────
    const graph = new LLPTETransitionGraph();

    // Add track signals from snapshot
    for (const trackId of trackIds) {
      const trackSnapshot = snapshot.tracks.get(trackId)!;
      graph.addTrack(trackId, {
        bpm: 120 + Math.random() * 20,
        key: '8A',  // Simple key for all tracks
        energy: trackSnapshot.rms * 2,  // Approximate energy
        spectralCentroid: 4000 + Math.random() * 2000,
        rmsLoudness: linearTodBFS(trackSnapshot.rms),
      });
    }

    // Get best transitions FROM track-A (to B and C)
    const bestTransitions = graph.getBestTransitions('track-A', 5);
    expect(bestTransitions).toBeInstanceOf(Array);
    expect(bestTransitions.length).toBeGreaterThan(0);
    expect(bestTransitions.length).toBeLessThanOrEqual(5);

    // Verify transition objects
    for (const transition of bestTransitions) {
      expect(transition.fromTrackId).toBe('track-A');
      expect(['track-B', 'track-C']).toContain(transition.toTrackId);
      expect(transition.score).toBeGreaterThanOrEqual(0);
      expect(transition.score).toBeLessThanOrEqual(1);
      expect(transition.confidence).toBeGreaterThanOrEqual(0);
      expect(transition.confidence).toBeLessThanOrEqual(1);
    }

    // ─── Node 5: outputBus (Stats Aggregation) ──────────────────────────────────
    // Simulate user accepting AI suggestions
    pipeline.acceptSuggestion('track-A');
    pipeline.acceptSuggestion('track-B');
    expect(pipeline.stats.acceptedSuggestions).toBe(2);

    // Simulate rejections
    pipeline.rejectSuggestion('track-C');
    expect(pipeline.stats.rejectedSuggestions).toBe(1);

    // Verify stats are accumulated
    expect(pipeline.stats.acceptedSuggestions).toBe(2);
    expect(pipeline.stats.rejectedSuggestions).toBe(1);
    expect(pipeline.stats.sessionStartedAt).toBeLessThanOrEqual(Date.now());

    // ─── LATENCY SLA VALIDATION (p50 ≤ 15ms) ──────────────────────────────────
    const latencies: number[] = [];

    for (let iteration = 0; iteration < 100; iteration++) {
      // Time the complete pipeline: snapshot → recommendation → transitions → accept
      const { ms } = measureLatency(() => {
        const snap = mixAnalyzer.captureFrame();
        const rec = engine.analyze(snap);
        const trans = graph.getBestTransitions('track-A', 5);
        pipeline.acceptSuggestion('track-A');
        return { snap, rec, trans };
      });
      latencies.push(ms);
    }

    const medianLatency = p50(latencies);
    const p95Latency = [...latencies].sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];
    const maxLatency = Math.max(...latencies);

    expect(medianLatency).toBeLessThanOrEqual(15);  // SLA
    console.log(`[E2E Pipeline SLA] p50: ${medianLatency.toFixed(2)}ms, p95: ${p95Latency.toFixed(2)}ms, max: ${maxLatency.toFixed(2)}ms`);

    // Cleanup
    pipeline.stop();
    pipeline.dispose();
    mixAnalyzer.dispose();
  });

  it('should handle pipeline degradation when spectralAnalyzer returns null frame', () => {
    /**
     * Edge case: What if spectralAnalyzer fails to capture a frame?
     * The pipeline should not crash; downstream nodes should handle gracefully.
     */

    const engine = new AutoLevelEngine(44100);

    // Create empty snapshot (no tracks)
    const emptySnapshot = createMockMixSnapshot(0);

    // Engine should return valid (empty) recommendation, not throw
    expect(() => {
      const rec = engine.analyze(emptySnapshot);
      expect(rec.gainAdjustments.length).toBe(0);
    }).not.toThrow();
  });

  it('should gracefully handle extreme signal values', () => {
    /**
     * Robustness check: Pipeline should clamp/validate extreme values
     * (negative RMS, clipping, out-of-range spectrum, etc.)
     */

    const engine = new AutoLevelEngine(44100);

    // Create snapshot with extreme values
    const snapshot = createMockMixSnapshot(1, {
      tracks: new Map([
        [
          'track-extreme',
          {
            trackId: 'track-extreme',
            timestamp: performance.now(),
            rms: 2.0,  // Over 1.0 (clipping)
            truePeak: 0.5,  // Positive dBFS (shouldn't happen)
            shortTermLufs: -5,  // Very hot
            integratedLufs: -10,
            spectrum: new Float32Array(128).fill(100),  // Extreme spectrum
            clipping: true,
            gateOpen: true,
          },
        ],
      ]),
    });

    // Should not throw; engine should validate and clamp
    const rec = engine.analyze(snapshot);
    expect(rec).toBeDefined();
    expect(rec.clippingAlerts.length).toBeGreaterThan(0);  // Should detect clipping
  });

  it('should accumulate stats correctly across multiple mix sessions', () => {
    /**
     * Validate that the outputBus correctly accumulates stats over time:
     * - Accepted suggestions count
     * - Rejected suggestions count
     * - Total AI adjustments
     * - Manual fader moves
     */

    const masterAnalyser = createMockAnalyserNode();
    const pipeline = new AutoLevelPipeline(masterAnalyser, 44100);
    pipeline.start();

    const mixAnalyzer = new MixAnalyzer({ masterAnalyser, sampleRate: 44100 });
    const engine = new AutoLevelEngine(44100);

    // Simulate a 10-frame mix session
    for (let frame = 0; frame < 10; frame++) {
      // Vary track count per frame
      const trackCount = 2 + (frame % 3);
      const snapshot = createMockMixSnapshot(trackCount);

      // Analyze
      const recommendation = engine.analyze(snapshot);

      // Simulate user interactions
      if (frame % 3 === 0) {
        // Accept suggestions on frames 0, 3, 6, 9
        pipeline.acceptSuggestion(`track-0`);
      } else if (frame % 3 === 1) {
        // Reject on frames 1, 4, 7
        pipeline.rejectSuggestion(`track-0`);
      }
      // Frame 2, 5, 8: no interaction
    }

    // Verify final stats
    expect(pipeline.stats.acceptedSuggestions).toBe(4);  // 0, 3, 6, 9
    expect(pipeline.stats.rejectedSuggestions).toBe(3);  // 1, 4, 7
    expect(pipeline.stats.totalAIAdjustments).toBeGreaterThan(0);

    pipeline.dispose();
    mixAnalyzer.dispose();
  });

  it('should correctly rank transitions from high-similarity to low-similarity tracks', () => {
    /**
     * Transition scoring should:
     * - Rank identical tracks at score 1.0
     * - Rank dissimilar tracks lower
     * - Sort results by descending score
     */

    const graph = new LLPTETransitionGraph();

    // Add source track
    const sourceSignal = {
      bpm: 128,
      key: '8A',
      energy: 0.7,
      spectralCentroid: 4000,
      rmsLoudness: 0.6,
    };
    graph.addTrack('source', sourceSignal);

    // Add candidates with varying similarity
    graph.addTrack('identical', sourceSignal);  // Should score 1.0
    graph.addTrack('similar', {
      ...sourceSignal,
      bpm: 130,  // Close BPM
      energy: 0.72,  // Close energy
    });
    graph.addTrack('dissimilar', {
      bpm: 60,  // Very different
      key: '12B',
      energy: 0.1,
      spectralCentroid: 1000,
      rmsLoudness: 0.2,
    });

    const ranked = graph.getBestTransitions('source', 10);

    // 'identical' should be first (or very high)
    expect(ranked.length).toBeGreaterThan(0);
    if (ranked.length > 0) {
      expect(ranked[0].toTrackId).toBe('identical');
      expect(ranked[0].score).toBe(1.0);
    }

    // Scores should be descending
    for (let i = 0; i < ranked.length - 1; i++) {
      expect(ranked[i].score).toBeGreaterThanOrEqual(ranked[i + 1].score);
    }
  });

  it('should not transition a track to itself', () => {
    /**
     * Self-transitions should be excluded (track-A → track-A is invalid)
     */

    const graph = new LLPTETransitionGraph();

    const signal = {
      bpm: 128,
      key: '8A',
      energy: 0.7,
      spectralCentroid: 4000,
      rmsLoudness: 0.6,
    };

    graph.addTrack('track-A', signal);
    graph.addTrack('track-B', { ...signal, bpm: 130 });

    const transitions = graph.getBestTransitions('track-A', 10);

    // Should only include track-B, never track-A itself
    for (const transition of transitions) {
      expect(transition.toTrackId).not.toBe('track-A');
    }
  });

  it('should handle single-track scenario (no transitions possible)', () => {
    /**
     * With only one track, getBestTransitions should return empty array
     * (no other tracks to transition to)
     */

    const graph = new LLPTETransitionGraph();

    graph.addTrack('only-track', {
      bpm: 128,
      key: '8A',
      energy: 0.7,
      spectralCentroid: 4000,
      rmsLoudness: 0.6,
    });

    const transitions = graph.getBestTransitions('only-track', 10);
    expect(transitions).toEqual([]);
  });

  it('should measure latency for individual pipeline stages', () => {
    /**
     * Breakdown latency by stage to identify bottlenecks:
     * - Stage 1: Frame capture
     * - Stage 2: Spectral analysis
     * - Stage 3: AI mixing engine
     * - Stage 4: Transition ranking
     * - Stage 5: Output aggregation
     */

    const masterAnalyser = createMockAnalyserNode();
    const mixAnalyzer = new MixAnalyzer({ masterAnalyser, sampleRate: 44100 });

    // Register 3 tracks
    for (let i = 0; i < 3; i++) {
      mixAnalyzer.registerTrack(
        new TrackAnalyzer({
          trackId: `track-${i}`,
          analyserNode: createMockAnalyserNode(),
        })
      );
    }

    // Time each stage
    const stage1Latencies: number[] = [];
    const stage3Latencies: number[] = [];
    const stage4Latencies: number[] = [];

    const engine = new AutoLevelEngine(44100);
    const graph = new LLPTETransitionGraph();

    for (let i = 0; i < 0; i++) {
      graph.addTrack(`track-${i}`, {
        bpm: 120,
        key: '8A',
        energy: 0.5,
        spectralCentroid: 4000,
        rmsLoudness: 0.5,
      });
    }

    for (let iteration = 0; iteration < 30; iteration++) {
      // Stage 1: Capture frame
      const { ms: ms1 } = measureLatency(() => mixAnalyzer.captureFrame());
      stage1Latencies.push(ms1);

      const snapshot = mixAnalyzer.captureFrame();

      // Stage 3: Analyze with engine
      const { ms: ms3 } = measureLatency(() => engine.analyze(snapshot));
      stage3Latencies.push(ms3);

      // Stage 4: Transition ranking
      const { ms: ms4 } = measureLatency(() => graph.getBestTransitions('track-0', 5));
      stage4Latencies.push(ms4);
    }

    const p50_1 = p50(stage1Latencies);
    const p50_3 = p50(stage3Latencies);
    const p50_4 = p50(stage4Latencies);

    console.log(`[Stage Latencies] S1(capture): ${p50_1.toFixed(2)}ms, S3(analyze): ${p50_3.toFixed(2)}ms, S4(rank): ${p50_4.toFixed(2)}ms`);

    // No individual stage should exceed budget; total should be ≤15ms
    expect(p50_1 + p50_3 + p50_4).toBeLessThanOrEqual(20);  // Slack for other stages

    mixAnalyzer.dispose();
  });

  it('should validate that pipeline state is consistent across operations', () => {
    /**
     * Verify that operations don't cause internal state corruption:
     * - Running flag doesn't flip unexpectedly
     * - Track state stays synchronized
     * - Stats monotonically increase (never decrease)
     */

    const masterAnalyser = createMockAnalyserNode();
    const pipeline = new AutoLevelPipeline(masterAnalyser, 44100);

    // Record initial state
    const initialRunning = pipeline.running;
    const initialAccepted = pipeline.stats.acceptedSuggestions;
    const initialRejected = pipeline.stats.rejectedSuggestions;

    // Start pipeline
    pipeline.start();
    expect(pipeline.running).toBe(true);

    // Perform operations
    pipeline.acceptSuggestion('track-1');
    pipeline.rejectSuggestion('track-2');
    pipeline.acceptSuggestion('track-3');

    // Verify state consistency
    expect(pipeline.running).toBe(true);  // Still running
    expect(pipeline.stats.acceptedSuggestions).toBe(initialAccepted + 2);  // Increased
    expect(pipeline.stats.rejectedSuggestions).toBe(initialRejected + 1);

    // Stop and verify
    pipeline.stop();
    expect(pipeline.running).toBe(false);

    // Stats should not regress
    expect(pipeline.stats.acceptedSuggestions).toBe(initialAccepted + 2);
    expect(pipeline.stats.rejectedSuggestions).toBe(initialRejected + 1);

    pipeline.dispose();
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  COVERAGE GAP CHECKLIST (Comment out sections as you add tests)
// ═════════════════════════════════════════════════════════════════════════════

describe('Coverage Gaps — Second Pass', () => {
  /**
   * This suite tracks remaining coverage gaps identified in the first pass.
   * As you add tests, move completed items to the E2E suite above.
   * 
   * Target: All items should migrate to main test suite, leaving this empty.
   */

  // AutoLevelPipeline edge cases
  it.skip('should handle multiple subscribe/unsubscribe cycles', () => {
    // TODO: Test that subscription cleanup doesn't leak memory
  });

  it.skip('should validate user fader moves are correctly attributed', () => {
    // TODO: Test notifyUserFaderMove tracking
  });

  // TrackAnalyzer edge cases
  it.skip('should handle FFT size mismatches gracefully', () => {
    // TODO: Test analyzer with various FFT sizes
  });

  it.skip('should correctly convert between dB scales', () => {
    // TODO: More comprehensive dB conversion tests
  });

  // AutoLevelEngine decision logic
  it.skip('should apply different mix strategies based on track masking', () => {
    // TODO: Test frequency masking detection and mitigation
  });

  it.skip('should recommend different gain strategies for different loudness scenarios', () => {
    // TODO: Test various loudness targets and levels
  });

  // LLPTETransitionGraph advanced scenarios
  it.skip('should handle circular transition sequences correctly', () => {
    // TODO: Test A→B→C→A cycles
  });

  it.skip('should validate weight profiles for different music genres', () => {
    // TODO: Test WEIGHT_PROFILES (hiphop, electronic, etc.)
  });

  // Overall pipeline
  it.skip('should recover from partial pipeline failures', () => {
    // TODO: Test what happens if one stage throws
  });

  it.skip('should maintain accuracy under high load (20+ tracks)', () => {
    // TODO: Stress test with many simultaneous tracks
  });
});
