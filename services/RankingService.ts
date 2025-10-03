import { RankingEntry } from '../types';
import AuthService from './AuthService';

interface RankingStore {
  entries: RankingEntry[];
  updatedAt: string;
}

class RankingService {
  private store: RankingStore = { entries: [], updatedAt: new Date().toISOString() };

  addEntry(entry: Omit<RankingEntry, 'id' | 'createdAt' | 'username'>) {
    const user = AuthService.getCurrentUser();
    if (!user) throw new Error('Usuário não autenticado');
    const displayName = (user as any).displayName;
    const full: RankingEntry = {
      id: `rk_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
      createdAt: new Date().toISOString(),
      username: displayName || (user as any).email || 'anon',
      ...entry,
    };
    this.store.entries.push(full);
    this.store.updatedAt = new Date().toISOString();
  }

  list(): RankingEntry[] {
    // Ordenar: melhor nota desc, depois menor tempo total, depois média menor
    return [...this.store.entries].sort((a,b) => {
      if (b.percentage !== a.percentage) return b.percentage - a.percentage;
      if (a.totalTimeMs !== b.totalTimeMs) return a.totalTimeMs - b.totalTimeMs;
      return a.averageTimeMs - b.averageTimeMs;
    });
  }
}

export default new RankingService();