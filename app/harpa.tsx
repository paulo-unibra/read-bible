import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatabaseService from '../services/DatabaseService';
import harpaService, { HymnListItem } from '../services/HarpaService';

export default function HarpaScreen() {
  const [hymns, setHymns] = useState<HymnListItem[]>([]);
  const [filteredHymns, setFilteredHymns] = useState<HymnListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSizePref, setFontSizePref] = useState<'small' | 'medium' | 'large'>('medium');

  useEffect(() => {
    loadSettings();
    loadHymnsList();
  }, []);

  useEffect(() => {
    filterHymns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, hymns]);

  const loadSettings = async () => {
    try {
      const settings = await DatabaseService.getMultipleSettings(['fontSize', 'theme']);
      const userFont = settings.fontSize as 'small' | 'medium' | 'large' | null;
      const userTheme = settings.theme as 'light' | 'dark' | null;
      if (userFont) setFontSizePref(userFont);
      if (userTheme) setTheme(userTheme);
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  };

  const loadHymnsList = () => {
    try {
      // Carrega lista completa instantaneamente (sem chamadas de API)
      const list = harpaService.getAllHymnsList();
      setHymns(list);
      setFilteredHymns(list);
    } catch (error) {
      console.error('Erro ao carregar lista de hinos:', error);
    }
  };

  const filterHymns = () => {
    if (!searchQuery.trim()) {
      setFilteredHymns(hymns);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = hymns.filter(
      hymn =>
        hymn.title.toLowerCase().includes(lowerQuery) ||
        hymn.number.toString().includes(searchQuery)
    );
    setFilteredHymns(filtered);
  };

  const applyFontScale = (base: number) => {
    switch (fontSizePref) {
      case 'small':
        return base * 0.9;
      case 'large':
        return base * 1.2;
      default:
        return base;
    }
  };

  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#121212' : '#f5f5f5',
    headerBg: isDark ? '#1d1d1d' : '#fff',
    border: isDark ? '#2b2b2b' : '#e0e0e0',
    card: isDark ? '#1e1e1e' : '#fff',
    textPrimary: isDark ? '#e0e0e0' : '#333',
    textSecondary: isDark ? '#b0b0b0' : '#666',
    accent: isDark ? '#81c784' : '#4CAF50',
    searchBg: isDark ? '#2b2b2b' : '#f0f0f0',
  };

  const renderHymnItem = ({ item }: { item: HymnListItem }) => (
    <TouchableOpacity
      style={[styles.hymnCard, { backgroundColor: colors.card }]}
      onPress={() =>
        router.push({
          pathname: '/hymn-viewer',
          params: { hymnNumber: item.number },
        })
      }
    >
      <View style={[styles.hymnNumber, { backgroundColor: colors.accent }]}>
        <Text style={[styles.hymnNumberText, { fontSize: applyFontScale(18) }]}>
          {item.number}
        </Text>
      </View>
      <View style={styles.hymnInfo}>
        <Text
          style={[
            styles.hymnTitle,
            { color: colors.textPrimary, fontSize: applyFontScale(16) },
          ]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.headerBg}
      />
      <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: applyFontScale(20) }]}>
          Harpa Cristã
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.headerBg }]}>
        <View style={[styles.searchInputContainer, { backgroundColor: colors.searchBg }]}>
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
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Hymns List */}
      <FlatList
        data={filteredHymns}
        renderItem={renderHymnItem}
        keyExtractor={item => item.number.toString()}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes-outline" size={64} color={colors.textSecondary} />
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  listContent: {
    padding: 16,
  },
  hymnCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  hymnNumber: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  hymnNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  hymnInfo: {
    flex: 1,
  },
  hymnTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  hymnAuthor: {
    fontSize: 12,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  loadingMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
