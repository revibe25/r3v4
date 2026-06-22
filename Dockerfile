FROM node:22-alpine

# Cache bust: 1780282105 — forces Railway to rebuild from scratch
ARG CACHEBUST=1780282105
RUN echo "build $CACHEBUST"

RUN apk add --no-cache python3 py3-pip curl && \
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
RUN pnpm --filter @r3vibe/shared build && pnpm --filter @llpte/llpte-signal build && pnpm --filter @llpte/llpte-core build && pnpm --filter @llpte/llpte-ai build && pnpm --filter @llpte/llpte-adapters build && pnpm --filter @llpte/llpte-execution build && pnpm --filter @llpte/llpte-transition-graph build

# Layer 4: build server
RUN pnpm --filter @r3vibe/server build

# Layer 5: runtime hardening
RUN addgroup --system appgroup && \
    adduser --system --ingroup appgroup appuser && \
    chown -R appuser:appgroup /app
USER appuser
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:${PORT:-3000}/api/health || exit 1
CMD ["node", "server/dist/index.js"]
