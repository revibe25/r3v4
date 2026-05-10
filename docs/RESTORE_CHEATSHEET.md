# 🟢 R3vibe Stack Restore Cheatsheet

## 1. Database Restore (from SQL dump)

```sh
sudo systemctl start postgresql
psql -U r3 -d r3vibe < /path/to/your/dump.sql
```

## 2. .env Restore

Overwrite current .env with last-known-good or use `.env.example` as template.

## 3. Admin Access Recovery (if locked out)

```sh
psql postgresql://r3:YOUR_PASSWORD@localhost:5432/r3vibe
UPDATE users SET password='<bcrypt hash for known password>' WHERE username='r3admin';
-- Or, if missing:
INSERT INTO users (id, username, password, email, tier, is_admin)
VALUES (gen_random_uuid(), 'r3admin', '<bcrypt hash>', 'admin@r3vibe.com', 'pro', true)
ON CONFLICT (username) DO UPDATE SET password = '<bcrypt hash>';
```

## 4. Services restart

```sh
cd ~/Stable && pnpm dev
```

## 5. Verify

- Login as admin through UI.
- Run: `npx tsc --noEmit` for type health if needed.