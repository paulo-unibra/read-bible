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

export { DICT_KEYS, DICT_LABELS };

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
  title: string;
}

export interface DictionaryGroup {
  dictKey: string;
  label: string;
  total: number;
  entries: { word: string; snippet: string; title: string }[];
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

// O dicionário de Temas Bíblicos usa códigos numéricos como palavra (1000, 1010...),
// mas a definição começa com o título real dentro de um <b>...</b>
function extractTopicTitle(html: string): string | null {
  const match = html.match(/<b[^>]*>\s*([^<]*?)\s*<\/b>/i);
  return match && match[1].trim() ? match[1].trim() : null;
}

function friendlyTitle(dictKey: string, word: string, definition: string): string {
  if (dictKey === "outros" && /^\d/.test(word)) {
    return extractTopicTitle(definition) || word;
  }
  return word;
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
    await this.closeAll();
    const missing: string[] = [];
    for (const key of DICT_KEYS) {
      const path = localPath(key);
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        missing.push(key);
        continue;
      }
      try {
        await this.validateFile(localFileName(key));
      } catch (error) {
        console.warn(`Dicionário ${key} incompleto ou inválido:`, error);
        await this.removeSqliteFile(path);
        missing.push(key);
      }
    }
    return { all: missing.length === 0, missing };
  }

  private async validateFile(fileName: string): Promise<void> {
    const info = await FileSystem.getInfoAsync(`${SQLITE_DIR}${fileName}`);
    if (!info.exists || !info.size || info.size < 50000) {
      throw new Error("Arquivo incompleto");
    }

    const db = await SQLite.openDatabaseAsync(fileName, undefined, SQLITE_DIR);
    try {
      const integrity = await db.getFirstAsync<{ quick_check: string }>("PRAGMA quick_check(1)");
      if (integrity?.quick_check !== "ok") {
        throw new Error("Banco de dados corrompido");
      }
      const tables = await db.getAllAsync<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      const table = tables.find((item) =>
        ["dictionary", "dict", "entries", "definitions"].includes(item.name.toLowerCase())
      );
      if (!table || !/^[a-z_]+$/i.test(table.name)) {
        throw new Error("Tabela do dicionário ausente");
      }
      const entry = await db.getFirstAsync(`SELECT 1 FROM "${table.name}" LIMIT 1`);
      if (!entry) throw new Error("Dicionário vazio");
    } finally {
      await db.closeAsync();
    }
  }

  private async ensureSqliteDir(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(SQLITE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(SQLITE_DIR, { intermediates: true });
    }
  }

  private async removeSqliteFile(path: string): Promise<void> {
    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
      await FileSystem.deleteAsync(`${path}${suffix}`, { idempotent: true });
    }
  }

  async downloadAll(
    files: DictionaryFileInfo[],
    onProgress?: (progress: number) => void
  ): Promise<void> {
    await this.ensureSqliteDir();
    const { missing } = await this.checkDownloaded();
    if (DICT_KEYS.some((key) => !files.some((file) => file.dictKey === key))) {
      throw new Error("Lista de dicionários incompleta. Tente novamente.");
    }

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    let downloadedBytes = 0;

    for (const file of files) {
      const target = localPath(file.dictKey);
      if (!missing.includes(file.dictKey)) {
        const existing = await FileSystem.getInfoAsync(target);
        downloadedBytes += existing.exists ? existing.size || 0 : 0;
        onProgress?.((downloadedBytes / totalBytes) * 100);
        continue;
      }

      const tempName = `${localFileName(file.dictKey)}.download`;
      const tempPath = `${SQLITE_DIR}${tempName}`;
      await this.removeSqliteFile(tempPath);
      try {
        const resumable = FileSystem.createDownloadResumable(
          `${API_URL}/dictionary/files/download/${file.dictKey}`,
          tempPath,
          {},
          (p) => {
            const written = p.totalBytesWritten || 0;
            onProgress?.(((downloadedBytes + written) / totalBytes) * 100);
          }
        );

        const result = await resumable.downloadAsync();
        if (!result || result.status !== 200) {
          throw new Error(`Falha ao baixar ${file.label}`);
        }
        await this.validateFile(tempName);
        await FileSystem.moveAsync({ from: tempPath, to: target });
      } catch (error) {
        await this.removeSqliteFile(tempPath);
        throw error;
      }

      const info = await FileSystem.getInfoAsync(target);
      downloadedBytes += info.exists ? info.size || 0 : 0;
      onProgress?.((downloadedBytes / totalBytes) * 100);
    }

    await this.closeAll();
  }

  private async openDict(dictKey: string): Promise<OpenSource> {
    const cached = this.connections.get(dictKey);
    if (cached) return cached;

    const db = await SQLite.openDatabaseAsync(
      localFileName(dictKey),
      undefined,
      SQLITE_DIR
    );

    try {
      const tables = (await db.getAllAsync(
        "SELECT name FROM sqlite_master WHERE type='table'"
      )) as { name: string }[];
      const dictTable = tables.find((t) =>
        ["dictionary", "dict", "entries", "definitions"].includes(
          t.name.toLowerCase()
        )
      );
      if (!dictTable) {
        throw new Error(`Tabela de dicionário não encontrada em ${dictKey}`);
      }

      const cols = (await db.getAllAsync(
        `PRAGMA table_info("${dictTable.name}")`
      )) as { name: string }[];
      if (!cols.length) throw new Error(`Colunas do dicionário ausentes em ${dictKey}`);
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
    } catch (error) {
      await db.closeAsync();
      throw error;
    }
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
            title: friendlyTitle(key, r.word, r.definition),
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
          title: friendlyTitle(key, row.word, row.definition),
        };
      }
    }
    return null;
  }

  async deleteAll(): Promise<void> {
    await this.closeAll();
    for (const key of DICT_KEYS) {
      await this.removeSqliteFile(localPath(key));
    }
  }

  private async closeAll(): Promise<void> {
    const connections = [...this.connections.values()];
    this.connections.clear();
    await Promise.all(connections.map((source) => source.db.closeAsync()));
  }
}

export default new DictionaryOfflineService();
