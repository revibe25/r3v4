# 🚦 R3vibe Deployment Guide

## Local to Prod Deployment (Manual)

1. **Push code to prod**
   ```sh
   git push production main
   ssh yourprodhost
   cd ~/Stable && git pull
   pnpm install
   ```

2. **Update environment config**
   Make sure `.env` exists with correct secrets and database credentials.

3. **(Re)build and restart**
   ```sh
   pnpm build
   pm2 restart all
   # or `pnpm dev` for dev
   ```

4. **DB Migrations**
   Run your migration tool or seed scripts if needed.

5. **Verify**
   - UI and API endpoints load without error
   - Check login, `/visuals` route, etc.

## Rollback

- Restore from backup.
- Reset DB using last SQL dump if applicable.
- Restore `.env` and secrets.

## Gotcha Checklist

- Never deploy with default admin password!
- Always verify actual DB and .env match environment you intend to use.