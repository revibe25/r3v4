import { createContext, useContext, useEffect, useState } from "react";
type Theme = "light" | "dark";
const _ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "dark",
  setTheme: () => {},
});
export const _ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>("dark");
  useEffect(() => {
    const _root = document.documentElement;
    root.classList.remove("light", "dark"); root.classList.add(theme);
  }, [theme]);
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>
  );
};
export const _useTheme = () => useContext(ThemeContext);
