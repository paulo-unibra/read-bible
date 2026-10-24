import AsyncStorage from '@react-native-async-storage/async-storage';
import { playReadingVoice } from './ReadingVoice';
const interval = 3 * 60 * 60 * 1000;
const busy = new Set<number>();
const lastPlayed = new Map<number, number>();
export async function playInviteVoice(userId: number, isActive: () => boolean): Promise<void> {
  if (busy.has(userId)) return;
  busy.add(userId);
  try {
    const key = `invite-voice:last-played:${userId}`;
    const stored = Number(await AsyncStorage.getItem(key));
    const last = Math.max(Number.isFinite(stored) ? stored : 0, lastPlayed.get(userId) ?? 0);
    const now = Date.now();
    if ((last > 0 && now - last < interval) || !isActive()) return;
    if (!playReadingVoice('invite')) return;
    lastPlayed.set(userId, now);
    await AsyncStorage.setItem(key, String(now));
  } catch { /* Optional speech must never prevent opening the invitation screen. */ }
  finally { busy.delete(userId); }
}
