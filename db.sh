#!/bin/bash
set -e
if [ -z "$DATABASE_URL" ] && [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
elif [ -z "$DATABASE_URL" ]; then
    echo "❌ No .env file found in $(pwd)"
    exit 1
fi
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL not set in .env"
    exit 1
fi
DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:/]*\).*/\1/p')
DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*$/\1/p' || echo "5432")
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
export PGPASSWORD="$DB_PASS" 
IS_LOCAL=false
if [[ "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" || "$DB_HOST" == "penguin" ]]; then
    IS_LOCAL=true
fi
PSQL_ARGS="-h $DB_HOST -U $DB_USER -d $DB_NAME"
if [ -n "$DATABASE_SSL" ] && [ "$DATABASE_SSL" = "false" ]; then
        export PGSSLMODE=disable
fi
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
print_status() { echo -e "${BLUE}→${NC} $1"; }
print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error() { echo -e "${RED}✗${NC} $1"; }
confirm() {
    local prompt="$1"
    echo -ne "${YELLOW}${prompt}${NC} (y/N) "
    read -r response
    [[ "$response" =~ ^[Yy]$ ]]
}
cmd_status() {
    print_status "Database connection status"
    echo "Host: $DB_HOST"
    echo "Port: $DB_PORT"
    echo "Database: $DB_NAME"
    echo "User: $DB_USER"
    echo "Local: $IS_LOCAL"
    echo ""
    print_status "Attempting connection..."
    if psql $PSQL_ARGS -c "SELECT version();" >/dev/null 2>&1; then
        print_success "Connection successful"
    else
        print_error "Connection failed"
        exit 1
    fi
}
cmd_migrate() {
    print_status "Running Drizzle migrations"
    if [ ! -f "package.json" ]; then
        print_error "No package.json found. Are you in the project root?"
        exit 1
    fi
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm not found. Install it first."
        exit 1
    fi
    if [ "$IS_LOCAL" = true ]; then
        print_warning "Target: LOCAL database"
    else
        print_warning "Target: REMOTE database ($DB_HOST)"
        if ! confirm "Apply migrations to REMOTE?"; then
            print_warning "Cancelled"
            exit 0
        fi
    fi
    print_status "Running: drizzle-kit push"
    ./server/node_modules/.bin/drizzle-kit push --config server/drizzle.config.ts
    print_success "Migrations complete"
}
cmd_query() {
    if [ $# -lt 1 ]; then
        print_error "Usage: $0 query <SQL>"
        exit 1
    fi
    local sql="$*"
    print_status "Executing query"
    psql $PSQL_ARGS -c "$sql"
}
cmd_shell() {
    print_status "Connecting to psql shell"
    print_warning "Connected to $DB_NAME on $DB_HOST"
    psql $PSQL_ARGS
}
cmd_backup() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="backup_${DB_NAME}_${timestamp}.sql"
    print_status "Creating backup: $backup_file"
    pg_dump $PSQL_ARGS > "$backup_file"
    print_success "Backup saved: $backup_file"
    ls -lh "$backup_file"
}
cmd_restore() {
    if [ $# -lt 1 ]; then
        print_error "Usage: $0 restore <backup_file>"
        exit 1
    fi
    local backup_file="$1"
    if [ ! -f "$backup_file" ]; then
        print_error "Backup file not found: $backup_file"
        exit 1
    fi
    print_warning "This will OVERWRITE the database!"
    if ! confirm "Restore from $backup_file?"; then
        print_warning "Cancelled"
        exit 0
    fi
    print_status "Restoring from: $backup_file"
    psql $PSQL_ARGS < "$backup_file"
    print_success "Restore complete"
}
cmd_help() {
    cat << HELPEOF
${BLUE}db.sh - PostgreSQL CLI wrapper${NC}

Commands:
  status              Show database connection details
  migrate             Run Drizzle migrations
  query <SQL>         Execute SQL query
  shell               Open psql interactive shell
  backup              Create SQL backup file
  restore <file>      Restore from backup file

Examples:
  ./db.sh status
  ./db.sh query "SELECT COUNT(*) FROM users;"
  ./db.sh migrate
  ./db.sh backup

HELPEOF
}
COMMAND="${1:-help}"
shift || true
case "$COMMAND" in
    status)   cmd_status ;;
    migrate)  cmd_migrate "$@" ;;
    query)    cmd_query "$@" ;;
    shell)    cmd_shell "$@" ;;
    backup)   cmd_backup "$@" ;;
    restore)  cmd_restore "$@" ;;
    help|--help|-h) cmd_help ;;
    *)        print_error "Unknown command: $COMMAND"; cmd_help; exit 1 ;;
esac
