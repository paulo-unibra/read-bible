import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import authService, { API_URL } from '../services/AuthService';
import type { ReadingPlan, ReadingPlanDay } from '../types';
import { CompanionQuizResult, getCompanion, getCompanionState } from '../utils/readingCompanion';
import CompanionAvatar from './CompanionAvatar';
import tamagoshiService from '../services/TamagoshiService';
import { Tamagoshi, tamagoshiStatus } from '../utils/tamagoshi';

export default function ReadingCompanion({ userId, plan, days }: {
  userId: number; plan: ReadingPlan | null; days: ReadingPlanDay[];
}) {
  const router = useRouter();
  const [petData, setPetData] = useState<Tamagoshi | null>(null);
  const [clock, setClock] = useState(new Date());
  const [results, setResults] = useState<CompanionQuizResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [bounce] = useState(() => new Animated.Value(0));
  const pet = getCompanion(petData?.seed ?? userId);
  const state = getCompanionState(plan, days, results);
  const status = petData ? tamagoshiStatus(petData, clock) : null;
  const mood = status?.mood;
  const sleeping = status?.sleeping;

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setResults(null);
    const timeout = setTimeout(() => controller.abort(), 10000);
    (async () => {
      try {
        const savedPet = await tamagoshiService.get(userId);
        if (active) setPetData(savedPet);
        if (!savedPet) return;
        await tamagoshiService.record(userId, 'reading', days.filter(day => day.isCompleted && day.completedDate).map(day => day.completedDate!));
        const token = authService.getToken();
        if (!token || authService.getUser()?.id !== userId) throw new Error('Sessão indisponível');
        const response = await fetch(`${API_URL}/quiz-results/me`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        if (!response.ok) throw new Error('Questionários indisponíveis');
        const data = await response.json();
        if (!data.success || !Array.isArray(data.results)) throw new Error('Resposta inválida');
        await tamagoshiService.record(userId, 'quiz', data.results.map((result: CompanionQuizResult) => result.lastCompletedAt ?? result.createdAt));
        const updated = await tamagoshiService.get(userId);
        if (active) { setResults(data.results); setPetData(updated); }
      } catch {
        if (active) setResults(null);
      } finally {
        clearTimeout(timeout);
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [userId, days]));

  useFocusEffect(useCallback(() => {
    const timer = setInterval(() => setClock(new Date()), 60000);
    setClock(new Date());
    return () => clearInterval(timer);
  }, []));

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReducedMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useFocusEffect(useCallback(() => {
    if (reducedMotion || !mood || sleeping) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(bounce, { toValue: mood === 'joyful' ? -6 : -3, duration: 1100, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 0, duration: 1100, useNativeDriver: true }),
    ]));
    animation.start();
    return () => { animation.stop(); bounce.setValue(0); };
  }, [bounce, reducedMotion, mood, sleeping]));

  if (!petData || !status) return null;
  const moodLabels = { joyful: 'Radiante', happy: 'Feliz', hopeful: 'Esperançoso', sleepy: 'Precisando de cuidado', curious: 'Curioso' };
  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.petStage} accessible accessibilityLabel={`${pet.species} ${petData.name}, ${status.sleeping ? "dormindo" : moodLabels[status.mood].toLowerCase()}`}>
          <Animated.View style={{ transform: [{ translateY: bounce }] }}>
            <CompanionAvatar seed={petData.seed} mood={status.mood} sleeping={status.sleeping} />
          </Animated.View>
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{petData.name} <Text style={styles.mood}>· {status.sleeping ? "Dormindo" : moodLabels[status.mood]}</Text></Text>
          <Text style={styles.message}>{status.sleeping ? `Estou descansando até ${petData.sleepEnd}. A leitura pode continuar no seu ritmo.` : status.readToday ? 'Você leu hoje! Voltar amanhã é o que me mantém saudável.' : 'Um capítulo hoje já cuida de mim. Vamos manter nossa constância?'}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.healthButton} onPress={() => router.push('/tamagoshi')} accessibilityRole="button" accessibilityLabel={`Ver saúde do Tamagoshi: ${status.health} de 100`}>
        <Text style={styles.healthTitle}>Saúde {status.health}/100 · Ver cuidados</Text>
        <Text style={styles.detail}>{status.streak} {status.streak === 1 ? 'dia seguido' : 'dias seguidos'} de leitura · {status.readToday ? 'Leitura de hoje concluída' : 'Leia 1 capítulo hoje'}</Text>
      </TouchableOpacity>
      <View style={styles.details}>
        <Text style={styles.detail}>{state.planText}</Text>
        <Text style={styles.detail}>{loading ? 'Consultando questionários…' : state.quizText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  healthButton: { marginTop: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#DCE6E8' },
  healthTitle: { color: '#203947', fontWeight: '700', fontSize: 15, marginBottom: 4 },
  container: { marginHorizontal: 16, marginTop: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#DCE6E8', alignSelf: 'stretch' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  petStage: { width: 88, alignItems: 'center' },
  copy: { flex: 1 },
  title: { fontSize: 19, fontWeight: '700', color: '#203947' },
  mood: { fontSize: 14, fontWeight: '500', color: '#496271' },
  message: { fontSize: 14, lineHeight: 21, color: '#344F5C', marginTop: 6 },
  details: { marginTop: 10, gap: 4 },
  detail: { color: '#496271', fontSize: 12, lineHeight: 18 },
});
