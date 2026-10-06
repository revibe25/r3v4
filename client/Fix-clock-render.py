#!/usr/bin/env python3
"""Fix ClockDisplay infinite render loop by moving default object outside component"""

import sys
from pathlib import Path

f = Path.home() / "Projects/r3v4/client/src/features/multitrack-v130/components/ClockDisplay.tsx"

text = f.read_text()

# The fix: add constant at module level, use it in parameter default
new_text = text.replace(
    "import React, { useEffect, useState } from 'react';\nimport styles from './ClockDisplay.module.css';",
    "import React, { useEffect, useState } from 'react';\nimport styles from './ClockDisplay.module.css';\n\nconst DEFAULT_TIME_SIGNATURE = { numerator: 4, denominator: 4 };"
)

new_text = new_text.replace(
    "  timeSignature = { numerator: 4, denominator: 4 }",
    "  timeSignature = DEFAULT_TIME_SIGNATURE"
)

if text == new_text:
    print("✗ No changes made (pattern not found)")
    sys.exit(1)

f.write_text(new_text)
print("✓ ClockDisplay.tsx: moved default object to module level")
print("✓ Dependency array will now be stable across renders")
