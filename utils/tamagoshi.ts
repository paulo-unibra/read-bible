import type { CompanionMood } from './readingCompanion';

export interface TamagoshiDay { reading: boolean; quiz: boolean }
export interface Tamagoshi {
  version: 1;
  catalogVersion?: 1 | 2;
  activatedAt: string;
  seed: number;
  name: string;
  sleepStart: string;
  sleepEnd: string;
  settledThrough: string;
  health: number;
  days: Record<string, TamagoshiDay>;
}
export const dayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function nextDay(key: string, offset = 1) {
  const date = new Date(`${key}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return dayKey(date);
}
export function clockMinutes(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Use horários no formato HH:mm, como 22:00.');
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
export function sleepMinutes(start: string, end: string) {
  return (clockMinutes(end) - clockMinutes(start) + 1440) % 1440;
}
export function isSleeping(pet: Tamagoshi, now = new Date()) {
  const start = clockMinutes(pet.sleepStart);
  const duration = sleepMinutes(pet.sleepStart, pet.sleepEnd);
  const elapsed = (now.getHours() * 60 + now.getMinutes() - start + 1440) % 1440;
  return elapsed < duration;
}
const clamp = (value: number) => Math.min(100, Math.max(0, value));
function dailyChange(pet: Tamagoshi, key: string, closed: boolean) {
  const activity = pet.days[key];
  // The activation day is partial; missed reading is only charged on full days.
  return (activity?.reading ? 6 : closed && key !== dayKey(new Date(pet.activatedAt)) ? -5 : 0)
    + (activity?.quiz ? 2 : 0)
    + (closed && sleepMinutes(pet.sleepStart, pet.sleepEnd) < 420 ? -8 : 0);
}
export function settleTamagoshi(pet: Tamagoshi, now = new Date()): Tamagoshi {
  const today = dayKey(now);
  let key = nextDay(pet.settledThrough);
  let health = pet.health;
  while (key < today) {
    health = clamp(health + dailyChange(pet, key, true));
    key = nextDay(key);
  }
  return { ...pet, health, settledThrough: today > pet.settledThrough ? nextDay(today, -1) : pet.settledThrough };
}
export function tamagoshiStatus(pet: Tamagoshi, now = new Date()) {
  const settled = settleTamagoshi(pet, now);
  const today = dayKey(now);
  const health = clamp(settled.health + dailyChange(settled, today, false));
  let streak = 0;
  let key = pet.days[today]?.reading ? today : nextDay(today, -1);
  while (pet.days[key]?.reading) { streak++; key = nextDay(key, -1); }
  const sleeping = isSleeping(pet, now);
  const mood: CompanionMood = health >= 85 ? 'joyful' : health >= 60 ? 'happy' : health >= 35 ? 'hopeful' : 'sleepy';
  return { health, streak, sleeping, mood, readToday: Boolean(pet.days[today]?.reading), quizToday: Boolean(pet.days[today]?.quiz) };
}
