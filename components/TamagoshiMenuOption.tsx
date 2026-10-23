import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import tamagoshiService from '../services/TamagoshiService';

export default function TamagoshiMenuOption({ userId, onOpen, dark = false }: { userId: number; onOpen?: () => void; dark?: boolean }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useFocusEffect(useCallback(() => {
    let active = true;
    tamagoshiService.get(userId).then(pet => { if (active) setEnabled(Boolean(pet)); }).catch(() => { if (active) setEnabled(null); });
    return () => { active = false; };
  }, [userId]));
  return <><TouchableOpacity style={styles.option} accessibilityRole="button" onPress={() => { onOpen?.(); router.push('/tamagoshi'); }}>
    <Ionicons name="paw-outline" size={23} color={dark ? '#83cfff' : '#0879b6'} />
    <View style={styles.copy}>
      <Text style={[styles.title, { color: dark ? '#f2f5f7' : '#203947' }]}>{enabled === null ? 'Tamagoshi' : enabled ? 'Configurar Tamagoshi' : 'Ativar Tamagoshi'}</Text>
      <Text style={[styles.subtitle, { color: dark ? '#aab4bb' : '#496271' }]}>{enabled ? 'Saúde, nome e horário de sono' : 'Um companheiro para sua constância de leitura'}</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={dark ? '#aab4bb' : '#496271'} />
  </TouchableOpacity>
  <TouchableOpacity style={styles.option} accessibilityRole="button" onPress={() => { onOpen?.(); router.push('/invite-friends'); }}>
    <Ionicons name="gift-outline" size={23} color={dark ? '#83cfff' : '#0879b6'} />
    <View style={styles.copy}>
      <Text style={[styles.title, { color: dark ? '#f2f5f7' : '#203947' }]}>Convidar amigos</Text>
      <Text style={[styles.subtitle, { color: dark ? '#aab4bb' : '#496271' }]}>Compartilhe seu código e ganhe saúde</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={dark ? '#aab4bb' : '#496271'} />
  </TouchableOpacity></>;
}
const styles = StyleSheet.create({ option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 12, gap: 12 }, copy: { flex: 1 }, title: { fontSize: 16, fontWeight: '600' }, subtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 } });
