import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import FocusBottomNav, { FOCUS_BOTTOM_NAV_HEIGHT } from "../components/FocusBottomNav";
import { FocusRadius, getFocusShadow } from "../constants/design";
import { useTheme } from "../hooks/theme-context";
import dictionaryOfflineService, {
  DICT_LABELS,
  DictionaryFileInfo,
} from "../services/DictionaryOfflineService";
import DatabaseService from "../services/DatabaseService";
import AdBanner from "../components/AdBanner";

interface Group {
  dictKey: string;
  label: string;
  total: number;
  entries: { word: string; snippet: string; title: string }[];
}

interface ListItem {
  type: "header" | "entry";
  key: string;
  group: Group;
  word?: string;
  title?: string;
  snippet?: string;
}

export default function DicionarioScreen() {
  const { colors, isDark } = useTheme();
  const focusShadow = getFocusShadow(isDark);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isCheckingDownload, setIsCheckingDownload] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [favoritesMode, setFavoritesMode] = useState(false);
  const [favoriteGroups, setFavoriteGroups] = useState<Group[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
  );

  const loadFavorites = useCallback(async () => {
    try {
      setFavoritesLoading(true);
      const favorites = await DatabaseService.getDictionaryFavorites();

      const groupsMap = new Map<string, Group>();
      for (const fav of favorites) {
        let snippet = "";
        try {
          const data = await dictionaryOfflineService.getWord(
            fav.word,
            fav.dictKey
          );
          snippet = data
            ? data.definition
                .replace(/<[^>]*>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 100)
            : "";
        } catch {
          snippet = "";
        }

        let group = groupsMap.get(fav.dictKey);
        if (!group) {
          group = {
            dictKey: fav.dictKey,
            label: DICT_LABELS[fav.dictKey] || fav.dictKey,
            total: 0,
            entries: [],
          };
          groupsMap.set(fav.dictKey, group);
        }
        group.entries.push({
          word: fav.word,
          title: fav.title,
          snippet,
        });
      }

      for (const group of groupsMap.values()) {
        group.total = group.entries.length;
      }

      setFavoriteGroups([...groupsMap.values()]);
    } catch (error) {
      console.error("Erro ao carregar favoritos:", error);
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (favoritesMode) {
        loadFavorites();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [favoritesMode])
  );

  useEffect(() => {
    checkDictionaryStatus();
  }, []);

  const checkDictionaryStatus = async () => {
    try {
      const status = await dictionaryOfflineService.checkDownloaded();
      if (status.all) {
        setIsDownloaded(true);
        loadPage(1);
      }
    } catch (error) {
      console.error("Erro ao verificar dicionários:", error);
      setDownloadError("Não foi possível verificar os dicionários. Tente novamente.");
    } finally {
      setIsCheckingDownload(false);
    }
  };

  const handleDownloadDictionaries = async () => {
    if (isDownloading) return;
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      setDownloadError(null);

      let files: DictionaryFileInfo[];
      try {
        files = await dictionaryOfflineService.listFiles();
      } catch {
        setDownloadError(
          "Sem conexão com a internet para baixar os dicionários. Conecte-se e tente novamente."
        );
        return;
      }

      await dictionaryOfflineService.downloadAll(files, (p) =>
        setDownloadProgress(p)
      );
      setIsDownloaded(true);
      loadPage(1);
    } catch (error: any) {
      console.error("Erro ao baixar dicionários:", error);
      setDownloadError(
        error?.message || "Erro inesperado ao baixar os dicionários"
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const mergeGroups = (prev: Group[], next: Group[]): Group[] => {
    const out = [...prev];
    for (const ng of next) {
      const existing = out.find((g) => g.dictKey === ng.dictKey);
      if (existing) {
        existing.entries.push(...ng.entries);
        existing.total = ng.total;
      } else {
        out.push(ng);
      }
    }
    return out;
  };

  const resetAfterReadError = async () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    let message = "Não foi possível abrir os dicionários. Deseja baixá-los novamente?";
    try {
      const status = await dictionaryOfflineService.checkDownloaded();
      if (status.all) {
        // Se os arquivos parecem íntegros, mas falharam na leitura, reiniciar o conjunto.
        await dictionaryOfflineService.deleteAll();
      }
    } catch (error) {
      console.error("Erro ao recuperar dicionários:", error);
      try {
        await dictionaryOfflineService.deleteAll();
      } catch (cleanupError) {
        console.error("Erro ao limpar dicionários:", cleanupError);
        message = "Não foi possível limpar os dicionários. Tente novamente.";
      }
    }

    setIsDownloaded(false);
    setGroups([]);
    setFavoriteGroups([]);
    setTotal(0);
    setQuery("");
    setPage(1);
    setFavoritesMode(false);
    setDownloadProgress(0);
    setDownloadError(message);
  };

  const loadPage = async (p: number, searchQuery?: string) => {
    try {
      if (p === 1) setLoading(true);
      const q = searchQuery !== undefined ? searchQuery : query;
      const result = await dictionaryOfflineService.search(q, p, q ? 50 : 3);
      if (p > 1) {
        setGroups((prev) => mergeGroups(prev, result.groups));
      } else {
        setGroups(result.groups);
      }
      setTotal(result.total);
    } catch (error) {
      console.error("Erro ao carregar dicionário:", error);
      await resetAfterReadError();
    } finally {
      setLoading(false);
      setSearching(false);
    }
  };

  const handleSearch = (text: string) => {
    setQuery(text);
    setSearching(true);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      loadPage(1, text);
    }, 400);
  };

  const loadMore = () => {
    if (!query) return;
    if (loading) return;
    const hasMore = groups.some((g) => g.entries.length < g.total);
    if (!hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadPage(nextPage);
  };

  const openEntry = (word: string, dictKey: string) => {
    router.push(
      `/dicionario-verbete?word=${encodeURIComponent(word)}&dict=${dictKey}`
    );
  };

  const listData: ListItem[] = favoritesMode
    ? favoriteGroups.flatMap((g) => [
        { type: "header", key: `${g.dictKey}-header`, group: g },
        ...g.entries.map((e) => ({
          type: "entry" as const,
          key: `${g.dictKey}-${e.word}`,
          group: g,
          word: e.word,
          title: e.title,
          snippet: e.snippet,
        })),
      ])
    : groups.flatMap((g) => [
        { type: "header", key: `${g.dictKey}-header`, group: g },
        ...g.entries.map((e) => ({
          type: "entry" as const,
          key: `${g.dictKey}-${e.word}`,
          group: g,
          word: e.word,
          title: e.title,
          snippet: e.snippet,
        })),
      ]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "header") {
      return (
        <View style={styles.groupHeader}>
          <Text style={[styles.groupTitle, { color: colors.primary }]}>
            {item.group.label}
          </Text>
          <Text style={[styles.groupCount, { color: colors.textSecondary }]}>
            {item.group.total}{" "}
            {item.group.total === 1 ? "verbete" : "verbetes"}
          </Text>
        </View>
      );
    }

    const word = item.word!;
    const title = item.title || word;
    const dictKey = item.group.dictKey;

    return (
      <TouchableOpacity
        style={[styles.entryCard, { backgroundColor: colors.card }, focusShadow]}
        onPress={() => openEntry(word, dictKey)}
        activeOpacity={0.7}
      >
        <View style={styles.entryHeader}>
          <Text style={[styles.entryWord, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <View style={styles.entryActions}>
            {favoritesMode && (
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await DatabaseService.removeDictionaryFavorite(
                      word,
                      dictKey
                    );
                    loadFavorites();
                  } catch (error) {
                    console.error("Erro ao remover favorito:", error);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="heart" size={18} color="#e91e63" />
              </TouchableOpacity>
            )}
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textSecondary}
            />
          </View>
        </View>
        <Text
          style={[styles.entrySnippet, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {item.snippet}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderDownloadScreen = () => (
    <View style={styles.centerContent}>
      <Ionicons name="book-outline" size={80} color={colors.accent} />
      <Text style={[styles.downloadTitle, { color: colors.textPrimary }]}>
        Dicionários Bíblicos
      </Text>
      <Text style={[styles.downloadSubtitle, { color: colors.textSecondary }]}>
        4 dicionários • Nomes, Wycliffe, Champlin e Temas Bíblicos
      </Text>

      {isDownloading && (
        <View style={styles.progressContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.progressText, { color: colors.textPrimary }]}>
            Baixando dicionários... {Math.round(downloadProgress)}%
          </Text>
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.accent, width: `${downloadProgress}%` },
              ]}
            />
          </View>
          <Text style={[styles.downloadInfo, { color: colors.textSecondary }]}>
            Isso será feito apenas uma vez
          </Text>
        </View>
      )}

      {isCheckingDownload && <ActivityIndicator size="large" color={colors.accent} />}

      {downloadError && !isDownloading && (
        <Text style={[styles.errorText, { color: "#D64545" }]}>
          {downloadError}
        </Text>
      )}

      {!isCheckingDownload && !isDownloading && (
        <View style={styles.downloadPrompt}>
          <Text style={[styles.downloadInfo, { color: colors.textSecondary }]}>
            Deseja baixar os dicionários para consultar os verbetes?
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={handleDownloadDictionaries}
          >
            <Text style={styles.retryButtonText}>Baixar dicionários</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.notNowButton}
            onPress={() => router.replace("/reading-plans")}
          >
            <Text style={[styles.notNowText, { color: colors.textSecondary }]}>
              Agora não
            </Text>
          </TouchableOpacity>
        </View>
      )}

    </View>
  );

  const dictionaryCount = groups.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Dicionário
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {!isDownloaded ? (
        renderDownloadScreen()
      ) : (
        <>
          {!favoritesMode && (
            <View
              style={[styles.searchContainer, { backgroundColor: colors.card }]}
            >
              <Ionicons
                name="search"
                size={20}
                color={colors.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                style={[styles.searchInput, { color: colors.textPrimary }]}
                placeholder="Buscar palavra em todos os dicionários..."
                placeholderTextColor={colors.textSecondary}
                value={query}
                onChangeText={handleSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searching && (
                <ActivityIndicator size="small" color={colors.primary} />
              )}
              {query.length > 0 && !searching && (
                <TouchableOpacity onPress={() => handleSearch("")}>
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[
                styles.favoriteFilter,
                {
                  backgroundColor: favoritesMode
                    ? "#e91e63"
                    : colors.card,
                },
              ]}
              onPress={() => setFavoritesMode((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={favoritesMode ? "heart" : "heart-outline"}
                size={16}
                color={favoritesMode ? "#fff" : colors.textSecondary}
              />
              <Text
                style={[
                  styles.favoriteFilterText,
                  {
                    color: favoritesMode ? "#fff" : colors.textSecondary,
                  },
                ]}
              >
                Favoritos
              </Text>
            </TouchableOpacity>

            {!favoritesMode && total > 0 && (
              <Text
                style={[styles.resultCount, { color: colors.textSecondary }]}
              >
                {total} {total === 1 ? "resultado" : "resultados"}
                {dictionaryCount > 0 &&
                  ` em ${dictionaryCount} ${
                    dictionaryCount === 1 ? "dicionário" : "dicionários"
                  }`}
              </Text>
            )}

            {favoritesMode && favoriteGroups.length > 0 && (
              <Text
                style={[styles.resultCount, { color: colors.textSecondary }]}
              >
                {favoriteGroups.reduce((acc, g) => acc + g.entries.length, 0)}{" "}
                {favoriteGroups.reduce((acc, g) => acc + g.entries.length, 0) === 1
                  ? "favorito"
                  : "favoritos"}
              </Text>
            )}
          </View>

          {(favoritesMode ? favoritesLoading : loading) &&
          listData.length === 0 ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={[styles.loadingText, { color: colors.textSecondary }]}
              >
                {favoritesMode
                  ? "Carregando favoritos..."
                  : "Carregando dicionários..."}
              </Text>
            </View>
          ) : listData.length === 0 ? (
            <View style={styles.centerContent}>
              <Ionicons
                name={favoritesMode ? "heart-outline" : "book-outline"}
                size={64}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {favoritesMode
                  ? "Nenhum verbete favorito ainda"
                  : query
                  ? "Nenhuma palavra encontrada"
                  : "Nenhum verbete disponível"}
              </Text>
              {favoritesMode && (
                <TouchableOpacity
                  style={[
                    styles.goBackFilter,
                    { backgroundColor: colors.primary },
                  ]}
                  onPress={() => setFavoritesMode(false)}
                >
                  <Text style={styles.goBackFilterText}>
                    Explorar dicionários
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) => item.key}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: FOCUS_BOTTOM_NAV_HEIGHT + 32 },
              ]}
              ListHeaderComponent={
                <View style={styles.listAd}>
                  <AdBanner />
                </View>
              }
              renderItem={renderItem}
              onEndReached={favoritesMode ? undefined : loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                !favoritesMode &&
                query &&
                groups.some((g) => g.entries.length < g.total) ? (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : null
              }
            />
          )}
        </>
      )}
      <FocusBottomNav active="dictionary" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    flex: 1,
    marginHorizontal: 8,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: { marginTop: 12, fontSize: 14 },
  emptyText: { marginTop: 12, fontSize: 15, textAlign: "center" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    borderRadius: FocusRadius.sm,
    height: 48,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, height: 44 },
  resultCount: { fontSize: 13, marginHorizontal: 16, marginBottom: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32, paddingTop: 6 },
  listAd: { marginHorizontal: -16, marginBottom: 12 },
  groupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  groupCount: { fontSize: 12 },
  entryCard: {
    borderRadius: FocusRadius.sm,
    padding: 14,
    marginBottom: 10,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
  },
  favoriteFilter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: FocusRadius.pill,
  },
  favoriteFilterText: { fontSize: 13, fontWeight: "600" },
  goBackFilter: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: FocusRadius.pill,
  },
  goBackFilterText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  entryWord: { fontSize: 15, fontWeight: "700" },
  entrySnippet: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  loadingMore: { paddingVertical: 16, alignItems: "center" },
  downloadTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 16,
    textAlign: "center",
  },
  downloadSubtitle: {
    fontSize: 16,
    marginTop: 8,
    textAlign: "center",
  },
  progressContainer: {
    marginTop: 24,
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 24,
  },
  progressText: {
    fontSize: 16,
    marginTop: 12,
    textAlign: "center",
  },
  progressBar: {
    width: "100%",
    height: 10,
    borderRadius: FocusRadius.pill,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: FocusRadius.pill },
  downloadInfo: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  downloadPrompt: { alignItems: "center", marginTop: 24 },
  notNowButton: { padding: 12, marginTop: 8 },
  notNowText: { fontSize: 14, fontWeight: "600" },
  errorText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: FocusRadius.pill,
  },
  retryButtonText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});
