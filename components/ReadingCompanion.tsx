import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import authService, { API_URL } from '../services/AuthService';
import type { ReadingPlan, ReadingPlanDay } from '../types';
import { CompanionQuizResult, getCompanion, getCompanionState } from '../utils/readingCompanion';
import CompanionFace from './CompanionFace';

export default function ReadingCompanion({ userId, plan, days }: {
  userId: number; plan: ReadingPlan | null; days: ReadingPlanDay[];
}) {
  const [results, setResults] = useState<CompanionQuizResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(true);
  const bounce = useRef(new Animated.Value(0)).current;
  const pet = getCompanion(userId);
  const state = getCompanionState(plan, days, results);

  useFocusEffect(useCallback(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setResults(null);
    const timeout = setTimeout(() => controller.abort(), 10000);
    (async () => {
      try {
        const token = authService.getToken();
        if (!token || authService.getUser()?.id !== userId) throw new Error('Sessão indisponível');
        const response = await fetch(`${API_URL}/quiz-results/me`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        if (!response.ok) throw new Error('Questionários indisponíveis');
        const data = await response.json();
        if (!data.success || !Array.isArray(data.results)) throw new Error('Resposta inválida');
        if (active) setResults(data.results);
      } catch {
        if (active) setResults(null);
      } finally {
        clearTimeout(timeout);
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [userId]));

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (active) setReducedMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReducedMotion);
    return () => { active = false; subscription.remove(); };
  }, []);

  useFocusEffect(useCallback(() => {
    if (reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(bounce, { toValue: state.mood === 'joyful' ? -6 : -3, duration: 1100, useNativeDriver: true }),
      Animated.timing(bounce, { toValue: 0, duration: 1100, useNativeDriver: true }),
    ]));
    animation.start();
    return () => { animation.stop(); bounce.setValue(0); };
  }, [bounce, reducedMotion, state.mood]));

  return (
    <View style={styles.container}>
      <View style={styles.top}>
        <View style={styles.petStage} accessible accessibilityLabel={`${pet.species} ${pet.name}, ${state.label.toLowerCase()}`}>
          <Animated.View style={{ transform: [{ translateY: bounce }] }}>
            <Svg width={88} height={96} viewBox="0 0 24 26">
              <Ellipse cx={12} cy={24} rx={8} ry={1} fill="#DCE6E8" />
              {/* Rounded ears overlap the head so the silhouette stays connected. */}
              {pet.kind !== 'chick' && <>
                <Circle cx={6} cy={7} r={2.8} fill={pet.color} />
                <Circle cx={18} cy={7} r={2.8} fill={pet.color} />
                <Circle cx={6} cy={7} r={1.4} fill="#FFF3DC" />
                <Circle cx={18} cy={7} r={1.4} fill="#FFF3DC" />
              </>}
              <Rect x={6} y={15} width={12} height={7} rx={3} fill={pet.color} />
              <Rect x={6.5} y={20} width={3.5} height={3} rx={1.5} fill={pet.color} />
              <Rect x={14} y={20} width={3.5} height={3} rx={1.5} fill={pet.color} />
              <Rect x={3} y={13} width={4} height={6} rx={2} fill={pet.color} />
              <Rect x={17} y={13} width={4} height={6} rx={2} fill={pet.color} />
              <Rect x={7.5} y={17} width={9} height={4} rx={2} fill="#FFF3DC" />
              <Rect x={3} y={7} width={18} height={11} rx={2.5} fill={pet.color} />
              <Ellipse cx={6.5} cy={15} rx={1.5} ry={0.6} fill="#D47773" />
              <Ellipse cx={17.5} cy={15} rx={1.5} ry={0.6} fill="#D47773" />
              <CompanionFace mood={state.mood} />
              {pet.kind === 'chick' && <Path d="M11 13.8H13L12 14.8Z" fill="#C97922" />}
            </Svg>
          </Animated.View>
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>{pet.name} <Text style={styles.mood}>· {state.label}</Text></Text>
          <Text style={styles.message}>{loading ? 'Estou vendo como foi nossa jornada…' : state.message}</Text>
        </View>
      </View>
      <View style={styles.details}>
        <Text style={styles.detail}>{state.planText}</Text>
        <Text style={styles.detail}>{loading ? 'Consultando questionários…' : state.quizText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
