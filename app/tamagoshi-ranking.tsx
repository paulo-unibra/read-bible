import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CompanionAvatar from '../components/CompanionAvatar';
import { getFocusColors } from '../constants/design';
import authService from '../services/AuthService';
import DatabaseService from '../services/DatabaseService';
import tamagoshiService, { MonthlyRanking } from '../services/TamagoshiService';
import { dayKey } from '../utils/tamagoshi';

export default function TamagoshiRankingScreen() {
  const router = useRouter();
  const [data, setData] = useState<MonthlyRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dark, setDark] = useState(false);
  const colors = getFocusColors(dark);
  const loadedMonth = data?.month;
  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => {
      if (loadedMonth && loadedMonth !== dayKey().slice(0, 7)) setAttempt(value => value + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, [loadedMonth]));
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError(false);
    if (attempt > 0) setData(null);
    (async () => {
      try {
        await authService.init();
        const userId = authService.getUser()?.id;
        if (userId == null) { router.replace('/auth?mode=login'); return; }
        await tamagoshiService.sync(userId);
        const [result, theme] = await Promise.all([tamagoshiService.ranking(), DatabaseService.getSetting('theme')]);
        if (active) { setData(result); setDark(theme === 'dark'); }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [attempt, router]));
  const monthLabel = data ? new Date(`${data.month}-15T12:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'America/Recife' }) : '';
  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.screen }]}>
    <View style={[styles.header, { borderBottomColor: colors.line }]}>
      <TouchableOpacity style={styles.back} accessibilityRole="button" accessibilityLabel="Voltar" onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]}>Ranking do Tamagoshi</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Atualizar ranking" disabled={loading} style={styles.back} onPress={() => setAttempt(value => value + 1)}><Ionicons name="refresh" size={22} color={colors.blueDark} /></TouchableOpacity>
    </View>
    {loading ? <ActivityIndicator style={{ marginTop: 48 }} color={colors.blue} /> : error || !data ? <View style={styles.notice}>
      <Text style={{ color: colors.text }}>Não foi possível carregar o ranking.</Text>
      <TouchableOpacity accessibilityRole="button" style={styles.retry} onPress={() => setAttempt(value => value + 1)}><Text style={{ color: colors.blueDark }}>Tentar novamente</Text></TouchableOpacity>
    </View> : <>
      <View style={styles.summary}>
        <Text style={[styles.month, { color: colors.text }]}>{monthLabel}</Text>
        <Text style={[styles.subtitle, { color: colors.muted }]}>Zera no dia 1º · horário de Recife</Text>
        <Text style={[styles.own, { color: colors.blueDark }]}>{data.own.position ? `Você: ${data.own.position}º lugar · ` : 'Você: '}{data.own.points} pontos</Text>
      </View>
      <FlatList data={data.entries} keyExtractor={item => String(item.userId)} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={[styles.entry, { borderColor: colors.line }]}>
        <Text style={[styles.position, { color: colors.muted }]}>{item.position}º</Text>
        <CompanionAvatar size={40} seed={item.seed} catalogVersion={item.catalogVersion} mood="happy" />
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
        <Text style={[styles.points, { color: colors.text }]}>{item.points}</Text>
      </View>} ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>Nenhuma pontuação neste mês. Conclua uma leitura para começar.</Text>}
        ListFooterComponent={data.hasMore ? <TouchableOpacity accessibilityRole="button" disabled={loadingMore} style={styles.retry} onPress={async () => {
          if (loadingMore) return;
          setLoadingMore(true);
          try {
            const next = await tamagoshiService.ranking(data.page + 1);
            setData(previous => previous && previous.month === next.month ? { ...next, entries: [...previous.entries, ...next.entries] } : next);
          } catch { setError(true); }
          finally { setLoadingMore(false); }
        }}><Text style={{ color: colors.blueDark }}>{loadingMore ? 'Carregando…' : 'Ver mais'}</Text></TouchableOpacity> : undefined} />
    </>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12, borderBottomWidth: 1 }, back: { minHeight: 44, minWidth: 44, justifyContent: 'center' }, title: { flex: 1, fontSize: 19, fontWeight: '700' }, summary: { padding: 24, gap: 6 }, month: { fontSize: 22, fontWeight: '700', textTransform: 'none' }, subtitle: { fontSize: 13 }, own: { marginTop: 10, fontSize: 16, fontWeight: '600' }, list: { paddingHorizontal: 24, paddingBottom: 32 }, entry: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1 }, position: { width: 32, fontSize: 14 }, name: { flex: 1, fontSize: 15 }, points: { fontSize: 18, fontWeight: '700' }, notice: { padding: 24 }, retry: { paddingVertical: 18, minHeight: 48 }, empty: { fontSize: 15, lineHeight: 23, paddingVertical: 24 } });
