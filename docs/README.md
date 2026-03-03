# R3/NATIVE — Professional Browser-Based DAW & Virtual Instrument Platform

> **Designed by Ernesto · Built on Web Audio API · Powered by AI**

R3/NATIVE is a full-stack SaaS platform that brings professional-grade digital audio workstation (DAW) capabilities to the browser. Create, perform, and share music with virtual instruments, a multi-track DAW engine, AI-assisted mixing, and real-time collaboration — no downloads required.

---

## ✨ Feature Overview

| Feature | Description |
|---|---|
| 🥁 **Drum Pads** | 16-pad velocity-sensitive grid, drag-and-drop samples, keyboard shortcuts |
| 🎹 **Piano Keys** | 2-octave polyphonic keyboard, auto-chord, velocity sensitivity |
| 🎚 **Multi-Track DAW** | Full DAW engine with track management and audio routing |
| 🤖 **AI Mixing** | Python-based AI mix assistant for automated mastering and FX suggestions |
| 🎛 **VST System** | Browser-native VST-style plugin architecture |
| 📊 **Visualizer** | Real-time spectrum analyzer with 12+ visual modes |
| 🎧 **DJ Controls** | Crossfader, EQ, cue points, BPM sync |
| 🎵 **MIDI Support** | Full MIDI I/O via WebMIDI API — works with any hardware controller |
| ☁️ **Cloud Storage** | Projects, samples, and presets synced via AWS S3 |
| 📱 **Mobile-Friendly** | Responsive design, touch support on iOS and Android |

---

## 🏗 Architecture

```
R3/NATIVE
├── client/          # React + Vite frontend (TypeScript)
├── server/          # Express + Node.js backend (TypeScript)
│   ├── agent/       # AI agent system
│   ├── ai_mix.py    # Python AI mixing engine
│   ├── routes/      # API route handlers
│   └── services/    # Business logic layer
├── shared/          # Shared TypeScript types & schema
└── docs/            # Architecture & API documentation
```

**Frontend Stack:** React 18, Vite, Tailwind CSS, shadcn/ui, Radix UI, Framer Motion, Three.js, Tone.js, Web Audio API, WebMIDI API

**Backend Stack:** Node.js, Express, TypeScript, Python (AI layer), PostgreSQL, Drizzle ORM, Passport.js, JWT, AWS S3, Stripe

**Infrastructure:** Docker, Docker Compose, Nginx reverse proxy, PostgreSQL

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- PostgreSQL 15+
- Docker & Docker Compose (for production)

### Local Development

```bash
# 1. Clone and install dependencies
git clone <repo>
cd r3-native
npm install

# 2. Set environment variables
cp .env.example .env
# Fill in: DATABASE_URL, AWS credentials, Stripe keys, JWT secret

# 3. Run database migrations
npm run db:migrate

# 4. Start development servers (client + server concurrently)
npm run dev
```

### Production (Docker)

```bash
docker-compose up -d
```

Nginx handles SSL termination and proxies to the Node.js backend.

---

## ⚙️ Environment Variables

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | ✅ |
| `AWS_ACCESS_KEY_ID` | AWS S3 access key | ✅ |
| `AWS_SECRET_ACCESS_KEY` | AWS S3 secret key | ✅ |
| `AWS_S3_BUCKET` | S3 bucket name for uploads | ✅ |
| `STRIPE_SECRET_KEY` | Stripe API secret key | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | ✅ |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | ✅ |
| `SESSION_SECRET` | Express session secret | ✅ |
| `PORT` | Server port (default: 3000) | ❌ |
| `NODE_ENV` | `development` or `production` | ❌ |

---

## 📁 Upload Structure

```
uploads/
├── samples/    # User-uploaded audio samples
├── presets/    # Instrument & FX preset configs
└── projects/   # Saved DAW project files
```

---

## 📖 Documentation

| Doc | Description |
|---|---|
| [API Reference](./docs/API_REFERENCE.md) | Full REST API documentation |
| [Audio Architecture](./docs/AUDIO_ARCHITECTURE.md) | Web Audio engine design |
| [Effects Guide](./docs/EFFECTS_GUIDE.md) | FX chain documentation |
| [DJ Controls](./docs/DJ_CONTROLS.md) | DJ mode reference |
| [Waveform Editor](./docs/WAVEFORM_EDITOR.md) | Waveform editing system |
| [Development Guide](./docs/DEVELOPMENT.md) | Contributing & dev workflow |
| [Troubleshooting](./docs/TROUBLESHOOTING.md) | Common issues & fixes |

---

## 💳 Subscription & Billing

R3/NATIVE is a SaaS platform powered by Stripe. Subscription tiers, billing cycles, and usage limits are managed through the Stripe billing portal. See `server/routes/` for billing route implementation.

---

## 📜 License

See [docs/Licensing.md](./docs/Licensing.md) for full licensing terms.

---

## 👤 Author

**Ernesto** — Designed and built R3/NATIVE  
Contact: Available upon acquisition inquiry

---

*R3/NATIVE v4.0 · © 2026 All Rights Reserved*
