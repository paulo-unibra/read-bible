import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  const petAccent = dark ? colors.blueDark : '#076B9D';
  const buttonForeground = dark ? colors.screen : '#fff';
  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.line, backgroundColor: colors.surface }];
  return <SafeAreaView style={[styles.screen, { backgroundColor: colors.screen }]}>
    <View style={[styles.header, { borderBottomColor: colors.line }]}>
      <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Voltar" style={styles.back}><Ionicons name="arrow-back" size={24} color={colors.text} /></TouchableOpacity>
      <Text style={[styles.title, { color: colors.text }]}>Configurar Tamagoshi</Text>
    </View>
    {loading ? <ActivityIndicator style={styles.loading} color={colors.blue} /> : error ? <Text style={[styles.body, styles.content, { color: colors.danger }]}>Não foi possível carregar seu Tamagoshi. Volte e tente novamente.</Text> : <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {pet && status ? <>
        <View style={[styles.pet, { backgroundColor: colors.blueSoft }]}>
          <CompanionAvatar size={88} catalogVersion={pet.catalogVersion ?? 1} seed={pet.seed} mood={status.mood} sleeping={status.sleeping} />
          <View style={styles.petSummary}>
            <Text style={[styles.petName, { color: colors.text }]}>{tamagoshiDisplayName(pet.name)}</Text>
            <Text style={[styles.body, { color: petAccent }]}>{status.points} pontos no mês</Text>
            {status.sleeping && <View style={styles.sleepStatus}>
              <Ionicons name="moon-outline" size={14} color={petAccent} />
              <Text style={[styles.statusText, { color: petAccent }]}>Dormindo</Text>
            </View>}
          </View>
        </View>
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>Nome do Tamagoshi</Text>
          <TextInput accessibilityLabel="Nome do Tamagoshi" style={inputStyle} value={name} onChangeText={setName} maxLength={24} selectionColor={colors.blueDark} returnKeyType="done" onSubmitEditing={submit} />
          <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: saving, busy: saving }} disabled={saving} style={[styles.button, { backgroundColor: colors.blueDark, opacity: saving ? 0.6 : 1 }]} onPress={submit}>
            {saving && <ActivityIndicator size="small" color={buttonForeground} />}
            <Text style={[styles.buttonText, { color: buttonForeground }]}>{saving ? 'Salvando…' : 'Salvar'}</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.links, { borderColor: colors.line }]}>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/tamagoshi-ranking')} style={[styles.link, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }]}>
            <Ionicons name="trophy-outline" size={22} color={colors.blueDark} />
            <Text style={[styles.linkText, { color: colors.text }]}>Ver ranking do mês</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/invite-friends')} style={styles.link}>
            <Ionicons name="people-outline" size={22} color={colors.blueDark} />
            <Text style={[styles.linkText, { color: colors.text }]}>Convidar amigos</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </TouchableOpacity>
        </View>
        <Text style={[styles.footnote, { color: colors.muted }]}>Pontuação zera no dia 1º de cada mês.</Text>
      </> : null}
    </ScrollView></KeyboardAvoidingView>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 16, gap: 8 },
  back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '700', flex: 1 },
  loading: { marginTop: 60 },
  content: { padding: 20, paddingBottom: 40, width: '100%', maxWidth: 560, alignSelf: 'center' },
  pet: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 16 },
  petSummary: { flex: 1, minWidth: 0 },
  petName: { fontSize: 23, fontWeight: '700', marginBottom: 4 },
  body: { fontSize: 15, lineHeight: 23 },
  sleepStatus: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  statusText: { fontSize: 13, lineHeight: 18 },
  form: { marginTop: 28 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 10 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, minHeight: 52 },
  button: { borderRadius: 12, padding: 15, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 14, minHeight: 50 },
  buttonText: { fontWeight: '700', fontSize: 16 },
  links: { marginTop: 28, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 18, minHeight: 60 },
  linkText: { fontSize: 15, fontWeight: '500', flex: 1 },
  footnote: { fontSize: 12, lineHeight: 18, marginTop: 20, textAlign: 'center' },
});
