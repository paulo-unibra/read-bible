import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TamagoshiMenuOption({ onOpen, dark = false }: { userId: number; onOpen?: () => void; dark?: boolean }) {
  const router = useRouter();
  return <><TouchableOpacity style={styles.option} accessibilityRole="button" onPress={() => { onOpen?.(); router.push('/tamagoshi'); }}>
    <Ionicons name="paw-outline" size={23} color={dark ? '#83cfff' : '#0879b6'} />
    <View style={styles.copy}>
      <Text style={[styles.title, { color: dark ? '#f2f5f7' : '#203947' }]}>Configurar Tamagoshi</Text>
      <Text style={[styles.subtitle, { color: dark ? '#aab4bb' : '#496271' }]}>Nome e pontuação do seu companheiro</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={dark ? '#aab4bb' : '#496271'} />
  </TouchableOpacity>
  <TouchableOpacity style={styles.option} accessibilityRole="button" onPress={() => { onOpen?.(); router.push('/invite-friends'); }}>
    <Ionicons name="gift-outline" size={23} color={dark ? '#83cfff' : '#0879b6'} />
    <View style={styles.copy}>
      <Text style={[styles.title, { color: dark ? '#f2f5f7' : '#203947' }]}>Convidar amigos</Text>
      <Text style={[styles.subtitle, { color: dark ? '#aab4bb' : '#496271' }]}>Compartilhe seu código e ganhe pontos</Text>
    </View>
    <Ionicons name="chevron-forward" size={18} color={dark ? '#aab4bb' : '#496271'} />
  </TouchableOpacity></>;
}
const styles = StyleSheet.create({ option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 12, gap: 12 }, copy: { flex: 1 }, title: { fontSize: 16, fontWeight: '600' }, subtitle: { fontSize: 13, lineHeight: 19, marginTop: 3 } });
