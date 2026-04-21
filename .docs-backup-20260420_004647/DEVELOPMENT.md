# R3 v4 — Development Guide

**Version:** 2.0.0  
**Last Updated:** 2026-04-12

---

## 🚀 Getting Started

### Prerequisites

```bash
# Required
Node.js 22.x Active LTS (https://nodejs.org)
pnpm 10.33.0  — install: npm install -g pnpm
Git

# Recommended
VSCode (https://code.visualstudio.com)
Postman (API testing)
Git Graph (commit visualization)
```

### Initial Setup

```bash
# Clone repository
git clone https://github.com/Berryboy93/r3v4.git
cd r3v4

# Install dependencies (use pnpm — never npm install)
pnpm install --frozen-lockfile

# Copy environment file
cp .env.example .env

# Start development server (client + server concurrently)
pnpm dev
```

### Verify Installation

```bash
# Run full test suite (42+ Vitest cases across LLPTE packages)
pnpm test

# TypeScript check — must be zero errors
pnpm tsc --noEmit

# Build for production
pnpm build

# Run hygiene audit
python3 r3_hygiene.py
```

---

## 📁 Project Structure

```
~/Stable/                       # Canonical dev machine — Kali Linux
├── client/                     # React 18 frontend (Vite 5.4.21)
│   └── src/
│       ├── pages/              # DAW.tsx, instrument.tsx, pricing/, etc.
│       ├── components/         # Shared UI components
│       ├── hooks/              # Zustand stores + tRPC hooks
│       │   └── authStore.ts    # CANONICAL auth store — import ONLY here
│       └── features/           # Feature slices (loopstation, etc.)
├── server/                     # Express 4.22.1 + tRPC backend
│   ├── routers/                # 11 tRPC routers
│   ├── services/               # session-metrics, ai-mix, stripe, etc.
│   ├── db/                     # Drizzle schema + migrations
│   └── procedures.ts           # appRouter wiring — ALL routers here
├── packages/                   # LLPTE monorepo packages
│   ├── llpte-core/
│   ├── llpte-signal/
│   ├── llpte-ai/
│   ├── llpte-adapters/
│   ├── llpte-transition-graph/
│   └── llpte-execution/
├── shared/                     # Shared types + schema
├── drizzle/migrations/         # Migration SQL files
├── docs/                       # CLAUDE.md, WIRE.txt, SKILLS.md, PRD, etc.
└── pnpm-workspace.yaml         # Monorepo config
```

---

## 🛠️ Development Workflow

### Start Development Environment

```bash
# Single command runs both client + server concurrently
pnpm dev
# Client: http://localhost:5173
# Server: http://localhost:3000

# Drizzle Studio (optional — local DB inspection)
pnpm drizzle-kit studio
# Runs on http://localhost:4983
```

### Using Hot Module Replacement (HMR)

```javascript
// Frontend changes auto-reload
// Edit src/components/... → Auto-refresh browser

// Backend needs restart
// Edit server/... → npm restart needed
```

### Code Style & Linting

```bash
# Format code
pnpm format

# Check for linting errors
pnpm lint

# Fix linting issues automatically
pnpm lint:fix

# Type checking
pnpm tsc --noEmit
```

---

## 📝 Code Examples

### Creating a New Effect

```typescript
// src/audio/effects/my-effect.ts
import * as Tone from 'tone';
import { MyEffectParams } from '../../shared/effects.types';

export class MyEffect {
  private input: Tone.Gain;
  private output: Tone.Gain;
  private params: MyEffectParams;

  constructor(audioContext: Tone.Destination) {
    this.input = new Tone.Gain();
    this.output = new Tone.Gain().connect(audioContext);
    this.input.connect(this.output);

    this.params = {
      enabled: true,
      parameter1: 0.5,
      wet: 0.5,
      dry: 0.5,
    };
  }

  setParams(params: Partial<MyEffectParams>): void {
    this.params = { ...this.params, ...params };
    this.applyParams();
  }

  private applyParams(): void {
    if (!this.params.enabled) return;
    // Apply effect logic
  }

  connect(source: Tone.ToneAudioNode | AudioNode): this {
    source.connect(this.input);
    return this;
  }

  dispose(): void {
    this.input.dispose();
    this.output.dispose();
  }
}
```

### Creating a React Component

```typescript
// src/components/my-control/index.tsx
import React, { useState } from 'react';
import { useDAWStore } from '../../hooks/useDAWStore'; // Zustand — canonical store
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

interface MyControlProps {
  label: string;
  onValueChange?: (value: number) => void;
}

export const MyControl: React.FC<MyControlProps> = ({
  label,
  onValueChange,
}) => {
  const [value, setValue] = useState(0.5);
  const { setEffectParam } = useDAWStore();

  const handleChange = (values: number[]) => {
    const newValue = values[0];
    setValue(newValue);
    
    setEffectParam('my-effect', { parameter: newValue });
    onValueChange?.(newValue);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <Slider
        value={[value]}
        min={0}
        max={1}
        step={0.01}
        onValueChange={handleChange}
      />
      <span className="text-xs text-gray-400">{(value * 100).toFixed(0)}%</span>
    </div>
  );
};
```

