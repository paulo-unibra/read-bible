import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import FocusBottomNav, {
  FOCUS_BOTTOM_NAV_HEIGHT,
} from "../components/FocusBottomNav";
import { FocusRadius, getFocusColors } from "../constants/design";
import authService from "../services/AuthService";
import bibleReaderService from "../services/BibleReaderService";
import DatabaseService from "../services/DatabaseService";
import { Book } from "../types";

type MainTab = "bible" | "more";

export default function HomeScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<MainTab>(
    params.tab === "more" ? "more" : "bible",
  );
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [bibleAbbrev, setBibleAbbrev] = useState("Bíblia");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState("");
  const [userProfilePicture, setUserProfilePicture] = useState<string | null>(
    null,
  );
  const [profileImageLoadError, setProfileImageLoadError] = useState(false);
  const [bibleOpenError, setBibleOpenError] = useState(false);

  const isDark = theme === "dark";
  const focus = getFocusColors(isDark);

  useEffect(() => {
    initializeApp();
  }, []);

  useEffect(() => {
    if (params.message && typeof params.message === "string") {
      Alert.alert("Login Necessário", params.message);
    }
  }, [params.message]);

  useEffect(() => {
    if (params.tab === "more") setActiveTab("more");
    if (params.tab === "bible") setActiveTab("bible");
  }, [params.tab]);

  const initializeApp = async () => {
    try {
      await DatabaseService.init();
      await authService.init();

      const savedTheme = await DatabaseService.getSetting("theme");
      if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);

      const authenticated = authService.isAuthenticated();
      const user = authService.getUser();
      setIsAuthenticated(authenticated);
      setUserName(authenticated && user?.name ? user.name.split(" ")[0] : "");
      setUserProfilePicture(
        authenticated ? user?.profilePicture || null : null,
      );

      const bibles = await DatabaseService.getBibles();
      const downloadedBibles = bibles.filter((bible) => bible.isDownloaded);
      const preferredBibleId =
        await DatabaseService.getSetting("preferredBibleId");
      const preferredBible = preferredBibleId
        ? downloadedBibles.find((bible) => bible.id === preferredBibleId)
        : downloadedBibles[0];

      if (preferredBible) {
        setBibleAbbrev(preferredBible.abbreviation || "Bíblia");
      }
    } catch (error) {
      console.error("Erro ao inicializar tela inicial:", error);
    } finally {
      setLoading(false);
    }
  };

  const openBible = useCallback(async (options: { replace?: boolean } = {}) => {
    try {
      setBibleOpenError(false);
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
              onPress: () => router.push("/bible-manager"),
            },
          ],
        );
        setBibleOpenError(true);
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

      const href = `/chapter-reader?bibleId=${lastReading.bibleId}&bookId=${lastReading.bookId}&chapterNumber=${lastReading.chapterNumber}`;
      if (options.replace) router.replace(href);
      else router.push(href);
    } catch (error) {
      console.error("Erro ao abrir Bíblia:", error);
      Alert.alert("Erro", "Falha ao abrir Bíblia");
      setBibleOpenError(true);
    }
  }, []);

  useEffect(() => {
    if (!loading && activeTab === "bible" && params.tab !== "more") {
      openBible({ replace: true });
    }
  }, [activeTab, loading, openBible, params.tab]);

  const renderListButton = ({
    icon,
    title,
    subtitle,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={[
        styles.listButton,
        { backgroundColor: focus.screen, borderColor: focus.line },
      ]}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={[styles.optionIcon, { backgroundColor: focus.blueSoft }]}>
        <Ionicons name={icon} size={21} color={focus.blue} />
      </View>
      <View style={styles.optionText}>
        <Text style={[styles.optionTitle, { color: focus.text }]}>{title}</Text>
        <Text style={[styles.optionSubtitle, { color: focus.muted }]}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={focus.muted} />
    </TouchableOpacity>
  );

  const renderMorePanel = () => (
    <ScrollView
      contentContainerStyle={[
        styles.panelContent,
        { paddingBottom: FOCUS_BOTTOM_NAV_HEIGHT + insets.bottom },
      ]}
    >
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionEyebrow, { color: focus.muted }]}>
          Conta e recursos
        </Text>
        <Text style={[styles.sectionTitle, { color: focus.text }]}>Mais</Text>
      </View>
      <View style={styles.buttonList}>
        {renderListButton({
          icon: "person-outline",
          title: isAuthenticated
            ? `Perfil de ${userName || "usuário"}`
            : "Entrar",
          subtitle: isAuthenticated
            ? "Conta e progresso"
            : "Sincronize seu plano",
          onPress: () => router.push(isAuthenticated ? "/profile" : "/auth"),
        })}
        {renderListButton({
          icon: "settings-outline",
          title: "Configurações",
          subtitle: "Aparência, leitura e notificações",
          onPress: () => router.push("/settings"),
        })}
        {/* {renderListButton({ icon: "trophy-outline", title: "Ranking", subtitle: "Acompanhe sua evolução", onPress: () => router.push("/ranking") })} */}
      </View>
    </ScrollView>
  );

  const renderPanel = () => {
    if (activeTab === "more") return renderMorePanel();
    if (bibleOpenError) {
      return (
        <View style={styles.centerContent}>
          <Ionicons name="book-outline" size={56} color={focus.muted} />
          <Text style={[styles.loadingText, { color: focus.muted }]}>
            Baixe uma Bíblia para começar
          </Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: focus.blue }]}
            onPress={() => router.push("/bible-manager")}
          >
            <Text style={styles.primaryButtonText}>Baixar Bíblias</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={styles.centerContent}>
        <ActivityIndicator size="large" color={focus.blue} />
        <Text style={[styles.loadingText, { color: focus.muted }]}>
          Abrindo Bíblia...
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: focus.screen }]}
      >
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={focus.blue} />
          <Text style={[styles.loadingText, { color: focus.muted }]}>
            Carregando...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: focus.screen }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: focus.screen, borderBottomColor: focus.line },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.versionButton,
            { backgroundColor: focus.blue },
            activeTab !== "bible" && styles.headerButtonDisabled,
          ]}
          onPress={() => {
            if (activeTab === "bible") router.push("/bible-manager");
          }}
          disabled={activeTab !== "bible"}
        >
          <Text style={styles.versionButtonText}>{bibleAbbrev}</Text>
          <Ionicons name="chevron-down" size={16} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.iconButton,
              activeTab !== "bible" && styles.headerButtonDisabled,
            ]}
            onPress={() => {
              if (activeTab === "bible") router.push("/free-reading");
            }}
            disabled={activeTab !== "bible"}
          >
            <Ionicons name="search" size={22} color={focus.blue} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.push("/settings")}
          >
            <Ionicons name="options-outline" size={22} color={focus.blue} />
          </TouchableOpacity>
          {userProfilePicture && !profileImageLoadError ? (
            <TouchableOpacity onPress={() => router.push("/profile")}>
              <Image
                source={{ uri: userProfilePicture }}
                style={styles.avatar}
                onError={() => setProfileImageLoadError(true)}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.main}>{renderPanel()}</View>

      <FocusBottomNav active={activeTab === "more" ? "more" : "bible"} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 14, fontSize: 15 },
  primaryButton: {
    marginTop: 16,
    minHeight: 44,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: FocusRadius.pill,
  },
  primaryButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  header: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  versionButton: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    borderRadius: 22,
  },
  versionButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  headerButtonDisabled: { opacity: 0.35 },
  avatar: { width: 34, height: 34, borderRadius: 17, marginLeft: 4 },
  main: { flex: 1 },
  panelContent: { paddingHorizontal: 18, paddingTop: 18 },
  locationButton: {
    width: "100%",
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: FocusRadius.sm,
  },
  locationOverline: { fontSize: 12, marginBottom: 2 },
  locationTitle: { fontSize: 16, fontWeight: "600" },
  readingPreview: { paddingHorizontal: 5, paddingTop: 25, paddingBottom: 20 },
  readingTitle: { fontSize: 27, fontWeight: "600", letterSpacing: -0.6 },
  versePreview: { marginTop: 20, fontSize: 16, lineHeight: 27 },
  readerActions: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 5,
    borderWidth: 1,
    borderRadius: 28,
    marginBottom: 28,
  },
  readerActionButton: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 13,
    borderRadius: 22,
  },
  readerActionText: { fontSize: 14, fontWeight: "600" },
  readerIconButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
  },
  sectionHeader: { marginBottom: 19 },
  sectionEyebrow: { fontSize: 12, marginBottom: 1 },
  sectionTitle: { fontSize: 27, fontWeight: "600", letterSpacing: -0.6 },
  buttonList: { gap: 10 },
  listButton: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    width: "100%",
    padding: 11,
    borderWidth: 1,
    borderRadius: FocusRadius.sm,
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 15, fontWeight: "600" },
  optionSubtitle: { marginTop: 3, fontSize: 12 },
  searchField: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: FocusRadius.sm,
  },
  searchPlaceholder: { fontSize: 15 },
  bottomNav: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 72,
    flexDirection: "row",
    borderTopWidth: 1,
    zIndex: 2,
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
