# 🟩 R3vibe Admin Stack Troubleshooting Guide

---

## 1. Project Structure Overview

- **Monorepo root:** `~/Stable`
- **Client (Frontend):** `~/Stable/client`
  - React, Wouter router, Vite, TypeScript
  - Routes: `src/App.tsx`
  - Pages: `src/pages/`
- **Server (Backend):** `~/Stable/server`
  - Node.js, TypeScript, TRPC
  - Reads config from `.env`
- **.env Main Location:**  
  - `~/Stable/.env` (used by both sides via process env)

---

## 2. Database & Credentials

- **Database:** PostgreSQL (usually local)
- **Admin user:** Managed in the `users` table, _not_ via `.env`
- **Typical connection:**  
  ```
  DATABASE_URL=postgresql://r3:r3vibe@localhost:5432/r3vibe
  ```
- **Password storage:** bcrypt hash  
  - `r3admin2024` → `$2b$12$hTzofp6lgqoqYE0M39aEjemz1/3i.T2jKdDJYWCHO67gIV8TSUmSG`
- **User creation/seeding:**  
  - Via SQL or a `seed` script from `~/Stable/server/db/seed`

---

## 3. Authentication Flow

- **Endpoints:**  
  - `/api/auth/login`
  - Credentials checked against the database
- **Admin restore:**  
  - Only reliably accomplished by direct SQL update/insert for `r3admin`

---

## 4. Common Issues & Resolutions

### A. DB Connection/ENOTFOUND

**Symptom:**  
`ENOTFOUND` error in server logs, login fails

**Root Cause:**  
`DATABASE_URL` in `.env` is incomplete (e.g., `...` instead of `localhost`)

**Fix:**  
```env
DATABASE_URL=postgresql://r3:r3vibe@localhost:5432/r3vibe
```
Then restart the backend:  
```sh
cd ~/Stable && pnpm dev
```

---

### B. Password Mismatch/Locked Out

**Symptom:**  
Login fails for `r3admin`, 401

**Root Cause:**  
Password is not as expected or needs to be seeded/reset.

**Fix:**  
1. Connect to the database:
   ```sh
   psql postgresql://r3:r3vibe@localhost:5432/r3vibe
   ```
2. Set admin password:
   ```sql
   UPDATE users SET password='$2b$12$hTzofp6lgqoqYE0M39aEjemz1/3i.T2jKdDJYWCHO67gIV8TSUmSG' WHERE username='r3admin';
   ```
3. If not present:
   ```sql
   INSERT INTO users (id, username, password, email, tier, is_admin)
   VALUES (gen_random_uuid(), 'r3admin', '$2b$12$hTzofp6lgqoqYE0M39aEjemz1/3i.T2jKdDJYWCHO67gIV8TSUmSG', 'admin@r3vibe.com', 'pro', true)
   ON CONFLICT (username) DO UPDATE SET password = '$2b$12$hTzofp6lgqoqYE0M39aEjemz1/3i.T2jKdDJYWCHO67gIV8TSUmSG';
   ```
   - This hash is for password: `r3admin2024`.

---

### C. 404/"Route Does Not Exist" (e.g. `/visual`)

**Symptom:**  
404 error after login, especially at `/visual`

**Root Cause:**  
Route not registered in `src/App.tsx`

**Fix:**  
In `src/App.tsx`, add an alias just after `/visuals`:
```tsx
<Route path="/visuals">
  <ProtectedRoute><VisualsPage /></ProtectedRoute>
</Route>
<Route path="/visual">
  <ProtectedRoute><VisualsPage /></ProtectedRoute>
</Route>
```
Or for a redirect:
```tsx
<Route path="/visual">
  <Redirect to="/visuals" />
</Route>
```

Save, then reload your browser.

---

### D. TypeScript Build Errors

**Symptom:**  
TypeScript errors (type union, unknown, etc.)

**Root Cause:**  
Types out of sync between usage and declaration

**Fix:**
- Update type unions and shared declarations, e.g., ensure `TrackState` includes all correct states.
- Test:
  ```sh
  npx tsc --noEmit
  ```

---

### E. AudioContext Not Allowed Warnings

**Symptom:**  
Browser warns: `AudioContext was not allowed to start...`

**Root Cause:**  
Audio must start after a user gesture per browser autoplay policies.

**Fix:**  
Only start audio code in response to a real user event.  
_Not critical for admin or stack troubleshooting._

---

## 5. Full Admin Access Restore: Checklist

```sh
# 1. DB running
sudo systemctl status postgresql

# 2. Check .env
grep DATABASE_URL ~/Stable/.env
# Should be: DATABASE_URL=postgresql://r3:r3vibe@localhost:5432/r3vibe

# 3. Restart backend
cd ~/Stable && pnpm dev

# 4. Set admin login in DB
psql postgresql://r3:r3vibe@localhost:5432/r3vibe
# Then, in psql:
UPDATE users SET password='$2b$12$hTzofp6lgqoqYE0M39aEjemz1/3i.T2jKdDJYWCHO67gIV8TSUmSG' WHERE username='r3admin';
# or, if missing:
INSERT INTO users (id, username, password, email, tier, is_admin)
VALUES (gen_random_uuid(), 'r3admin', '$2b$12$hTzofp6lgqoqYE0M39aEjemz1/3i.T2jKdDJYWCHO67gIV8TSUmSG', 'admin@r3vibe.com', 'pro', true)
ON CONFLICT (username) DO UPDATE SET password = '$2b$12$hTzofp6lgqoqYE0M39aEjemz1/3i.T2jKdDJYWCHO67gIV8TSUmSG';

# 5. /visual 404?
# Add route alias or redirect in src/App.tsx as above
```

---

## 6. Backup & Recovery Steps

- Backup files are created with `.bak_*` extensions.
- Use `git` for robust version tracking.
- Restore admin via direct SQL if ever locked out.

---

## 7. Security Notes

- Never deploy with default passwords in production.
- Postgres should bind only to localhost in dev.
- Do not commit `.env` to public repositories.

---

## Summary Table

| Problem                | Symptom           | Fix                           |
|------------------------|-------------------|-------------------------------|
| Wrong DB URL           | ENOTFOUND         | Set correct `DATABASE_URL`    |
| Can't login as admin   | 401 on login      | Update admin password in DB   |
| /visual 404            | 404 in browser    | Add route alias in `App.tsx`  |
| TypeScript build error | tsc errors        | Update shared types/unions    |
| AudioContext warning   | Console warning   | User gesture for audio start  |

---

**For further help, paste your log/error and get targeted fixes.**
