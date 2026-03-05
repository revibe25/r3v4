#!/usr/bin/env bash
# ============================================================
# R3 v4 — Tailwind fix script
# Run from: ~/Stable/R3 v4/
# Usage:  bash fix-tailwind.sh
# ============================================================
set -e
PROJECT="$(pwd)"
CLIENT="$PROJECT/client"

echo "→ Project root : $PROJECT"
echo "→ Client dir   : $CLIENT"

# ── 1. Show existing tailwind configs so we know what we're replacing ──
echo ""
echo "Existing tailwind configs:"
find "$PROJECT" -name "tailwind.config*" -not -path "*/node_modules/*"

# ── 2. Determine correct config location (where vite.config lives) ──
VITE_DIR=$(dirname "$(find "$CLIENT" -maxdepth 2 -name "vite.config*" -not -path "*/node_modules/*" | head -1)")
echo ""
echo "→ Writing tailwind config to: $VITE_DIR"

# ── 3. Write the correct tailwind.config.ts ──
cat > "$VITE_DIR/tailwind.config.ts" << 'TAILWIND_EOF'
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary:     { DEFAULT: "hsl(var(--primary))",     foreground: "hsl(var(--primary-foreground))"     },
        secondary:   { DEFAULT: "hsl(var(--secondary))",   foreground: "hsl(var(--secondary-foreground))"   },
        destructive: { DEFAULT: "hsl(var(--destructive))", foreground: "hsl(var(--destructive-foreground))" },
        muted:       { DEFAULT: "hsl(var(--muted))",       foreground: "hsl(var(--muted-foreground))"       },
        accent:      { DEFAULT: "hsl(var(--accent))",      foreground: "hsl(var(--accent-foreground))"      },
        popover:     { DEFAULT: "hsl(var(--popover))",     foreground: "hsl(var(--popover-foreground))"     },
        card:        { DEFAULT: "hsl(var(--card))",        foreground: "hsl(var(--card-foreground))"        },
        metal: {
          50:  "#f5f6f7",
          100: "#e8eaed",
          200: "#d0d4da",
          300: "#adb4bf",
          400: "#838e9e",
          500: "#637080",
          600: "#4e5a6a",
          700: "#3d4755",
          800: "#2d3540",
          900: "#1e2530",
          950: "#111620",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        "metal":          "2px 2px 4px rgba(0,0,0,0.6), -1px -1px 2px rgba(255,255,255,0.05)",
        "metal-lg":       "4px 4px 8px rgba(0,0,0,0.7), -2px -2px 4px rgba(255,255,255,0.06)",
        "metal-xl":       "6px 6px 16px rgba(0,0,0,0.8), -3px -3px 6px rgba(255,255,255,0.05)",
        "metal-inner":    "inset 2px 2px 4px rgba(0,0,0,0.6), inset -1px -1px 2px rgba(255,255,255,0.05)",
        "metal-inner-lg": "inset 4px 4px 8px rgba(0,0,0,0.7), inset -2px -2px 4px rgba(255,255,255,0.06)",
        "metal-raised":   "2px 2px 6px rgba(0,0,0,0.7), -1px -1px 3px rgba(255,255,255,0.1), inset 0 1px 0 rgba(255,255,255,0.1)",
        "metal-pressed":  "inset 2px 2px 6px rgba(0,0,0,0.8), inset -1px -1px 2px rgba(255,255,255,0.03)",
        "led-off":        "inset 0 0 4px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,0.5)",
        "glow-blue":      "0 0 8px rgba(59,130,246,0.7),  0 0 20px rgba(59,130,246,0.3)",
        "glow-green":     "0 0 8px rgba(34,197,94,0.7),   0 0 20px rgba(34,197,94,0.3)",
        "glow-red":       "0 0 8px rgba(239,68,68,0.7),   0 0 20px rgba(239,68,68,0.3)",
        "glow-orange":    "0 0 8px rgba(249,115,22,0.7),  0 0 20px rgba(249,115,22,0.3)",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1",   filter: "brightness(1)"   },
          "50%":      { opacity: "0.7", filter: "brightness(1.4)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
    },
  },
  plugins: [
    function ({ addUtilities }: { addUtilities: (u: Record<string, Record<string, string>>) => void }) {
      addUtilities({
        ".text-shadow-metal":    { textShadow: "0 1px 2px rgba(0,0,0,0.8), 0 -1px 1px rgba(255,255,255,0.1)"  },
        ".text-shadow-engraved": { textShadow: "0 1px 2px rgba(0,0,0,0.9), 0 -1px 0 rgba(255,255,255,0.05)"   },
        ".text-shadow-embossed": { textShadow: "0 -1px 2px rgba(0,0,0,0.8), 0 1px 1px rgba(255,255,255,0.15)" },
      });
    },
  ],
};

export default config;
TAILWIND_EOF

echo "✓ tailwind.config.ts written"

# ── 4. Clean up the misnamed / stale configs to avoid confusion ──
for f in \
  "$PROJECT/Tailwind.config" \
  "$PROJECT/tailwind.config.js" \
  "$CLIENT/config/tailwind.config.ts" \
  "$PROJECT/config/tailwind.config.ts"
do
  if [ -f "$f" ] && [ "$f" != "$VITE_DIR/tailwind.config.ts" ]; then
    echo "  removing stale: $f"
    rm -f "$f"
  fi
done

# ── 5. Kill any stale process on port 3000 and restart ──
echo ""
echo "→ Killing port 3000..."
fuser -k 3000/tcp 2>/dev/null || true
sleep 1

echo "→ Starting dev server..."
cd "$PROJECT"
npm run dev
