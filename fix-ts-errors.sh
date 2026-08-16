#!/bin/bash
set -e

echo "=== Fix 1: instrument.tsx imports ==="
sed -i '1s/^/import { useState, useRef, useEffect } from "react";\n/' /home/r3v/Stable/client/src/pages/instrument.tsx

echo "=== Fix 2: class -> className ==="
sed -i 's/ class=/ className=/g' /home/r3v/Stable/client/src/pages/instrument.tsx

echo "=== Fix 3: implicit any types ==="
sed -i 's/filter((t) =>/filter((t: number) =>/g' /home/r3v/Stable/client/src/pages/instrument.tsx
sed -i 's/setActivePads((prev) =>/setActivePads((prev: Record<number, boolean>) =>/g' /home/r3v/Stable/client/src/pages/instrument.tsx
sed -i 's/setActiveSteps((prev) =>/setActiveSteps((prev: boolean[]) =>/g' /home/r3v/Stable/client/src/pages/instrument.tsx
sed -i 's/setOctave((o) =>/setOctave((o: number) =>/g' /home/r3v/Stable/client/src/pages/instrument.tsx
sed -i 's/activeSteps.map((on, idx) =>/activeSteps.map((on: boolean, idx: number) =>/g' /home/r3v/Stable/client/src/pages/instrument.tsx

echo "=== Fix 4: audio.ts Tone import ==="
sed -i "s/const { default: Tone } = await import('tone');/const Tone = await import('tone');/" /home/r3v/Stable/client/src/utils/audio.ts

echo "=== Fix 5: Express req.user type ==="
mkdir -p /home/r3v/Stable/server/types
cat > /home/r3v/Stable/server/types/express.d.ts << 'TYPEOF'
import { JwtPayload } from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload | string;
    }
  }
}

export {};
TYPEOF

echo "=== Verify ==="
cd /home/r3v/Stable/client
pnpm check || true

echo "=== Done ==="
