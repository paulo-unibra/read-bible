import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCompanion } from '../utils/readingCompanion';
import { dayKey, nextDay, settleTamagoshi, sleepMinutes, Tamagoshi } from '../utils/tamagoshi';

// Account-scoped local persistence; activity never leaks to another login.
class TamagoshiService {
  private queue: Promise<unknown> = Promise.resolve();
  private key(userId: number) { return `@readbible/tamagoshi/v1/${userId}`; }
  private run<T>(work: () => Promise<T>): Promise<T> {
    const task = this.queue.then(work);
    this.queue = task.catch(() => {});
    return task;
  }
  private async read(userId: number): Promise<Tamagoshi | null> {
    const value = await AsyncStorage.getItem(this.key(userId));
    if (!value) return null;
    const pet = JSON.parse(value) as Tamagoshi;
    if (pet.version !== 1 || !pet.activatedAt || !pet.days || !Number.isFinite(pet.health)) throw new Error('Não foi possível carregar seu Tamagoshi.');
    return settleTamagoshi(pet);
  }
  get(userId: number) {
    return this.run(async () => {
      const pet = await this.read(userId);
      if (pet) await AsyncStorage.setItem(this.key(userId), JSON.stringify(pet));
      return pet;
    });
  }
  activate(userId: number) {
    return this.run(async () => {
      const existing = await this.read(userId);
      if (existing) return existing;
      const seed = Math.floor(Math.random() * 2147483647);
      const pet: Tamagoshi = { version: 1, catalogVersion: 2, seed, name: getCompanion(seed).name,
        activatedAt: new Date().toISOString(), sleepStart: '22:00', sleepEnd: '06:00',
        settledThrough: nextDay(dayKey(), -1), health: 60, days: {} };
      await AsyncStorage.setItem(this.key(userId), JSON.stringify(pet));
      return pet;
    });
  }
  configure(userId: number, settings: Pick<Tamagoshi, 'name' | 'sleepStart' | 'sleepEnd'>) {
    return this.run(async () => {
      const duration = sleepMinutes(settings.sleepStart, settings.sleepEnd);
      if (!duration || duration > 960) throw new Error('Escolha um período de sono entre 1 minuto e 16 horas.');
      const name = settings.name.trim();
      if (!name || name.length > 24) throw new Error('O nome deve ter entre 1 e 24 caracteres.');
      const pet = await this.read(userId);
      if (!pet) throw new Error('Ative seu Tamagoshi primeiro.');
      const updated = { ...pet, ...settings, name };
      await AsyncStorage.setItem(this.key(userId), JSON.stringify(updated));
      return updated;
    });
  }
  applyInviteRewards(userId: number, totalPoints: number) {
    return this.run(async () => {
      if (!Number.isSafeInteger(totalPoints) || totalPoints < 0) throw new Error('Pontos de convite inválidos.');
      const pet = await this.read(userId);
      if (!pet) return;
      const previous = pet.claimedInvitePoints ?? 0;
      if (totalPoints <= previous) return;
      // Consume the full award even at the health cap; repeat fetches grant nothing.
      pet.health = Math.min(100, pet.health + totalPoints - previous);
      pet.claimedInvitePoints = totalPoints;
      await AsyncStorage.setItem(this.key(userId), JSON.stringify(pet));
    });
  }
  record(userId: number, kind: 'reading' | 'quiz', dates: string[] = [new Date().toISOString()]) {
    return this.run(async () => {
      const pet = await this.read(userId);
      if (!pet) return;
      // Live completions only. Past history never creates retroactive health.
      const today = dayKey();
      const valid = dates.some((value) => {
        const date = new Date(value);
        return Number.isFinite(date.getTime()) && date.getTime() >= Date.parse(pet.activatedAt)
          && date.getTime() <= Date.now() && dayKey(date) === today;
      });
      if (valid) pet.days[today] = { ...(pet.days[today] ?? { reading: false, quiz: false }), [kind]: true };
      await AsyncStorage.setItem(this.key(userId), JSON.stringify(pet));
    });
  }
}
export default new TamagoshiService();
