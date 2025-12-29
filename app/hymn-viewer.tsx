import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DatabaseService from '../services/DatabaseService';
import harpaService, { Hymn, HymnVerse } from '../services/HarpaService';

export default function HymnViewerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const hymnNumber = parseInt(params.hymnNumber as string);

  const [hymn, setHymn] = useState<Hymn | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSizePref, setFontSizePref] = useState<'small' | 'medium' | 'large'>('medium');

  useEffect(() => {
    loadSettings();
    loadHymn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const loadHymn = async () => {
    try {
      setLoading(true);
      const loadedHymn = await harpaService.getHymnByNumber(hymnNumber);
      setHymn(loadedHymn);
    } catch (error) {
      console.error('Erro ao carregar hino:', error);
    } finally {
      setLoading(false);
    }
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
    chorusBg: isDark ? '#2b3d2b' : '#e8f5e9',
  };

  const renderVerse = (verse: HymnVerse, index: number) => {
    const isChorus = verse.type === 'chorus';

    return (
      <View
        key={`${verse.name}-${index}`}
        style={[
          styles.verseContainer,
          isChorus && { backgroundColor: colors.chorusBg, padding: 16, borderRadius: 8 },
        ]}
      >
        {isChorus && (
          <Text
            style={[
              styles.verseLabel,
              { color: colors.accent, fontSize: applyFontScale(14) },
            ]}
          >
            Coro
          </Text>
        )}
        {verse.lines.map((line, lineIndex) => (
          <Text
            key={lineIndex}
            style={[
              styles.verseLine,
              {
                color: colors.textPrimary,
                fontSize: applyFontScale(16),
                fontStyle: isChorus ? 'italic' : 'normal',
              },
            ]}
          >
            {line}
          </Text>
        ))}
      </View>
    );
  };

  if (loading) {
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
            Hino {hymnNumber}
          </Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, fontSize: applyFontScale(16) }]}>
            Carregando hino...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hymn) {
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
        <View style={styles.centerContent}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.textSecondary} />
          <Text
            style={[
              styles.errorTitle,
              { color: colors.textPrimary, fontSize: applyFontScale(18) },
            ]}
          >
            Hino não encontrado
          </Text>
          <Text
            style={[
              styles.errorText,
              { color: colors.textSecondary, fontSize: applyFontScale(14) },
            ]}
          >
            O hino {hymnNumber} não pôde ser carregado
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontSize: applyFontScale(20) }]} numberOfLines={1}>
          Hino {hymn.number}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Header Card */}
        <View style={[styles.headerCard, { backgroundColor: colors.card }]}>
          <View style={[styles.hymnNumberBadge, { backgroundColor: colors.accent }]}>
            <Text style={[styles.hymnNumberText, { fontSize: applyFontScale(24) }]}>
              {hymn.number}
            </Text>
          </View>
          <Text
            style={[
              styles.hymnTitle,
              { color: colors.textPrimary, fontSize: applyFontScale(22) },
            ]}
          >
            {hymn.title}
          </Text>
          {hymn.author && hymn.author !== 'Autor Desconhecido' && (
            <Text
              style={[
                styles.hymnAuthor,
                { color: colors.textSecondary, fontSize: applyFontScale(14) },
              ]}
            >
              {hymn.author}
            </Text>
          )}
          {hymn.copyright && (
            <Text
              style={[
                styles.hymnCopyright,
                { color: colors.textSecondary, fontSize: applyFontScale(12) },
              ]}
            >
              {hymn.copyright}
            </Text>
          )}
        </View>

        {/* Verses */}
        <View style={styles.versesContent}>
          {hymn.verses.map((verse, index) => renderVerse(verse, index))}
        </View>
      </ScrollView>
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
    flex: 1,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  headerCard: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 3,
  },
  hymnNumberBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  hymnNumberText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  hymnTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  hymnAuthor: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 4,
  },
  hymnCopyright: {
    fontSize: 12,
    textAlign: 'center',
  },
  versesContent: {
    gap: 20,
  },
  verseContainer: {
    marginBottom: 8,
  },
  verseLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  verseLine: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 4,
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
  },
});
