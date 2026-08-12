#!/usr/bin/env node
/**
 * Super Solid TypeScript Monorepo Fix Script
 * Run from repo root: node fix-monorepo-ts.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.cwd();
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Helpers ─────────────────────────────────────────────────────────
function log(msg) {
  console.log(`[fix-ts] ${msg}`);
}

function readJsonSafe(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  // Strip single-line and multi-line comments so JSON.parse doesn't choke
  const cleaned = raw
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  return JSON.parse(cleaned);
}

function writeJson(filePath, data) {
  const content = JSON.stringify(data, null, 2) + '\n';
  if (DRY_RUN) {
    log(`[DRY-RUN] Would write: ${filePath}`);
    return;
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

function backup(filePath) {
  const bak = filePath + '.bak';
  if (!fs.existsSync(bak) && !DRY_RUN) {
    fs.copyFileSync(filePath, bak);
    log(`Backed up: ${filePath} -> ${bak}`);
  }
}

function ensureArray(obj, key, defaults = []) {
  if (!Array.isArray(obj[key])) {
    obj[key] = defaults;
  }
  return obj[key];
}

// ─── Fixers ──────────────────────────────────────────────────────────
function fixPackageTsconfig(pkgDir, pkgName) {
  const configPath = path.join(pkgDir, 'tsconfig.json');
  if (!fs.existsSync(configPath)) return false;

  backup(configPath);
  const tsconfig = readJsonSafe(configPath);
  let changed = false;

  // 1. composite + declaration requirements
  tsconfig.compilerOptions = tsconfig.compilerOptions || {};
  if (!tsconfig.compilerOptions.composite) {
    tsconfig.compilerOptions.composite = true;
    changed = true;
  }
  if (!tsconfig.compilerOptions.declaration) {
    tsconfig.compilerOptions.declaration = true;
    changed = true;
  }
  if (!tsconfig.compilerOptions.declarationMap) {
    tsconfig.compilerOptions.declarationMap = true;
    changed = true;
  }

  // 2. rootDir / outDir sanity
  if (!tsconfig.compilerOptions.rootDir) {
    tsconfig.compilerOptions.rootDir = './src';
    changed = true;
  }
  if (!tsconfig.compilerOptions.outDir) {
    tsconfig.compilerOptions.outDir = './dist';
    changed = true;
  }

  // 3. Fix broad includes that pull in dist/
  // If include is missing, TS defaults to '**/*' which picks up dist/
  if (!tsconfig.include) {
    tsconfig.include = ['src/**/*'];
    changed = true;
  } else if (Array.isArray(tsconfig.include)) {
    const hasBroadWildcard = tsconfig.include.some(
      p => p === '**/*' || p === './**/*'
    );
    if (hasBroadWildcard) {
      tsconfig.include = ['src/**/*'];
      changed = true;
    }
  }

  // 4. Exclude dist and node_modules
  const excl = ensureArray(tsconfig, 'exclude', []);
  if (!excl.includes('dist')) {
    excl.push('dist');
    changed = true;
  }
  if (!excl.includes('node_modules')) {
    excl.push('node_modules');
    changed = true;
  }

  if (changed) {
    writeJson(configPath, tsconfig);
    log(`Fixed package config: ${pkgName}`);
  } else {
    log(`No changes needed for: ${pkgName}`);
  }
  return true;
}

function fixServerTsconfig() {
  const configPath = path.join(ROOT, 'server', 'tsconfig.json');
  if (!fs.existsSync(configPath)) {
    log('WARNING: server/tsconfig.json not found, skipping server fix');
    return;
  }

  backup(configPath);
  const tsconfig = readJsonSafe(configPath);
  let changed = false;

  // composite + declaration
  tsconfig.compilerOptions = tsconfig.compilerOptions || {};
  if (!tsconfig.compilerOptions.composite) {
    tsconfig.compilerOptions.composite = true;
    changed = true;
  }
  if (!tsconfig.compilerOptions.declaration) {
    tsconfig.compilerOptions.declaration = true;
    changed = true;
  }
  if (!tsconfig.compilerOptions.declarationMap) {
    tsconfig.compilerOptions.declarationMap = true;
    changed = true;
  }

  // Remove the out-of-rootDir include that causes TS6059
  if (Array.isArray(tsconfig.include)) {
    const beforeLen = tsconfig.include.length;
    tsconfig.include = tsconfig.include.filter(p => {
      const normalized = p.replace(/\\/g, '/');
      return !normalized.startsWith('../') && !normalized.startsWith('..\\');
    });
    if (tsconfig.include.length !== beforeLen) {
      changed = true;
      log('Removed parent-directory includes (e.g. ../index.ts) from server/tsconfig.json');
      log('  -> If that file is genuinely required by the server, move it into server/src/');
    }
  }

  // Exclude dist
  const excl = ensureArray(tsconfig, 'exclude', []);
  if (!excl.includes('dist')) {
    excl.push('dist');
    changed = true;
  }

  if (changed) {
    writeJson(configPath, tsconfig);
    log('Fixed server/tsconfig.json');
  } else {
    log('No changes needed for server/tsconfig.json');
  }
}

