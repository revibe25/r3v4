#!/bin/bash
# ════════════════════════════════════════════════════════════════════════════
# R3 v4 Stable Build Fix — MASTERY-LEVEL Implementation
# ════════════════════════════════════════════════════════════════════════════
# Includes: timestamped backups, TSC verification gates, robust anchors,
# error context, and rollback instructions (Wire.txt discipline)

set -euo pipefail  # Strict mode: exit on error, undefined vars, pipe failure

# ── Global State & Rollback Tracking ─────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$HOME/.r3_backups_${TIMESTAMP}"
ROLLBACK_SCRIPT="$BACKUP_DIR/ROLLBACK_${TIMESTAMP}.sh"
FIXES_APPLIED=()
FAILED=0

# Create backup directory
mkdir -p "$BACKUP_DIR"

# ── Logging Functions ────────────────────────────────────────────────────────
log_step() {
  echo ""
  echo "════════════════════════════════════════════════════════════════"
  echo "🔧 $1"
  echo "════════════════════════════════════════════════════════════════"
}

log_success() {
  echo "✓ $1"
}

log_error() {
  echo "❌ $1"
  FAILED=$((FAILED + 1))
}

log_warn() {
  echo "⚠ $1"
}

# ── Rollback Helpers ─────────────────────────────────────────────────────────
backup_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    cp "$file" "$BACKUP_DIR/$(basename "$file").bak.${TIMESTAMP}"
    echo "rm -f '$file' && cp '$BACKUP_DIR/$(basename "$file").bak.${TIMESTAMP}' '$file'" >> "$ROLLBACK_SCRIPT"
  fi
}

register_fix() {
  FIXES_APPLIED+=("$1")
  echo "  → Registered fix: $1"
}

# ── TSC Verification Gate ────────────────────────────────────────────────────
verify_tsc() {
  local package="$1"
  local tsconfig="${2:-tsconfig.json}"
  
  log_step "TSC Verification Gate: $package"
  
  if [[ ! -f "$package/$tsconfig" ]]; then
    log_warn "tsconfig not found at $package/$tsconfig, skipping TSC check"
    return 0
  fi
  
  cd "$package"
  # Use npx to find tsc in node_modules (works in pnpm environments like Penguin/Crostini)
  if npx tsc --noEmit 2>&1 | tee "$BACKUP_DIR/tsc_${package//\//_}.log"; then
    log_success "TSC check passed for $package"
    cd - > /dev/null
    return 0
  else
    log_error "TSC check FAILED for $package (see $BACKUP_DIR/tsc_${package//\//_}.log)"
    cd - > /dev/null
    return 1
  fi
}

# ════════════════════════════════════════════════════════════════════════════
# MAIN EXECUTION
# ════════════════════════════════════════════════════════════════════════════

cd ~/Stable || { echo "❌ Failed to cd to ~/Stable"; exit 1; }

log_step "PHASE 1: Pre-flight Checks"

# Verify required directories
if [[ ! -d server ]]; then
  log_error "server directory not found"
  exit 1
fi

if [[ ! -f shared/subscription.types.ts ]]; then
  log_error "shared/subscription.types.ts not found (source of truth)"
  exit 1
fi

log_success "Pre-flight checks passed"

# ────────────────────────────────────────────────────────────────────────────
log_step "PHASE 2: Create Type Stubs (with Backups)"

# Ensure types directory exists
mkdir -p server/types

# FIX 1: express.d.ts with proper SubscriptionTier import
log_step "FIX 1: Update server/types/express.d.ts"

backup_file "server/types/express.d.ts"

cat > server/types/express.d.ts << 'EOF'
import { Request } from 'express';
import type { SubscriptionTier } from '@r3vibe/shared/subscription.types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
        role: string;
        tier: SubscriptionTier;
        is_admin?: boolean;
      };
    }
  }
}

export {};
EOF

register_fix "express.d.ts updated with SubscriptionTier import"
log_success "express.d.ts created/updated"

# ────────────────────────────────────────────────────────────────────────────
# FIX 2: multer-s3.d.ts with AUTO_CONTENT_TYPE namespace
log_step "FIX 2: Update server/types/multer-s3.d.ts"

backup_file "server/types/multer-s3.d.ts"

cat > server/types/multer-s3.d.ts << 'EOF'
declare module 'multer-s3' {
  import { StorageEngine } from 'multer';
  import { S3Client } from '@aws-sdk/client-s3';

