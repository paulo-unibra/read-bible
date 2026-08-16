import * as FileSystem from "expo-file-system/legacy";
import * as SQLite from "expo-sqlite";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:1999";

const DICT_KEYS = ["nomes", "wycliffe", "champlin", "outros"] as const;

const DICT_LABELS: Record<string, string> = {
  nomes: "Dicionário de Nomes",
  wycliffe: "Dicionário Wycliffe",
  champlin: "Dicionário Champlin",
  outros: "Dicionário de Temas Bíblicos",
};

const SQLITE_DIR = `${FileSystem.documentDirectory}SQLite/`;

export interface DictionaryFileInfo {
  dictKey: string;
  label: string;
  fileName: string;
  size: number;
}

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

interface OpenSource {
  db: SQLite.SQLiteDatabase;
  tableName: string;
  wordColumn: string;
  definitionColumn: string;
}

function localFileName(dictKey: string): string {
  return `dict-${dictKey}.mybible`;
}

function localPath(dictKey: string): string {
  return `${SQLITE_DIR}${localFileName(dictKey)}`;
}

function plainText(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function makeSnippet(definition: string): string {
  const text = plainText(definition);
  return text.length > 100 ? `${text.slice(0, 100)}...` : text;
}

class DictionaryOfflineService {
  private connections = new Map<string, OpenSource>();

  async listFiles(): Promise<DictionaryFileInfo[]> {
    const response = await fetch(`${API_URL}/dictionary/files`);
    if (!response.ok) throw new Error(`Erro ao listar dicionários: ${response.status}`);
    const data = await response.json();
    return data.files || [];
  }

  async checkDownloaded(): Promise<{ all: boolean; missing: string[] }> {
    const results = await Promise.all(
      DICT_KEYS.map(async (key) => {
        const info = await FileSystem.getInfoAsync(localPath(key));
        return { key, ok: info.exists && !!info.size && info.size >= 50000 };
      })
    );
    const missing = results.filter((r) => !r.ok).map((r) => r.key);
    return { all: missing.length === 0, missing };
  }

  private async ensureSqliteDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(SQLITE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });
    }
  }

  async downloadAll(
    files: DictionaryFileInfo[],
    onProgress?: (progress: number) => void
  ): Promise<void> {
    await this.ensureSqliteDir();

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    let downloadedBytes = 0;

    for (const file of files) {
      const target = localPath(file.dictKey);

      const existing = await FileSystem.getInfoAsync(target);
      if (existing.exists && existing.size && existing.size >= 50000) {
        downloadedBytes += existing.size;
        onProgress?.((downloadedBytes / totalBytes) * 100);
        continue;
      }

      await FileSystem.deleteAsync(target, { idempotent: true });

      const resumable = FileSystem.createDownloadResumable(
        `${API_URL}/dictionary/files/download/${file.dictKey}`,
        target,
        {},
        (p) => {
          const written = p.totalBytesWritten || 0;
          onProgress?.(((downloadedBytes + written) / totalBytes) * 100);
        }
      );

      const result = await resumable.downloadAsync();
      if (!result || result.status !== 200) {
        await FileSystem.deleteAsync(target, { idempotent: true });
        throw new Error(`Falha ao baixar ${file.label}`);
      }

      const info = await FileSystem.getInfoAsync(target);
      if (!info.exists || !info.size || info.size < 50000) {
        await FileSystem.deleteAsync(target, { idempotent: true });
        throw new Error(`Arquivo inválido: ${file.label}`);
      }

      downloadedBytes += info.size;
      onProgress?.((downloadedBytes / totalBytes) * 100);
    }

    this.closeAll();
  }

  private async openDict(dictKey: string): Promise<OpenSource> {
    const cached = this.connections.get(dictKey);
    if (cached) return cached;

    const db = await SQLite.openDatabaseAsync(
      localFileName(dictKey),
      undefined,
      SQLITE_DIR
    );

    const tables = (await db.getAllAsync(
      "SELECT name FROM sqlite_master WHERE type='table'"
    )) as { name: string }[];
    const dictTable = tables.find((t) =>
      ["dictionary", "dict", "entries", "definitions"].includes(
        t.name.toLowerCase()
      )
    );
    if (!dictTable) {
      await db.closeAsync();
      throw new Error(`Tabela de dicionário não encontrada em ${dictKey}`);
    }

    const cols = (await db.getAllAsync(
      `PRAGMA table_info("${dictTable.name}")`
    )) as { name: string }[];
    const colNames = cols.map((c) => c.name.toLowerCase());
    const wordColumn = colNames.includes("word")
      ? "word"
      : colNames.includes("topic")
        ? "topic"
        : cols[0].name;
    const definitionColumn = colNames.includes("definition")
      ? "definition"
      : colNames.includes("meaning")
        ? "meaning"
        : colNames.includes("data")
          ? "data"
          : colNames.includes("content")
            ? "content"
            : cols[1]?.name || cols[0].name;

    const source: OpenSource = {
      db,
      tableName: dictTable.name,
      wordColumn,
      definitionColumn,
    };
    this.connections.set(dictKey, source);
    return source;
  }

  private excludeFilter(wordColumn: string): string {
    return `"${wordColumn}" NOT LIKE 'Prefácio%' AND "${wordColumn}" NOT LIKE 'Sobre o Livro%' AND "${wordColumn}" NOT GLOB '[0-9].*'`;
  }

  async search(query: string, page = 1, perPage = 50): Promise<SearchResult> {
    const offset = (page - 1) * perPage;
    const like = `%${query.toUpperCase()}%`;
    const groups: DictionaryGroup[] = [];
    let total = 0;

    for (const key of DICT_KEYS) {
      const source = await this.openDict(key);
      const filter = this.excludeFilter(source.wordColumn);
      const where = query
        ? `"${source.wordColumn}" LIKE ? AND ${filter}`
        : filter;
      const args: (string | number)[] = query ? [like] : [];

      const countRow = (await source.db.getFirstAsync(
        `SELECT COUNT(*) as total FROM "${source.tableName}" WHERE ${where}`,
        ...args
      )) as { total: number } | null;

      const rows = (await source.db.getAllAsync(
        `SELECT "${source.wordColumn}" as word, "${source.definitionColumn}" as definition FROM "${source.tableName}" WHERE ${where} ORDER BY "${source.wordColumn}" ASC LIMIT ? OFFSET ?`,
        ...args,
        perPage,
        offset
      )) as { word: string; definition: string }[];

      if (rows.length > 0) {
        groups.push({
          dictKey: key,
          label: DICT_LABELS[key],
          total: countRow?.total || 0,
          entries: rows.map((r) => ({
            word: r.word,
            snippet: makeSnippet(r.definition),
          })),
        });
      }
      total += countRow?.total || 0;
    }

    return { groups, total, page, perPage };
  }

  async getWord(word: string, dictKey?: string): Promise<DictionaryEntry | null> {
    const keys: string[] = dictKey ? [dictKey] : [...DICT_KEYS];
    for (const key of keys) {
      const source = await this.openDict(key);
      const row = (await source.db.getFirstAsync(
        `SELECT "${source.wordColumn}" as word, "${source.definitionColumn}" as definition FROM "${source.tableName}" WHERE "${source.wordColumn}" = ?`,
        word
      )) as { word: string; definition: string } | null;
      if (row) {
        return {
          ...row,
          dictKey: key,
          dictionary: DICT_LABELS[key] || key,
        };
      }
    }
    return null;
  }

  async deleteAll(): Promise<void> {
    this.closeAll();
    for (const key of DICT_KEYS) {
      await FileSystem.deleteAsync(localPath(key), { idempotent: true });
    }
  }

  private closeAll(): void {
    for (const source of this.connections.values()) {
      try {
        source.db.closeAsync();
      } catch {
        // ignore
      }
    }
    this.connections.clear();
  }
}

export default new DictionaryOfflineService();