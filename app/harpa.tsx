import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import AdBanner from "../components/AdBanner";
import DatabaseService from "../services/DatabaseService";
import harpaOfflineService from "../services/HarpaOfflineService";

interface HymnListItem {
  number: number;
  title: string;
  snippet?: string; // Trecho encontrado na busca
}

export default function HarpaScreen() {
  const insets = useSafeAreaInsets();
  const [hymns, setHymns] = useState<HymnListItem[]>([]);
  const [filteredHymns, setFilteredHymns] = useState<HymnListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  const [fontSizePref, setFontSizePref] = useState<
    "small" | "medium" | "large"
  >("medium");

  // Estados de download
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // Carregar tema ANTES de qualquer renderização
  useEffect(() => {
    const initTheme = async () => {
      try {
        const settings = await DatabaseService.getMultipleSettings(["theme"]);
        const userTheme = settings.theme as "light" | "dark" | null;
        setTheme(userTheme || "light");
      } catch (error) {
        console.error("Erro ao carregar tema:", error);
        setTheme("light");
      }
    };
    initTheme();
  }, []);

  useEffect(() => {
    // Só carregar conteúdo depois que o tema foi definido
    if (theme !== null) {
      loadSettings();
      checkHarpaStatus();
    }
  }, [theme]);

  useEffect(() => {
    filterHymns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, hymns]);

  const loadSettings = async () => {
    try {
      const settings = await DatabaseService.getMultipleSettings(["fontSize"]);
      const userFont = settings.fontSize as "small" | "medium" | "large" | null;
      if (userFont) setFontSizePref(userFont);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
    }
  };

  const checkHarpaStatus = async () => {
    try {
      const downloaded = await harpaOfflineService.isHarpaDownloaded();
      setIsDownloaded(downloaded);

      if (downloaded) {
        await loadHymnsList();
      } else {
        // Extrair automaticamente na primeira vez
        setIsDownloading(true);
        const result = await harpaOfflineService.downloadHarpa((progress) => {
          setDownloadProgress(progress);
        });

        if (result.success) {
          setIsDownloaded(true);
          await loadHymnsList();
        } else {
          setDownloadError(result.error || "Erro ao preparar a Harpa");
        }
        setIsDownloading(false);
      }
    } catch (error) {
      console.error("Erro ao verificar status da Harpa:", error);
      setIsDownloading(false);
    }
  };

  const loadHymnsList = async () => {
    try {
      const list = await harpaOfflineService.getHymnsList();
      const formattedList: HymnListItem[] = list.map((hymn) => ({
        number: hymn.number,
        title: hymn.title,
      }));

      setHymns(formattedList);
      setFilteredHymns(formattedList);
    } catch (error) {
      console.error("Erro ao carregar lista de hinos:", error);
    }
  };

  const handleDownloadHarpa = async () => {
    try {
      setIsDownloading(true);
      setDownloadError(null);
      setDownloadProgress(0);

      const result = await harpaOfflineService.downloadHarpa((progress) => {
        setDownloadProgress(progress);
      });

      if (result.success) {
        setIsDownloaded(true);
        await loadHymnsList();
      } else {
        setDownloadError(result.error || "Erro ao baixar a Harpa");
      }
    } catch (error) {
      console.error("Erro no download:", error);
      setDownloadError("Erro inesperado ao baixar a Harpa");
    } finally {
      setIsDownloading(false);
    }
  };

  const filterHymns = async () => {
    // Se busca vazia, mostrar todos os hinos
    if (!searchQuery.trim()) {
      // Se hymns estiver vazio, tentar carregar
      if (hymns.length === 0 && isDownloaded) {
        console.log("📋 Busca vazia, carregando lista de hinos...");
        await loadHymnsList();
      } else {
        setFilteredHymns(hymns);
      }
      setSearchLoading(false);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();

    // Buscar por número ou título (instantâneo)
    const titleMatches: HymnListItem[] = hymns
      .filter(
        (hymn) =>
          hymn.title.toLowerCase().includes(lowerQuery) ||
          hymn.number.toString().includes(searchQuery),
      )
      .map((hymn) => ({ ...hymn, snippet: undefined }));

    // Mostrar resultados de título imediatamente
    setFilteredHymns(titleMatches);

    // Se a busca for por texto (não apenas número), buscar no conteúdo
    if (isNaN(Number(searchQuery)) && searchQuery.length >= 3) {
      setSearchLoading(true);
      try {
        console.log("🔍 Buscando no conteúdo por:", lowerQuery);
        const contentMatches =
          await harpaOfflineService.searchInContent(lowerQuery);
        console.log(
          "✅ Encontrados",
          contentMatches.length,
          "hinos no conteúdo",
        );

        // Criar um mapa de snippets por número do hino
        const snippetMap = new Map(
          contentMatches.map((m) => [m.number, m.snippet]),
        );

        // Atualizar titleMatches com snippets quando disponível
        const titleMatchesWithSnippets = titleMatches.map((hymn) => ({
          ...hymn,
          snippet: snippetMap.get(hymn.number),
        }));

        // Adicionar hinos que só foram encontrados no conteúdo
        const titleNumbers = new Set(titleMatches.map((h) => h.number));
        const uniqueContentMatches = contentMatches.filter(
          (match) => !titleNumbers.has(match.number),
        );

        setFilteredHymns([
          ...titleMatchesWithSnippets,
          ...uniqueContentMatches,
        ]);
      } catch (error) {
        console.error("Erro ao buscar no conteúdo:", error);
        setFilteredHymns(titleMatches);
      } finally {
        setSearchLoading(false);
      }
    } else {
      setSearchLoading(false);
    }
  };

  const applyFontScale = (base: number) => {
    switch (fontSizePref) {
      case "small":
        return base * 0.9;
      case "large":
        return base * 1.2;
      default:
        return base;
    }
  };

  const isDark = theme === "dark";
  const colors = {
    bg: isDark ? "#121212" : "#f5f5f5",
    headerBg: isDark ? "#1d1d1d" : "#fff",
    border: isDark ? "#2b2b2b" : "#e0e0e0",
    card: isDark ? "#1e1e1e" : "#fff",
    textPrimary: isDark ? "#e0e0e0" : "#333",
    textSecondary: isDark ? "#b0b0b0" : "#666",
    accent: isDark ? "#81c784" : "#4CAF50",
    searchBg: isDark ? "#2b2b2b" : "#f0f0f0",
  };

  // Não renderizar nada até o tema estar carregado
  if (theme === null) {
    return null;
  }

  const renderHighlightedSnippet = (snippet: string) => {
    const parts = snippet.split(/(\*\*.*?\*\*)/g);

    return (
      <Text
        style={[
          styles.hymnSnippet,
          { color: colors.textSecondary, fontSize: applyFontScale(13) },
        ]}
        numberOfLines={2}
      >
        {parts.map((part, index) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            const highlightedText = part.slice(2, -2);
            return (
              <Text
                key={index}
                style={[
                  styles.highlightedText,
                  { color: colors.accent, fontWeight: "bold" },
                ]}
              >
                {highlightedText}
              </Text>
            );
          }
          return <Text key={index}>{part}</Text>;
        })}
      </Text>
    );
  };

  const renderDownloadScreen = () => (
    <View style={[styles.downloadContainer, { backgroundColor: colors.bg }]}>
      <Ionicons name="musical-notes" size={80} color={colors.accent} />
      <Text
        style={[
          styles.downloadTitle,
          { color: colors.textPrimary, fontSize: applyFontScale(24) },
        ]}
      >
        Harpa Cristã
      </Text>
      <Text
        style={[
          styles.downloadSubtitle,
          { color: colors.textSecondary, fontSize: applyFontScale(16) },
        ]}
      >
        640 hinos disponíveis
      </Text>

      {isDownloading && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text
            style={[
              styles.progressText,
              { color: colors.textPrimary, fontSize: applyFontScale(16) },
            ]}
          >
            Preparando hinos... {downloadProgress}%
          </Text>
          <View
            style={[styles.progressBar, { backgroundColor: colors.border }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: colors.accent,
                  width: `${downloadProgress}%`,
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.downloadInfo,
              { color: colors.textSecondary, fontSize: applyFontScale(14) },
            ]}
          >
            Isso será feito apenas uma vez
          </Text>
        </View>
      )}

      {downloadError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#f44336" />
          <Text
            style={[
              styles.errorText,
              { color: "#f44336", fontSize: applyFontScale(14) },
            ]}
          >
            {downloadError}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={handleDownloadHarpa}
          >
            <Text
              style={[styles.retryButtonText, { fontSize: applyFontScale(14) }]}
            >
              Tentar novamente
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderHymnItem = ({ item }: { item: HymnListItem }) => {
    return (
      <TouchableOpacity
        style={[styles.hymnCard, { backgroundColor: colors.card }]}
        onPress={() => {
          router.push({
            pathname: "/hymn-viewer",
            params: { hymnNumber: item.number },
          });
        }}
      >
        <View style={styles.hymnInfo}>
          <Text
            style={[
              styles.hymnTitle,
              { color: colors.textPrimary, fontSize: applyFontScale(16) },
            ]}
            numberOfLines={2}
          >
            {String(item.number).padStart(3, "0")} - {item.title}
          </Text>
          {item.snippet && renderHighlightedSnippet(item.snippet)}
        </View>
        <Ionicons
          name="chevron-forward"
          size={20}
          color={colors.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  // Se não baixou ainda, mostrar tela de download
  if (!isDownloaded) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.headerBg}
        />
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.headerBg,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.textPrimary, fontSize: applyFontScale(20) },
            ]}
          >
            Harpa Cristã
          </Text>
          <View style={{ width: 40 }} />
        </View>
        {renderDownloadScreen()}
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
        <StatusBar
          barStyle={isDark ? "light-content" : "dark-content"}
          backgroundColor={colors.headerBg}
        />
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.headerBg,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text
            style={[
              styles.headerTitle,
              { color: colors.textPrimary, fontSize: applyFontScale(20) },
            ]}
          >
            Harpa Cristã
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Search Bar */}
        <View
          style={[styles.searchContainer, { backgroundColor: colors.headerBg }]}
        >
          <View
            style={[
              styles.searchInputContainer,
              { backgroundColor: colors.searchBg },
            ]}
          >
            <Ionicons name="search" size={20} color={colors.textSecondary} />
            <TextInput
              style={[
                styles.searchInput,
                { color: colors.textPrimary, fontSize: applyFontScale(16) },
              ]}
              placeholder="Buscar por número ou título..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchLoading && (
              <ActivityIndicator
                size="small"
                color={colors.accent}
                style={{ marginRight: 8 }}
              />
            )}
            {searchQuery.length > 0 && !searchLoading && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Hymns List */}
        <FlatList
          data={filteredHymns}
          renderItem={renderHymnItem}
          keyExtractor={(item) => item.number.toString()}
          contentContainerStyle={{
            paddingBottom: 80,
            paddingHorizontal: 16,
            paddingTop: 16,
          }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons
                name="musical-notes-outline"
                size={64}
                color={colors.textSecondary}
              />
              <Text
                style={[
                  styles.emptyTitle,
                  { color: colors.textPrimary, fontSize: applyFontScale(18) },
                ]}
              >
                Nenhum hino encontrado
              </Text>
              <Text
                style={[
                  styles.emptyText,
                  { color: colors.textSecondary, fontSize: applyFontScale(14) },
                ]}
              >
                Tente buscar por outro termo
              </Text>
            </View>
          }
        />
      </SafeAreaView>

      {/* Banner fixo - usando fragment para ficar fora do SafeAreaView */}
      <View
        style={[
          styles.bannerContainer,
          { backgroundColor: colors.bg, paddingBottom: insets.bottom },
        ]}
      >
        <AdBanner />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  hymnCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  hymnNumber: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  hymnNumberText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  hymnInfo: {
    flex: 1,
  },
  hymnTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  hymnSnippet: {
    fontSize: 13,
    marginTop: 4,
    fontStyle: "italic",
  },
  highlightedText: {
    fontSize: 13,
    fontWeight: "bold",
  },
  audioStatus: {
    marginTop: 4,
  },
  cachedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  notCachedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  hymnAuthor: {
    fontSize: 12,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  loadingMoreContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  downloadContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  downloadTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 24,
    marginBottom: 8,
  },
  downloadSubtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  downloadInfo: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  downloadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  progressContainer: {
    width: "100%",
    alignItems: "center",
    gap: 16,
  },
  progressText: {
    fontSize: 16,
    marginTop: 16,
  },
  progressBar: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  errorContainer: {
    alignItems: "center",
    gap: 16,
    marginTop: 24,
  },
  bannerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 1000,
  },
});
