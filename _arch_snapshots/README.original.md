# R3 v4

> _One-line description of what this project does._

## Prerequisites

- Node.js 20+
- PostgreSQL
- Docker (optional)

## Setup

```bash
cp .env.example .env
# Fill in values in .env

npm install
npm run db:migrate   # if applicable
npm run dev
```

## Environment Variables

See [.env.example](./.env.example) for all required variables.

| Variable | Description |
|---|---|
| `PORT` | HTTP port (default: 3000) |
| `DATABASE_URL` | PostgreSQL connection string |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `APP_URL` | Public URL of the app |
| `MAX_UPLOAD_SIZE_MB` | Max file upload size in MB |
| `MULTIPART_THRESHOLD_MB` | Threshold to switch to multipart |
| `SIGNED_URL_EXPIRES` | Signed URL TTL in seconds |

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Compile TypeScript
npm run start    # Start production server
npm test         # Run tests
```

## Docker

```bash
docker build -t r3-v4 .
docker run --env-file .env -p 3000:3000 r3-v4
```
