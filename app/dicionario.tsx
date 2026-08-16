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
import dictionaryService, { DictionaryGroup } from "../services/DictionaryService";
import AdBanner from "../components/AdBanner";

interface Group {
  dictKey: string;
  label: string;
  total: number;
  entries: { word: string; snippet: string }[];
}

interface ListItem {
  type: "header" | "entry";
  key: string;
  group: Group;
  word?: string;
  snippet?: string;
}

interface ExpandedState {
  word: string;
  dictKey: string;
  label: string;
  definition: string;
  loading: boolean;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export default function DicionarioScreen() {
  const { colors, isDark } = useTheme();
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<ExpandedState | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    loadPage(1);
  }, []);

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
      const result = await dictionaryService.search(q, p);
      if (p > 1) {
        setGroups((prev) => mergeGroups(prev, result.groups));
      } else {
        setGroups(result.groups);
      }
      setTotal(result.total);
      setExpanded(null);
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
    if (loading) return;
    const hasMore = groups.some((g) => g.entries.length < g.total);
    if (!hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadPage(nextPage);
  };

  const toggleExpand = async (word: string, dictKey: string, label: string) => {
    if (expanded && expanded.word === word && expanded.dictKey === dictKey) {
      setExpanded(null);
      return;
    }
    setExpanded({ word, dictKey, label, definition: "", loading: true });
    try {
      const data = await dictionaryService.getWord(word, dictKey);
      if (data) {
        setExpanded({
          word,
          dictKey,
          label,
          definition: stripHtml(data.definition),
          loading: false,
        });
      } else {
        setExpanded(null);
      }
    } catch (error) {
      console.error("Erro ao expandir verbete:", error);
      setExpanded(null);
    }
  };

  const listData: ListItem[] = groups.flatMap((g) => [
    { type: "header", key: `${g.dictKey}-header`, group: g },
    ...g.entries.map((e) => ({
      type: "entry" as const,
      key: `${g.dictKey}-${e.word}`,
      group: g,
      word: e.word,
      snippet: e.snippet,
    })),
  ]);

  const isExpanded = (word: string, dictKey: string) =>
    expanded?.word === word && expanded?.dictKey === dictKey;

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "header") {
      return (
        <View style={styles.groupHeader}>
          <Text style={[styles.groupTitle, { color: colors.primary }]}>
            {item.group.label}
          </Text>
          <Text style={[styles.groupCount, { color: colors.textSecondary }]}>
            {item.group.total} {item.group.total === 1 ? "verbete" : "verbetes"}
          </Text>
        </View>
      );
    }

    const word = item.word!;
    const dictKey = item.group.dictKey;
    const open = isExpanded(word, dictKey);

    return (
      <TouchableOpacity
        style={[styles.entryCard, { backgroundColor: colors.card }]}
        onPress={() => toggleExpand(word, dictKey, item.group.label)}
        activeOpacity={0.7}
      >
        <View style={styles.entryHeader}>
          <Text style={[styles.entryWord, { color: colors.textPrimary }]}>
            {word}
          </Text>
          <Ionicons
            name={open ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </View>
        <Text
          style={[styles.entrySnippet, { color: colors.textSecondary }]}
          numberOfLines={open ? undefined : 2}
        >
          {item.snippet}
        </Text>
        {open && (
          <View>
            {expanded!.loading ? (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={{ marginTop: 8 }}
              />
            ) : (
              <Text style={[styles.entryFull, { color: colors.textPrimary }]}>
                {expanded!.definition}
              </Text>
            )}
            <TouchableOpacity
              style={styles.fullButton}
              onPress={() =>
                router.push(
                  `/dicionario-verbete?word=${encodeURIComponent(word)}&dict=${dictKey}`
                )
              }
            >
              <Text style={[styles.fullButtonText, { color: colors.accent }]}>
                Ver verbete completo
              </Text>
              <Ionicons name="open-outline" size={14} color={colors.accent} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const dictionaryCount = groups.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Dicionário</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.searchContainer, { backgroundColor: colors.card }]}>
        <Ionicons name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Buscar palavra em todos os dicionários..."
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={handleSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searching && <ActivityIndicator size="small" color={colors.primary} />}
        {query.length > 0 && !searching && (
          <TouchableOpacity onPress={() => handleSearch("")}>
            <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {total > 0 && (
        <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
          {total} {total === 1 ? "resultado" : "resultados"}
          {dictionaryCount > 0 && ` em ${dictionaryCount} ${dictionaryCount === 1 ? "dicionário" : "dicionários"}`}
        </Text>
      )}

      {loading && listData.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Carregando dicionários...
          </Text>
        </View>
      ) : listData.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="book-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {query ? "Nenhuma palavra encontrada" : "Nenhum verbete disponível"}
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
            groups.some((g) => g.entries.length < g.total) ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
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
  headerTitle: { fontSize: 20, fontWeight: "bold", flex: 1, marginHorizontal: 8 },
  centerContent: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
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
  groupTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
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
  entryFull: { fontSize: 14, lineHeight: 22, marginTop: 10 },
  fullButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  fullButtonText: { fontSize: 13, fontWeight: "600" },
  loadingMore: { paddingVertical: 16, alignItems: "center" },
});