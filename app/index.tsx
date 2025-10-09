import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '../components/logo';
import DatabaseService from '../services/DatabaseService';
import notificationService from '../services/NotificationService';
import readingPlanService from '../services/ReadingPlanService';
import { ReadingPlanDay } from '../types';

export default function HomeScreen() {
  // Planos de leitura desativados temporariamente
  const [todayReading, setTodayReading] = useState<ReadingPlanDay | null>(null);
  const [loading, setLoading] = useState(true);
  const [fontSizePref, setFontSizePref] = useState<'small' | 'medium' | 'large'>('medium');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [userLogged, setUserLogged] = useState(false);

  useEffect(() => { initializeApp(); }, []);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    (async () => {
      try {
        const userFont = (await DatabaseService.getSetting('fontSize')) as 'small' | 'medium' | 'large' | null;
        const userTheme = (await DatabaseService.getSetting('theme')) as 'light' | 'dark' | null;
        if (mounted) {
          if (userFont) setFontSizePref(userFont);
          if (userTheme) setTheme(userTheme);
          setUserLogged(false); // Sem autenticação
        }
      } catch {}
    })();
    return () => { mounted = false; };
  }, []));

  const initializeApp = async () => {
    try {
      await DatabaseService.init();
      await DatabaseService.ensureSampleBible();
      await notificationService.requestPermissions();
      // Carregamento de planos desativado (em desenvolvimento)
      const userFont = (await DatabaseService.getSetting('fontSize')) as 'small' | 'medium' | 'large' | null;
      const userTheme = (await DatabaseService.getSetting('theme')) as 'light' | 'dark' | null;
  if (userFont) setFontSizePref(userFont);
  if (userTheme) setTheme(userTheme);
  setUserLogged(false); // Sem autenticação
    } catch (e) {
      console.error(e);
      Alert.alert('Erro', 'Falha ao inicializar o aplicativo');
    } finally { setLoading(false); }
  };

  const applyFontScale = useCallback((base: number) => {
    switch (fontSizePref) { case 'small': return base * 0.9; case 'large': return base * 1.2; default: return base; }
  }, [fontSizePref]);

  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#121212' : '#f5f5f5', headerBg: isDark ? '#1d1d1d' : '#fff', border: isDark ? '#2b2b2b' : '#e0e0e0',
    card: isDark ? '#1e1e1e' : '#fff', surfaceAlt: isDark ? '#2a2a2a' : '#f0f0f0', textPrimary: isDark ? '#e0e0e0' : '#333',
    textSecondary: isDark ? '#b0b0b0' : '#666', accent: isDark ? '#90caf9' : '#2196F3', success: isDark ? '#81c784' : '#4CAF50',
    progressTrack: isDark ? '#2c2c2c' : '#e0e0e0', progressFill: '#4CAF50', iconMuted: isDark ? '#aaaaaa' : '#666', iconForward: isDark ? '#888' : '#999', emptyIcon: isDark ? '#555' : '#ccc'
  } as const;

  const showPlansDevAlert = () => {
    Alert.alert('Em desenvolvimento', 'A funcionalidade de planos de leitura ainda está em desenvolvimento.');
  };

  const handleMarkReadingComplete = async () => {
    if (!todayReading) return;
    try { await readingPlanService.markDayAsCompleted(todayReading.id); setTodayReading({ ...todayReading, isCompleted: true }); Alert.alert('Parabéns!', 'Leitura marcada como concluída! 🎉'); } catch { Alert.alert('Erro','Falha ao marcar leitura'); }
  };

  const startFreeReading = async () => {
    try {
      const bibles = await DatabaseService.getBibles();
      const downloadedBibles = bibles.filter(b => b.isDownloaded);
      if (downloadedBibles.length === 0) {
        Alert.alert('Nenhuma Bíblia Disponível','Você precisa baixar pelo menos uma Bíblia.',[{ text:'Cancelar', style:'cancel'}, { text:'Baixar Bíblias', onPress: () => router.push('/bible-manager') }]);
        return;
      }
      let lastReading = await DatabaseService.getLastReading();
      if (!lastReading) { lastReading = { bibleId: downloadedBibles[0].id, bookId: 1, chapterNumber: 1 }; }
      router.push(`/chapter-reader?bibleId=${lastReading.bibleId}&bookId=${lastReading.bookId}&chapterNumber=${lastReading.chapterNumber}`);
    } catch { Alert.alert('Erro','Falha ao iniciar leitura livre'); }
  };

  if (loading) {
    return <SafeAreaView style={[styles.container,{ backgroundColor: colors.bg }]}><View style={styles.centerContent}><Text style={[styles.loadingText,{ color: colors.textSecondary }]}>Carregando...</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={[styles.container,{ backgroundColor: colors.bg }]}> 
      {/* Header fixo */}
      <View style={[styles.header,{ backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}> 
        <Logo size={36} />
        <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
          <Ionicons name="settings-outline" size={24} color={colors.iconMuted} />
        </TouchableOpacity>
      </View>
      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 40 }}>
        {todayReading ? (
          <View style={[styles.todayCard,{ backgroundColor: colors.card, borderLeftColor: colors.accent, shadowOpacity: isDark ? 0.3 : 0.1 }]}> 
            <Text style={[styles.todayTitle,{ color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Leitura de Hoje</Text>
            <View style={styles.readingInfo}>
              {todayReading.readings.map((reading,i) => (
                <Text key={i} style={[styles.readingText,{ color: colors.textSecondary, fontSize: applyFontScale(16) }]}>
                  {reading.bookName} {reading.startChapter}{reading.endChapter !== reading.startChapter && `-${reading.endChapter}`}
                </Text>
              ))}
            </View>
            {!todayReading.isCompleted ? (
              <TouchableOpacity style={styles.completeButton} onPress={handleMarkReadingComplete}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={[styles.completeButtonText,{ fontSize: applyFontScale(16) }]}>Marcar como Lida</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.completedBadge}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.completedText,{ color: colors.success, fontSize: applyFontScale(16) }]}>Concluída</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.noReadingCard,{ backgroundColor: colors.card, shadowOpacity: isDark ? 0.3 : 0.1 }]}> 
            <Ionicons name="calendar-outline" size={48} color={colors.emptyIcon} />
            <Text style={[styles.noReadingTitle,{ color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Nenhuma leitura programada</Text>
            <Text style={[styles.noReadingText,{ color: colors.textSecondary, fontSize: applyFontScale(14), lineHeight: applyFontScale(20) }]}>Crie um plano de leitura para começar sua jornada bíblica</Text>
              <TouchableOpacity style={[styles.createPlanButton, styles.disabledButton]} onPress={showPlansDevAlert}>
                <Text style={[styles.createPlanButtonText, styles.disabledButtonText,{ fontSize: applyFontScale(16) }]}>Criar Plano</Text>
              </TouchableOpacity>
          </View>
        )}

        <View style={styles.actionsSection}>
          <Text style={[styles.sectionTitle,{ color: colors.textPrimary, fontSize: applyFontScale(20) }]}>Modo de Leitura</Text>
          <TouchableOpacity style={[styles.actionCard,{ backgroundColor: colors.card, shadowOpacity: isDark ? 0.25 : 0.1 }]} onPress={startFreeReading}>
            <View style={[styles.actionIcon,{ backgroundColor: colors.surfaceAlt }]}><Ionicons name="book-outline" size={32} color={colors.accent} /></View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle,{ color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Leitura Livre</Text>
              <Text style={[styles.actionDescription,{ color: colors.textSecondary, fontSize: applyFontScale(14) }]}>Navegue por livros, capítulos e versículos</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.iconForward} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard, styles.disabledCard,{ backgroundColor: colors.card, shadowOpacity: isDark ? 0.25 : 0.1 }]} onPress={showPlansDevAlert} activeOpacity={0.8}>
            <View style={[styles.actionIcon,{ backgroundColor: colors.surfaceAlt }]}><Ionicons name="calendar-outline" size={32} color={isDark ? '#ffb74d' : '#FF9800'} /></View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle, styles.disabledText,{ color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Planos de Leitura</Text>
              <Text style={[styles.actionDescription, styles.disabledText,{ color: colors.textSecondary, fontSize: applyFontScale(14) }]}>Em desenvolvimento</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.iconForward} />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionCard,{ backgroundColor: colors.card, shadowOpacity: isDark ? 0.25 : 0.1 }]} onPress={() => router.push('/explore')}>
            <View style={[styles.actionIcon,{ backgroundColor: colors.surfaceAlt }]}><Ionicons name="compass-outline" size={32} color={isDark ? '#64b5f6' : '#1976D2'} /></View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle,{ color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Explorar</Text>
              <Text style={[styles.actionDescription,{ color: colors.textSecondary, fontSize: applyFontScale(14) }]}>Estatísticas, dicas e estrutura bíblica</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.iconForward} />
          </TouchableOpacity>

