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
  private biblesCache: { data: Bible[]; updatedAt: number } | null = null;
  // Saúde / circuito
  private lastHealthCheck = 0;
  private lastHealthOk = 0;
  private healthFailures = 0;
  private reinitializing = false;
  private circuitOpenUntil = 0;
  // Debounce para saveLastReading
  private saveReadingDebounceTimer: any = null;
  private pendingReadingSave: {
    bibleId: string;
    bookId: number;
    chapterNumber: number;
  } | null = null;
  // Semáforo para operações em batch
  private batchOperationInProgress = false;
  // Mutex para evitar inicializações simultâneas
  private initMutex: Promise<void> | null = null;
  private initMutexRelease: (() => void) | null = null;

  /**
   * Adquire lock do mutex
   */
  private async acquireMutex(): Promise<() => void> {
    // Se já há um mutex ativo, aguardar
    while (this.initMutex) {
      console.log("[DB] 🔒 Aguardando mutex...");
      await this.initMutex;
    }

    // Criar novo mutex
    let release: (() => void) | undefined;
    this.initMutex = new Promise<void>((resolve) => {
      release = resolve;
    });

    return release!;
  }

  /**
   * Libera lock do mutex
   */
  private releaseMutex(release: () => void) {
    this.initMutex = null;
    release();
    console.log("[DB] 🔓 Mutex liberado");
  }

  // Método para criar uma nova conexão independente para cada operação
  private async createFreshConnection(): Promise<SQLite.SQLiteDatabase> {
    try {
      // GARANTIR que o banco principal foi inicializado primeiro
      if (!this.db && !global.__READBIBLE_DB_HANDLE) {
        console.log("⚠️ Banco não inicializado, inicializando agora...");
        await this.ensureInitialized();
      }

      const connection = await SQLite.openDatabaseAsync(DB_NAME);

      // Habilitar WAL mode para melhor concorrência
      await connection.execAsync("PRAGMA journal_mode = WAL");
      await connection.execAsync("PRAGMA busy_timeout = 5000"); // 5 segundos de timeout

      // Verificar se as tabelas existem na nova conexão
      const result = await connection.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='bibles'",
      );
      if (!result) {
        // Se não existir, criar as tabelas necessárias
        await this.createTablesOnConnection(connection);
      }

      // Sempre executar migração de schema (verifica se é necessário internamente)
      await this.migrateSchema(connection);

      return connection;
    } catch (error) {
      console.error("❌ Erro ao criar nova conexão:", error);
      throw error;
    }
  }

  // Executar operação com conexão independente
  private async withFreshConnection<T>(
    operation: (db: SQLite.SQLiteDatabase) => Promise<T>,
    operationName: string = "unknown",
  ): Promise<T> {
    let connection: SQLite.SQLiteDatabase | null = null;

    try {
      // GARANTIR inicialização antes de qualquer operação
      await this.ensureInitialized();

      console.log(`🔧 Criando nova conexão para: ${operationName}`);
      connection = await this.createFreshConnection();

      const result = await operation(connection);

      console.log(`✅ Operação ${operationName} concluída com sucesso`);
      return result;
    } catch (error) {
      console.error(`❌ Erro na operação ${operationName}:`, error);
      throw error;
    } finally {
      if (connection) {
        try {
          await connection.closeAsync();
          console.log(`🔒 Conexão fechada para: ${operationName}`);
        } catch (closeError) {
          console.warn(`⚠️ Erro ao fechar conexão:`, closeError);
        }
      }
    }
  }

  // Método público para forçar reset em casos extremos
  public forceResetLock() {
    console.warn("🚨 FORCE RESETTING DATABASE CONNECTIONS - Use with caution");
    this.initPromise = null;
    // Também reseta o cache para forçar re-inicialização se necessário
    this.biblesCache = null;
  }

  // Auto-recovery: reset locks se muitos timeouts consecutivos
  private consecutiveTimeouts = 0;
  private autoRecoverLock() {
    this.consecutiveTimeouts++;
    console.warn(
      `🔄 Auto-recovery: ${this.consecutiveTimeouts} consecutive timeouts`,
    );

    if (this.consecutiveTimeouts >= 3) {
      console.warn(
        "🚨 AUTO-RECOVERY: Too many consecutive timeouts, force resetting locks",
      );
      this.forceResetLock();
      this.consecutiveTimeouts = 0;
    }
  }

  // Criar tabelas em uma conexão específica
  private async createTablesOnConnection(
    db: SQLite.SQLiteDatabase,
  ): Promise<void> {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS bibles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        abbreviation TEXT NOT NULL,
        fileName TEXT NOT NULL,
        isDownloaded INTEGER DEFAULT 0,
        downloadDate TEXT,
        size INTEGER,
        source TEXT DEFAULT 'google_drive'
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
      CREATE TABLE IF NOT EXISTS dictionary_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        dictKey TEXT NOT NULL,
        title TEXT,
        createdDate TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(word, dictKey)
      );

      CREATE TABLE IF NOT EXISTS reading_plans (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT,
        totalDays INTEGER NOT NULL,
        completedDays INTEGER DEFAULT 0,
        currentDay INTEGER DEFAULT 1,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        isActive INTEGER DEFAULT 0,
        createdDate TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reading_plan_days (
        id TEXT PRIMARY KEY,
        planId TEXT NOT NULL,
        dayNumber INTEGER NOT NULL,
        date TEXT NOT NULL,
        readings TEXT NOT NULL,
        isCompleted INTEGER DEFAULT 0,
        completedDate TEXT,
        FOREIGN KEY (planId) REFERENCES reading_plans (id) ON DELETE CASCADE,
        UNIQUE(planId, dayNumber)
      );

      CREATE TABLE IF NOT EXISTS reading_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bibleId TEXT NOT NULL,
        bookId INTEGER NOT NULL,
        chapterNumber INTEGER NOT NULL,
        lastReadDate TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(bibleId, bookId, chapterNumber)
      );

      CREATE TABLE IF NOT EXISTS harpa_hymns (
        number INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        copyright TEXT NOT NULL,
        verses TEXT NOT NULL,
        createdDate TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Migração de schema - atualizar tabelas antigas
  private async migrateSchema(db: SQLite.SQLiteDatabase): Promise<void> {
    try {
      console.log("🔄 Verificando necessidade de migração do schema...");

      // Verificar se a coluna 'type' existe em reading_plans
      const tableInfo = (await db.getAllAsync(
        "PRAGMA table_info(reading_plans)",
      )) as any[];
      const hasTypeColumn = tableInfo.some((col: any) => col.name === "type");
      const hasStartDateColumn = tableInfo.some(
        (col: any) => col.name === "startDate",
      );
      const hasEndDateColumn = tableInfo.some(
        (col: any) => col.name === "endDate",
      );
      const hasCompletedDaysColumn = tableInfo.some(
        (col: any) => col.name === "completedDays",
      );

      if (
        !hasTypeColumn ||
        !hasStartDateColumn ||
        !hasEndDateColumn ||
        !hasCompletedDaysColumn
      ) {
        console.log(
          "⚠️ Schema desatualizado detectado! Migrando tabela reading_plans...",
        );

        // Backup dos dados existentes
        const existingPlans = await db.getAllAsync(
          "SELECT * FROM reading_plans",
        );
        console.log(`📦 Backup de ${existingPlans.length} planos existentes`);

        // Dropar e recriar tabela
        await db.execAsync("DROP TABLE IF EXISTS reading_plans");
        await db.execAsync("DROP TABLE IF EXISTS reading_plan_days");

        // Recriar com novo schema
        await db.execAsync(`
          CREATE TABLE IF NOT EXISTS reading_plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            description TEXT,
            totalDays INTEGER NOT NULL,
            completedDays INTEGER DEFAULT 0,
            currentDay INTEGER DEFAULT 1,
            startDate TEXT NOT NULL,
            endDate TEXT NOT NULL,
            isActive INTEGER DEFAULT 0,
            createdDate TEXT DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS reading_plan_days (
            id TEXT PRIMARY KEY,
            planId TEXT NOT NULL,
            dayNumber INTEGER NOT NULL,
            date TEXT NOT NULL,
            readings TEXT NOT NULL,
            isCompleted INTEGER DEFAULT 0,
            completedDate TEXT,
            FOREIGN KEY (planId) REFERENCES reading_plans (id) ON DELETE CASCADE,
            UNIQUE(planId, dayNumber)
          );
        `);

        console.log("✅ Migração de schema concluída!");
      } else {
        console.log("✅ Schema já está atualizado (reading_plans)");
      }

      const biblesInfo = (await db.getAllAsync(
        "PRAGMA table_info(bibles)",
      )) as any[];
      const hasSourceColumn = biblesInfo.some((col: any) => col.name === "source");

      if (!hasSourceColumn) {
        console.log("⚠️ Migrando tabela bibles: adicionando coluna source...");
        await db.execAsync("ALTER TABLE bibles ADD COLUMN source TEXT DEFAULT 'google_drive'");
        console.log("✅ Migração da tabela bibles concluída!");
      } else {
        console.log("✅ Schema já está atualizado (bibles)");
      }

      // Criar tabela de favoritos do dicionário (se ainda não existir)
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS dictionary_favorites (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          word TEXT NOT NULL,
          dictKey TEXT NOT NULL,
          title TEXT,
          createdDate TEXT DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(word, dictKey)
        );
      `);
    } catch (error) {
      console.error("❌ Erro ao migrar schema:", error);
    }
  }

  private async safeDbOperation<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxRetries: number = 2,
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        console.error(
          `Erro em ${operationName} (tentativa ${attempt + 1}):`,
          error,
        );

        if (this.isNativePrepareNPE(error)) {
          if (attempt < maxRetries - 1) {
            console.log(`Reinicializando banco para ${operationName}...`);
            await this.reinitializeDatabase(
              `${operationName} retry ${attempt + 1}`,
            );
            continue;
          }
        }

        throw error;
      }
    }
    throw new Error(
      `Operação ${operationName} falhou após ${maxRetries} tentativas`,
    );
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
            `[DB] Health check falhou (prepareAsync/NPE) falhas=${failureCount}`,
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
    return (
      msg.includes("prepareAsync") ||
      msg.includes("NullPointerException") ||
      msg.includes("NativeDatabase.prepareAsync") ||
      msg.includes("database is locked") ||
      msg.includes("Call to function 'NativeDatabase")
    );
  }

  /**
   * Garantir inicialização única e reutilizável com mutex.
   */
  private async ensureInitialized(retryCount: number = 0) {
    const MAX_RETRIES = 3;

    // Adquirir mutex para evitar inicializações simultâneas
    const release = await this.acquireMutex();

    try {
      // Se já temos um banco válido, testar e retornar
      if (this.db && global.__READBIBLE_DB_HANDLE) {
        try {
          await this.db.getFirstAsync("SELECT 1");
          console.log("[DB] ✅ Banco já inicializado e funcionando");
          return; // Banco está funcionando
        } catch (error) {
          console.warn(
            "[DB] ⚠️ Banco existente não responde, será reinicializado...",
          );
          // Limpar completamente
          try {
            await this.db.closeAsync?.();
          } catch {}
          this.db = null;
          global.__READBIBLE_DB_HANDLE = undefined;
          this.initPromise = null;
        }
      }

      // Se há global handle mas não temos referência local
      if (!this.db && global.__READBIBLE_DB_HANDLE) {
        try {
          await global.__READBIBLE_DB_HANDLE.getFirstAsync("SELECT 1");
          this.db = global.__READBIBLE_DB_HANDLE;
          console.log("[DB] ✅ Reutilizando global handle");
          return; // Global handle está funcionando
        } catch (error) {
          console.warn("[DB] ⚠️ Global handle inválido, limpando...");
          try {
            await global.__READBIBLE_DB_HANDLE.closeAsync?.();
          } catch {}
          global.__READBIBLE_DB_HANDLE = undefined;
        }
      }

      // Inicializar do zero
      console.log(
        `[DB] 🔄 Iniciando nova inicialização (tentativa ${retryCount + 1}/${MAX_RETRIES})...`,
      );

      try {
        // Abrir banco
        this.db = await SQLite.openDatabaseAsync(DB_NAME, {
          useNewConnection: false,
        });

        if (!this.db) {
          throw new Error("openDatabaseAsync retornou null");
        }

        console.log("[DB] 📋 Criando tabelas...");
        global.__READBIBLE_DB_HANDLE = this.db;
        await this.createTables();

        // Migração de schema (adiciona colunas que não existiam)
        await this.migrateSchema(this.db);

        // Teste final robusto
        console.log("[DB] 🧪 Testando conexão...");
        await this.db.getFirstAsync("SELECT 1");

        console.log("[DB] ✅ Banco inicializado e validado com sucesso");
      } catch (error) {
        console.error(
          `[DB] ❌ Erro na inicialização (tentativa ${retryCount + 1}/${MAX_RETRIES}):`,
          error,
        );

        // Limpar estado
        if (this.db) {
          try {
            await this.db.closeAsync?.();
          } catch {}
        }
        this.db = null;
        global.__READBIBLE_DB_HANDLE = undefined;
        this.initPromise = null;

        // Retry com delay exponencial
        if (retryCount < MAX_RETRIES) {
          const delay = 1000 * (retryCount + 1); // 1s, 2s, 3s
          console.log(`[DB] 🔄 Tentando novamente em ${delay}ms...`);
          this.releaseMutex(release); // Liberar antes do delay
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.ensureInitialized(retryCount + 1);
        }

        throw error;
      }
    } finally {
      // Sempre liberar mutex
      this.releaseMutex(release);
    }
  }

  private async reinitializeDatabase(reason?: string) {
    console.log("[DB] 🔄 Reinitializando banco", reason ? `(${reason})` : "");
    // Limpar tudo
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
    // No more locks to reset - using fresh connections per operation
    await this.ensureInitialized();
  }

  /**
   * Método público para inicializar o banco
   * Mantido para compatibilidade com código existente
   */
  async init(): Promise<void> {
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
        size INTEGER,
        source TEXT DEFAULT 'google_drive'
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
      CREATE TABLE IF NOT EXISTS dictionary_favorites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        word TEXT NOT NULL,
        dictKey TEXT NOT NULL,
        title TEXT,
        createdDate TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(word, dictKey)
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

      CREATE TABLE IF NOT EXISTS harpa_hymns (
        number INTEGER PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        copyright TEXT NOT NULL,
        verses TEXT NOT NULL,
        createdDate TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  // Bible management
  async saveBible(bible: Bible): Promise<void> {
    console.log("🔥 DatabaseService.saveBible CALLED with:", {
      id: bible.id,
      name: bible.name,
      abbreviation: bible.abbreviation,
      fileName: bible.fileName,
      isDownloaded: bible.isDownloaded,
      downloadDate: bible.downloadDate,
      size: bible.size,
      source: bible.source,
    });

    return this.safeDbOperation(
      async () => {
        console.log("🔥 About to call ensureInitialized...");
        await this.ensureInitialized();
        console.log("🔥 ensureInitialized completed");

        if (!this.db) throw new Error("Database not initialized");
        console.log(
          "🔥 Database is initialized, running INSERT OR REPLACE directly...",
        );

        await this.db.runAsync(
          "INSERT OR REPLACE INTO bibles (id, name, abbreviation, fileName, isDownloaded, downloadDate, size, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [
            bible.id,
            bible.name,
            bible.abbreviation,
            bible.fileName,
            bible.isDownloaded ? 1 : 0,
            bible.downloadDate || null,
            bible.size || null,
            bible.source || 'google_drive',
          ],
        );
        console.log("🔥 INSERT OR REPLACE completed successfully");
        this.biblesCache = null; // invalidar cache
        console.log("🔥 Cache invalidated, saveBible operation completed");
      },
      "saveBible",
      3,
    ); // 3 tentativas de retry
  }

  async getBibles(): Promise<Bible[]> {
    // Cache: se já carregou e não houve mudança estrutural, reutiliza
    if (this.biblesCache) {
      return this.biblesCache.data;
    }

    try {
      await this.ensureInitialized();
      if (!this.db) return [];

      // Double-check cache
      if (this.biblesCache) {
        return this.biblesCache.data;
      }

      const rows = await this.db.getAllAsync(
        "SELECT * FROM bibles ORDER BY name",
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
          source: row.source as string | undefined,
        };
      });
      this.biblesCache = { data: mapped, updatedAt: Date.now() };
      console.log("BÍBLIAS NO BANCO", mapped.length);
      console.log(
        "BÍBLIAS NO BANCO DETALHES",
        mapped.map((bible) => ({
          id: bible.id,
          name: bible.name,
          fileName: bible.fileName,
          source: bible.source,
        })),
      );
      console.log("----------------------");
      return mapped;
    } catch (error) {
      console.error("[DB] Erro em getBibles:", error);
      return [];
    }
  }

  async deleteBible(bibleId: string): Promise<void> {
    return this.safeDbOperation(async () => {
      await this.ensureInitialized();
      if (!this.db) throw new Error("Database not initialized");

      await this.db.runAsync("DELETE FROM bibles WHERE id = ?", [bibleId]);
      await this.db.runAsync("DELETE FROM favorites WHERE bibleId = ?", [
        bibleId,
      ]);
      this.biblesCache = null;
    }, "deleteBible");
  }

  async markBibleAsDownloaded(bibleId: string, size?: number): Promise<void> {
    return this.safeDbOperation(async () => {
      await this.ensureInitialized();
      if (!this.db) throw new Error("Database not initialized");

      await this.db.runAsync(
        "UPDATE bibles SET isDownloaded = 1, downloadDate = ?, size = ? WHERE id = ?",
        [new Date().toISOString(), size || null, bibleId],
      );
      this.biblesCache = null;
    }, "markBibleAsDownloaded");
  }

  // Settings management
  async saveSetting(key: string, value: string): Promise<void> {
    try {
      await this.ensureInitialized();
      if (!this.db) throw new Error("Database not initialized");

      await this.db.runAsync(
        "INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)",
        [key, value],
      );
    } catch (error) {
      console.error("[DB] Erro em saveSetting:", error);
      throw error;
    }
  }

  async getSetting(key: string): Promise<string | null> {
    try {
      await this.ensureInitialized();
      if (!this.db) return null;

      const result = (await this.db.getFirstAsync(
        "SELECT value FROM user_settings WHERE key = ?",
        [key],
      )) as { value: string } | null;
      return result ? result.value : null;
    } catch (error) {
      console.error("[DB] Erro em getSetting:", error);
      return null;
    }
  }

  async getMultipleSettings(
    keys: string[],
  ): Promise<Record<string, string | null>> {
    try {
      await this.ensureInitialized();
      if (!this.db) {
        const settingsMap: Record<string, string | null> = {};
        keys.forEach((key) => {
          settingsMap[key] = null;
        });
        return settingsMap;
      }

      const placeholders = keys.map(() => "?").join(",");
      const results = (await this.db.getAllAsync(
        `SELECT key, value FROM user_settings WHERE key IN (${placeholders})`,
        keys,
      )) as { key: string; value: string }[];

      const settingsMap: Record<string, string | null> = {};
      keys.forEach((key) => {
        settingsMap[key] = null;
      });
      results.forEach((result) => {
        settingsMap[result.key] = result.value;
      });

      return settingsMap;
    } catch (error) {
      console.error("[DB] Erro em getMultipleSettings:", error);
      const settingsMap: Record<string, string | null> = {};
      keys.forEach((key) => {
        settingsMap[key] = null;
      });
      return settingsMap;
    }
  }

  // Favorites management
  async addToFavorites(
    bibleId: string,
    bookId: number,
    chapterNumber: number,
    verseNumber: number,
  ): Promise<void> {
    return this.safeDbOperation(async () => {
      await this.ensureInitialized();
      if (!this.db) throw new Error("Database not initialized");

      await this.db.runAsync(
        "INSERT OR IGNORE INTO favorites (bibleId, bookId, chapterNumber, verseNumber) VALUES (?, ?, ?, ?)",
        [bibleId, bookId, chapterNumber, verseNumber],
      );
    }, "addToFavorites");
  }

  async removeFromFavorites(
    bibleId: string,
    bookId: number,
    chapterNumber: number,
    verseNumber: number,
  ): Promise<void> {
    return this.safeDbOperation(async () => {
      await this.ensureInitialized();
      if (!this.db) throw new Error("Database not initialized");

      await this.db.runAsync(
        "DELETE FROM favorites WHERE bibleId = ? AND bookId = ? AND chapterNumber = ? AND verseNumber = ?",
        [bibleId, bookId, chapterNumber, verseNumber],
      );
    }, "removeFromFavorites");
  }

  async getFavorites(
    bibleId: string,
  ): Promise<{ bookId: number; chapterNumber: number; verseNumber: number }[]> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.getAllAsync(
      "SELECT bookId, chapterNumber, verseNumber FROM favorites WHERE bibleId = ? ORDER BY bookId, chapterNumber, verseNumber",
      [bibleId],
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
    verseNumber: number,
  ): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.getFirstAsync(
      "SELECT 1 FROM favorites WHERE bibleId = ? AND bookId = ? AND chapterNumber = ? AND verseNumber = ?",
      [bibleId, bookId, chapterNumber, verseNumber],
    );

    return !!result;
  }

  // Dictionary favorites management
  async addDictionaryFavorite(
    word: string,
    dictKey: string,
    title?: string,
  ): Promise<void> {
    return this.safeDbOperation(async () => {
      await this.ensureInitialized();
      if (!this.db) throw new Error("Database not initialized");

      await this.db.runAsync(
        "INSERT OR IGNORE INTO dictionary_favorites (word, dictKey, title) VALUES (?, ?, ?)",
        [word, dictKey, title || word],
      );
    }, "addDictionaryFavorite");
  }

  async removeDictionaryFavorite(word: string, dictKey: string): Promise<void> {
    return this.safeDbOperation(async () => {
      await this.ensureInitialized();
      if (!this.db) throw new Error("Database not initialized");

      await this.db.runAsync(
        "DELETE FROM dictionary_favorites WHERE word = ? AND dictKey = ?",
        [word, dictKey],
      );
    }, "removeDictionaryFavorite");
  }

  async isDictionaryFavorite(
    word: string,
    dictKey: string,
  ): Promise<boolean> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.getFirstAsync(
      "SELECT 1 FROM dictionary_favorites WHERE word = ? AND dictKey = ?",
      [word, dictKey],
    );

    return !!result;
  }

  async getDictionaryFavorites(): Promise<
    { word: string; dictKey: string; title: string; createdDate: string }[]
  > {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");

    const result = await this.db.getAllAsync(
      "SELECT word, dictKey, title, createdDate FROM dictionary_favorites ORDER BY createdDate DESC, id DESC",
    );

    return result.map((row: any) => ({
      word: row.word as string,
      dictKey: row.dictKey as string,
      title: (row.title as string) || (row.word as string),
      createdDate: row.createdDate as string,
    }));
  }

  // Reading history management
  async saveLastReading(
    bibleId: string,
    bookId: number,
    chapterNumber: number,
  ): Promise<void> {
    // Sistema completamente não-bloqueante - retorna imediatamente
    this.pendingReadingSave = { bibleId, bookId, chapterNumber };

    if (this.saveReadingDebounceTimer) {
      clearTimeout(this.saveReadingDebounceTimer);
    }

    // Salvar em background sem esperar nem bloquear
    this.saveReadingDebounceTimer = setTimeout(async () => {
      if (!this.pendingReadingSave) return;

      const {
        bibleId: finalBibleId,
        bookId: finalBookId,
        chapterNumber: finalChapter,
      } = this.pendingReadingSave;
      this.pendingReadingSave = null;

      // Tentar salvar usando conexão principal - se falhar, não é crítico
      try {
        await this.ensureInitialized();
        if (this.db) {
          await this.db.runAsync(
            "INSERT OR REPLACE INTO reading_history (bibleId, bookId, chapterNumber, lastReadDate) VALUES (?, ?, ?, ?)",
            [finalBibleId, finalBookId, finalChapter, new Date().toISOString()],
          );
        }
      } catch (error) {
        // Salvar leitura não é crítico - ignora erros
        console.warn(
          "[DEBUG] Erro ao salvar posição de leitura (ignorado):",
          error,
        );
      }
    }, 2000); // 2 segundos de debounce

    // Retorna imediatamente - não bloqueia NADA
    return Promise.resolve();
  }

  async getLastReading(): Promise<{
    bibleId: string;
    bookId: number;
    chapterNumber: number;
  } | null> {
    await this.ensureInitialized();
    if (!this.db) throw new Error("Database not initialized");

    const result = (await this.db.getFirstAsync(
      "SELECT bibleId, bookId, chapterNumber FROM reading_history ORDER BY lastReadDate DESC LIMIT 1",
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

  async getQuizStats(): Promise<{ completed: number; total: number } | null> {
    return this.safeDbOperation(async () => {
      await this.ensureInitialized();
      if (!this.db) throw new Error("Database not initialized");

      // Buscar estatísticas de questionários completados
      const result = await this.db.getFirstAsync<{ completed: number }>(
        "SELECT COUNT(*) as cod FROM quiz_results WHERE score >= 7",
      );

      const totalResult = await this.db.getFirstAsync<{ total: number }>(
        "SELECT COUNT(*) as total FROM quiz_results",
      );
      [];
      return {
        completed: result?.completed || 0,
        total: totalResult?.total || 0,
      };
    }, "getQuizStats");
  }

  async clearAllData(): Promise<void> {
    return this.safeDbOperation(async () => {
      await this.ensureInitialized();
      if (!this.db) throw new Error("Database not initialized");

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
    }, "clearAllData");
  }

  // Harpa Hymns Management
  async saveHymnToDatabase(hymn: {
    number: number;
    title: string;
    author: string;
    copyright: string;
    verses: any[];
  }): Promise<void> {
    try {
      await this.ensureInitialized();
      if (!this.db) throw new Error("Database not initialized");

      await this.db.runAsync(
        `INSERT OR REPLACE INTO harpa_hymns (number, title, author, copyright, verses)
         VALUES (?, ?, ?, ?, ?)`,
        [
          hymn.number,
          hymn.title,
          hymn.author,
          hymn.copyright,
          JSON.stringify(hymn.verses),
        ],
      );
    } catch (error) {
      console.error("[DB] Erro em saveHymnToDatabase:", error);
      throw error;
    }
  }

  // Salvar múltiplos hinos em uma única transação (MUITO MAIS RÁPIDO e evita locks)
  async saveHymnsBatch(
    hymns: {
      number: number;
      title: string;
      author: string;
      copyright: string;
      verses: any[];
    }[],
  ): Promise<void> {
    try {
      console.log(`[DB] 💾 Salvando batch de ${hymns.length} hinos...`);

      await this.ensureInitialized();

      if (!this.db) {
        throw new Error("Database not initialized after ensureInitialized");
      }

      // Teste adicional: verificar se o banco responde
      try {
        await this.db.getFirstAsync("SELECT 1");
      } catch (testError) {
        console.error("[DB] ❌ Banco não responde, tentando reinicializar...");
        await this.reinitializeDatabase("saveHymnsBatch test failed");
        if (!this.db) {
          throw new Error("Database still not ready after reinitialization");
        }
      }

      console.log("[DB] 🚀 Iniciando transação...");
      await this.db.execAsync("BEGIN TRANSACTION");
      [];
      try {
        for (const hymn of hymns) {
          await this.db.runAsync(
            `INSERT OR REPLACE INTO harpa_hymns (number, title, author, copyright, verses)
             VALUES (?, ?, ?, ?, ?)`,
            [
              hymn.number,
              hymn.title,
              hymn.author,
              hymn.copyright,
              JSON.stringify(hymn.verses),
            ],
          );
        }

        await this.db.execAsync("COMMIT");
        console.log(`[DB] ✅ Batch de ${hymns.length} hinos salvo com sucesso`);
      } catch (error) {
        console.error("[DB] ❌ Erro durante transação, executando rollback...");
        try {
          await this.db.execAsync("ROLLBACK");
        } catch (rollbackError) {
          console.error("[DB] ⚠️ Erro no rollback:", rollbackError);
        }
        throw error;
      }
    } catch (error) {
      console.error("[DB] ❌ Erro em saveHymnsBatch:", error);
      throw error;
    }
  }

  async getHymnFromDatabase(number: number): Promise<{
    number: number;
    title: string;
    author: string;
    copyright: string;
    verses: any[];
  } | null> {
    try {
      await this.ensureInitialized();

      if (!this.db) {
        console.warn(
          `[DB] ⚠️ Database não inicializado em getHymnFromDatabase(${number}), retornando null`,
        );
        return null;
      }

      const result = (await this.db.getFirstAsync(
        "SELECT * FROM harpa_hymns WHERE number = ?",
        [number],
      )) as any;

      if (!result) return null;

      return {
        number: result.number,
        title: result.title,
        author: result.author,
        copyright: result.copyright,
        verses: JSON.parse(result.verses),
      };
    } catch (error) {
      console.error(`[DB] Erro em getHymnFromDatabase(${number}):`, error);
      return null; // Retornar null ao invés de lançar erro
    }
  }

  async searchHymnsInDatabase(
    query: string,
    limit: number = 20,
  ): Promise<
    {
      number: number;
      title: string;
      snippet: string;
    }[]
  > {
    try {
      await this.ensureInitialized();
      [];

      if (!this.db) {
        console.warn(
          "[DB] ⚠️ Database não inicializado em searchHymnsInDatabase, retornando []",
        );
        return [];
      }

      const lowerQuery = query.toLowerCase();

      // LOG: Ver quantos hinos existem na tabela
      const countResult = (await this.db.getFirstAsync(
        "SELECT COUNT(*) as count FROM harpa_hymns",
      )) as any;
      console.log(
        `[searchHymns] Total de hinos na tabela: ${countResult?.count || 0}`,
      );

      // LOG: Query SQL que será executada
      console.log(`[searchHymns] Query: "${lowerQuery}"`);
      console.log(
        `[searchHymns] SQL: SELECT number, title, verses FROM harpa_hymns WHERE LOWER(verses) LIKE '%${lowerQuery}%' LIMIT ${limit}`,
      );

      // Buscar em verses (JSON)
      const results = (await this.db.getAllAsync(
        `SELECT number, title, verses 
         FROM harpa_hymns 
         WHERE LOWER(verses) LIKE ?
         LIMIT ?`,
        [`%${lowerQuery}%`, limit],
      )) as any[];

      console.log(`[searchHymns] Resultados encontrados: ${results.length}`);

      return results.map((row) => {
        const verses = JSON.parse(row.verses);
        let snippet = "";

        // Procurar snippet no conteúdo
        for (const verse of verses) {
          // Juntar todas as linhas com espaço (tratando \n como separador)
          const verseText = verse.lines.join(" ");
          const lowerText = verseText.toLowerCase();
          const index = lowerText.indexOf(lowerQuery);

          if (index !== -1) {
            const start = Math.max(0, index - 30);
            const end = Math.min(verseText.length, index + query.length + 30);

            // Extrair o trecho com destaque
            const before = verseText.substring(start, index);
            const match = verseText.substring(index, index + query.length);
            const after = verseText.substring(index + query.length, end);

            snippet =
              (start > 0 ? "..." : "") +
              before +
              "**" +
              match +
              "**" +
              after.trim() +
              (end < verseText.length ? "..." : "");
            break;
          }
        }

        return {
          number: row.number,
          title: row.title,
          snippet: snippet || "Trecho encontrado no hino",
        };
      });
    } catch (error) {
      console.error("[DB] Erro em searchHymnsInDatabase:", error);
      return [];
    }
  }

  async getHymnsDatabaseCount(): Promise<number> {
    try {
      await this.ensureInitialized();

      if (!this.db) {
        console.warn(
          "[DB] ⚠️ Database não inicializado em getHymnsDatabaseCount, retornando 0",
        );
        return 0;
      }

      const result = (await this.db.getFirstAsync(
        "SELECT COUNT(*) as count FROM harpa_hymns",
      )) as any;
      return result?.count || 0;
    } catch (error) {
      console.error("[DB] Erro em getHymnsDatabaseCount:", error);
      // Retornar 0 ao invés de lançar erro - o app pode continuar funcionando
      return 0;
    }
  }

  async getAllHymnsMetadata(): Promise<
    { number: number; title: string }[]
  > {
    try {
      await this.ensureInitialized();

      if (!this.db) {
        console.warn(
          "[DB] ⚠️ Database não inicializado em getAllHymnsMetadata, retornando []",
        );
        return [];
      }

      const results = (await this.db.getAllAsync(
        "SELECT number, title FROM harpa_hymns ORDER BY number ASC",
      )) as any[];

      return results.map((row) => ({
        number: row.number,
        title: row.title,
      }));
    } catch (error) {
      console.error("[DB] Erro em getAllHymnsMetadata:", error);
      return [];
    }
  }

  async clearAllHymns(): Promise<void> {
    try {
      await this.ensureInitialized();
      if (!this.db) throw new Error("Database not initialized");

      await this.db.runAsync("DELETE FROM harpa_hymns");
      console.log("[DB] Todos os hinos foram removidos do banco");
    } catch (error) {
      console.error("[DB] Erro em clearAllHymns:", error);
      throw error;
    }
  }

  async saveVideoProgress(progress: {
    bibleId: string;
    bibleName: string;
    bookId: string;
    chapter: number;
    positionMs: number;
    duration: number;
  }): Promise<void> {
    try {
      await this.saveSetting('lastVideoProgress', JSON.stringify(progress));
    } catch (error) {
      console.error("[DB] Erro em saveVideoProgress:", error);
    }
  }

  async getLastVideoProgress(): Promise<{
    bibleId: string;
    bibleName: string;
    bookId: string;
    chapter: number;
    positionMs: number;
    duration: number;
  } | null> {
    try {
      const raw = await this.getSetting('lastVideoProgress');
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.error("[DB] Erro em getLastVideoProgress:", error);
      return null;
    }
  }

  async clearVideoProgress(): Promise<void> {
    try {
      await this.saveSetting('lastVideoProgress', '');
    } catch (error) {
      console.error("[DB] Erro em clearVideoProgress:", error);
    }
  }
}

const databaseServiceInstance = new DatabaseService();

// Expor função global para debug/emergência
declare global {
  var __FORCE_RESET_DB_LOCK: () => void;
}

if (__DEV__) {
  global.__FORCE_RESET_DB_LOCK = () => {
    console.warn("🚨 MANUAL EMERGENCY DATABASE LOCK RESET");
    databaseServiceInstance.forceResetLock();
  };
}

export default databaseServiceInstance;
