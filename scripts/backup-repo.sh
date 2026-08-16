#!/bin/bash
set -euo pipefail

REPO_NAME=$(basename "$(cd "$(dirname "${BASH_SOURCE[0]}")/../" && pwd)")
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../" && pwd)"
BACKUP_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_PREFIX="${REPO_NAME}-backup-${BACKUP_TIMESTAMP}"
BACKUP_DIR="${HOME}"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

DRY_RUN=0
BACKUP_ALL=0

if [[ "${1:-}" == "--dry-run" ]]; then DRY_RUN=1; fi
if [[ "${1:-}" == "--all" ]]; then BACKUP_ALL=1; fi

echo -e "${BLUE}🔐 ${REPO_NAME} Backup Script v1.0${NC}"
echo -e "${BLUE}════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Repository:${NC} $REPO_NAME"
echo -e "${YELLOW}Location:${NC} $REPO_ROOT"
echo -e "${YELLOW}Backup ID:${NC} $BACKUP_PREFIX"
echo ""

if [ -f "$REPO_ROOT/scripts/backup.config" ]; then
  source "$REPO_ROOT/scripts/backup.config"
fi

EXCLUDE_FLAGS=(
  '--exclude=node_modules'
  '--exclude=.pnpm'
  '--exclude=dist'
  '--exclude=build'
  '--exclude=.git'
  '--exclude=*.tsbuildinfo'
  '--exclude=vitest.config.ts.timestamp-*'
  '--exclude=.next'
  '--exclude=*.lock'
  '--exclude=.DS_Store'
  '--exclude=Thumbs.db'
  '--exclude=.vscode'
  '--exclude=.idea'
  '--exclude=coverage'
)

if [ $DRY_RUN -eq 1 ]; then
  echo -e "${YELLOW}🧪 DRY-RUN MODE${NC}"
  TAR_SIZE=$(tar "${EXCLUDE_FLAGS[@]}" -czf - "$REPO_ROOT" 2>/dev/null | wc -c)
  TAR_SIZE_MB=$((TAR_SIZE / 1024 / 1024))
  echo -e "  ${GREEN}✅ Would compress to ~${TAR_SIZE_MB}MB${NC}"
  exit 0
fi

if [ $BACKUP_ALL -eq 1 ]; then
  echo -e "${YELLOW}🔑 Set encryption password:${NC}"
  read -sp "Password: " PASSWORD
  echo ""
  read -sp "Confirm: " PASSWORD_CONFIRM
  echo ""
  
  if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
    echo -e "${RED}❌ Passwords don't match${NC}"
    exit 1
  fi
fi

echo -e "${YELLOW}Creating backup...${NC}"
cd "$BACKUP_DIR"

if tar "${EXCLUDE_FLAGS[@]}" -czf - "$REPO_ROOT" 2>/dev/null | \
   openssl enc -aes-256-cbc -pbkdf2 -iter 100000 -salt -pass pass:"$PASSWORD" | \
   split -b 500M - "$BACKUP_PREFIX-"; then
  
  sha256sum ${BACKUP_PREFIX}-* > "$BACKUP_PREFIX.sha256"
  
  echo -e "${GREEN}✅ Backup complete${NC}"
  echo ""
  echo -e "${YELLOW}📋 Files created:${NC}"
  ls -lh ${BACKUP_PREFIX}-* | awk '{printf "  %s (%s)\n", $9, $5}'
  
else
  echo -e "${RED}❌ Backup failed${NC}"
  exit 1
fi
