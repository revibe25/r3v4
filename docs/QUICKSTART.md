# 🚀 R3vibe Dev Quickstart

1. **Clone repo**
   ```sh
   git clone <REPO_URL>
   cd ~/Stable
   ```

2. **Install deps**
   ```sh
   pnpm install
   ```

3. **Copy & fill .env**
   ```sh
   cp .env.example .env
   # Edit to fill DB password, secret, etc
   ```

4. **Setup DB**
   ```sh
   sudo systemctl start postgresql
   createdb -U r3 r3vibe
   # Optionally: seed DB from SQL or skip to UI for user creation
   ```

5. **Run dev stack**
   ```sh
   pnpm dev
   # Will start both server and client (concurrently)
   ```

6. **Access App**
   - UI: http://localhost:5174
   - API: http://localhost:3000

7. **First admin login**
   - If locked out, see RESTORE_CHEATSHEET.md

---

**Requirements:**  
- Node.js (v18+ recommended), pnpm, Postgres 13+
- See DEVELOPMENT.md for more