import { useTheme } from "@/components/theme-provider";
export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
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
