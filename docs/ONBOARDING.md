# 🚀 R3vibe New Dev Onboarding

## Tools Needed

- Node.js v18+
- pnpm
- PostgreSQL 13+
- Linux/mac recommended

## Fast Start

1. Clone, checkout main branch
2. Install deps: `pnpm install`
3. Copy and fill `.env` (`cp .env.example .env`)
4. Start Postgres, create role+db if missing
5. `pnpm dev`
6. Login: http://localhost:5174
7. If you can't log in, see RESTORE_CHEATSHEET.md
8. For schema/code/infra reference, see `/docs`

---

**Pro Tips:**  
Keep `BACKUP_RESTORE.md` handy before making major changes.  
Sync with lead dev before running migrations or seeds in prod!

---