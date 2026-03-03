import type { Config } from 'tailwindcss'

export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // 3D Metal Theme Colors
        metal: {
          50: '#f8f9fa',
          100: '#e9ecef',
          200: '#dee2e6',
          300: '#ced4da',
          400: '#adb5bd',
          500: '#6c757d',
          600: '#495057',
          700: '#343a40',
          800: '#212529',
          900: '#0d1117',
          950: '#010409',
        },
        chrome: {
          light: '#e8eaed',
          DEFAULT: '#c5c9cc',
          dark: '#9ca3a8',
          darker: '#6c757d',
          darkest: '#495057',
        },
        steel: {
          light: '#b8bfc6',
          DEFAULT: '#8b95a1',
          dark: '#5d6875',
          darker: '#454d57',
          darkest: '#2d3339',
        },
        bronze: {
          light: '#d4af87',
          DEFAULT: '#cd7f32',
          dark: '#a0522d',
          darker: '#8b4513',
          darkest: '#6b3410',
        },
        copper: {
          light: '#f4c2a0',
          DEFAULT: '#b87333',
          dark: '#9b5a28',
          darker: '#7d4620',
          darkest: '#5f3317',
        },
        gold: {
          light: '#ffd700',
          DEFAULT: '#d4af37',
          dark: '#b8941f',
          darker: '#9c7a0f',
          darkest: '#806000',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      boxShadow: {
        // 3D Metal Shadows
        'metal-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.3), inset 0 1px 0 0 rgba(255, 255, 255, 0.1)',
        'metal': '0 2px 4px 0 rgba(0, 0, 0, 0.4), inset 0 1px 0 0 rgba(255, 255, 255, 0.15), inset 0 -1px 0 0 rgba(0, 0, 0, 0.2)',
        'metal-md': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.4), inset 0 2px 0 0 rgba(255, 255, 255, 0.2), inset 0 -2px 0 0 rgba(0, 0, 0, 0.25)',
        'metal-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -4px rgba(0, 0, 0, 0.5), inset 0 2px 1px 0 rgba(255, 255, 255, 0.25), inset 0 -2px 1px 0 rgba(0, 0, 0, 0.3)',
        'metal-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.6), inset 0 3px 2px 0 rgba(255, 255, 255, 0.3), inset 0 -3px 2px 0 rgba(0, 0, 0, 0.35)',
        'metal-2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.8), inset 0 4px 3px 0 rgba(255, 255, 255, 0.35), inset 0 -4px 3px 0 rgba(0, 0, 0, 0.4)',
        'metal-inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.4), inset 0 -1px 0 0 rgba(255, 255, 255, 0.1)',
        'metal-inner-lg': 'inset 0 4px 8px 0 rgba(0, 0, 0, 0.5), inset 0 -2px 0 0 rgba(255, 255, 255, 0.15)',
        // Button states
        'metal-pressed': 'inset 0 3px 6px 0 rgba(0, 0, 0, 0.6), inset 0 1px 0 0 rgba(0, 0, 0, 0.4)',
        'metal-raised': '0 4px 8px 0 rgba(0, 0, 0, 0.4), 0 1px 2px 0 rgba(0, 0, 0, 0.3), inset 0 2px 0 0 rgba(255, 255, 255, 0.2)',
        // Glow effects
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3), inset 0 0 10px rgba(59, 130, 246, 0.2)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.5), 0 0 40px rgba(34, 197, 94, 0.3), inset 0 0 10px rgba(34, 197, 94, 0.2)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.5), 0 0 40px rgba(239, 68, 68, 0.3), inset 0 0 10px rgba(239, 68, 68, 0.2)',
        'glow-orange': '0 0 20px rgba(249, 115, 22, 0.5), 0 0 40px rgba(249, 115, 22, 0.3), inset 0 0 10px rgba(249, 115, 22, 0.2)',
        'glow-purple': '0 0 20px rgba(168, 85, 247, 0.5), 0 0 40px rgba(168, 85, 247, 0.3), inset 0 0 10px rgba(168, 85, 247, 0.2)',
        // LED indicators
        'led-on': '0 0 10px currentColor, 0 0 20px currentColor, inset 0 0 5px currentColor',
        'led-off': 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
      },
      backgroundImage: {
        // Metal gradients
        'metal-gradient': 'linear-gradient(135deg, #e8eaed 0%, #c5c9cc 25%, #9ca3a8 50%, #c5c9cc 75%, #e8eaed 100%)',
        'metal-gradient-vertical': 'linear-gradient(180deg, #e8eaed 0%, #c5c9cc 25%, #9ca3a8 50%, #c5c9cc 75%, #e8eaed 100%)',
        'dark-metal-gradient': 'linear-gradient(135deg, #6c757d 0%, #495057 25%, #343a40 50%, #495057 75%, #6c757d 100%)',
        'dark-metal-gradient-vertical': 'linear-gradient(180deg, #6c757d 0%, #495057 25%, #343a40 50%, #495057 75%, #6c757d 100%)',
        // Brushed metal
        'brushed-metal': 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%), linear-gradient(135deg, #e8eaed 0%, #9ca3a8 100%)',
        'brushed-dark-metal': 'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0) 100%), linear-gradient(135deg, #495057 0%, #212529 100%)',
        // Chrome effects
        'chrome-gradient': 'linear-gradient(135deg, #ffffff 0%, #e8eaed 20%, #c5c9cc 40%, #9ca3a8 50%, #c5c9cc 60%, #e8eaed 80%, #ffffff 100%)',
        'dark-chrome-gradient': 'linear-gradient(135deg, #8b95a1 0%, #6c757d 20%, #495057 40%, #343a40 50%, #495057 60%, #6c757d 80%, #8b95a1 100%)',
        // Panel backgrounds
        'panel-metal': 'linear-gradient(180deg, #495057 0%, #343a40 50%, #212529 100%)',
        'panel-light-metal': 'linear-gradient(180deg, #c5c9cc 0%, #9ca3a8 50%, #6c757d 100%)',
        // Knob gradients
        'knob-metal': 'radial-gradient(circle at 30% 30%, #e8eaed, #9ca3a8 60%, #6c757d)',
        'knob-dark-metal': 'radial-gradient(circle at 30% 30%, #6c757d, #343a40 60%, #212529)',
        // LED gradients
        'led-blue': 'radial-gradient(circle, rgba(59, 130, 246, 1) 0%, rgba(59, 130, 246, 0.8) 50%, rgba(59, 130, 246, 0.4) 100%)',
        'led-green': 'radial-gradient(circle, rgba(34, 197, 94, 1) 0%, rgba(34, 197, 94, 0.8) 50%, rgba(34, 197, 94, 0.4) 100%)',
        'led-red': 'radial-gradient(circle, rgba(239, 68, 68, 1) 0%, rgba(239, 68, 68, 0.8) 50%, rgba(239, 68, 68, 0.4) 100%)',
        'led-orange': 'radial-gradient(circle, rgba(249, 115, 22, 1) 0%, rgba(249, 115, 22, 0.8) 50%, rgba(249, 115, 22, 0.4) 100%)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        // Metal-specific animations
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        'led-blink': {
          '0%, 49%': { opacity: '1' },
          '50%, 100%': { opacity: '0.3' },
        },
        'meter-pulse': {
          '0%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(1.05)' },
          '100%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'shimmer': 'shimmer 3s linear infinite',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'led-blink': 'led-blink 1s ease-in-out infinite',
        'meter-pulse': 'meter-pulse 0.3s ease-in-out',
      },
      backdropBlur: {
        xs: '2px',
      },
      textShadow: {
        'metal': '0 1px 2px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.5)',
        'metal-lg': '0 2px 4px rgba(0, 0, 0, 0.4), 0 0 2px rgba(255, 255, 255, 0.6)',
        'embossed': '0 1px 0 rgba(255, 255, 255, 0.4), 0 -1px 0 rgba(0, 0, 0, 0.6)',
        'engraved': '0 -1px 0 rgba(255, 255, 255, 0.3), 0 1px 0 rgba(0, 0, 0, 0.8)',
        'glow': '0 0 10px currentColor, 0 0 20px currentColor',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
    // Plugin for text shadows
    function ({ addUtilities }: any) {
      const newUtilities = {
        '.text-shadow-metal': {
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.3), 0 0 1px rgba(255, 255, 255, 0.5)',
        },
        '.text-shadow-metal-lg': {
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.4), 0 0 2px rgba(255, 255, 255, 0.6)',
        },
        '.text-shadow-embossed': {
          textShadow: '0 1px 0 rgba(255, 255, 255, 0.4), 0 -1px 0 rgba(0, 0, 0, 0.6)',
        },
        '.text-shadow-engraved': {
          textShadow: '0 -1px 0 rgba(255, 255, 255, 0.3), 0 1px 0 rgba(0, 0, 0, 0.8)',
        },
        '.text-shadow-glow': {
          textShadow: '0 0 10px currentColor, 0 0 20px currentColor',
        },
      }
      addUtilities(newUtilities)
    },
  ],
} satisfies Config