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
import { Tamagoshi, tamagoshiDisplayName, tamagoshiStatus } from '../utils/tamagoshi';

export default function TamagoshiScreen() {
  const router = useRouter();
  const [pet, setPet] = useState<Tamagoshi | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [name, setName] = useState('');
  const [dark, setDark] = useState(false);
  const [clock, setClock] = useState(new Date());
  useFocusEffect(useCallback(() => {
    setClock(new Date());
    const timer = setInterval(() => setClock(new Date()), 60000);
    return () => clearInterval(timer);
  }, []));
  const colors = getFocusColors(dark);
  const populate = (value: Tamagoshi) => { setPet(value); setName(value.name); };
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      try {
        await authService.init();
        const userId = authService.getUser()?.id;
        if (!userId) { router.replace('/auth?mode=login'); return; }
        const [saved, theme] = await Promise.all([tamagoshiService.get(userId), DatabaseService.getSetting('theme')]);
        if (active) { if (saved) { populate(saved); setLoading(false); } setDark(theme === 'dark'); }
        const rewarded = await tamagoshiService.sync(userId).catch(() => saved);
        if (!rewarded) throw new Error('Não foi possível criar seu Tamagoshi.');
        if (active && rewarded) { if (!saved || saved.seed !== rewarded.seed || saved.activatedAt !== rewarded.activatedAt) populate(rewarded); else setPet(rewarded); }
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
      if (!pet) return;
      const saved = await tamagoshiService.configure(userId, { name });
      populate(saved);
      Alert.alert('Salvo', 'Nome do Tamagoshi atualizado.');
    } catch (e) { Alert.alert('Não foi possível salvar', e instanceof Error ? e.message : 'Tente novamente.'); }
    finally { setSaving(false); }
  };
  const status = pet ? tamagoshiStatus(pet, clock) : null;
  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.line, backgroundColor: colors.surface }];
  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.screen }]}>
    <View style={[styles.header, { borderBottomColor: colors.line }]}>
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.back}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]}>Configurar Tamagoshi</Text>
    </View>
    {loading ? <ActivityIndicator style={styles.loading} color={colors.blue} /> : error ? <Text style={[styles.body, styles.content, { color: colors.danger }]}>Não foi possível carregar seu Tamagoshi. Volte e tente novamente.</Text> : <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {pet && status ? <>
        <View style={styles.pet}>
          <CompanionAvatar size={64} catalogVersion={pet.catalogVersion ?? 1} seed={pet.seed} mood={status.mood} sleeping={status.sleeping} />
          <View style={styles.petSummary}>
            <Text style={[styles.petName, { color: colors.text }]} numberOfLines={1}>{tamagoshiDisplayName(pet.name, authService.getUser()?.name)}</Text>
            <Text style={[styles.body, { color: colors.muted }]}>{status.points} pontos no mês{status.sleeping ? ' · Dormindo' : ''}</Text>
          </View>
        </View>
        <Text style={[styles.label, { color: colors.text }]}>Nome</Text>
        <TextInput accessibilityLabel="Nome do Tamagoshi" style={inputStyle} value={name} onChangeText={setName} maxLength={24} />
      </> : null}
      <TouchableOpacity accessibilityRole="button" disabled={saving} style={[styles.button, { backgroundColor: colors.blueDark, opacity: saving ? 0.6 : 1 }]} onPress={submit}><Text style={styles.buttonText}>{saving ? 'Salvando…' : 'Salvar'}</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/tamagoshi-ranking')} style={{ paddingVertical: 12 }}><Text style={{ color: colors.blueDark, fontWeight: '600', fontSize: 15 }}>Ver ranking do mês</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/invite-friends')} style={{ paddingVertical: 12 }}><Text style={{ color: colors.blueDark, fontWeight: '600', fontSize: 15 }}>Convidar amigos</Text></TouchableOpacity>
      <Text style={[styles.footnote, { color: colors.muted }]}>Pontuação zera no dia 1º de cada mês.</Text>
    </ScrollView>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, paddingVertical: 12, paddingHorizontal: 16, gap: 12 }, back: { minWidth: 44, minHeight: 44, justifyContent: 'center' }, title: { fontSize: 19, fontWeight: '700', flex: 1 }, loading: { marginTop: 60 }, content: { padding: 24, paddingBottom: 48, gap: 12 }, pet: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingBottom: 8 }, petSummary: { flex: 1, minWidth: 0 }, petName: { fontSize: 21, fontWeight: '700', marginBottom: 4 }, label: { fontSize: 15, fontWeight: '600', marginBottom: 8 }, input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 17, minHeight: 52 }, body: { fontSize: 15, lineHeight: 23 }, button: { borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 16, minHeight: 52 }, buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 }, footnote: { fontSize: 12, lineHeight: 18, marginTop: 6 }, hero: { fontSize: 28, lineHeight: 35, fontWeight: '700', marginBottom: 8 }, activationIcon: { marginVertical: 12 } });
