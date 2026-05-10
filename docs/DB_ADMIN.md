# 🗄️  R3vibe Database Admin Guide

## Users Table

- Username: `r3admin`
- Password: bcrypt hash (12 rounds)
- Required fields: `id` (uuid), `username`, `password`, `email`, `is_admin`

## Common Commands

**List admins:**
```sql
SELECT username, email FROM users WHERE is_admin = true;
```

**Reset admin password:**
```sql
UPDATE users SET password='<bcrypt hash>' WHERE username='r3admin';
```

**Create admin if missing:**
```sql
INSERT INTO users (id, username, password, email, tier, is_admin)
VALUES (gen_random_uuid(), 'r3admin', '<bcrypt hash>', 'admin@r3vibe.com', 'pro', true)
ON CONFLICT (username) DO UPDATE SET password = '<bcrypt hash>';
```

**Hash a password:**
- Use your app’s bcrypt util or CLI tool:  
  ```sh
  node -e 'console.log(require("bcryptjs").hashSync("mysecret",12))'
  ```

**Connect to DB:**
```sh
psql postgresql://r3:YOUR_DB_PASSWORD@localhost:5432/r3vibe
```