// client/src/components/theme-provider.tsx
import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Theme, ThemeMetadata } from '@/lib/theme-config';
import { THEMES, STORAGE_KEY, AVAILABLE_THEMES } from '@/lib/theme-config';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: readonly Theme[];
  themeMetadata: ThemeMetadata;
  isDark: boolean;
  isLight: boolean;
  toggleTheme: () => void;
  nextTheme: () => void;
  previousTheme: () => void;
  getThemesByCategory: (category: 'dark' | 'light') => Theme[];
  resolvedTheme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
        if (stored && AVAILABLE_THEMES.includes(stored)) return stored;
      } catch (err) {
        console.error('Error reading theme from localStorage:', err);
      }

      try {
        if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
      } catch (err) {
        console.error('Error checking system theme preference:', err);
      }
    }
    return 'dark';
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    if (!AVAILABLE_THEMES.includes(newTheme)) {
      console.warn(`Invalid theme "${newTheme}", falling back to dark.`);
      newTheme = 'dark';
    }

    setThemeState(newTheme);

    if (typeof window !== 'undefined') {
      try {
        const root = document.documentElement;
        AVAILABLE_THEMES.forEach((t) => root.classList.remove(t));
        root.classList.add(newTheme);
        localStorage.setItem(STORAGE_KEY, newTheme);
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: newTheme } }));
      } catch (err) {
        console.error('Error applying theme:', err);
      }
    }
  }, []);

  const toggleTheme = useCallback(() => {
    const currentIsDark = THEMES[theme].isDark;
    const candidates = currentIsDark
      ? AVAILABLE_THEMES.filter(t => !THEMES[t].isDark)
      : AVAILABLE_THEMES.filter(t => THEMES[t].isDark);
    if (candidates.length > 0) setTheme(candidates[0]);
  }, [theme, setTheme]);

  const nextTheme = useCallback(() => {
    const idx = AVAILABLE_THEMES.indexOf(theme);
    setTheme(AVAILABLE_THEMES[(idx + 1) % AVAILABLE_THEMES.length]);
  }, [theme, setTheme]);

  const previousTheme = useCallback(() => {
    const idx = AVAILABLE_THEMES.indexOf(theme);
    setTheme(AVAILABLE_THEMES[(idx - 1 + AVAILABLE_THEMES.length) % AVAILABLE_THEMES.length]);
  }, [theme, setTheme]);

  const getThemesByCategory = useCallback((category: 'dark' | 'light') => {
    return AVAILABLE_THEMES.filter(t => THEMES[t].isDark === (category === 'dark'));
  }, []);

  // Apply theme classes and CSS variables
  useEffect(() => {
    if (!mounted || typeof window === 'undefined') return;

    try {
      const root = document.documentElement;
      const themeData = THEMES[theme];

      // Remove all theme classes
      AVAILABLE_THEMES.forEach(t => root.classList.remove(t));
      root.classList.add(theme);

      // Set dark mode class for Tailwind
      if (themeData.isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      // Set data attribute
      root.setAttribute('data-theme', theme);

      // Set CSS custom properties for theme colors
      root.style.setProperty('--theme-accent', themeData.accent);
      
      // Set gradient variables
      root.style.setProperty('--theme-gradient-from', themeData.gradient.from);
      root.style.setProperty('--theme-gradient-to', themeData.gradient.to);
      if (themeData.gradient.via) {
        root.style.setProperty('--theme-gradient-via', themeData.gradient.via);
      }
    } catch (err) {
      console.error('Error applying theme variables:', err);
    }
  }, [theme, mounted]);

  const themeMetadata = THEMES[theme];
  const isDark = themeMetadata.isDark;
  const isLight = !themeMetadata.isDark;

  if (!mounted) return null;

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        themes: AVAILABLE_THEMES,
        themeMetadata,
        isDark,
        isLight,
        toggleTheme,
        nextTheme,
        previousTheme,
        getThemesByCategory,
        resolvedTheme: theme, // Add resolvedTheme
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
