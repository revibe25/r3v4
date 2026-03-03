# R3/NATIVE — AI Mixing Engine

## Overview

R3/NATIVE includes a Python-based AI mixing and mastering assistant (`server/ai_mix.py`) that runs as a sidecar service alongside the main Node.js backend. This is one of R3's core differentiators — bringing intelligent audio processing to a browser-based DAW.

---

## Architecture

```
Browser Client
      │
      ▼
Node.js Express Server (TypeScript)
      │
      ▼ HTTP / IPC
Python AI Service (ai_mix.py + main.py)
      │
      ▼
Audio Analysis + ML Inference
```

The Python AI layer communicates with the Node.js backend via internal API calls. It receives audio buffer data or project state, performs analysis, and returns mixing recommendations or automated adjustments.

---

## Agent System (`server/agent/`)

The agent directory houses the orchestration logic for multi-step AI mixing workflows. The agent can:

- Analyze frequency spectrum and identify problematic bands
- Suggest or automatically apply EQ adjustments
- Recommend compression settings based on audio dynamics
- Balance multi-track mixing levels
- Apply genre-aware mastering profiles
- Generate mixing notes and explanations for the user

---

## Key Capabilities

### Automated Mastering
The AI can analyze a finished mix and apply a mastering chain — EQ, limiting, stereo widening — calibrated to target loudness standards (e.g., Spotify -14 LUFS).

### Mix Analysis
Given a multi-track project, the AI identifies:
- Frequency clashing between instruments
- Dynamic range issues
- Stereo imbalance
- Timing inconsistencies

### Intelligent FX Suggestions
Based on the instrument type and musical context, the AI suggests reverb size, delay timing (tempo-synced), and compression ratios appropriate for the material.

---

## Tech Stack

| Component | Technology |
|---|---|
| AI Service | Python 3.10+ |
| ML Framework | (see `server/requirements.txt`) |
| Audio Analysis | librosa / numpy (inferred) |
| Communication | Internal REST API |
| Entry Point | `server/main.py` → `server/ai_mix.py` |

---

## API Integration

The Node.js backend exposes AI mixing capabilities through the main routes layer. Client requests flow:

1. User triggers AI mix from browser
2. Express route handler calls Python service
3. Python analyzes audio/project state
4. Results returned as JSON mixing instructions
5. Frontend applies suggested changes or shows recommendations

---

## Competitive Advantage

Browser-based DAWs that include AI mixing are rare. The combination of:
- Real-time Web Audio API processing
- Server-side Python AI analysis
- VST-style plugin architecture

...represents a technically significant moat. Competitors typically offer either browser playback OR AI mixing, not both in a unified SaaS platform.

---

## Roadmap Potential

- Real-time AI mixing during live performance
- Fine-tuned models for specific genres (EDM, Hip-Hop, Jazz)
- Collaborative AI — multiple users contributing to one AI-assisted mix
- Model personalization based on user's mixing history

---

*See also: [Audio Architecture](./AUDIO_ARCHITECTURE.md) · [Effects Guide](./EFFECTS_GUIDE.md)*
