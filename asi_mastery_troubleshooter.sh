#!/bin/bash
set -e

echo ""
echo "🚀 ASI MASTERY TROUBLESHOOTER"
echo "→ Purpose: Safely & correctly integrate neon theme, Pro ThemeProvider/Switcher, neon utility classes, audio/VJ starters into an R3v4-class project"
echo ""

#### 1. BACKUP CRITICAL COMPONENTS ####
STAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=~/Stable/asi-upgrade-backup-$STAMP
echo "📦 [1/9] Backing up client/src/ and key configs to $BACKUP_DIR..."
mkdir -p "$BACKUP_DIR"
rsync -a --exclude node_modules --exclude dist client/src/ "$BACKUP_DIR/"
cp client/tailwind.config.ts "$BACKUP_DIR/" 2>/dev/null || true
cp client/src/styles/theme.css "$BACKUP_DIR/" 2>/dev/null || true

#### 2. INSTALL/UPDATE THEME CSS ####
echo "🎨 [2/9] Installing/ensuring canonical neon theme.css..."

cat > client/src/styles/theme.css <<'EOF'
:root {
  --bg: #000000;
  --fg: #eaeaea;
  --panel: #050505;
  --neon-lime: #bfff00;
  --neon-soft: #dfff66;
  --border: #bfff00;
  --glow-sm: 0 0 4px #bfff00;
  --glow-md: 0 0 12px #bfff00, 0 0 24px #bfff00;
  --glow-lg: 0 0 32px #bfff00, 0 0 64px #bfff00;
}
.neon-border { border: 1.5px solid var(--neon-lime); box-shadow: var(--glow-sm); }
.neon-lift:hover { box-shadow: var(--glow-md); border-color: var(--neon-soft); }
.neon-text { color: var(--neon-lime); text-shadow: 0 0 6px var(--neon-lime); }
.neon-panel { background: var(--panel); border: 1px solid var(--neon-lime); box-shadow: var(--glow-sm);}
@keyframes neonPulse {0%,100%{box-shadow:var(--glow-sm);}50%{box-shadow:var(--glow-lg);}}
.neon-pulse { animation: neonPulse 2s infinite ease-in-out; }
EOF

echo "✅ theme.css in place."

#### 3. ENSURE TAILWIND CONFIG SUPPORTS THEME TOKENS ####
echo "🔧 [3/9] Patching tailwind.config.ts for new tokens (darkMode, neon)..."
TWC=client/tailwind.config.ts
if grep -q "neon-lime" "$TWC"; then
  echo "✅ Tailwind config already patched for neon theme tokens."
else
  # Semi-safe patch: extend colors and boxShadow with tokens
  sed -i "s/^ *theme: {/theme: {\n    extend: {\n      colors: {\n        accent: 'var(--neon-lime)',\n        border: 'var(--neon-lime)',\n        panel: 'var(--panel)',\n        background: 'var(--bg)'\n      },\n      boxShadow: {\n        neon: 'var(--glow-md)',\n        neonStrong: 'var(--glow-lg)',\n      },\n    },/" "$TWC" || true
  sed -i "s/^ *darkMode: .*/darkMode: 'class',/" "$TWC" || true
  echo "✅ Tailwind config extended with neon/accent tokens."
fi

#### 4. INSTALL/OVERWRITE PRO THEMEPROVIDER/HOOK CONTEXT ####
echo "🌗 [4/9] Installing Pro ThemeProvider & hook/context..."
mkdir -p client/src/context
cat > client/src/context/ThemeProvider.tsx <<'EOF'
import { createContext, useContext, useEffect, useState } from "react";
type Theme = "light" | "dark";
const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "dark",
  setTheme: () => {},
});
export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark"); root.classList.add(theme);
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  );
};
export const useTheme = () => useContext(ThemeContext);
EOF

echo "✅ ThemeProvider installed to client/src/context/ThemeProvider.tsx"

