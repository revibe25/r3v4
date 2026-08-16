# Backup & Restore Guide

## Quick Start

### Backup This Repository
```bash
bash scripts/backup-repo.sh --all
```

### Restore from Backup
```bash
bash scripts/restore-repo.sh <backup-prefix>
```

## What Gets Backed Up
- ✅ All source code
- ✅ Configuration files
- ✅ Documentation
- ❌ node_modules/
- ❌ .git/
- ❌ build artifacts

## Encryption & Security
- **Algorithm:** AES-256-CBC
- **Key Derivation:** PBKDF2 (100,000 iterations)
- **Checksums:** SHA256 for integrity
- **Password:** Required to restore

## Wire.txt Compliance
Backup operations follow Wire.txt Protocol v1 standards.
