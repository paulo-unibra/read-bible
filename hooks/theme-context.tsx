import React, { createContext, useContext, useEffect, useState } from "react";
import { getFocusColors } from "../constants/design";
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
  const focus = getFocusColors(isDark);

  const colors = {
    bg: focus.screen,
    headerBg: focus.screen,
    border: focus.line,
    card: focus.screen,
    surfaceAlt: focus.surface,
    textPrimary: focus.text,
    textSecondary: focus.muted,
    textLight: "#fff",
    accent: focus.blue,
    primary: focus.blue,
    success: focus.success,
    progressTrack: focus.blueSoft,
    progressFill: focus.success,
    iconMuted: focus.muted,
    iconForward: focus.muted,
    emptyIcon: isDark ? "#55616a" : "#cbd4da",
  } as const;

  return { colors, isDark, theme };
};