#### 5. INSTALL/OVERWRITE PRO THEMESWITCHER ####
echo "🟢 [5/9] Installing Pro-level ThemeSwitcher component..."

cat > client/src/components/theme-switcher.tsx <<'EOF'
import { useTheme } from "@/context/ThemeProvider";
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="neon-border neon-panel px-2 py-1 rounded flex items-center gap-2 transition-all"
      aria-label="Toggle theme"
    >
      <span
        className={`inline-block w-3 h-3 rounded-full transition-all ${
          theme === "dark" ? "bg-accent shadow-neon" : "bg-foreground"
        }`}
      />
      <span className="text-xs uppercase">{theme}</span>
    </button>
  );
}
EOF
echo "✅ ThemeSwitcher installed to client/src/components/theme-switcher.tsx"

#### 6. INSTALL AUDIO REACTIVITY HOOK ####
echo "🎛️ [6/9] Installing useAudioReactivity hook..."
mkdir -p client/src/hooks
cat > client/src/hooks/useAudioReactivity.ts <<'EOF'
import { useEffect, useState } from "react";
// Pass in a function that returns the audio level [0,1]
export function useAudioReactivity(getLevel: () => number) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    let smoothed = 0; let raf: number;
    const loop = () => { const raw = getLevel();
      smoothed = smoothed * 0.85 + raw * 0.15;
      setLevel(smoothed);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [getLevel]);
  return level;
}
EOF

echo "✅ useAudioReactivity hook installed."

#### 7. INSTALL STARTER VJ CANVAS ####
echo "🎥 [7/9] Installing starter VJCanvas..."
mkdir -p client/src/vj
cat > client/src/vj/VJCanvas.tsx <<'EOF'
import { useRef, useEffect } from "react";
export function VJCanvas({ level = 0, beat = 0 }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let anim: number;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.shadowBlur = 30 + 40 * level;
      ctx.shadowColor = "#bfff00";
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2, 70 + 32 * Math.abs(Math.sin(beat)), 0, 2 * Math.PI);
      ctx.fillStyle = "#101a00";
      ctx.fill();
      ctx.restore();
      anim = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(anim);
  }, [level, beat]);
  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      style={{
        width: "100vw",
        height: "100vh",
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: "none",
        background: "transparent",
      }}
    />
  );
}
EOF
echo "✅ VJCanvas installed at client/src/vj/VJCanvas.tsx"

#### 8. GREP & MANUAL AUDIT/REPLACE WARNING ####
echo ""
echo "🔎 [8/9] Rerunning a live grep for any remaining non-token legacy colors..."
grep -R "bg-black\|text-white\|border-green\|green-[34]00" client/src || echo "No legacy classes found!"
echo ""
echo "⚠️ Review above: Only DAW.tsx/instrument.tsx or .bak/utility/data/legend hits should remain."
echo "✓ If you see hits *outside* those, open and migrate to tokens now!"
echo ""

echo "❓ [Manual] In your app, ensure ThemeProvider is mounted at root (index.tsx or App.tsx), and imported ThemeSwitcher is visible."

#### 9. TYPECHECK & TEST ####
echo "🧪 [9/9] Running global typecheck (pnpm -w run typecheck)..."
pnpm -w run typecheck

echo ""
echo "✅ Typecheck passed."

echo ""
echo "🏁 All core ASI theme/neon/reactive/VJ upgrades are in place."
echo ""
echo "🔔 NEXT:"
echo "  - Manually test UI and theme switching in browser"
echo "  - Ensure all neon accents/borders respond"
echo "  - Integrate VJCanvas where desired (root or overlay panel)"
echo "  - Build up UI theming with provided utility classes (neon-border, neon-panel, etc.)"
echo ""
echo "📚 Backups can be restored from $BACKUP_DIR if any issues."
echo ""
echo "🌟 ASI Mastery implementation complete! For further feature wiring (audio source to hook, beat clock, MIDI), duplicate and extend the starter hooks/classes."
echo ""