### Adding a New tRPC Procedure (Preferred)

> R3 v4 uses tRPC for all API communication. New endpoints should be tRPC procedures
> added to an existing router in `server/routers/`. Wire into `server/procedures.ts`.
> See API_REFERENCE.md for the full router shape. REST endpoints (below) only exist
> for legacy effects/waveform surface.

### Adding a Legacy REST Endpoint

```typescript
// server/routes/my-api.ts
import { Router } from 'express';
import { db } from '../db/index';

const router = Router();

// GET endpoint
router.get('/items', async (req, res) => {
  try {
    const items = await db.select().from(itemsTable);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST endpoint
router.post('/items', async (req, res) => {
  try {
    const { name, value } = req.body;
    
    // Validation
    if (!name) {
      return res.status(400).json({ error: 'Name required' });
    }

    const newItem = await db.insert(itemsTable).values({
      name,
      value,
    });

    res.status(201).json(newItem);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create item' });
  }
});

export default router;
```

---

## 🧪 Testing

### Unit Tests

```bash
# Run all tests (42+ Vitest cases across LLPTE packages)
pnpm test

# Run specific test file
pnpm vitest run packages/llpte-core/tests/

# Watch mode
pnpm vitest watch

# Coverage report
pnpm vitest --coverage
```

### Test Template

```typescript
// __tests__/effects.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReverbEffect } from '../src/audio/effects/reverb';
import * as Tone from 'tone';

describe('ReverbEffect', () => {
  let reverb: ReverbEffect;
  let destination: Tone.Destination;

  beforeEach(async () => {
    await Tone.start();
    destination = Tone.Destination;
    reverb = new ReverbEffect(destination);
  });

  afterEach(() => {
    reverb.dispose();
  });

  it('should initialize with default params', () => {
    const params = reverb.getParams();
    expect(params.enabled).toBe(true);
    expect(params.wet).toBeCloseTo(0.3);
  });

  it('should update params', () => {
    reverb.setParams({ wet: 0.5 });
    const params = reverb.getParams();
    expect(params.wet).toBeCloseTo(0.5);
  });

  it('should handle disposal', () => {
    expect(() => reverb.dispose()).not.toThrow();
  });
});
```

### Integration Tests

```bash
# Test full audio pipeline
pnpm test:integration

# Test API endpoints
pnpm test:api

# E2E tests (UI)
pnpm test:e2e
```

---

## 🐛 Debugging

### VS Code Debugging

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "chrome",
      "request": "launch",
      "name": "Launch Frontend",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/client",
      "sourceMaps": true
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Launch Backend",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev:server"],
      "cwd": "${workspaceFolder}",
      "console": "integratedTerminal"
    }
  ]
}
```

### Browser DevTools

```javascript
// Console - Check audio context
Tone.Context.getContext()

// Performance - Profile audio processing
performance.mark('process-start');
// ... do work ...
performance.mark('process-end');
performance.measure('process', 'process-start', 'process-end');

// Memory - Check for leaks
performance.memory

// Network - Monitor API calls
// Open DevTools → Network tab → Reload
```

### Logging

```typescript
// Structured logging only — no console.log in committed code (CLAUDE.md hard guard)
import { logger } from '../utils/logger'; // Morgan-based structured logger
logger.info('Effect loaded', { effectType: 'reverb' });
logger.warn('High CPU usage', { cpuLoad: 85 });
logger.error('Audio context failed', error);
```

---

## 🔄 Git Workflow

### Branch Naming

```bash
# Feature branch
git checkout -b feature/drum-machine-update

# Bug fix branch
git checkout -b fix/audio-latency

# Chore branch
git checkout -b chore/dependencies-update
```

### Commit Messages

```bash
# Format: type(scope): description
git commit -m "feat(effects): add reverb effect"
git commit -m "fix(dj): reduce crossfader latency"
git commit -m "docs(readme): update setup instructions"
git commit -m "test(effects): add reverb tests"
```

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `test` - Test updates
- `chore` - Maintenance
- `refactor` - Code restructuring
- `perf` - Performance improvement

### Pull Request Process

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and commit
git add .
git commit -m "feat: describe change"

# Push to GitHub
git push origin feature/my-feature

# Create PR on GitHub
# Add description, link issues, request reviewers
```

---

## 📦 Building & Deployment

### Build for Development

```bash
pnpm build:dev
# Creates unminified build with source maps
```

### Build for Production

```bash
pnpm build
# Creates optimized, minified build
```

### Build for Deployment

```bash
# Railway (backend) auto-deploys on push to main
# Vercel (frontend) auto-deploys on push to main
# Manual deploy trigger:
railway up          # backend
vercel --prod       # frontend
```

