#!/usr/bin/env python3
"""
inspect-init-constants.py
Show the exact definition of INIT_COLLABS and INIT_SUGGESTIONS in collaborative-daw-pro.tsx
This helps debug why validation is failing.
"""

from pathlib import Path
import re

TARGET = Path('/home/r3v/Stable/client/src/pages/collaborative-daw-pro.tsx')

if not TARGET.exists():
    print(f'ERROR: {TARGET} not found')
    exit(1)

src = TARGET.read_text(encoding='utf-8')

print('=== SEARCHING FOR INIT_COLLABS ===\n')
matches = list(re.finditer(r'const\s+INIT_COLLABS\s*[=:].*?[;\n]', src, re.DOTALL))
if matches:
    for i, m in enumerate(matches):
        start = max(0, m.start() - 100)
        end = min(len(src), m.end() + 100)
        print(f'Match {i+1}:')
        print('---CONTEXT---')
        print(src[start:end])
        print('---END---\n')
else:
    print('No INIT_COLLABS constant definition found\n')

print('=== SEARCHING FOR INIT_SUGGESTIONS ===\n')
matches = list(re.finditer(r'const\s+INIT_SUGGESTIONS\s*[=:].*?(?=const|\n\n|\Z)', src, re.DOTALL))
if matches:
    for i, m in enumerate(matches):
        start = max(0, m.start() - 100)
        end = min(len(src), m.end() + 200)
        print(f'Match {i+1}:')
        print('---CONTEXT---')
        print(src[start:end])
        print('---END---\n')
else:
    print('No INIT_SUGGESTIONS constant definition found\n')

print('=== CHECKING USAGE IN useState ===\n')
if 'useState<Collaborator[]>(INIT_COLLABS)' in src:
    print('✗ INIT_COLLABS still used in useState')
else:
    print('✓ INIT_COLLABS no longer used in useState')

if 'useState<LLPTESuggestion[]>(INIT_SUGGESTIONS)' in src:
    print('✗ INIT_SUGGESTIONS still used in useState')
else:
    print('✓ INIT_SUGGESTIONS no longer used in useState')
