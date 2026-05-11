# Cache bust: 1778539152
FROM node:22-alpine

# Build deps + pnpm
RUN apk add --no-cache python3 py3-pip curl && \
    npm install -g pnpm@10.33.0

WORKDIR /app

# ── Workspace manifest layer (cached unless deps change) ──────────────────────
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json           ./server/
COPY shared/package.json           ./shared/
COPY packages/llpte-signal/package.json  ./packages/llpte-signal/
COPY packages/llpte-ai/package.json      ./packages/llpte-ai/
COPY packages/llpte-core/package.json    ./packages/llpte-core/
COPY packages/llpte-adapters/package.json ./packages/llpte-adapters/
COPY packages/llpte-execution/package.json ./packages/llpte-execution/
COPY packages/llpte-transition-graph/package.json ./packages/llpte-transition-graph/

# Install server + all workspace deps
RUN pnpm install --frozen-lockfile --filter @r3vibe/server...

# ── Source layer ──────────────────────────────────────────────────────────────
COPY server/   ./server/
COPY shared/   ./shared/
COPY packages/ ./packages/
COPY index.ts  ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY drizzle/  ./drizzle/

# ── Non-root user ─────────────────────────────────────────────────────────────
RUN addgroup --system appgroup && \
    adduser --system --ingroup appgroup appuser && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=20s \
  CMD curl -f http://localhost:3000/api/health || exit 1

# tsx handles ESM + TS natively; dotenv loaded via NODE_OPTIONS
CMD ["node", "--import", "dotenv/config", "--loader", "tsx", "index.ts"]
