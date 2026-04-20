FROM node:22-alpine

# Install build dependencies + pnpm
RUN apk add --no-cache python3 py3-pip && \
    npm install -g pnpm

WORKDIR /app

# Copy entire workspace config
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/

# Install ALL workspace deps from root (resolves cross-package imports correctly)
RUN pnpm install --frozen-lockfile --filter @r3vibe/server... 

# The ... suffix means: install server AND all its workspace dependencies
# This includes shared/ and any root-level packages server/ imports from

# Copy source
COPY server/ ./server/
COPY shared/ ./shared/
COPY index.ts ./
COPY tsconfig.json ./
COPY drizzle.config.ts ./
COPY drizzle/ ./drizzle/

EXPOSE 3000

# Run as non-root
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

CMD ["pnpm", "exec", "tsx", "index.ts"]
