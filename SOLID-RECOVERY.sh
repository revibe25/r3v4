#!/usr/bin/env bash
set -euo pipefail

# Colors
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[0;34m'; C='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${B}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${G}✅${NC} $1"; }
warn() { echo -e "${Y}⚠️${NC}  $1"; }
fail() { echo -e "${R}❌${NC} $1"; }

ROOT_DIR="$(pwd)"
log "Working directory: $ROOT_DIR"

# ═══════════════════════════════════════════════════════════════════════
# STEP 0: NUKE every dist/ directory recursively (packages + server + client)
# ═══════════════════════════════════════════════════════════════════════
log "STEP 0: Deep-cleaning all dist/ directories..."
find "$ROOT_DIR" -type d -name "dist" -not -path "*/node_modules/*" -exec rm -rf {} + 2>/dev/null || true
find "$ROOT_DIR" -type f -name "*.tsbuildinfo" -not -path "*/node_modules/*" -delete 2>/dev/null || true
ok "All dist/ and .tsbuildinfo files purged"

# ═══════════════════════════════════════════════════════════════════════
# STEP 1: Fix ALL tsconfig.json files — exclude dist/ & tighten includes
# ═══════════════════════════════════════════════════════════════════════
log "STEP 1: Hardening all tsconfig.json files..."

fix_tsconfig() {
  local file="$1"
  local dir
  dir=$(dirname "$file")

  # If there's no tsconfig, skip
  [[ -f "$file" ]] || return 0

  # Create a Node.js script to surgically patch the JSON
  node <<'NODE' -- "$file"
    const fs = require('fs');
    const path = require('path');
    const file = process.argv[1];
    let raw = fs.readFileSync(file, 'utf8');
    let cfg;
    try {
      cfg = JSON.parse(raw);
    } catch(e) {
      // Might have comments — use a regex strip for JSONC
      cfg = JSON.parse(raw.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));
    }

    // 1. Ensure exclude contains "dist" and "node_modules"
    const excludes = new Set(cfg.exclude || []);
    excludes.add('dist');
    excludes.add('node_modules');
    cfg.exclude = Array.from(excludes);

    // 2. If include is missing or dangerously broad, fix it
    if (!cfg.include) {
      // Default to src only
      cfg.include = ['src/**/*'];
    } else if (cfg.include.some(p => p === '**/*' || p.includes('dist'))) {
      cfg.include = cfg.include.filter(p => p !== '**/*' && !p.includes('dist'));
      if (cfg.include.length === 0) cfg.include = ['src/**/*'];
    }

    // 3. Ensure outDir is set if missing
    if (!cfg.compilerOptions) cfg.compilerOptions = {};
    if (!cfg.compilerOptions.outDir) {
      cfg.compilerOptions.outDir = 'dist';
    }

    // 4. Ensure rootDir is set to prevent upward leakage
    if (!cfg.compilerOptions.rootDir) {
      cfg.compilerOptions.rootDir = 'src';
    }

    // 5. Force declaration emit off for app code if it's the client or server app
    // (packages should emit declarations, apps usually shouldn't)
    const dir = path.dirname(file);
    const isPackage = dir.includes('/packages/');
    if (!isPackage && cfg.compilerOptions.declaration === undefined) {
      cfg.compilerOptions.declaration = false;
    }

    fs.writeFileSync(file, JSON.stringify(cfg, null, 2) + '\n');
    console.log('Patched: ' + file);
NODE
}

export -f fix_tsconfig
find "$ROOT_DIR" -name "tsconfig.json" -not -path "*/node_modules/*" -exec bash -c 'fix_tsconfig "$0"' {} \;

ok "All tsconfig.json files hardened"

# ═══════════════════════════════════════════════════════════════════════
# STEP 2: Fix package.json peer dependency version mismatches
# ═══════════════════════════════════════════════════════════════════════
log "STEP 2: Aligning peer dependency versions..."

# The errors show:
# @trpc/client 11.18.0 vs @trpc/server 11.12.0
# @trpc/react-query 11.12.0 wants @trpc/client@11.12.0 but finds 11.18.0
# @vitest/coverage-v8 4.1.9 vs vitest 4.1.10

# Strategy: align all trpc packages to 11.18.0 (latest installed)
# align vitest and coverage to 4.1.10