-
          {/* {!userLogged && (
            <TouchableOpacity style={[styles.actionCard,{ backgroundColor: colors.card, shadowOpacity: isDark ? 0.25 : 0.1 }]} onPress={() => router.push('/login')}>
              <View style={[styles.actionIcon,{ backgroundColor: colors.surfaceAlt }]}><Ionicons name="log-in-outline" size={32} color={isDark ? '#64b5f6' : '#1976D2'} /></View>
              <View style={styles.actionContent}>
                <Text style={[styles.actionTitle,{ color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Login</Text>
                <Text style={[styles.actionDescription,{ color: colors.textSecondary, fontSize: applyFontScale(14) }]}>Entre para salvar seu ranking</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.iconForward} />
            </TouchableOpacity>
          )} */}
        </View>

        <View style={styles.actionsSection}>
          <Text style={[styles.sectionTitle,{ color: colors.textPrimary, fontSize: applyFontScale(20) }]}>Gerenciar Bíblias</Text>
          <TouchableOpacity style={[styles.actionCard,{ backgroundColor: colors.card, shadowOpacity: isDark ? 0.25 : 0.1 }]} onPress={() => router.push('/bible-manager')}>
            <View style={[styles.actionIcon,{ backgroundColor: colors.surfaceAlt }]}><Ionicons name="download-outline" size={32} color={isDark ? '#81c784' : '#4CAF50'} /></View>
            <View style={styles.actionContent}>
              <Text style={[styles.actionTitle,{ color: colors.textPrimary, fontSize: applyFontScale(18) }]}>Baixar Bíblias</Text>
              <Text style={[styles.actionDescription,{ color: colors.textSecondary, fontSize: applyFontScale(14) }]}>Gerencie suas versões da Bíblia</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.iconForward} />
          </TouchableOpacity>
        </View>

        {/* Seção de planos ativos oculta enquanto a funcionalidade está em desenvolvimento */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollView: { flex: 1 },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 18, color: '#666' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' },
  settingsButton: { padding: 8 },
  todayCard: { backgroundColor: '#fff', margin: 16, padding: 20, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#2196F3', shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 5 },
  todayTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  readingInfo: { marginBottom: 16 },
  readingText: { fontSize: 16, color: '#666', marginBottom: 4 },
  completeButton: { backgroundColor: '#2196F3', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  completeButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  completedBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12 },
  completedText: { color: '#4CAF50', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  actionsSection: { padding: 16 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  actionCard: { backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', padding: 16, marginBottom: 12, borderRadius: 12, shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 3 },
  disabledCard: { opacity: 0.55 },
  actionIcon: { width: 56, height: 56, backgroundColor: '#f0f0f0', borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  actionContent: { flex: 1 },
  actionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 4 },
  actionDescription: { fontSize: 14, color: '#666' },
  plansSection: { padding: 16 },
  planSummary: { backgroundColor: '#fff', padding: 16, borderRadius: 12, marginBottom: 12, shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 3 },
  planName: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 8 },
  planProgress: { fontSize: 14, color: '#666', marginBottom: 8 },
  progressBar: { height: 4, backgroundColor: '#e0e0e0', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#4CAF50', borderRadius: 2 },
  noReadingCard: { backgroundColor: '#fff', padding: 24, margin: 16, borderRadius: 12, alignItems: 'center', shadowColor: '#000', shadowOffset: { width:0, height:2 }, shadowOpacity: 0.1, shadowRadius: 3.84, elevation: 3 },
  noReadingTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 8 },
  noReadingText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  createPlanButton: { backgroundColor: '#2196F3', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  disabledButton: { backgroundColor: '#888' },
  createPlanButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  disabledButtonText: { color: '#eee' },
  disabledText: { opacity: 0.7 },
});
