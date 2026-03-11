#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
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
      this.log(`  📋 Backup: ${backupPath}`, 'blue');
    }
  }

  fixRouterFile(filePath) {
    if (!this.fileExists(filePath)) {
      this.log(`  ⊘ File not found: ${filePath}`, 'yellow');
      return false;
    }

    this.log(`  → Processing: ${filePath}`, 'yellow');
    this.backupFile(filePath);

    let content = this.readFile(filePath);
    const originalContent = content;

    // Check if already fixed
    if (content.includes('const router: Router = Router()')) {
      this.log(`    ✓ Already fixed`, 'green');
      return true;
    }

    // Add Router type import if missing
    if (!content.match(/import\s*\{[^}]*Router[^}]*\}\s*from\s*['"]express['"]/)) {
      const importMatch = content.match(/import\s+/);
      if (importMatch) {
        content = content.replace(
          /import\s+express/,
          "import express, { type Router }"
        );
      }
    }

    // Fix the router declaration - handle variations
    content = content.replace(
      /const\s+router\s*=\s*Router\(\);/g,
      'const router: Router = Router();'
    );

    // Write fixed content
    this.writeFile(filePath, content);

    // Verify fix
    const fixedContent = this.readFile(filePath);
    if (fixedContent.includes('const router: Router = Router()')) {
      this.log(`    ✓ Fixed`, 'green');
      this.fixed++;
      return true;
    } else {
      this.log(`    ✗ Failed to fix`, 'red');
      this.writeFile(filePath, originalContent);
      this.failed++;
      return false;
    }
  }

  fixMiddlewareFile(filePath) {
    if (!this.fileExists(filePath)) {
      this.log(`  ⊘ File not found: ${filePath}`, 'yellow');
      return false;
    }

    this.log(`  → Processing: ${filePath}`, 'yellow');
    this.backupFile(filePath);

    let content = this.readFile(filePath);
    const originalContent = content;

    // Check if already fixed
    if (content.includes('export const attachSubscription: RequestHandler')) {
      this.log(`    ✓ Already fixed`, 'green');
      return true;
    }

    // Ensure RequestHandler is imported
    if (!content.includes('RequestHandler')) {
      // Check for various import patterns
      if (content.includes("import express, { type Router }")) {
        content = content.replace(
          "import express, { type Router }",
          "import express, { type Router, type RequestHandler }"
        );
      } else if (content.includes('import { Router')) {
        content = content.replace(
          /import\s*\{\s*Router/,
          "import { Router, type RequestHandler"
        );
      } else {
        // Add new import
        const firstImport = content.match(/^import\s+/m);
        if (firstImport) {
          content = `import { type RequestHandler } from 'express';\n${content}`;
        }
      }
    }

    // Fix attachSubscription export
    content = content.replace(
      /export\s+const\s+attachSubscription\s*=\s*middleware\(/,
      'export const attachSubscription: RequestHandler = middleware('
    );

    // Write fixed content
    this.writeFile(filePath, content);

    // Verify fix
    const fixedContent = this.readFile(filePath);
    if (fixedContent.includes('export const attachSubscription: RequestHandler')) {
      this.log(`    ✓ Fixed`, 'green');
      this.fixed++;
      return true;
    } else {
      this.log(`    ✗ Failed to fix`, 'red');
      this.writeFile(filePath, originalContent);
      this.failed++;
      return false;
    }
  }

  fixProceduresFile(filePath) {
    if (!this.fileExists(filePath)) {
      this.log(`  ⊘ File not found: ${filePath}`, 'yellow');
      return false;
    }

    this.log(`  → Processing: ${filePath}`, 'yellow');
    this.backupFile(filePath);

    let content = this.readFile(filePath);

    // This file needs manual review based on tRPC setup
    this.log(`    ℹ Manual review needed - check tRPC procedure types`, 'blue');
    return true;
  }

  runFixes() {
    this.log('\n🔧 Fixing TypeScript TS2742 Portability Errors\n', 'blue');
    this.log(`📍 Project root: ${this.projectRoot}\n`, 'yellow');

    // Router files
    this.log('═══════════════════════════════════════', 'yellow');
    this.log('Fixing Router Declarations', 'yellow');
    this.log('═══════════════════════════════════════', 'yellow');
    this.routerFiles.forEach(file => this.fixRouterFile(file));

    // Middleware files
    this.log('\n═══════════════════════════════════════', 'yellow');
    this.log('Fixing Middleware Declarations', 'yellow');
    this.log('═══════════════════════════════════════', 'yellow');
    this.fixMiddlewareFile('server/middleware/feature-gate.ts');

    // Procedures
    this.log('\n═══════════════════════════════════════', 'yellow');
    this.log('Reviewing Procedures File', 'yellow');
    this.log('═══════════════════════════════════════', 'yellow');
    this.fixProceduresFile('server/procedures.ts');

    // Summary
    this.log('\n═══════════════════════════════════════', 'yellow');
    this.log(`✓ Fixed: ${this.fixed} files`, 'green');
    if (this.failed > 0) {
      this.log(`✗ Failed: ${this.failed} files`, 'red');
    }
    this.log('═══════════════════════════════════════\n', 'yellow');

    // Run typecheck
    this.log('Running pnpm typecheck...', 'yellow');
    try {
      execSync('pnpm typecheck', { stdio: 'inherit', cwd: this.projectRoot });
      this.log('\n✓ TypeScript check passed!', 'green');
      return true;
    } catch (error) {
      this.log('\n✗ TypeScript check failed', 'red');
      this.log('Check errors above and apply manual fixes if needed.', 'yellow');
      return false;
    }
  }
}

const projectRoot = process.argv[2] || '.';
const fixer = new TypeScriptFixer(projectRoot);
const success = fixer.runFixes();
process.exit(success ? 0 : 1);
