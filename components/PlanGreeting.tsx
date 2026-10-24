import { hasRecentReadingVoice, onReadingVoice } from '../services/ReadingVoice';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAudioPlayer } from 'expo-audio';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';
import type { ReadingPlan, ReadingPlanDay } from '../types';
import { greetingDayKey, planGreeting } from '../utils/planGreeting';

const clips: Record<string, number> = {
  late_1: require('../assets/falas_leituras/1_dias_atraso.mp3'),
  late_2: require('../assets/falas_leituras/2_dias_atraso.mp3'),
  late_3: require('../assets/falas_leituras/3_dias_atraso.mp3'),
  late_4: require('../assets/falas_leituras/4_dias_atraso.mp3'),
  late_5: require('../assets/falas_leituras/5_dias_atraso.mp3'),
  resume: require('../assets/falas_leituras/que_bom_ter_voce_aqui.mp3'),
  today: require('../assets/falas_leituras/vamos_reservar_um_momento.mp3'),
  completed: require('../assets/falas_leituras/voce_ja_fez_sua_leitura_de_hoje.mp3'),
};
const claimed = new Set<string>();
export default function PlanGreeting({ userId, plan, days }: { userId: number; plan: ReadingPlan; days: ReadingPlanDay[] }) {
  const player = useAudioPlayer(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    const key = greetingDayKey(userId);
    const stopGreeting = onReadingVoice(() => player.pause());
    (async () => {
      if (claimed.has(key) || AppState.currentState !== 'active') return;
      claimed.add(key);
      try {
        const seen = await AsyncStorage.getItem(key);
        if (!active || seen) { if (!seen) claimed.delete(key); return; }
        // Persist before playback so refreshes cannot repeat the greeting.
        await AsyncStorage.setItem(key, '1');
        if (!active || hasRecentReadingVoice()) return;
        player.replace(clips[planGreeting(plan, days)]);
        player.play();
      } catch { claimed.delete(key); }
    })();
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') player.pause(); });
    return () => { active = false; stopGreeting(); subscription.remove(); player.pause(); };
  }, [userId, plan, days, player]));
  return null;
}
