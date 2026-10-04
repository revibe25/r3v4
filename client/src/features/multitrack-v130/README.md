# R3 NATIVE Multitrack v1.3 Migration Boundary

This directory is the production migration boundary for the
R3 NATIVE Multitrack v1.3 workstation.

Rules:

1. Do not instantiate a second AudioContext.
2. Do not create a second canonical MIDI owner.
3. Do not replace DAW.tsx.
4. Do not bypass useDAWStore for persistent project state.
5. Do not bypass daw-project-state for persisted project serialization.
6. Do not copy the standalone HTML's global html/body/button/canvas CSS.
7. Reference v1.3 visual and interaction behavior remains the source contract.
8. Every migrated feature must have an explicit adapter to the canonical R3 stack.
9. Existing /multitrack remains rollback-safe until parity verification passes.
