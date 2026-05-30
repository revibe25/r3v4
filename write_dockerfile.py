#!/usr/bin/env python3
"""Writes a clean Dockerfile to ~/Stable/Dockerfile — no heredoc corruption."""
from pathlib import Path
import time

content = '''FROM node:22-alpine

# Cache bust: {ts} — forces Railway to rebuild from scratch
ARG CACHEBUST={ts}
RUN echo "build $CACHEBUST"

RUN apk add --no-cache python3 py3-pip curl && \\
    npm install -g pnpm@10.33.0
WORKDIR /app

# Layer 1: manifests only (pnpm install cache layer)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json                               ./server/
COPY shared/package.json                               ./shared/
COPY packages/llpte-signal/package.json                ./packages/llpte-signal/
COPY packages/llpte-ai/package.json                    ./packages/llpte-ai/
COPY packages/llpte-core/package.json                  ./packages/llpte-core/
COPY packages/llpte-adapters/package.json              ./packages/llpte-adapters/
COPY packages/llpte-execution/package.json             ./packages/llpte-execution/
COPY packages/llpte-transition-graph/package.json      ./packages/llpte-transition-graph/
RUN pnpm install --frozen-lockfile

# Layer 2: source
COPY server/   ./server/
COPY shared/   ./shared/
COPY packages/ ./packages/
COPY index.ts tsconfig.json ./
COPY drizzle/  ./drizzle/

# Layer 3: build LLPTE packages first (server imports from their dist/)
RUN pnpm --filter "@llpte/*" build

# Layer 4: build server
RUN pnpm --filter "@r3vibe/server" build

# Layer 5: runtime hardening
RUN addgroup --system appgroup && \\
    adduser --system --ingroup appgroup appuser && \\
    chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \\
  CMD curl -f http://localhost:${{PORT:-3000}}/api/health || exit 1
CMD ["node", "dist/server/index.js"]
'''.format(ts=int(time.time()))

f = Path.home() / "Stable/Dockerfile"
f.write_text(content)
print(f"Written: {f}")
print(f"Lines: {len(content.splitlines())}")
# Verify key lines present
for check in ["ARG CACHEBUST", "pnpm --filter", "@llpte/*", "@r3vibe/server", 'CMD ["node"']:
    assert check in content, f"MISSING: {check}"
    print(f"  OK: {check}")