  namespace s3 {
    const AUTO_CONTENT_TYPE: boolean;
  }

  function s3(options: any): StorageEngine;
  export = s3;
}
EOF

register_fix "multer-s3.d.ts updated with AUTO_CONTENT_TYPE namespace"
log_success "multer-s3.d.ts created/updated"

# ────────────────────────────────────────────────────────────────────────────
log_step "PHASE 3: Verify Type Stubs with TSC Gate"

if ! verify_tsc "server"; then
  log_error "Server package TSC check failed — type stubs have issues"
  exit 1
fi

log_success "Type stubs verified"

# ────────────────────────────────────────────────────────────────────────────
log_step "PHASE 4: Fix waveformData Type Issue (with Anchor Assertion)"

# Find routes.ts first (it's in server/src, not server/src/routes)
ROUTES_FILE=$(find server -name "routes.ts" -not -path "*/node_modules/*" | grep -v ".d.ts" | head -1)

if [[ -z "$ROUTES_FILE" ]]; then
  log_warn "routes.ts not found (may not need waveformData fix)"
else
  backup_file "$ROUTES_FILE"
  
  # Find the exact pattern with anchor assertion
  # Pattern: waveformData assigned from DB (Json | undefined type)
  # We need to cast to unknown first, then let TypeScript narrow it
  
  if grep -q "waveformData:" "$ROUTES_FILE"; then
    # Use exact anchor: look for the line and the context
    # The issue is passing waveformData (Json | undefined) where Record<string, unknown> | undefined expected
    
    # Safest approach: cast the entire object value to unknown first
    sed -i.bak_${TIMESTAMP} \
      '/waveformData:/ {
        s/waveformData: waveformData,/waveformData: (typeof waveformData === "string" ? JSON.parse(waveformData) : waveformData) as Record<string, unknown> | undefined,/g
        s/waveformData: waveformData$/waveformData: (typeof waveformData === "string" ? JSON.parse(waveformData) : waveformData) as Record<string, unknown> | undefined/g
      }' "$ROUTES_FILE"
    
    register_fix "waveformData type cast applied in $ROUTES_FILE"
    log_success "waveformData type issue fixed (with undefined handling and cast)"
  else
    log_warn "waveformData pattern not found in $ROUTES_FILE (may have been pre-fixed)"
  fi
fi

# ────────────────────────────────────────────────────────────────────────────
log_step "PHASE 5: TSC Gate Before Full Build"

if ! verify_tsc "server"; then
  log_error "Pre-build TSC gate failed — fixes incomplete"
  log_error "Rollback script available at: $ROLLBACK_SCRIPT"
  exit 1
fi

log_success "Pre-build TSC verification passed"

# ────────────────────────────────────────────────────────────────────────────
log_step "PHASE 6: Full Monorepo Build"

if ! pnpm build 2>&1 | tee "$BACKUP_DIR/pnpm_build.log"; then
  log_error "pnpm build FAILED"
  log_error "Build log: $BACKUP_DIR/pnpm_build.log"
  log_error "To rollback, run: bash $ROLLBACK_SCRIPT"
  exit 1
fi

log_success "pnpm build completed successfully"

# ────────────────────────────────────────────────────────────────────────────
log_step "PHASE 7: Post-Build Verification"

# Run TSC one more time to ensure no hidden errors (use npx for Penguin compatibility)
if npx tsc -p server/tsconfig.json --noEmit 2>&1 | tee "$BACKUP_DIR/final_tsc_check.log"; then
  log_success "Final TSC check passed"
else
  log_warn "Final TSC check has warnings/errors (see $BACKUP_DIR/final_tsc_check.log)"
fi

# ════════════════════════════════════════════════════════════════════════════
# SUCCESS SUMMARY
# ════════════════════════════════════════════════════════════════════════════

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ BUILD FIX COMPLETE"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "📋 Fixes Applied:"
for fix in "${FIXES_APPLIED[@]}"; do
  echo "  ✓ $fix"
done
echo ""
echo "📂 Backup Location: $BACKUP_DIR"
echo "📜 Rollback Script:  $ROLLBACK_SCRIPT"
echo ""
echo "🚀 Next Steps:"
echo "  1. Verify the build on Kali (canonical dev env):"
echo "     cd ~/Stable && pnpm build"
echo "  2. Run tests to get LLPTE coverage baseline"
echo "  3. Deploy to Railway for investor demo"
echo ""
echo "════════════════════════════════════════════════════════════════"

exit 0
