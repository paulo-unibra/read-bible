import { Bible, DriveFile } from "../types";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:1999";

interface DictionaryEntry {
  word: string;
  definition: string;
}

interface SearchResult {
  entries: DictionaryEntry[];
  total: number;
  page: number;
  perPage: number;
}

class DictionaryService {
  async search(query: string, page = 1, perPage = 50): Promise<SearchResult> {
    const params = new URLSearchParams({ q: query, page: String(page), perPage: String(perPage) });
    const response = await fetch(`${API_URL}/dictionary/search?${params}`);
    if (!response.ok) throw new Error(`Erro na busca: ${response.status}`);
    const data = await response.json();
    return { entries: data.entries || [], total: data.total || 0, page: data.page || 1, perPage: data.perPage || 50 };
  }

  async getWord(word: string): Promise<DictionaryEntry | null> {
    const response = await fetch(`${API_URL}/dictionary/word?w=${encodeURIComponent(word)}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.data || null;
  }

  async getAlphabetList(page = 1, perPage = 50): Promise<SearchResult> {
    return this.search("", page, perPage);
  }
}

export default new DictionaryService();