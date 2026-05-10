# 🍀 R3vibe Backup & Restore

## App Code

Take regular `git` snapshots.  
Back up `/Stable` folder and `/docs` with:
```sh
tar czf stable_code_$(date +%F).tar.gz ~/Stable
```

## Database

**Backup:**
```sh
pg_dump -U r3 r3vibe > r3vibe_db_dump_$(date +%F).sql
```
**Restore:**
```sh
psql -U r3 -d r3vibe < r3vibe_db_dump_YYYY-MM-DD.sql
```

## .env and Secrets

Backup `.env` to an encrypted volume or password manager.  
Optionally, rotate `INTERNAL_SECRET` on restore.

---

**Automate backups where possible and keep offsite weekly/monthly!**