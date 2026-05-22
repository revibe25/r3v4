# Cache bust: 1778539153
FROM node:22-alpine
RUN apk add --no-cache python3 py3-pip curl && \
    npm install -g pnpm@10.33.0
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json           ./server/
COPY shared/package.json           ./shared/
COPY packages/llpte-signal/package.json  ./packages/llpte-signal/
COPY packages/llpte-ai/package.json      ./packages/llpte-ai/
COPY packages/llpte-core/package.json    ./packages/llpte-core/
COPY packages/llpte-adapters/package.json ./packages/llpte-adapters/
COPY packages/llpte-execution/package.json ./packages/llpte-execution/
COPY packages/llpte-transition-graph/package.json ./packages/llpte-transition-graph/
RUN pnpm install --frozen-lockfile --filter @r3vibe/server...
COPY server/   ./server/
COPY shared/   ./shared/
COPY packages/ ./packages/
COPY index.ts  ./
COPY tsconfig.json ./
COPY server/drizzle.config.ts ./
COPY drizzle/  ./drizzle/
RUN addgroup --system appgroup && \
    adduser --system --ingroup appgroup appuser && \
    chown -R appuser:appgroup /app
USER appuser
EXPOSE 8080
# HEALTHCHECK uses Railway-injected PORT (default 8080)
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
  CMD curl -f http://localhost:${PORT:-8080}/api/health || exit 1
CMD ["node", "--import", "dotenv/config", "--loader", "tsx", "index.ts"]
