#!/usr/bin/env python3
"""Add scrolling ticker to pages that don't have it. Read-before-write, no other changes."""

import sys

TICKER_BLOCK = """\n      {/* Ticker */}
      <style>{`@keyframes ag-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div style={{ overflow:'hidden', position:'relative', background:'#080808', padding:'5px 0', flexShrink:0 }}>
        <div style={{ display:'flex', width:'max-content', animation:'ag-scroll 28s linear infinite' }}>
          {['R3 Native','Web Audio API','Offline-First','MIDI Support','Polyphony','Accessible','MultiTrack DAW','VST System','R3 Native','Web Audio API','Offline-First','MIDI Support','Polyphony','Accessible','MultiTrack DAW','VST System'].map((item, i) => (
            <span key={i} style={{ padding:'0 18px', fontSize:9, letterSpacing:'0.2em', textTransform:'uppercase', fontFamily:'"IBM Plex Mono",monospace', color:'#555', whiteSpace:'nowrap' }}>
              {item}<span style={{ color:'#a3e635', marginLeft:8 }}>/</span>
            </span>
          ))}
        </div>
      </div>"""

PATCHES = [
    {
        'file': 'client/src/pages/DAW.tsx',
        # Insert AFTER the TransportBar self-closing tag
        'marker': '      <TransportBar engine={engine} />',
        'mode': 'after',
    },
    {
        'file': 'client/src/pages/vst.tsx',
        # Insert BEFORE the Scrollable body comment (sits right after sub-header </div>)
        # marker is the exact string as it appears in the file — no extra spaces added
        'marker': '      {/* Scrollable body */}',
        'mode': 'before',
    },
    {
        'file': 'client/src/pages/visuals.tsx',
        # Insert BEFORE the Full-screen canvas comment
        'marker': '      {/* Full-screen canvas */}',
        'mode': 'before',
    },
    # collaborative-daw-pro.tsx is excluded: its main wrapper div's style object
    # needs more context to find a safe JSX-level insertion point.
    # Run separately after: grep -n "nav-h\|</style>\|{/\*" collaborative-daw-pro.tsx
]

base = '/home/r3v/Stable'

for patch in PATCHES:
    path = f"{base}/{patch['file']}"
    try:
        with open(path, 'r') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"ERROR: {path} not found")
        sys.exit(1)

    marker = patch['marker']
    if marker not in content:
        print(f"ERROR: marker not found in {patch['file']}:\n  {repr(marker)}")
        sys.exit(1)

    if 'ag-scroll' in content:
        print(f"SKIP: {patch['file']} already has ticker")
        continue

    if patch['mode'] == 'before':
        # Replace marker with: TICKER_BLOCK + newline + marker
        # No extra spaces — marker string already carries its own indentation
        new_content = content.replace(marker, TICKER_BLOCK + '\n' + marker, 1)
    else:
        # Replace marker with: marker + TICKER_BLOCK
        new_content = content.replace(marker, marker + TICKER_BLOCK, 1)

    with open(path, 'w') as f:
        f.write(new_content)
    print(f"OK: {patch['file']}")

print("\nDone. collaborative-daw-pro.tsx skipped — needs manual insertion point.")
print("Run: grep -n '{/\\*' ~/Stable/client/src/pages/collaborative-daw-pro.tsx | head -20")
