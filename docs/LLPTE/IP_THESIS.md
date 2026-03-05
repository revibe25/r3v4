# LLPTE — IP Thesis
## Confidential — Do Not Distribute

### What Is Novel

1. **Weighted Multi-Factor Transition Scoring**
   Simultaneous evaluation of harmonic, energy, spectral, phase, and tempo dimensions.
   Configurable weight matrix per deployment context.

2. **Incremental Directed Transition Graph**
   Only affected edges recomputed on track add/remove.
   O(1) best-next lookup. Fully serializable.

3. **Score-Derived Crossfade Parameter Selection**
   Crossfade duration and curve type determined deterministically from composite score.
   No manual parameter input required.

### What Is Deterministic

Given identical inputs and weight matrix:
- Score is pure functional (no RNG, no time dependency)
- Graph is reproducible from serialized state
- Crossfade scheduling uses AudioContext native scheduler

### Why Not Obvious Over Prior Art

Prior art uses binary checks (BPM within range + key compatible = allow).
LLPTE uses a formal weighted optimization function producing ranked candidates.
The graph representation and O(1) lookup are not present in any known prior art.

### Action Items

- [ ] Patent search: "audio transition scoring graph", "crossfade optimization weighted"
- [ ] Provisional patent application (35 U.S.C. § 111(b))
- [ ] File within 90 days of first public demonstration
- [ ] Document prior art exclusions with citations
- [ ] Engage IP counsel experienced in audio software patents
