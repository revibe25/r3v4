FROM node:20-alpine

RUN apk add --no-cache python3 py3-pip

WORKDIR /app
COPY package*.json ./
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

WORKDIR /app/client
COPY pnpm-workspace.yaml pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
RUN npm run build

WORKDIR /app
EXPOSE 5000
# Run as non-root
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

CMD ["npm", "start"]