function fixRootTsconfig() {
  const configPath = path.join(ROOT, 'tsconfig.json');
  if (!fs.existsSync(configPath)) {
    log('WARNING: root tsconfig.json not found');
    return;
  }

  backup(configPath);
  const tsconfig = readJsonSafe(configPath);
  let changed = false;

  // Ensure references array exists
  if (!Array.isArray(tsconfig.references)) {
    tsconfig.references = [];
    changed = true;
  }

  const existingPaths = new Set(tsconfig.references.map(r => r.path));

  // Discover packages
  const packagesDir = path.join(ROOT, 'packages');
  const packages = [];
  if (fs.existsSync(packagesDir)) {
    const entries = fs.readdirSync(packagesDir);
    for (const entry of entries) {
      const full = path.join(packagesDir, entry);
      if (
        fs.statSync(full).isDirectory() &&
        fs.existsSync(path.join(full, 'tsconfig.json'))
      ) {
        packages.push(`packages/${entry}`);
      }
    }
  }

  // Add server if present
  if (fs.existsSync(path.join(ROOT, 'server', 'tsconfig.json'))) {
    packages.push('server');
  }

  // Append any missing references
  for (const refPath of packages) {
    if (!existingPaths.has(refPath)) {
      tsconfig.references.push({ path: refPath });
      changed = true;
      log(`Added root reference: ${refPath}`);
    }
  }

  // A solution/root tsconfig for project references should have files: []
  // (or at least not include source files directly)
  if (!tsconfig.files) {
    tsconfig.files = [];
    changed = true;
  }

  if (changed) {
    writeJson(configPath, tsconfig);
    log('Fixed root tsconfig.json');
  } else {
    log('No changes needed for root tsconfig.json');
  }
}

function cleanBuild() {
  if (DRY_RUN) {
    log('[DRY-RUN] Would delete all dist/ dirs and *.tsbuildinfo files');
    log('[DRY-RUN] Would run: pnpm exec tsc --build');
    return;
  }

  log('Deleting stale dist/ directories...');
  try {
    execSync('find . -type d -name "dist" -prune -exec rm -rf {} +', {
      cwd: ROOT,
      stdio: 'pipe',
    });
  } catch (e) {
    // ignore find errors (e.g. no dist dirs)
  }

  log('Deleting *.tsbuildinfo files...');
  try {
    execSync('find . -name "*.tsbuildinfo" -delete', {
      cwd: ROOT,
      stdio: 'pipe',
    });
  } catch (e) {
    // ignore
  }

  log('Running: pnpm exec tsc --build');
  try {
    execSync('pnpm exec tsc --build', { cwd: ROOT, stdio: 'inherit' });
    log('Build succeeded.');
  } catch (e) {
    console.error('\n[fix-ts] Build failed. Review the remaining errors above.');
    console.error('[fix-ts] If TS6305/TS6306 persist, ensure every referenced project has "composite": true.');
    process.exit(1);
  }
}

// ─── Main ────────────────────────────────────────────────────────────
function main() {
  console.log('========================================');
  console.log(' TypeScript Monorepo Auto-Fix Script');
  console.log('========================================\n');

  if (DRY_RUN) {
    log('Running in DRY-RUN mode (no files will be changed)');
  }

  // 1. Fix all packages
  const packagesDir = path.join(ROOT, 'packages');
  if (fs.existsSync(packagesDir)) {
    const entries = fs.readdirSync(packagesDir);
    for (const entry of entries) {
      const full = path.join(packagesDir, entry);
      if (fs.statSync(full).isDirectory()) {
        fixPackageTsconfig(full, entry);
      }
    }
  }

  // 2. Fix server
  fixServerTsconfig();

  // 3. Fix root references
  fixRootTsconfig();

  // 4. Clean + build
  console.log('');
  cleanBuild();

  console.log('\n========================================');
  console.log(' Done.');
  console.log('========================================');
  if (!DRY_RUN) {
    console.log('\nOriginal configs backed up as *.bak');
    console.log('If anything looks wrong, restore with:');
    console.log('  find . -name "tsconfig.json.bak" -exec sh -c \'cp "$1" "${1%.bak}"\' _ {} \\;');
  }
}

main();
