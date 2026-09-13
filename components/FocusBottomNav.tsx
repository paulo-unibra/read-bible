import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FocusShadow, getFocusColors } from "../constants/design";
import { useThemeCustom } from "../hooks/theme-context";
import bibleReaderService from "../services/BibleReaderService";
import DatabaseService from "../services/DatabaseService";
import { Book } from "../types";

type ActiveTab = "plan" | "bible" | "harpa" | "dictionary" | "more";

interface FocusBottomNavProps {
  active: ActiveTab;
}

export default function FocusBottomNav({ active }: FocusBottomNavProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useThemeCustom();
  const isDark = theme === "dark";
  const focus = getFocusColors(isDark);
  const shadow = isDark ? FocusShadow.dark : FocusShadow.light;

  const openReadingPlan = () => {
    router.replace("/reading-plans");
  };

  const openBible = async () => {
    try {
      const bibles = await DatabaseService.getBibles();
      const downloadedBibles = bibles.filter((bible) => bible.isDownloaded);

      if (downloadedBibles.length === 0) {
        Alert.alert(
          "Nenhuma Bíblia Disponível",
          "Você precisa baixar pelo menos uma Bíblia.",
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Baixar Bíblias",
              onPress: () => router.replace("/bible-manager"),
            },
          ],
        );
        return;
      }

      const preferredBibleId =
        await DatabaseService.getSetting("preferredBibleId");
      const bible = preferredBibleId
        ? downloadedBibles.find((item) => item.id === preferredBibleId) ||
          downloadedBibles[0]
        : downloadedBibles[0];

      let lastReading = await DatabaseService.getLastReading();
      if (!lastReading) {
        await bibleReaderService.openBible(bible.id, bible.fileName);
        const books = await bibleReaderService.getBooks(bible.id);
        const hasOldTestament = books.some(
          (book: Book) => book.testament === "old",
        );
        const firstBook = hasOldTestament
          ? books[0]
          : books.find((book: Book) => /Mateus|Matthew/i.test(book.name)) ||
            books[0];
        lastReading = {
          bibleId: bible.id,
          bookId: firstBook?.id || 1,
          chapterNumber: 1,
        };
      }

      router.replace(
        `/chapter-reader?bibleId=${lastReading.bibleId}&bookId=${lastReading.bookId}&chapterNumber=${lastReading.chapterNumber}`,
      );
    } catch (error) {
      console.error("Erro ao abrir Bíblia:", error);
      Alert.alert("Erro", "Falha ao abrir Bíblia");
    }
  };

  const renderButton = (
    key: ActiveTab,
    icon: keyof typeof Ionicons.glyphMap,
    label: string,
    onPress: () => void,
  ) => {
    const selected = key === active;
    return (
      <TouchableOpacity key={key} style={styles.tabButton} onPress={onPress}>
        <Ionicons
          name={icon}
          size={22}
          color={selected ? focus.blue : focus.muted}
        />
        <Text
          style={[
            styles.tabLabel,
            { color: selected ? focus.blue : focus.muted },
            selected && styles.tabLabelActive,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[
        styles.bottomNav,
        {
          backgroundColor: focus.screen,
          borderTopColor: focus.line,
          paddingBottom: Math.max(8, insets.bottom),
        },
        shadow,
      ]}
    >
      {renderButton("plan", "today-outline", "Plano", openReadingPlan)}
      {renderButton("bible", "book", "Bíblia", openBible)}
      {renderButton("dictionary", "book-outline", "Dicionário", () =>
        router.replace("/dicionario"),
      )}
      {renderButton("harpa", "musical-notes-outline", "Harpa", () =>
        router.replace("/harpa"),
      )}
      {renderButton("more", "menu-outline", "Mais", () =>
        router.replace("/?tab=more"),
      )}
    </View>
  );
}

export const FOCUS_BOTTOM_NAV_HEIGHT = 104;

const styles = StyleSheet.create({
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 72,
    flexDirection: "row",
    borderTopWidth: 1,
    zIndex: 20,
  },
  tabButton: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tabLabel: { fontSize: 12 },
  tabLabelActive: { fontWeight: "600" },
});
