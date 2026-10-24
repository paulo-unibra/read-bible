import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ReadingPlan, ReadingPlanDay } from '../types';
import { getCompanion } from '../utils/readingCompanion';
import CompanionAvatar from './CompanionAvatar';
import tamagoshiService from '../services/TamagoshiService';
import { TAMAGOSHI_REWARDS, Tamagoshi, tamagoshiDisplayName, tamagoshiStatus } from '../utils/tamagoshi';

export default function ReadingCompanion({ userId }: {
  userId: number; plan: ReadingPlan | null; days: ReadingPlanDay[];
}) {
  const router = useRouter();
  const [petData, setPetData] = useState<Tamagoshi | null>(null);
  const [clock, setClock] = useState(new Date());
  const [tipIndex, setTipIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [bounce] = useState(() => new Animated.Value(0));
  const [tipOpacity] = useState(() => new Animated.Value(1));
  const pet = getCompanion(petData?.seed ?? userId, petData?.catalogVersion ?? 1);
  const status = petData ? tamagoshiStatus(petData, clock) : null;
  const mood = status?.mood;
  const sleeping = status?.sleeping;
  const enabled = petData !== null;

  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    let active = true;
    let transition: Animated.CompositeAnimation | undefined;
    const timer = setInterval(() => {
      if (reducedMotion) {
        setTipIndex(index => (index + 1) % 3);
        return;
      }
      transition = Animated.timing(tipOpacity, { toValue: 0, duration: 300, useNativeDriver: true });
      transition.start(({ finished }) => {
        if (!finished || !active) return;
        setTipIndex(index => (index + 1) % 3);
        transition = Animated.timing(tipOpacity, { toValue: 1, duration: 450, useNativeDriver: true });
        transition.start();
      });
    }, 7000);
    return () => {
      active = false;
      clearInterval(timer);
      transition?.stop();
      tipOpacity.setValue(1);
    };
  }, [enabled, reducedMotion, tipOpacity]));

  useFocusEffect(useCallback(() => {
    let active = true;
    const unsubscribe = tamagoshiService.subscribe(userId, pet => {
      if (!active) return;
      setPetData(pet);
      setClock(new Date());
    });
    (async () => {
      try {
        const savedPet = await tamagoshiService.get(userId);
        if (active) setPetData(savedPet);
        const synchronized = await tamagoshiService.sync(userId).catch(() => savedPet);
        if (active) setPetData(synchronized);
        if (!synchronized) return;
      } catch {
        // Keep the last server-confirmed monthly score available offline.
      }
    })();
    return () => { active = false; unsubscribe(); };
  }, [userId]));

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
  const displayName = tamagoshiDisplayName(petData.name);
  const moodLabels = { joyful: 'Radiante', happy: 'Feliz', hopeful: 'Esperançoso', sleepy: 'Precisando de cuidado', curious: 'Curioso' };
  const feeling = status.sleeping ? 'Dormindo' : moodLabels[status.mood];
  const tips = [
    status.readingConfirmed ? `Leitura concluída: +${TAMAGOSHI_REWARDS.reading} pontos hoje.` : status.readToday ? 'Leitura salva · conecte-se hoje para pontuar.' : `Leia 1 capítulo e conquiste +${TAMAGOSHI_REWARDS.reading} pontos por dia.`,
    status.quizConfirmed ? `Questionário concluído: +${TAMAGOSHI_REWARDS.quiz} pontos hoje.` : `Faça um questionário: +${TAMAGOSHI_REWARDS.quiz} pontos por dia.`,
    `Convide uma pessoa: +${TAMAGOSHI_REWARDS.invite} pontos após confirmar o cadastro.`,
    'Descanso automático: das 22h às 6h.',
  ];
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push('/tamagoshi')}
      accessibilityRole="button"
      accessibilityLabel={`${pet.species} ${displayName}, ${feeling.toLowerCase()}. ${status.points} pontos neste mês. Leitura: até ${TAMAGOSHI_REWARDS.reading} pontos por dia. Questionário: até ${TAMAGOSHI_REWARDS.quiz} pontos por dia. Ver pontos do Tamagoshi`}
    >
      <View style={styles.row}>
      <View style={styles.petStage} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Animated.View style={{ transform: [{ translateY: bounce }] }}>
          <CompanionAvatar size={64} catalogVersion={petData.catalogVersion ?? 1} seed={petData.seed} mood={status.mood} sleeping={status.sleeping} />
        </Animated.View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.mood} numberOfLines={1}>{feeling}</Text>
      </View>
      <View style={styles.health}>
        <Text style={styles.healthLabel}>Pontos</Text>
        <Text style={styles.healthValue}>{status.points}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#496271" />
      </View>
      <Animated.Text style={[styles.tip, { opacity: tipOpacity }]} numberOfLines={2}>{tips[tipIndex]}</Animated.Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginTop: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#DCE6E8' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72 },
  tip: { color: '#496271', fontSize: 12, lineHeight: 17, minHeight: 34, marginTop: 2 },
  petStage: { width: 68, alignItems: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#203947' },
  mood: { fontSize: 13, lineHeight: 19, color: '#496271' },
  health: { alignItems: 'flex-end' },
  healthLabel: { fontSize: 12, lineHeight: 18, color: '#496271' },
  healthValue: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: '#203947' },
});