### Docker Build

```dockerfile
# Dockerfile
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

```bash
# Build image
docker build -t r3vibe:latest .

# Run container
docker run -p 3000:3000 r3vibe:latest
```

---

## 📊 Performance Optimization

### Bundle Analysis

```bash
# Analyze bundle size
pnpm analyze

# View interactive treemap
# Check what's taking space
```

### Profiling Audio

```javascript
// Profile effect processing
const startTime = performance.now();

for (let i = 0; i < 1000; i++) {
  reverb.setParams({ wet: Math.random() });
}

const elapsed = performance.now() - startTime;
// logger.info(`Avg time per call: ${(elapsed / 1000).toFixed(3)}ms`)
```

### Code Splitting

```typescript
// Dynamic imports for lazy loading
const WaveformEditor = React.lazy(() =>
  import('./components/waveform-editor')
);

export const App = () => (
  <Suspense fallback={<div>Loading...</div>}>
    <WaveformEditor />
  </Suspense>
);
```

---

## 🔐 Security Best Practices

### Validation

```typescript
// Always validate user input
import { z } from 'zod';

const effectParamsSchema = z.object({
  wet: z.number().min(0).max(1),
  dry: z.number().min(0).max(1),
  enabled: z.boolean(),
});

const validated = effectParamsSchema.parse(userInput);
```

### API Security

```typescript
// Helmet for HTTP headers
import helmet from 'helmet';
app.use(helmet());

// CORS configuration
import cors from 'cors';
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true,
}));

// Rate limiting
import rateLimit from 'express-rate-limit';
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use('/api/', limiter);
```

### Authentication

```typescript
// Require authentication for sensitive endpoints
app.post('/api/presets', authenticateToken, (req, res) => {
  // Only authenticated users can save presets
});

function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  
  // Verify token...
  next();
}
```

---

## 📚 Documentation Standards

### Code Comments

```typescript
/**
 * Applies reverb effect to audio signal
 * @param params - Reverb parameters
 * @param params.wet - Wet signal amount (0-1)
 * @param params.roomSize - Room size (0-1)
 * @returns Modified audio signal
 * @example
 * reverb.setParams({ wet: 0.3, roomSize: 0.7 });
 */
public setParams(params: Partial<ReverbParams>): void {
  // Implementation...
}
```

### README Updates

Always update README when adding features:

```markdown
## Features

- 16-Pad Drum Machine (new in 1.0.2)
- 12-Key Piano
- Professional Effects
  - Reverb
  - Delay
  - **New: Custom Filter**

## Installation

[Updated instructions...]
```

---

## 🚀 Continuous Integration

### GitHub Actions

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 22
      
      - run: npm install -g pnpm && pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm build
```

---

## 📞 Contributing

### Code Review Process

1. **Self-review**
   - Read your own code
   - Check for obvious errors
   - Verify tests pass

2. **Request review**
   - Add 2+ reviewers
   - Explain changes
   - Reference related issues

3. **Address feedback**
   - Make requested changes
   - Re-request review
   - Keep conversation professional

### Common Issues in Review

```javascript
// ❌ Missing error handling
await fetchPresets();

// ✅ Proper error handling
try {
  await fetchPresets();
} catch (error) {
  console.error('Failed to load presets:', error);
  showErrorToast('Could not load presets');
}

// ❌ No type safety
const effect = { name: 'Reverb', ... };

// ✅ Type-safe
const effect: EffectPreset = { name: 'Reverb', ... };

// ❌ Magic numbers
const timeout = 5000;

// ✅ Named constants
const PRESET_LOAD_TIMEOUT_MS = 5000;
```

---

## 🎓 Learning Resources

### Audio Development
- Web Audio API: https://www.w3.org/TR/webaudio/
- Tone.js Tutorial: https://tonejs.org/
- Audio DSP: https://www.youtube.com/c/TheAudioProgrammer

### React Development
- React Docs: https://react.dev
- Zustand: https://github.com/pmndrs/zustand
- Tailwind CSS: https://tailwindcss.com/

### Backend Development
- Express.js: https://expressjs.com/
- Drizzle ORM: https://orm.drizzle.team/
- Node.js: https://nodejs.org/

### DevOps
- Docker: https://www.docker.com/
- GitHub Actions: https://github.com/features/actions
- Railway Docs: https://docs.railway.app/

---

## ✅ Pre-Release Checklist

- [ ] All tests passing
- [ ] No console errors/warnings
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Changelog updated
- [ ] Version bumped
- [ ] Build artifacts created
- [ ] Security audit passed
- [ ] Cross-platform tested
- [ ] Release notes written

---

**Happy coding! 🚀**

For questions, open an issue on GitHub.
R3 v4 repo: https://github.com/Berryboy93/r3v4
Engineering protocol: docs/WIRE.txt | docs/CLAUDE.md