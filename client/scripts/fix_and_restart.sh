#!/usr/bin/env bash
# fix_and_restart.sh
# Usage:
#   ./fix_and_restart.sh ["/full/path/to/file.tsx"]
# Defaults to: /home/r3/Stable/R3 v4/client/src/components/piano-keys.tsx
set -euo pipefail

TARGET="${1:-/home/r3/Stable/R3 v4/client/src/components/piano-keys.tsx}"

# Resolve path
if command -v realpath >/dev/null 2>&1; then
  TARGET_ABS="$(realpath -m -- "$TARGET")"
else
  TARGET_ABS="$(cd "$(dirname -- "$TARGET")" 2>/dev/null && printf "%s/%s" "$(pwd)" "$(basename -- "$TARGET")")"
fi

if [[ ! -f "$TARGET_ABS" ]]; then
  echo "Target file not found: $TARGET_ABS"
  exit 2
fi

TIMESTAMP="$(date +%s)"
BACKUP="${TARGET_ABS}.${TIMESTAMP}.bak"
echo "Creating backup: $BACKUP"
cp -v -- "$TARGET_ABS" "$BACKUP"

echo "Attempting to parse and auto-fix JSX mismatched closing tag (if present)..."

# Run the embedded Node script. We pass the target path as an argument to node.
# Using node - "$TARGET_ABS" sends '-' then the path; the Node script below handles both positions.
node - "$TARGET_ABS" <<'NODE'
const fs = require('fs');
const path = require('path');

let filePath;

// Accept either process.argv[1] (normal) or process.argv[2] (when '-' is passed for stdin)
if (process.argv[1] && process.argv[1] !== '-') {
  filePath = process.argv[1];
} else if (process.argv[2]) {
  filePath = process.argv[2];
} else {
  console.error('Node script requires file path argument (usage: node - "filePath" <<EOF ... ).');
  process.exit(2);
}

if (!fs.existsSync(filePath)) {
  console.error('File not found:', filePath);
  process.exit(3);
}

let src;
try {
  src = fs.readFileSync(filePath, 'utf8');
} catch (e) {
  console.error('Could not read file:', filePath, e.message);
  process.exit(4);
}

// Try to load @babel/parser from local node_modules first
let parser;
try {
  parser = require(path.join(process.cwd(), 'node_modules', '@babel', 'parser'));
} catch (e) {
  try {
    parser = require('@babel/parser');
  } catch (e2) {
    console.error('Could not load @babel/parser. Please run `npm install` (or pnpm/yarn) to install dependencies.');
    process.exit(5);
  }
}

function tryParse(code) {
  try {
    parser.parse(code, {
      sourceType: 'module',
      plugins: [
        'typescript',
        'jsx',
        'classProperties',
        'decorators-legacy',
        'dynamicImport',
        'nullishCoalescingOperator',
        'optionalChaining',
        'topLevelAwait',
      ],
    });
    return null;
  } catch (err) {
    return err;
  }
}

let err = tryParse(src);
if (!err) {
  console.log('No parse errors detected. No changes necessary.');
  process.exit(0);
}

const msg = (err && err.message) ? err.message : '';
if (!/Expected corresponding JSX closing tag/i.test(msg)) {
  console.error('Parse error detected but not the expected unmatched-JSX-tag error:');
  console.error(msg);
  process.exit(6);
}

const loc = err.loc || null;
if (!loc || !loc.line) {
  console.error('Could not determine error location from parser error:', msg);
  process.exit(7);
}

const lines = src.split(/\r?\n/);
const errLineIndex = loc.line - 1;
if (errLineIndex < 0 || errLineIndex > lines.length) {
  console.error('Error line out of range:', loc.line);
  process.exit(8);
}

// Insert a closing </div> before the reported line only if appropriate
let insertAt = errLineIndex;
let j = insertAt - 1;
while (j >= 0 && /^[ \t]*$/.test(lines[j])) j--;
const prev = j >= 0 ? lines[j].trim() : '';
if (prev.endsWith('</div>') || /\/>$/.test(prev) || prev.endsWith('</section>') || prev.endsWith('/>')) {
  console.error('No insertion needed: previous non-empty line already closes or is self-closing.');
  process.exit(0);
}

const errLine = lines[insertAt] || '';
const indentMatch = errLine.match(/^([ \t]*)/);
const indent = indentMatch ? indentMatch[1] : '';
const insertion = indent + '  </div>';

lines.splice(insertAt, 0, insertion);
const newSrc = lines.join('\n');
const secondErr = tryParse(newSrc);
if (secondErr) {
  console.error('Attempted insertion but parsing still fails. Aborting; no file written.');
  console.error('Parser error after insertion:', secondErr.message);
  process.exit(9);
}

// Write the fixed file
try {
  fs.writeFileSync(filePath, newSrc, 'utf8');
  console.log('Inserted closing </div> before line', insertAt + 1);
  console.log('File updated:', filePath);
} catch (e) {
  console.error('Failed to write file:', e.message);
  process.exit(10);
}
process.exit(0);
NODE

# If inside a git repo, create a branch and commit the fix
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  BRANCH="fix/jsx-piano-keys-${TIMESTAMP}"
  echo "Creating git branch and committing fix: $BRANCH"
  git checkout -b "$BRANCH"
  git add -- "$TARGET_ABS"
  git commit -m "fix(piano-keys): auto-close unmatched JSX tag (inserted </div>)"
  echo "Committed to branch $BRANCH"
else
  echo "Not a git repo (or git not available); no commit created. Backup at: $BACKUP"
fi

# Attempt to start dev server from project root (look up tree for package.json)
CUR_DIR="$(pwd)"
ROOT_DIR="$CUR_DIR"
while [[ "$ROOT_DIR" != "/" && ! -f "$ROOT_DIR/package.json" ]]; do
  ROOT_DIR="$(dirname "$ROOT_DIR")"
done

if [[ -f "$ROOT_DIR/package.json" ]]; then
  echo "Found package.json in $ROOT_DIR. Starting dev server..."
  cd "$ROOT_DIR"
  if [[ -f pnpm-lock.yaml && -x "$(command -v pnpm)" ]]; then
    exec pnpm run dev
  elif [[ -f yarn.lock && -x "$(command -v yarn)" ]]; then
    exec yarn dev
  else
    exec npm run dev
  fi
else
  echo "No package.json found; cannot start dev server automatically."
  exit 0
fi