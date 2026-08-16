import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { useTheme } from "../hooks/theme-context";
import dictionaryOfflineService, {
  DictionaryFileInfo,
} from "../services/DictionaryOfflineService";
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
  const { colors } = useTheme();
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined
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
        return;
      }

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

  const listData: ListItem[] = groups.flatMap((g) => [
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
        style={[styles.entryCard, { backgroundColor: colors.card }]}
        onPress={() => openEntry(word, dictKey)}
        activeOpacity={0.7}
      >
        <View style={styles.entryHeader}>
          <Text style={[styles.entryWord, { color: colors.textPrimary }]}>
            {title}
          </Text>
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textSecondary}
          />
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

      {downloadError && !isDownloading && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#f44336" />
          <Text style={[styles.errorText, { color: "#f44336" }]}>
            {downloadError}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            onPress={checkDictionaryStatus}
          >
            <Text style={styles.retryButtonText}>Tentar novamente</Text>
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

          {total > 0 && (
            <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
              {total} {total === 1 ? "resultado" : "resultados"}
              {dictionaryCount > 0 &&
                ` em ${dictionaryCount} ${
                  dictionaryCount === 1 ? "dicionário" : "dicionários"
                }`}
            </Text>
          )}

          {loading && listData.length === 0 ? (
            <View style={styles.centerContent}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text
                style={[styles.loadingText, { color: colors.textSecondary }]}
              >
                Carregando dicionários...
              </Text>
            </View>
          ) : listData.length === 0 ? (
            <View style={styles.centerContent}>
              <Ionicons
                name="book-outline"
                size={64}
                color={colors.textSecondary}
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {query
                  ? "Nenhuma palavra encontrada"
                  : "Nenhum verbete disponível"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={listData}
              keyExtractor={(item) => item.key}
              contentContainerStyle={styles.listContent}
              renderItem={renderItem}
              onEndReached={loadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                query && groups.some((g) => g.entries.length < g.total) ? (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={colors.primary} />
                  </View>
                ) : null
              }
            />
          )}
        </>
      )}
      <AdBanner />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
  },
  backButton: { padding: 8 },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
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
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, height: 44 },
  resultCount: { fontSize: 13, marginHorizontal: 16, marginBottom: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
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
    borderRadius: 10,
    padding: 14,
    marginBottom: 6,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
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
    borderRadius: 5,
    marginTop: 12,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 5 },
  downloadInfo: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  errorContainer: {
    marginTop: 24,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: { fontSize: 14, fontWeight: "600", color: "#fff" },
});