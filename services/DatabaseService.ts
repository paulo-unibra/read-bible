import * as SQLite from "expo-sqlite";
import { Bible } from "../types";

// Nome central do banco e singleton global para sobreviver a Fast Refresh
const DB_NAME = "readbible.db";

declare global {
  var __READBIBLE_DB_HANDLE: SQLite.SQLiteDatabase | undefined;
}

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private lock: Promise<void> = Promise.resolve();
  private biblesCache: { data: Bible[]; updatedAt: number } | null = null;
  // Saúde / circuito
  private lastHealthCheck = 0;
  private lastHealthOk = 0;
  private healthFailures = 0;
  private reinitializing = false;
  private circuitOpenUntil = 0;

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    // Cria um novo promise e encadeia no lock anterior para serializar
    const start = this.lock;
    let release: () => void = () => {};
    this.lock = new Promise<void>((res) => (release = res));
    await start; // espera operações anteriores
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private async ensureHealthy() {
    if (!this.db) return;
    const now = Date.now();
    // Não checar mais que 1 vez por segundo
    if (now - this.lastHealthCheck < 1000) return;
    this.lastHealthCheck = now;
    // Circuit breaker aberto? só retorna; tentaremos depois
    if (now < this.circuitOpenUntil) return;
    try {
      await this.db.getFirstAsync("SELECT 1");
      this.healthFailures = 0;
      this.lastHealthOk = now;
    } catch (err: any) {
      if (this.isNativePrepareNPE(err)) {
        this.healthFailures += 1;
        const failureCount = this.healthFailures;
        // Log controlado para não inundar
        if (failureCount === 1 || failureCount % 5 === 0) {
          console.warn(
            `[DB] Health check falhou (prepareAsync/NPE) falhas=${failureCount}`
          );
        }
        if (!this.reinitializing) {
          // Backoff: pequena espera crescente
          const delay = Math.min(500 * failureCount, 2500);
          this.reinitializing = true;
          setTimeout(async () => {
            try {
              await this.reinitializeDatabase("health check failed");
            } finally {
              this.reinitializing = false;
            }
          }, delay);
        }
        // Se falhou muitas vezes rápido, abrir circuito por 3s
        if (failureCount >= 6) {
          this.circuitOpenUntil = Date.now() + 3000;
        }
      } else {
        console.error("[DB] Erro inesperado em health check", err);
      }
    }
  }

  private isNativePrepareNPE(err: any): boolean {
    if (!err) return false;
    const msg = String(err.message || err);
    return msg.includes("prepareAsync") || msg.includes("NullPointerException");
  }

  /**
   * Garantir inicialização única e reutilizável.
   */
  private async ensureInitialized() {
    if (this.db) {
      await this.ensureHealthy();
      return;
    }
    if (global.__READBIBLE_DB_HANDLE) {
      this.db = global.__READBIBLE_DB_HANDLE;
      await this.ensureHealthy();
      return;
    }
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.init();
    try {
      await this.initPromise;
    } finally {
      if (!this.db) this.initPromise = null;
    }
  }

  async init() {
    try {
      console.log("INICIANDO BANCO DE DADOS");
      this.db = await SQLite.openDatabaseAsync(DB_NAME, {
        useNewConnection: true,
      });
      global.__READBIBLE_DB_HANDLE = this.db;
      await this.createTables();
    } catch (error) {
      console.error("Database initialization error:", error);
      throw error;
    }
  }

  private async reinitializeDatabase(reason?: string) {
    console.log("[DB] Reinitializing database", reason ? `(${reason})` : "");
    try {
      if (this.db) {
        try {
          await this.db.closeAsync?.();
        } catch {}
      }
    } catch {}
    this.db = null;
    this.initPromise = null;
    this.lastHealthCheck = 0;
    await this.ensureInitialized();
  }

  private async createTables() {
    if (!this.db) throw new Error("Database not initialized");

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS bibles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        abbreviation TEXT NOT NULL,
        fileName TEXT NOT NULL,
        isDownloaded INTEGER DEFAULT 0,
        downloadDate TEXT,
        size INTEGER
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bibleId TEXT NOT NULL,
        bookId INTEGER NOT NULL,
        chapterNumber INTEGER NOT NULL,
        verseNumber INTEGER NOT NULL,
        createdDate TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(bibleId, bookId, chapterNumber, verseNumber)
      );

      CREATE TABLE IF NOT EXISTS reading_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        createdDate TEXT DEFAULT CURRENT_TIMESTAMP,
        totalDays INTEGER NOT NULL,
        completedDays INTEGER DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS reading_plan_days (
        id TEXT PRIMARY KEY,
        planId TEXT NOT NULL,
        dayNumber INTEGER NOT NULL,
        date TEXT NOT NULL,
        readings TEXT NOT NULL,
        isCompleted INTEGER DEFAULT 0,
        completedDate TEXT,
        FOREIGN KEY (planId) REFERENCES reading_plans (id)
      );

      CREATE TABLE IF NOT EXISTS reading_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bibleId TEXT NOT NULL,
        bookId INTEGER NOT NULL,
        chapterNumber INTEGER NOT NULL,
        lastReadDate TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(bibleId, bookId, chapterNumber)
      );
    `);
  }

  // Bible management
  async saveBible(bible: Bible): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");
    await this.withLock(async () => {
      await this.db!.runAsync(
        "INSERT OR REPLACE INTO bibles (id, name, abbreviation, fileName, isDownloaded, downloadDate, size) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          bible.id,
          bible.name,
          bible.abbreviation,
          bible.fileName,
          bible.isDownloaded ? 1 : 0,
          bible.downloadDate || null,
          bible.size || null,
        ]
      );
      this.biblesCache = null; // invalidar cache
    });
  }

  async getBibles(): Promise<Bible[]> {
    await this.ensureInitialized();
    console.log("DB SERVICE - getBibles", this.db);
    if (!this.db) throw new Error("Database not initialized");
    // Cache: se já carregou e não houve mudança estrutural, reutiliza
    if (this.biblesCache) {
      return this.biblesCache.data;
    }

    const execute = async () => {
      let attempt = 0;
      while (attempt < 2) {
        try {
          const rows = await this.db!.getAllAsync(
            "SELECT * FROM bibles ORDER BY name"
          );
          const mapped = rows.map((row: any) => {
            // Limpar extensões indesejadas no nome exibido (.bbl, .bbl.db, .db)
            let displayName = String(row.name || "");
            displayName = displayName.replace(/\.bbl(?:\.db)?$/i, "");
            displayName = displayName.replace(/\.db$/i, "");
            return {
              id: row.id as string,
              name: displayName,
              abbreviation: row.abbreviation as string,
              fileName: row.fileName as string,
              isDownloaded: Boolean(row.isDownloaded),
              downloadDate: row.downloadDate as string | undefined,
              size: row.size as number | undefined,
            };
          });
          this.biblesCache = { data: mapped, updatedAt: Date.now() };
          console.log("BÍBLIAS NO BANCO", mapped.length);
          console.log("----------------------");
          return mapped;
        } catch (err: any) {
          const message = String(err?.message || err);
          console.error("Erro getBibles tentativa", attempt + 1, message);
          if (this.isNativePrepareNPE(err)) {
            await this.reinitializeDatabase("prepareAsync NPE getBibles");
            attempt++;
            continue;
          }
          throw err;
        }
      }
      throw new Error("Falha ao executar getBibles após retries");
    };

    // Serializa a execução para evitar corrida múltipla de reinitialize
    return this.withLock(execute);
  }

  async deleteBible(bibleId: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");
    await this.withLock(async () => {
      await this.db!.runAsync("DELETE FROM bibles WHERE id = ?", [bibleId]);
      await this.db!.runAsync("DELETE FROM favorites WHERE bibleId = ?", [
        bibleId,
      ]);
      this.biblesCache = null;
    });
  }

  async markBibleAsDownloaded(bibleId: string, size?: number): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");
    await this.withLock(async () => {
      await this.db!.runAsync(
        "UPDATE bibles SET isDownloaded = 1, downloadDate = ?, size = ? WHERE id = ?",
        [new Date().toISOString(), size || null, bibleId]
      );
      this.biblesCache = null;
    });
  }

  // Settings management
  async saveSetting(key: string, value: string): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");
    await this.withLock(async () => {
      await this.db!.runAsync(
        "INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)",
        [key, value]
      );
    });
  }

  async getSetting(key: string): Promise<string | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");

    const result = (await this.db.getFirstAsync(
      "SELECT value FROM user_settings WHERE key = ?",
      [key]
    )) as { value: string } | null;
    return result ? result.value : null;
  }

  // Favorites management
  async addToFavorites(
    bibleId: string,
    bookId: number,
    chapterNumber: number,
    verseNumber: number
  ): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");
    await this.withLock(async () => {
      await this.db!.runAsync(
        "INSERT OR IGNORE INTO favorites (bibleId, bookId, chapterNumber, verseNumber) VALUES (?, ?, ?, ?)",
        [bibleId, bookId, chapterNumber, verseNumber]
      );
    });
  }

  async removeFromFavorites(
    bibleId: string,
    bookId: number,
    chapterNumber: number,
    verseNumber: number
  ): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");
    await this.withLock(async () => {
      await this.db!.runAsync(
        "DELETE FROM favorites WHERE bibleId = ? AND bookId = ? AND chapterNumber = ? AND verseNumber = ?",
        [bibleId, bookId, chapterNumber, verseNumber]
      );
    });
  }

  async getFavorites(
    bibleId: string
  ): Promise<{ bookId: number; chapterNumber: number; verseNumber: number }[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.getAllAsync(
      "SELECT bookId, chapterNumber, verseNumber FROM favorites WHERE bibleId = ? ORDER BY bookId, chapterNumber, verseNumber",
      [bibleId]
    );

    return result.map((row: any) => ({
      bookId: row.bookId as number,
      chapterNumber: row.chapterNumber as number,
      verseNumber: row.verseNumber as number,
    }));
  }

  async isVerseFavorite(
    bibleId: string,
    bookId: number,
    chapterNumber: number,
    verseNumber: number
  ): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.getFirstAsync(
      "SELECT 1 FROM favorites WHERE bibleId = ? AND bookId = ? AND chapterNumber = ? AND verseNumber = ?",
      [bibleId, bookId, chapterNumber, verseNumber]
    );

    return !!result;
  }

  // Reading history management
  async saveLastReading(
    bibleId: string,
    bookId: number,
    chapterNumber: number
  ): Promise<void> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");

    await this.db.runAsync(
      "INSERT OR REPLACE INTO reading_history (bibleId, bookId, chapterNumber, lastReadDate) VALUES (?, ?, ?, ?)",
      [bibleId, bookId, chapterNumber, new Date().toISOString()]
    );

    // Also save as preferred settings
    await this.saveSetting("lastReadBibleId", bibleId);
    await this.saveSetting("lastReadBookId", bookId.toString());
    await this.saveSetting("lastReadChapter", chapterNumber.toString());
  }

  async getLastReading(): Promise<{
    bibleId: string;
    bookId: number;
    chapterNumber: number;
  } | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");

    const result = (await this.db.getFirstAsync(
      "SELECT bibleId, bookId, chapterNumber FROM reading_history ORDER BY lastReadDate DESC LIMIT 1"
    )) as { bibleId: string; bookId: number; chapterNumber: number } | null;

    return result;
  }

  async getDefaultReading(): Promise<{
    bibleId: string;
    bookId: number;
    chapterNumber: number;
  } | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");

    // First try to get the first available Bible
    const bibles = await this.getBibles();
    const downloadedBibles = bibles.filter((b) => b.isDownloaded);

    if (downloadedBibles.length === 0) {
      return null;
    }

    // For now, return the first Bible with first book, first chapter
    // TODO: We could import BibleReaderService here to get the actual first book ID
    return {
      bibleId: downloadedBibles[0].id,
      bookId: 1, // This should be dynamically determined
      chapterNumber: 1,
    };
  }

  async clearAllData(): Promise<void> {
    return this.withLock(async () => {
      await this.ensureHealthy();
      if (!this.db) throw new Error("Database not initialized");
      
      try {
        // Clear all tables
        await this.db.runAsync("DELETE FROM bibles");
        await this.db.runAsync("DELETE FROM user_settings");
        await this.db.runAsync("DELETE FROM favorites");
        await this.db.runAsync("DELETE FROM reading_plans");
        await this.db.runAsync("DELETE FROM reading_plan_days");
        await this.db.runAsync("DELETE FROM reading_history");
        
        // Clear cache
        this.biblesCache = null;
        
        console.log("All data cleared successfully");
      } catch (error) {
        console.error("Error clearing all data:", error);
        throw error;
      }
    });
  }
}

export default new DatabaseService();
