import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import "react-native-reanimated";
import DatabaseService from "../services/DatabaseService";

export default function RootLayout() {
  // Preferência do usuário, não apenas sistema
  const [userTheme, setUserTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    (async () => {
      const theme = await DatabaseService.getSetting("theme");
      if (theme === "dark" || theme === "light") setUserTheme(theme);
    })();
  }, []);

  return (
    <ThemeProvider value={userTheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="explore" options={{ headerShown: false }} />
        <Stack.Screen name="bible-manager" options={{ headerShown: false }} />
        <Stack.Screen name="free-reading" options={{ headerShown: false }} />
        <Stack.Screen name="chapter-reader" options={{ headerShown: false }} />
        <Stack.Screen name="reading-plans" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="quiz" options={{ headerShown: false }} />
  <Stack.Screen name="login" options={{ headerShown: false }} />
  <Stack.Screen name="ranking" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", headerShown: false }}
        />
      </Stack>
  <StatusBar style={userTheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}
