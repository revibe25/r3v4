#!/usr/bin/env bash
# fix-jsx-parent.sh — wrap multi-root returns in <> fragments
# Fixes: TS2657 in AudioTest.tsx + AuthPage.tsx
set -euo pipefail

cd ~/Stable/client

TS=$(date +%Y%m%d_%H%M%S)
AUDIO="src/pages/AudioTest.tsx"
AUTH="src/pages/AuthPage.tsx"

cp "$AUDIO" "${AUDIO}.bak.${TS}"
cp "$AUTH"  "${AUTH}.bak.${TS}"
echo "Backups written"

python3 << 'PYEOF'
import re, sys

def fix_return_fragment(filepath, approx_line):
    with open(filepath, 'r') as f:
        src = f.read()
    lines = src.split('\n')

    # Search backward from approx_line for 'return ('
    ret_idx = None
    for i in range(min(approx_line - 1, len(lines) - 1), max(0, approx_line - 25) - 1, -1):
        if re.search(r'^\s*return\s*\(', lines[i]):
            ret_idx = i
            break

    if ret_idx is None:
        print(f"  ✘ return ( not found near line {approx_line} in {filepath}", file=sys.stderr)
        sys.exit(1)

    ws = ' ' * (len(lines[ret_idx]) - len(lines[ret_idx].lstrip()))
    rest = '\n'.join(lines[ret_idx:])

    # Position immediately after 'return ('
    m = re.search(r'return\s*\(', rest)
    open_pos = m.end()

    # Paren-depth walk — all inner JSX parens are balanced,
    # so this reliably finds the outer return(...) closing paren
    depth = 1
    i = open_pos
    while i < len(rest) and depth > 0:
        c = rest[i]
        if   c == '(': depth += 1
        elif c == ')': depth -= 1
        if depth > 0: i += 1

    close_pos = i          # index of the closing )
    inner = rest[open_pos:close_pos]

    new_rest = (
        rest[:open_pos]
        + '\n' + ws + '  <>'
        + inner
        + ws + '  </>\n' + ws
        + rest[close_pos:]
    )

    new_src = ('\n'.join(lines[:ret_idx]) + '\n' + new_rest) if ret_idx > 0 else new_rest

    with open(filepath, 'w') as f:
        f.write(new_src)

    print(f"  ✔ Fixed {filepath}  (return at line {ret_idx + 1})")

fix_return_fragment('src/pages/AudioTest.tsx', 8)
fix_return_fragment('src/pages/AuthPage.tsx', 173)
PYEOF

echo ""
echo "Running TSC..."
ERRORS=$(npx tsc --noEmit 2>&1 | grep "error TS" | wc -l)

if [[ "$ERRORS" -eq 0 ]]; then
  echo "  ✔ TSC: 0 errors"
  rm -f "${AUDIO}.bak.${TS}" "${AUTH}.bak.${TS}"
else
  echo "  ✘ ${ERRORS} error(s) remaining:"
  npx tsc --noEmit 2>&1 | grep "error TS"
  echo "Restoring backups..."
  cp "${AUDIO}.bak.${TS}" "$AUDIO"
  cp "${AUTH}.bak.${TS}"  "$AUTH"
  rm -f "${AUDIO}.bak.${TS}" "${AUTH}.bak.${TS}"
  echo "  ✔ Restored"
  exit 1
fi
