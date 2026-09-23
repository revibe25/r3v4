import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        neonLime: "#a3e635",
        neonLimeDim: "rgba(163,230,53,0.12)",
        r3Bg: "#0a0a0a",
        r3Surface: "#0d0d0d",
        r3Border: "#1c1c1c",
        r3Text: "#e5e5e5",
        r3Dim: "#555555",
        violet: '#8B5CF6',
      },
      boxShadow: {
        neon: 'var(--glow-md)',
        neonStrong: 'var(--glow-lg)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config
