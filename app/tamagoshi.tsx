import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CompanionAvatar from '../components/CompanionAvatar';
import authService from '../services/AuthService';
import DatabaseService from '../services/DatabaseService';
import tamagoshiService from '../services/TamagoshiService';
import { getFocusColors } from '../constants/design';
import { sleepMinutes, Tamagoshi, tamagoshiStatus } from '../utils/tamagoshi';

export default function TamagoshiScreen() {
  const router = useRouter();
  const [pet, setPet] = useState<Tamagoshi | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [name, setName] = useState('');
  const [start, setStart] = useState('22:00');
  const [end, setEnd] = useState('06:00');
  const [dark, setDark] = useState(false);
  const [clock, setClock] = useState(new Date());
  useFocusEffect(useCallback(() => {
    setClock(new Date());
    const timer = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(timer);
  }, []));
  const colors = getFocusColors(dark);
  const populate = (value: Tamagoshi) => { setPet(value); setName(value.name); setStart(value.sleepStart); setEnd(value.sleepEnd); };
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        await authService.init();
        const userId = authService.getUser()?.id;
        if (!userId) { router.replace('/auth?mode=login'); return; }
        const [saved, theme] = await Promise.all([tamagoshiService.get(userId), DatabaseService.getSetting('theme')]);
        if (active) { if (saved) populate(saved); setDark(theme === 'dark'); }
      } catch { if (active) setError(true); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [router]));
  const submit = async () => {
    const userId = authService.getUser()?.id;
    if (!userId || saving) return;
    setSaving(true);
    try {
      const saved = pet ? await tamagoshiService.configure(userId, { name, sleepStart: start, sleepEnd: end }) : await tamagoshiService.activate(userId);
      populate(saved);
      if (pet) Alert.alert('Cuidados salvos', 'Seu Tamagoshi seguirá o novo horário de sono.');
    } catch (e) { Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : 'Tente novamente.'); }
    finally { setSaving(false); }
  };
  const status = pet ? tamagoshiStatus(pet, clock) : null;
  let minutes: number | null = null;
  try { minutes = sleepMinutes(start, end); } catch {}
  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.line, backgroundColor: colors.surface }];
  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.screen }]}>
    <View style={[styles.header, { borderBottomColor: colors.line }]}>
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.back}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]}>{pet ? 'Configurar Tamagoshi' : 'Ativar Tamagoshi'}</Text>
    </View>
    {loading ? <ActivityIndicator style={styles.loading} color={colors.blue} /> : error ? <Text style={[styles.body, styles.content, { color: colors.danger }]}>Não foi possível carregar seu Tamagoshi. Volte e tente novamente.</Text> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {pet && status ? <>
        <View style={styles.pet}><CompanionAvatar catalogVersion={pet.catalogVersion ?? 1} seed={pet.seed} mood={status.mood} sleeping={status.sleeping} /><Text style={[styles.petName, { color: colors.text }]}>{pet.name}</Text><Text style={[styles.body, { color: colors.muted }]}>{status.sleeping ? `Dormindo até ${pet.sleepEnd}` : 'Acordado para acompanhar sua jornada'}</Text></View>
        <View style={[styles.health, { borderColor: colors.line }]}>
          <Text style={[styles.healthValue, { color: colors.text }]}>Saúde {status.health}/100</Text>
          <Text style={[styles.body, { color: colors.muted }]}>{status.streak} {status.streak === 1 ? 'dia seguido' : 'dias seguidos'} de leitura</Text>
          <Text style={[styles.body, { color: colors.text }]}>{status.readToday ? 'Leitura de hoje concluída.' : 'Meta de hoje: concluir pelo menos 1 capítulo.'} {status.quizToday ? 'Questionário de hoje concluído.' : ''}</Text>
        </View>
        <Text style={[styles.label, { color: colors.text }]}>Nome do Tamagoshi</Text>
        <TextInput accessibilityLabel="Nome do Tamagoshi" style={inputStyle} value={name} onChangeText={setName} maxLength={24} />
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Sono diário</Text>
        <Text style={[styles.body, { color: colors.muted }]}>Ele dorme automaticamente nesse horário, mesmo com o app fechado. Você pode continuar lendo enquanto ele descansa.</Text>
        <View style={styles.row}>
          <View style={styles.field}><Text style={[styles.label, { color: colors.text }]}>Dormir às</Text><TextInput accessibilityLabel="Horário de dormir, HH:mm" style={inputStyle} value={start} onChangeText={setStart} placeholder="22:00" placeholderTextColor={colors.muted} maxLength={5} keyboardType="numbers-and-punctuation" /></View>
          <View style={styles.field}><Text style={[styles.label, { color: colors.text }]}>Acordar às</Text><TextInput accessibilityLabel="Horário de acordar, HH:mm" style={inputStyle} value={end} onChangeText={setEnd} placeholder="06:00" placeholderTextColor={colors.muted} maxLength={5} keyboardType="numbers-and-punctuation" /></View>
        </View>
        <Text accessibilityLiveRegion="polite" style={[styles.body, { color: minutes !== null && minutes >= 420 ? colors.muted : colors.danger }]}>{minutes === null ? 'Informe os horários no formato HH:mm.' : `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')} de sono por dia.${minutes < 420 ? ' Menos de 7 horas reduz a saúde em 8 pontos por dia.' : ' Descanso suficiente para cuidar da saúde.'}`}</Text>
      </> : <>
        <Ionicons name="paw-outline" size={56} color={colors.blueDark} style={styles.activationIcon} />
        <Text style={[styles.hero, { color: colors.text }]}>Sua constância dá vida a um companheiro.</Text>
        <Text style={[styles.body, { color: colors.muted }]}>Ao ativar, você recebe seu próprio Tamagoshi, com nome, expressão e saúde. Ele começa com 60 pontos e dorme das 22h às 6h.</Text>
      </>}
      <TouchableOpacity accessibilityRole="button" disabled={saving} style={[styles.button, { backgroundColor: colors.blueDark, opacity: saving ? 0.6 : 1 }]} onPress={submit}><Text style={styles.buttonText}>{saving ? 'Salvando…' : pet ? 'Salvar cuidados' : 'Ativar meu Tamagoshi'}</Text></TouchableOpacity>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Um pouco a cada dia</Text>
      <Text style={[styles.body, { color: colors.text }]}>Concluir 1 ou mais capítulos no dia: +6 de saúde. Vários capítulos no mesmo dia não substituem a leitura dos dias seguintes.</Text>
      <Text style={[styles.body, { color: colors.text }]}>Concluir um questionário no dia: +2 de saúde. Ele ajuda, mas não substitui a leitura.</Text>
      <Text style={[styles.body, { color: colors.text }]}>Um dia inteiro sem leitura: −5. Dormir menos de 7 horas: −8. As perdas são aplicadas quando o dia termina; a saúde fica entre 0 e 100.</Text>
      <Text style={[styles.body, { color: colors.muted }]}>Na Bíblia, use “Concluí este capítulo”. No plano, você também pode marcar a leitura como lida. O primeiro dia não tem perda por falta de leitura.</Text>

      <Text style={[styles.footnote, { color: colors.muted }]}>Os cuidados e a constância ficam salvos para sua conta neste aparelho. Os horários seguem o relógio local.</Text>
    </ScrollView>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 12, paddingHorizontal: 16, gap: 12 }, back: { minWidth: 44, minHeight: 44, justifyContent: 'center' }, title: { fontSize: 19, fontWeight: '700', flex: 1 }, loading: { marginTop: 60 }, content: { padding: 24, paddingBottom: 48, gap: 12 }, pet: { alignItems: 'center', paddingVertical: 8 }, petName: { fontSize: 24, fontWeight: '700', marginBottom: 6 }, health: { paddingVertical: 18, borderTopWidth: 1, borderBottomWidth: 1, gap: 8 }, healthValue: { fontSize: 23, fontWeight: '700' }, label: { fontSize: 15, fontWeight: '600', marginBottom: 8 }, input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 17, minHeight: 52 }, sectionTitle: { fontSize: 19, fontWeight: '700', marginTop: 16 }, row: { flexDirection: 'row', gap: 16, marginTop: 8 }, field: { flex: 1 }, body: { fontSize: 15, lineHeight: 23 }, button: { borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 16, minHeight: 52 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 }, footnote: { fontSize: 12, lineHeight: 18, marginTop: 6 }, hero: { fontSize: 28, lineHeight: 35, fontWeight: '700', marginBottom: 8 }, activationIcon: { marginVertical: 12 } });
