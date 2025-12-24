import React, { createContext, useContext, useEffect, useState } from "react";
import DatabaseService from "../services/DatabaseService";

export type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  loading: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  setTheme: () => {},
  loading: false,
});

export const ThemeProviderCustom: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>("light");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const th = await DatabaseService.getSetting("theme");
        if (th === "dark" || th === "light") setThemeState(th);
      } catch {
        // fallback para light
        setThemeState("light");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    await DatabaseService.saveSetting("theme", newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeCustom = () => useContext(ThemeContext);

export const useTheme = () => {
  const { theme } = useThemeCustom();
  const isDark = theme === "dark";
  
  const colors = {
    bg: isDark ? "#121212" : "#f5f5f5",
    headerBg: isDark ? "#1d1d1d" : "#fff",
    border: isDark ? "#2b2b2b" : "#e0e0e0",
    card: isDark ? "#1e1e1e" : "#fff",
    surfaceAlt: isDark ? "#2a2a2a" : "#f0f0f0",
    textPrimary: isDark ? "#e0e0e0" : "#333",
    textSecondary: isDark ? "#b0b0b0" : "#666",
    textLight: isDark ? "#e0e0e0" : "#fff",
    accent: isDark ? "#90caf9" : "#2196F3",
    primary: isDark ? "#90caf9" : "#2196F3",
    success: isDark ? "#81c784" : "#4CAF50",
    progressTrack: isDark ? "#2c2c2c" : "#e0e0e0",
    progressFill: "#4CAF50",
    iconMuted: isDark ? "#aaaaaa" : "#666",
    iconForward: isDark ? "#888" : "#999",
    emptyIcon: isDark ? "#555" : "#ccc",
  } as const;

  return { colors, isDark, theme };
};