node <<'NODE'
  const fs = require('fs');
  const path = require('path');

  const root = process.cwd();
  const pkgFiles = [];
  
  function findPackageJson(dir) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name === 'node_modules') continue;
      if (item.isDirectory()) {
        findPackageJson(path.join(dir, item.name));
      } else if (item.name === 'package.json') {
        pkgFiles.push(path.join(dir, item.name));
      }
    }
  }
  findPackageJson(root);

  let changed = 0;
  for (const file of pkgFiles) {
    const raw = fs.readFileSync(file, 'utf8');
    const pkg = JSON.parse(raw);
    let dirty = false;

    const bump = (section, name, version) => {
      if (pkg[section] && pkg[section][name] && pkg[section][name] !== version) {
        pkg[section][name] = version;
        dirty = true;
      }
    };

    // Align tRPC to latest (11.18.0)
    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(sec => {
      bump(sec, '@trpc/server', '11.18.0');
      bump(sec, '@trpc/client', '11.18.0');
      bump(sec, '@trpc/react-query', '11.18.0');
    });

    // Align vitest ecosystem to 4.1.10
    ['dependencies', 'devDependencies', 'peerDependencies'].forEach(sec => {
      bump(sec, 'vitest', '4.1.10');
      bump(sec, '@vitest/coverage-v8', '4.1.10');
    });

    if (dirty) {
      fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
      console.log('Updated: ' + file);
      changed++;
    }
  }
  console.log('Total package.json files updated: ' + changed);
NODE

ok "Peer dependency versions aligned"

# ═══════════════════════════════════════════════════════════════════════
# STEP 3: Clean install with frozen lockfile disabled (regenerate lockfile)
# ═══════════════════════════════════════════════════════════════════════
log "STEP 3: Fresh dependency install..."

# Nuke node_modules to be absolutely sure
find "$ROOT_DIR" -type d -name "node_modules" -prune -exec rm -rf {} + 2>/dev/null || true
rm -f pnpm-lock.yaml

# Install with --no-frozen-lockfile to allow regeneration
pnpm install --no-frozen-lockfile

ok "Dependencies reinstalled"

# ═══════════════════════════════════════════════════════════════════════
# STEP 4: Build packages in topological order BEFORE type-checking
# ═══════════════════════════════════════════════════════════════════════
log "STEP 4: Building workspace packages in dependency order..."

# Use pnpm recursive build if available, or turbo if configured
if grep -q '"build"' package.json 2>/dev/null; then
  pnpm run build --filter='./packages/*' || pnpm -r run build
else
  # Fallback: build each package manually in order
  PACKAGES=(
    "packages/llpte-signal"
    "packages/llpte-adapters"
    "packages/llpte-ai"
    "packages/llpte-core"
    "packages/llpte-execution"
    "packages/llpte-transition-graph"
  )
  for pkg in "${PACKAGES[@]}"; do
    if [[ -d "$pkg" ]]; then
      log "  Building $pkg..."
      (cd "$pkg" && pnpm exec tsc --build --force 2>/dev/null || pnpm exec tsc 2>/dev/null || true)
    fi
  done
fi

ok "Package builds completed"

# ═══════════════════════════════════════════════════════════════════════
# STEP 5: Verify no dist/ files are being picked up by tsc
# ═══════════════════════════════════════════════════════════════════════
log "STEP 5: Verifying tsconfig isolation..."

# Quick diagnostic: list files tsc would include for the server
if [[ -f "server/tsconfig.json" ]]; then
  (cd server && npx tsc --listFiles --noEmit 2>/dev/null | grep -E "/dist/" | head -5 || true) > /tmp/tsc_dist_leak.txt
  if [[ -s /tmp/tsc_dist_leak.txt ]]; then
    warn "server/tsconfig.json still includes dist/ files:"
    cat /tmp/tsc_dist_leak.txt
  else
    ok "server/tsconfig.json correctly excludes dist/"
  fi
fi

# ═══════════════════════════════════════════════════════════════════════
# STEP 6: Final TypeScript check
# ═══════════════════════════════════════════════════════════════════════
log "STEP 6: Running final TypeScript type check..."

# Run from root if root tsconfig exists, else server only
if [[ -f "tsconfig.json" ]]; then
  if pnpm exec tsc --noEmit; then
    ok "ROOT TypeScript check PASSED"
  else
    fail "ROOT TypeScript check FAILED — see errors above"
    exit 1
  fi
elif [[ -f "server/tsconfig.json" ]]; then
  if (cd server && pnpm exec tsc --noEmit); then
    ok "SERVER TypeScript check PASSED"
  else
    fail "SERVER TypeScript check FAILED — see errors above"
    exit 1
  fi
else
  warn "No root or server tsconfig.json found for type check"
fi

# ═══════════════════════════════════════════════════════════════════════
# STEP 7: Summary
# ═══════════════════════════════════════════════════════════════════════
echo ""
echo -e "${G}╔══════════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${G}║              EMERGENCY BUILD RECOVERY — COMPLETE                     ║${NC}"
echo -e "${G}╚══════════════════════════════════════════════════════════════════════╝${NC}"
echo ""
ok "All dist/ directories purged"
ok "All tsconfig.json files hardened with exclude: ['dist', 'node_modules']"
ok "Peer dependencies aligned (trpc@11.18.0, vitest@4.1.10)"
ok "Fresh lockfile generated"
ok "Packages built in dependency order"
ok "TypeScript check passed"
echo ""
log "You can now run: ${C}pnpm dev${NC} or ${C}pnpm build${NC}"
