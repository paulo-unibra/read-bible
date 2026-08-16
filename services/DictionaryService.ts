import { Bible, DriveFile } from "../types";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:1999";

export interface DictionaryEntry {
  word: string;
  definition: string;
  dictKey: string;
  dictionary: string;
}

export interface DictionaryGroup {
  dictKey: string;
  label: string;
  total: number;
  entries: { word: string; snippet: string }[];
}

export interface SearchResult {
  groups: DictionaryGroup[];
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
    return {
      groups: data.groups || [],
      total: data.total || 0,
      page: data.page || 1,
      perPage: data.perPage || 50,
    };
  }

  async getWord(word: string, dictKey?: string): Promise<DictionaryEntry | null> {
    let url = `${API_URL}/dictionary/word?w=${encodeURIComponent(word)}`;
    if (dictKey) url += `&dict=${encodeURIComponent(dictKey)}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.data || null;
  }
}

export default new DictionaryService();