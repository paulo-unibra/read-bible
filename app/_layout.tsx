import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";
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

  return (
    <ThemeProvider value={userTheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="explore" />
        <Stack.Screen name="bible-manager" />
        <Stack.Screen name="free-reading" />
        <Stack.Screen name="chapter-reader" />
        <Stack.Screen name="reading-plans" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="quiz" />
        <Stack.Screen name="login" />
        <Stack.Screen name="ranking" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="forgot-password" />
        <Stack.Screen name="reading-history" />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal" }}
        />
      </Stack>
  <StatusBar style={userTheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}
