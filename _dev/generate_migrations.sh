#!/bin/bash
set -e

# =========================
# ⚡ Config
# =========================
ROOT="$HOME/Stable/R3 v4"
DB_NAME="r3vibe"
DB_USER="postgres"
DB_PASSWORD="your_postgres_password"  # <-- replace with your real password
DB_HOST="localhost"
MIGRATIONS_DIR="$ROOT/drizzle/migrations"

export DATABASE_URL="postgres://$DB_USER:$DB_PASSWORD@$DB_HOST:5432/$DB_NAME"

# =========================
# 1️⃣ Backup database
# =========================
echo "💾 Backing up database..."
PGPASSWORD="$DB_PASSWORD" pg_dump -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" > "$ROOT/backup_before_saas_upgrade.sql"
echo "✅ Backup saved at backup_before_saas_upgrade.sql"

# =========================
# 2️⃣ Ensure drizzle.config.json exists
# =========================
CONFIG_FILE="$ROOT/shared/drizzle.config.json"
if [ ! -f "$CONFIG_FILE" ]; then
  echo "📝 Creating default drizzle.config.json..."
  cat > "$CONFIG_FILE" <<EOF
{
  "schema": "./server/db/schema.ts",
  "out": "$MIGRATIONS_DIR",
  "driver": "pg",
  "dbCredentials": {
    "connectionString": "$DATABASE_URL"
  }
}
EOF
  echo "✅ drizzle.config.json created"
fi

# =========================
# 3️⃣ Generate migrations
# =========================
echo "⚡ Generating Drizzle migrations..."
npx drizzle-kit generate --config "$CONFIG_FILE"
echo "✅ Migrations generated in $MIGRATIONS_DIR"
