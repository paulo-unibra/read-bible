import AsyncStorage from '@react-native-async-storage/async-storage';
const key = 'audio-guides:enabled';
let enabled = false;
let revision = 0;
const listeners = new Set<() => void>();
export const audioGuideSettings = {
  isEnabled: () => enabled,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  async load(): Promise<boolean> {
    const version = revision;
    try { const saved = await AsyncStorage.getItem(key); if (version === revision) enabled = saved === 'true'; } catch { /* Defaults to silent. */ }
    return enabled;
  },
  async setEnabled(value: boolean): Promise<void> {
    await AsyncStorage.setItem(key, String(value));
    revision++;
    enabled = value;
    listeners.forEach(listener => listener());
  },
};
