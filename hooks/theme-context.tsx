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
