#!/bin/bash
set -e

REPO_NAME=$(basename "$(cd "$(dirname "${BASH_SOURCE[0]}")/../" && pwd)")

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔓 ${REPO_NAME} Restore Script v1.0${NC}"
echo -e "${BLUE}════════════════════════════════════${NC}"
echo ""

if [ $# -eq 0 ]; then
  echo -e "${RED}❌ Missing backup prefix${NC}"
  echo "Usage: bash scripts/restore-repo.sh <backup-prefix>"
  exit 1
fi

BACKUP_PREFIX="$1"
echo -e "${YELLOW}📦 Backup prefix:${NC} $BACKUP_PREFIX"
echo ""

if [ ! -f "$BACKUP_PREFIX.sha256" ]; then
  echo -e "${RED}❌ Checksum file not found${NC}"
  exit 1
fi

HAS_CHUNKS=0
if ls ${BACKUP_PREFIX}-* &>/dev/null 2>&1; then
  HAS_CHUNKS=1
  echo -e "${YELLOW}📋 Backup chunks found${NC}"
else
  echo -e "${YELLOW}📋 Encrypted backup found${NC}"
fi
echo ""

echo -e "${YELLOW}🔍 Verifying integrity...${NC}"
if ! sha256sum -c "$BACKUP_PREFIX.sha256" > /dev/null 2>&1; then
  echo -e "  ${RED}❌ Verification failed${NC}"
  exit 1
fi
echo -e "  ${GREEN}✅ Verified${NC}"
echo ""

echo -e "${YELLOW}🔑 Enter password:${NC}"
read -sp "Password: " PASSWORD
echo ""
echo ""

TEMP_ENC="/tmp/restore-$$.enc"
TEMP_TAR="/tmp/restore-$$.tar.gz"

if [ $HAS_CHUNKS -eq 1 ]; then
  cat ${BACKUP_PREFIX}-* > "$TEMP_ENC"
else
  cp "$BACKUP_PREFIX.tar.gz.enc" "$TEMP_ENC"
fi

echo -e "${YELLOW}Decrypting...${NC}"
if ! openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -pass pass:"$PASSWORD" \
    -in "$TEMP_ENC" -out "$TEMP_TAR" 2>/dev/null; then
  echo -e "  ${RED}❌ Decryption failed${NC}"
  rm -f "$TEMP_ENC" "$TEMP_TAR"
  exit 1
fi

echo -e "${YELLOW}Extracting...${NC}"
tar xzf "$TEMP_TAR"
rm -f "$TEMP_ENC" "$TEMP_TAR"

echo -e "${GREEN}✅ Restoration complete${NC}"
