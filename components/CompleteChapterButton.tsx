import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Text, TouchableOpacity } from 'react-native';
import authService from '../services/AuthService';
import tamagoshiService from '../services/TamagoshiService';
import { dayKey } from '../utils/tamagoshi';

export default function CompleteChapterButton({ chapterKey, dark = false }: { chapterKey: string; dark?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    if (!chapterKey) { setEnabled(false); return; }
    const userId = authService.getUser()?.id;
    if (!userId) { setEnabled(false); return; }
    const refresh = () => tamagoshiService.get(userId).then(pet => {
      if (active) { setEnabled(Boolean(pet)); setDone(Boolean(pet?.days[dayKey()]?.reading)); }
    }).catch(() => { if (active) setEnabled(false); });
    refresh();
    const timer = setInterval(refresh, 60000);
    return () => { active = false; clearInterval(timer); };
  }, [chapterKey]));
  if (!enabled) return null;
  return <TouchableOpacity accessibilityRole="button" disabled={saving || done} style={{ padding: 16, margin: 16, borderRadius: 14, backgroundColor: dark ? '#17394a' : '#eaf7fe', minHeight: 48 }} onPress={async () => {
    const userId = authService.getUser()?.id;
    if (!userId) return;
    setSaving(true);
    try {
      const result = await tamagoshiService.record(userId, 'reading'); setDone(true);
      if (!result.synced) Alert.alert('Leitura salva', 'Conecte-se à internet ainda hoje para sincronizar os pontos do ranking.');
    }
    catch { Alert.alert('Não foi possível registrar', 'Tente novamente para guardar a leitura de hoje.'); }
    finally { setSaving(false); }
  }}>
    <Text style={{ color: dark ? '#83cfff' : '#0879b6', textAlign: 'center', fontWeight: '600', fontSize: 15 }}>{done ? 'Leitura de hoje registrada' : saving ? 'Registrando…' : 'Concluí este capítulo'}</Text>
  </TouchableOpacity>;
}
