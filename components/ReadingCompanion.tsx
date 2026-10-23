import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import authService, { API_URL } from '../services/AuthService';
import type { ReadingPlan, ReadingPlanDay } from '../types';
import { CompanionQuizResult, getCompanion } from '../utils/readingCompanion';
import CompanionAvatar from './CompanionAvatar';
import tamagoshiService from '../services/TamagoshiService';
import { Tamagoshi, tamagoshiStatus } from '../utils/tamagoshi';

export default function ReadingCompanion({ userId, days }: {
  userId: number; plan: ReadingPlan | null; days: ReadingPlanDay[];
}) {
  const router = useRouter();
  const [petData, setPetData] = useState<Tamagoshi | null>(null);
  const [clock, setClock] = useState(new Date());
  const [reducedMotion, setReducedMotion] = useState(true);
  const [bounce] = useState(() => new Animated.Value(0));
  const pet = getCompanion(petData?.seed ?? userId, petData?.catalogVersion ?? 1);
  const status = petData ? tamagoshiStatus(petData, clock) : null;
  const mood = status?.mood;
  const sleeping = status?.sleeping;

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    let active = true;
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
        if (active) setPetData(updated);
      } catch {
        // Keep the locally stored health available when the network is offline.
      } finally {
        clearTimeout(timeout);
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
  const feeling = status.sleeping ? 'Dormindo' : moodLabels[status.mood];
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push('/tamagoshi')}
      accessibilityRole="button"
      accessibilityLabel={`${pet.species} ${petData.name}, ${feeling.toLowerCase()}. Saúde ${status.health} de 100. Ver cuidados do Tamagoshi`}
    >
      <View style={styles.petStage} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Animated.View style={{ transform: [{ translateY: bounce }] }}>
          <CompanionAvatar size={64} catalogVersion={petData.catalogVersion ?? 1} seed={petData.seed} mood={status.mood} sleeping={status.sleeping} />
        </Animated.View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>{petData.name}</Text>
        <Text style={styles.mood} numberOfLines={1}>{feeling}</Text>
      </View>
      <View style={styles.health}>
        <Text style={styles.healthLabel}>Saúde</Text>
        <Text style={styles.healthValue}>{status.health}/100</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#496271" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 8, paddingVertical: 8, minHeight: 72, borderBottomWidth: 1, borderBottomColor: '#DCE6E8' },
  petStage: { width: 68, alignItems: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#203947' },
  mood: { fontSize: 13, lineHeight: 19, color: '#496271' },
  health: { alignItems: 'flex-end' },
  healthLabel: { fontSize: 12, lineHeight: 18, color: '#496271' },
  healthValue: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#203947' },
});
