#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
};

class TypeScriptFixer {
  constructor(projectRoot = '.') {
    this.projectRoot = projectRoot;
    this.fixed = 0;
    this.failed = 0;
    this.routerFiles = [
      'server/routes/effects.ts',
      'server/routes/loopProjects.ts',
      'server/routes/loops.ts',
      'server/routes/midi.ts',
      'server/routes/presets.ts',
      'server/routes/uploads.ts',
      'server/routes/waveform.ts',
      'server/routes/webhooks/stripe.ts',
    ];
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  fileExists(filePath) {
    const fullPath = path.join(this.projectRoot, filePath);
    return fs.existsSync(fullPath);
  }

  readFile(filePath) {
    const fullPath = path.join(this.projectRoot, filePath);
    return fs.readFileSync(fullPath, 'utf-8');
  }

  writeFile(filePath, content) {
    const fullPath = path.join(this.projectRoot, filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  backupFile(filePath) {
    const fullPath = path.join(this.projectRoot, filePath);
    const backupPath = `${fullPath}.bak`;
    if (fs.existsSync(fullPath)) {
      fs.copyFileSync(fullPath, backupPath);
    }
  }

  fixRouterFile(filePath) {
    if (!this.fileExists(filePath)) {
      this.log(`⊘ File not found: ${filePath}`, 'yellow');
      return false;
    }

    this.log(`→ Processing: ${filePath}`, 'yellow');
    this.backupFile(filePath);

    let content = this.readFile(filePath);
    const originalContent = content;

    // Check if already fixed
    if (content.includes('const router: Router = Router()')) {
      this.log('✓ Already fixed', 'green');
      return true;
    }

    // Add Router type import if missing
    if (!content.includes("import { Router }") && !content.includes("import { type Router }")) {
      content = `import { Router } from 'express';\n${content}`;
    }

    // Fix the router declaration
    content = content.replace(
      /const router\s*=\s*Router\(\);/g,
      'const router: Router = Router();'
    );

    // Write fixed content
    this.writeFile(filePath, content);

    // Verify fix
    const fixedContent = this.readFile(filePath);
    if (fixedContent.includes('const router: Router = Router()')) {
      this.log('✓ Fixed', 'green');
      this.fixed++;
      return true;
    } else {
      this.log('✗ Failed to fix', 'red');
      this.writeFile(filePath, originalContent);
      this.failed++;
      return false;
    }
  }

  fixMiddlewareFile(filePath) {
    if (!this.fileExists(filePath)) {
      this.log(`⊘ File not found: ${filePath}`, 'yellow');
      return false;
    }

    this.log(`→ Processing: ${filePath}`, 'yellow');
    this.backupFile(filePath);

    let content = this.readFile(filePath);
    const originalContent = content;

    // Add RequestHandler import if missing
    if (!content.includes('RequestHandler')) {
      content = content.replace(
        /import express, \{ type Router \}/,
        "import express, { type Router, type RequestHandler }"
      );
      content = content.replace(
        /import express, \{ Router, type Router as ExpressRouter \}/,
        "import express, { Router, type Router as ExpressRouter, type RequestHandler }"
      );
    }

    // Fix attachSubscription export
    content = content.replace(
      /export const attachSubscription = middleware\(/,
      'export const attachSubscription: RequestHandler = middleware('
    );

    // Write fixed content
    this.writeFile(filePath, content);

    // Verify fix
    const fixedContent = this.readFile(filePath);
    if (fixedContent.includes('export const attachSubscription: RequestHandler')) {
      this.log('✓ Fixed', 'green');
      this.fixed++;
      return true;
    } else {
      this.log('✗ Failed to fix', 'red');
      this.writeFile(filePath, originalContent);
      this.failed++;
      return false;
    }
  }

  fixProceduresFile(filePath) {
    if (!this.fileExists(filePath)) {
      this.log(`⊘ File not found: ${filePath}`, 'yellow');
      return false;
    }

    this.log(`→ Processing: ${filePath}`, 'yellow');
    this.backupFile(filePath);

    let content = this.readFile(filePath);
    const originalContent = content;

    // This file needs manual review - just document what needs fixing
    this.log(
      'ℹ This file may need manual type annotation for protectedProcedure',
      'yellow'
    );

    return true;
  }

  runFixes() {
    this.log('\n🔧 Fixing TypeScript TS2742 errors...', 'yellow');
    this.log(`📍 Project root: ${this.projectRoot}\n`, 'yellow');

    // Fix router files
    this.log('═══════════════════════════════════════', 'yellow');
    this.log('Fixing Router Declarations', 'yellow');
    this.log('═══════════════════════════════════════', 'yellow');
    this.routerFiles.forEach(file => this.fixRouterFile(file));

    // Fix middleware files
    this.log('\n═══════════════════════════════════════', 'yellow');
    this.log('Fixing Middleware Declarations', 'yellow');
    this.log('═══════════════════════════════════════', 'yellow');
    this.fixMiddlewareFile('server/middleware/feature-gate.ts');

    // Fix procedures file
    this.log('\n═══════════════════════════════════════', 'yellow');
    this.log('Procedures File Notice', 'yellow');
    this.log('═══════════════════════════════════════', 'yellow');
    this.fixProceduresFile('server/procedures.ts');

    // Summary
    this.log('\n═══════════════════════════════════════', 'yellow');
    this.log(`✓ Fixed: ${this.fixed} files`, 'green');
    if (this.failed > 0) {
      this.log(`✗ Failed: ${this.failed} files`, 'red');
    }
    this.log('═══════════════════════════════════════', 'yellow');

    // Run typecheck
    this.log('\nRunning typecheck...', 'yellow');
    try {
      execSync('pnpm typecheck', { stdio: 'inherit', cwd: this.projectRoot });
      this.log('\n✓ TypeScript check passed!', 'green');
      return true;
    } catch (error) {
      this.log('\n✗ TypeScript check failed', 'red');
      this.log('Please review the errors above and apply manual fixes if needed.', 'yellow');
      return false;
    }
  }
}

// Run the fixer
const projectRoot = process.argv[2] || '.';
const fixer = new TypeScriptFixer(projectRoot);
const success = fixer.runFixes();
process.exit(success ? 0 : 1);
