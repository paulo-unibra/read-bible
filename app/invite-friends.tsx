import Alert from '../services/AppFeedback';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getFocusColors } from '../constants/design';
import authService from '../services/AuthService';
import DatabaseService from '../services/DatabaseService';
import referralService, { ReferralSummary } from '../services/ReferralService';

export default function InviteFriendsScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<ReferralSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [dark, setDark] = useState(false);
  const colors = getFocusColors(dark);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError(false);
    if (attempt > 0) setSummary(null);
    (async () => {
      try {
        await authService.init();
        if (!authService.isAuthenticated()) { router.replace('/auth?mode=login'); return; }
        const [data, theme] = await Promise.all([referralService.getMine(), DatabaseService.getSetting('theme')]);
        if (active) { setSummary(data); setDark(theme === 'dark'); }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [attempt, router]));
  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.screen }]}>
    <View style={[styles.header, { borderBottomColor: colors.line }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar" style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]}>Convidar amigos</Text>
    </View>
    {loading ? <ActivityIndicator color={colors.blue} style={{ marginTop: 48 }} /> : <ScrollView contentContainerStyle={styles.content}>
      {error || !summary ? <>
        <Text style={[styles.body, { color: colors.text }]}>Não foi possível carregar seu convite. Confira a conexão e tente novamente.</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.blueDark }]} onPress={() => setAttempt(value => value + 1)} accessibilityRole="button"><Text style={styles.buttonText}>Tentar novamente</Text></TouchableOpacity>
      </> : <>
        <Text style={[styles.body, { color: colors.muted }]}>Ganhe +{summary.rewardPerInvite} pontos por cadastro com seu código e e-mail confirmado.</Text>
        <Text style={[styles.label, { color: colors.muted }]}>Seu código</Text>
        <Text selectable style={[styles.code, { color: colors.text, backgroundColor: colors.surface }]}>{summary.code}</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.blueDark }]} accessibilityRole="button" onPress={async () => {
          try { await Share.share({ message: `Venha ler a Bíblia comigo na Bíblia em Foco! Use meu código ${summary.code} no cadastro.\n${summary.inviteUrl}` }); }
          catch { Alert.alert('Não foi possível compartilhar', 'Você pode copiar o código e enviá-lo a um amigo.'); }
        }}><Text style={styles.buttonText}>Compartilhar convite</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.copy, { borderColor: colors.line }]} accessibilityRole="button" onPress={async () => {
          try { await Clipboard.setStringAsync(summary.code); Alert.alert('Código copiado', 'Envie a um amigo para ele usar no cadastro.'); }
          catch { Alert.alert('Não foi possível copiar', 'Você pode selecionar o código e copiá-lo manualmente.'); }
        }}><Text style={[styles.copyText, { color: colors.blueDark }]}>Copiar código</Text></TouchableOpacity>
        <View style={[styles.stats, { borderColor: colors.line }]}>
          <Text style={[styles.note, { color: colors.muted }]}>{summary.monthlyConfirmedInvites} confirmados · {summary.pendingInvites} {summary.pendingInvites === 1 ? 'pendente' : 'pendentes'} · +{summary.monthlyPoints} pontos</Text>
        </View>
        <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/tamagoshi')} style={styles.petLink}><Text style={[styles.copyText, { color: colors.blueDark }]}>Ver meu Tamagoshi</Text></TouchableOpacity>
      </>}
    </ScrollView>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, padding: 16, gap: 12 }, back: { minWidth: 44, minHeight: 44, justifyContent: 'center' }, title: { fontSize: 19, fontWeight: '700', flex: 1 }, content: { padding: 24, paddingBottom: 48, gap: 12 }, body: { fontSize: 15, lineHeight: 23 }, label: { fontSize: 14, marginTop: 12 }, code: { fontSize: 24, fontWeight: '700', letterSpacing: 2, padding: 18, textAlign: 'center', borderRadius: 12 }, button: { padding: 17, borderRadius: 14, alignItems: 'center', minHeight: 52 }, buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' }, copy: { borderWidth: 1, borderRadius: 14, padding: 14, alignItems: 'center', minHeight: 48 }, copyText: { fontWeight: '600', fontSize: 15 }, stats: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 18, gap: 5, marginVertical: 8 }, petLink: { paddingVertical: 12, minHeight: 44 }, note: { fontSize: 12, lineHeight: 18 } });
