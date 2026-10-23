import AsyncStorage from '@react-native-async-storage/async-storage';
import authService, { API_URL } from './AuthService';
import { getCompanion } from '../utils/readingCompanion';
import { dayKey, settleTamagoshi, TAMAGOSHI_SLEEP, Tamagoshi, MonthlyScore } from '../utils/tamagoshi';

export interface MonthlyRanking {
  month: string;
  entries: { position: number; userId: number; name: string; seed: number; catalogVersion: 1 | 2; points: number }[];
  hasMore: boolean;
  page: number;
  own: { points: number; position: number | null };
  resetsAt: string;
}
interface RemotePet {
  profile: { name: string; seed: number; catalogVersion: 1 | 2; activatedAt: string } | null;
  score: MonthlyScore;
}

class TamagoshiService {
  private queue: Promise<unknown> = Promise.resolve();
  private key(userId: number) { return `@readbible/tamagoshi/v1/${userId}`; }
  private run<T>(work: () => Promise<T>): Promise<T> {
    const task = this.queue.then(work); this.queue = task.catch(() => {}); return task;
  }
  private async read(userId: number): Promise<Tamagoshi | null> {
    const value = await AsyncStorage.getItem(this.key(userId));
    if (!value) return null;
    const pet = JSON.parse(value) as Tamagoshi;
    if (pet.version !== 1 || !pet.activatedAt || !pet.days || !pet.name || !Number.isSafeInteger(pet.seed)) throw new Error('Não foi possível carregar seu Tamagoshi.');
    return settleTamagoshi(pet);
  }
  private async save(userId: number, pet: Tamagoshi) { await AsyncStorage.setItem(this.key(userId), JSON.stringify(pet)); return pet; }
  get(userId: number) { return this.run(async () => { const pet = await this.read(userId); return pet ? this.save(userId, pet) : null; }); }
  activate(userId: number) {
    return this.run(async () => {
      const existing = await this.read(userId); if (existing) return existing;
      const seed = Math.floor(Math.random() * 2147483647);
      return this.save(userId, { version: 1, catalogVersion: 2, seed, name: getCompanion(seed).name,
        activatedAt: new Date().toISOString(), sleepStart: TAMAGOSHI_SLEEP.start, sleepEnd: TAMAGOSHI_SLEEP.end, days: {} });
    });
  }
  async configure(userId: number, settings: Pick<Tamagoshi, 'name'>) {
    const pet = await this.run(async () => {
      const name = settings.name.trim();
      if (!name || name.length > 24) throw new Error('O nome deve ter entre 1 e 24 caracteres.');
      const current = await this.read(userId); if (!current) throw new Error('Ative seu Tamagoshi primeiro.');
      return this.save(userId, { ...current, name, pendingName: name });
    });
    return await this.sync(userId).catch(() => pet) ?? pet;
  }
  private async request<T = RemotePet>(userId: number, path = '', method = 'GET', body?: object) {
    const token = authService.getToken();
    if (!token || authService.getUser()?.id !== userId) throw new Error('Entre na sua conta para sincronizar os pontos.');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(`${API_URL}/tamagoshi${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'Não foi possível sincronizar os pontos.');
      if (authService.getToken() !== token || authService.getUser()?.id !== userId) throw new Error('A sessão mudou.');
      return result.data as T;
    } finally { clearTimeout(timer); }
  }
  async ranking(page = 1) {
    const userId = authService.getUser()?.id;
    if (userId == null) throw new Error('Entre na sua conta para ver o ranking.');
    return this.request<MonthlyRanking>(userId, `/ranking?page=${page}`);
  }
  async sync(userId: number): Promise<Tamagoshi | null> {
    const local = await this.get(userId);
    let data = await this.request(userId);
    if (!data.profile && local) data = await this.request(userId, '/activate', 'POST', { name: local.name, seed: local.seed, catalogVersion: local.catalogVersion ?? 1 });
    if (!data.profile) return null;
    if (local?.pendingName) data = await this.request(userId, '', 'PUT', { name: local.pendingName });
    if (local?.pendingReadingDay === dayKey()) data = await this.request(userId, '/reading', 'POST', { day: local.pendingReadingDay });
    if (!Number.isSafeInteger(data.score?.points) || data.score.points < 0 || !/^\d{4}-\d{2}$/.test(data.score.month)) throw new Error('Pontuação inválida.');
    const profile = data.profile!;
    return this.run(async () => {
      const current = await this.read(userId);
      const pet: Tamagoshi = { version: 1, days: {}, ...current, seed: profile.seed, catalogVersion: profile.catalogVersion,
        name: current?.pendingName && current.pendingName !== local?.pendingName ? current.name : profile.name,
        activatedAt: profile.activatedAt, sleepStart: TAMAGOSHI_SLEEP.start, sleepEnd: TAMAGOSHI_SLEEP.end, monthlyScore: data.score };
      for (const date of data.score.readingDays) pet.days[date] = { ...(pet.days[date] ?? { reading: false, quiz: false }), reading: true };
      for (const date of data.score.quizDays) pet.days[date] = { ...(pet.days[date] ?? { reading: false, quiz: false }), quiz: true };
      if (pet.pendingName === local?.pendingName) delete pet.pendingName;
      if (pet.pendingReadingDay && (data.score.readingDays.includes(pet.pendingReadingDay) || pet.pendingReadingDay < dayKey())) delete pet.pendingReadingDay;
      return this.save(userId, pet);
    });
  }
  async record(userId: number, kind: 'reading' | 'quiz', dates: string[] = [new Date().toISOString()]) {
    const active = await this.run(async () => {
      const pet = await this.read(userId); if (!pet) return false;
      const today = dayKey();
      const valid = dates.some(value => { const date = new Date(value); return Number.isFinite(date.getTime()) && date.getTime() >= Date.parse(pet.activatedAt) && date.getTime() <= Date.now() && dayKey(date) === today; });
      if (!valid) return false;
      pet.days[today] = { ...(pet.days[today] ?? { reading: false, quiz: false }), [kind]: true };
      if (kind === 'reading') pet.pendingReadingDay = today;
      await this.save(userId, pet); return true;
    });
    if (!active) return { synced: false };
    const saved = await this.sync(userId).catch(() => null);
    return { synced: Boolean(saved?.monthlyScore && (kind === 'reading' ? saved.monthlyScore.readingDays : saved.monthlyScore.quizDays).includes(dayKey())) };
  }
}
export default new TamagoshiService();
