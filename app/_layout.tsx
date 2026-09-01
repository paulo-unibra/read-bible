import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import { ThemeProviderCustom } from "../hooks/theme-context";
import { initializeAds } from "../services/AdService";
import DatabaseService from "../services/DatabaseService";

export default function RootLayout() {
  // Preferência do usuário, não apenas sistema
  const [userTheme, setUserTheme] = useState<"light" | "dark">("light");
  
  useEffect(() => {
    (async () => {
      const theme = await DatabaseService.getSetting("theme");
      if (theme === "dark" || theme === "light") setUserTheme(theme);
      
      // Inicializar AdMob
      await initializeAds();
    })();
  }, []);

  const bottomNavScreenOptions = { animation: "none" as const };

  return (
    <ThemeProviderCustom>
      <ThemeProvider value={userTheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={bottomNavScreenOptions} />
          <Stack.Screen name="explore" />
          <Stack.Screen name="bible-manager" />
          <Stack.Screen name="free-reading" />
          <Stack.Screen name="chapter-reader" options={bottomNavScreenOptions} />
          <Stack.Screen name="reading-plans" options={bottomNavScreenOptions} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="quiz" />
          <Stack.Screen name="login" />
          <Stack.Screen name="ranking" />
          <Stack.Screen name="auth" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reading-history" />
          <Stack.Screen name="video-list" />
          <Stack.Screen name="videos" />
          <Stack.Screen name="video-player" />
          <Stack.Screen name="harpa" options={bottomNavScreenOptions} />
          <Stack.Screen name="dicionario" options={bottomNavScreenOptions} />
          <Stack.Screen name="dicionario-verbete" />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal" }}
          />
        </Stack>
        <StatusBar style={userTheme === "dark" ? "light" : "dark"} />
      </ThemeProvider>
    </ThemeProviderCustom>
  );
}
