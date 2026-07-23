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
import dictionaryService from "../services/DictionaryService";

interface Entry {
  word: string;
  definition: string;
}

export default function DicionarioScreen() {
  const { colors, isDark } = useTheme();
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadPage(1);
  }, []);

  const loadPage = async (p: number, searchQuery?: string) => {
    try {
      if (p === 1) setLoading(true);
      const q = searchQuery !== undefined ? searchQuery : query;
      const result = q
        ? await dictionaryService.search(q, p)
        : await dictionaryService.getAlphabetList(p);
      if (p === 1) {
        setEntries(result.entries);
      } else {
        setEntries((prev) => [...prev, ...result.entries]);
      }
      setTotal(result.total);
      setHasMore(result.page * result.perPage < result.total);
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
    setSelectedEntry(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setPage(1);
      loadPage(1, text);
    }, 400);
  };

  const loadMore = () => {
    if (!hasMore || loading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadPage(nextPage);
  };

  const renderEntry = ({ item }: { item: Entry }) => (
    <TouchableOpacity
      style={[styles.entryCard, { backgroundColor: colors.card }]}
      onPress={() => setSelectedEntry(selectedEntry?.word === item.word ? null : item)}
    >
      <View style={styles.entryHeader}>
        <Text style={[styles.entryWord, { color: colors.primary }]}>{item.word}</Text>
        <Ionicons
          name={selectedEntry?.word === item.word ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textSecondary}
        />
      </View>
      {selectedEntry?.word === item.word && (
        <Text style={[styles.entryDefinition, { color: colors.textPrimary }]}>
          {item.definition.replace(/<[^>]*>/g, "")}
        </Text>
      )}
    </TouchableOpacity>
  );

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
          placeholder="Buscar palavra..."
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
          {total} {total === 1 ? "verbetes" : "verbetes"}
        </Text>
      )}

      {loading && entries.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Carregando dicionário...
          </Text>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="book-outline" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {query ? "Nenhuma palavra encontrada" : "Nenhum verbete disponível"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, idx) => `${item.word}-${idx}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderEntry}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            hasMore ? (
              <View style={styles.loadingMore}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
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
    paddingHorizontal: 12,
    borderRadius: 10,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, height: 44 },
  resultCount: { fontSize: 13, marginHorizontal: 16, marginBottom: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
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
  entryDefinition: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  loadingMore: { paddingVertical: 16, alignItems: "center" },
});