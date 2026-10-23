import type { CompanionMood } from './readingCompanion';

export interface TamagoshiDay { reading: boolean; quiz: boolean }
export function tamagoshiDisplayName(petName: string, userName?: string | null): string {
  const base = petName.trim().replace(/\s+/g, ' ');
  const firstName = userName?.trim().split(/\s+/)[0];
  if (!firstName) return base;
  const parts = base.split(' ');
  if (parts.length > 1 && parts[parts.length - 1].toLocaleLowerCase('pt-BR') === firstName.toLocaleLowerCase('pt-BR')) return base;
  return `${base} ${firstName}`.trim();
}
export interface MonthlyScore {
  month: string;
  points: number;
  readingDays: string[];
  readingHistory?: string[];
  quizDays: string[];
  readToday: boolean;
  quizToday: boolean;
}
export interface Tamagoshi {
  version: 1;
  catalogVersion?: 1 | 2;
  activatedAt: string;
  seed: number;
  name: string;
  sleepStart: string;
  sleepEnd: string;
  health?: number; // Legacy data, discarded rather than converted into ranked points.
  claimedInvitePoints?: number;
  settledThrough?: string;
  monthlyScore?: MonthlyScore;
  pendingReadingDay?: string;
  pendingName?: string;
  days: Record<string, TamagoshiDay>;
}
export const dayKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Recife', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};
export function nextDay(key: string, offset = 1) {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export const TAMAGOSHI_SLEEP = { start: '22:00', end: '06:00' } as const;
export function isSleeping(now = new Date()) { return now.getHours() >= 22 || now.getHours() < 6; }
export const TAMAGOSHI_REWARDS = { reading: 6, quiz: 2 } as const;
export function settleTamagoshi(pet: Tamagoshi): Tamagoshi {
  const updated = { ...pet, sleepStart: TAMAGOSHI_SLEEP.start, sleepEnd: TAMAGOSHI_SLEEP.end };
  delete updated.health;
  delete updated.claimedInvitePoints;
  delete updated.settledThrough;
  return updated;
}
export function tamagoshiStatus(pet: Tamagoshi, now = new Date()) {
  const today = dayKey(now);
  const month = today.slice(0, 7);
  const score = pet.monthlyScore?.month === month ? pet.monthlyScore : null;
  const readingDates = new Set(pet.monthlyScore?.readingHistory ?? [...Object.keys(pet.days).filter(key => pet.days[key].reading), ...(score?.readingDays ?? [])]);
  if (pet.pendingReadingDay === today) readingDates.add(today);
  const readToday = readingDates.has(today);
  const quizToday = Boolean(pet.days[today]?.quiz || score?.quizDays.includes(today));
  let streak = 0;
  let key = readToday ? today : nextDay(today, -1);
  while (readingDates.has(key)) { streak++; key = nextDay(key, -1); }
  const mood: CompanionMood = streak >= 7 ? 'joyful' : readToday ? 'happy' : streak > 0 ? 'hopeful' : dayKey(new Date(pet.activatedAt)) < nextDay(today, -1) ? 'sleepy' : 'curious';
  return { month, points: score?.points ?? 0, synced: Boolean(score), streak, sleeping: isSleeping(now), mood, readToday, quizToday,
    readingConfirmed: Boolean(score?.readingDays.includes(today)), quizConfirmed: Boolean(score?.quizDays.includes(today)) };
}
