import * as SQLite from 'expo-sqlite';
import { Bible } from '../types';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async init() {
    try {
      this.db = await SQLite.openDatabaseAsync('readbible.db');
      await this.createTables();
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  private async createTables() {
    if (!this.db) throw new Error('Database not initialized');

    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS bibles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        abbreviation TEXT NOT NULL,
        language TEXT NOT NULL,
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
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      'INSERT OR REPLACE INTO bibles (id, name, abbreviation, language, fileName, isDownloaded, downloadDate, size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [bible.id, bible.name, bible.abbreviation, bible.language, bible.fileName, bible.isDownloaded ? 1 : 0, bible.downloadDate || null, bible.size || null]
    );
  }

  async getBibles(): Promise<Bible[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getAllAsync('SELECT * FROM bibles ORDER BY name');
    console.log("BÍBLIAS NO BANCO", result.length);
    return result.map((row: any) => ({
      id: row.id as string,
      name: row.name as string,
      abbreviation: row.abbreviation as string,
      language: row.language as string,
      fileName: row.fileName as string,
      isDownloaded: Boolean(row.isDownloaded),
      downloadDate: row.downloadDate as string | undefined,
      size: row.size as number | undefined,
    }));
  }

  async deleteBible(bibleId: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync('DELETE FROM bibles WHERE id = ?', [bibleId]);
    await this.db.runAsync('DELETE FROM favorites WHERE bibleId = ?', [bibleId]);
  }

  async markBibleAsDownloaded(bibleId: string, size?: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      'UPDATE bibles SET isDownloaded = 1, downloadDate = ?, size = ? WHERE id = ?',
      [new Date().toISOString(), size || null, bibleId]
    );
  }

  // Settings management
  async saveSetting(key: string, value: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      'INSERT OR REPLACE INTO user_settings (key, value) VALUES (?, ?)',
      [key, value]
    );
  }

  async getSetting(key: string): Promise<string | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync(
      'SELECT value FROM user_settings WHERE key = ?',
      [key]
    ) as { value: string } | null;
    return result ? result.value : null;
  }

  // Favorites management
  async addToFavorites(bibleId: string, bookId: number, chapterNumber: number, verseNumber: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      'INSERT OR IGNORE INTO favorites (bibleId, bookId, chapterNumber, verseNumber) VALUES (?, ?, ?, ?)',
      [bibleId, bookId, chapterNumber, verseNumber]
    );
  }

  async removeFromFavorites(bibleId: string, bookId: number, chapterNumber: number, verseNumber: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      'DELETE FROM favorites WHERE bibleId = ? AND bookId = ? AND chapterNumber = ? AND verseNumber = ?',
      [bibleId, bookId, chapterNumber, verseNumber]
    );
  }

  async getFavorites(bibleId: string): Promise<{ bookId: number; chapterNumber: number; verseNumber: number }[]> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getAllAsync(
      'SELECT bookId, chapterNumber, verseNumber FROM favorites WHERE bibleId = ? ORDER BY bookId, chapterNumber, verseNumber',
      [bibleId]
    );
    
    return result.map((row: any) => ({
      bookId: row.bookId as number,
      chapterNumber: row.chapterNumber as number,
      verseNumber: row.verseNumber as number,
    }));
  }

  async isVerseFavorite(bibleId: string, bookId: number, chapterNumber: number, verseNumber: number): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync(
      'SELECT 1 FROM favorites WHERE bibleId = ? AND bookId = ? AND chapterNumber = ? AND verseNumber = ?',
      [bibleId, bookId, chapterNumber, verseNumber]
    );
    
    return !!result;
  }

  // Reading history management
  async saveLastReading(bibleId: string, bookId: number, chapterNumber: number): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');
    
    await this.db.runAsync(
      'INSERT OR REPLACE INTO reading_history (bibleId, bookId, chapterNumber, lastReadDate) VALUES (?, ?, ?, ?)',
      [bibleId, bookId, chapterNumber, new Date().toISOString()]
    );
    
    // Also save as preferred settings
    await this.saveSetting('lastReadBibleId', bibleId);
    await this.saveSetting('lastReadBookId', bookId.toString());
    await this.saveSetting('lastReadChapter', chapterNumber.toString());
  }

  async getLastReading(): Promise<{ bibleId: string; bookId: number; chapterNumber: number } | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const result = await this.db.getFirstAsync(
      'SELECT bibleId, bookId, chapterNumber FROM reading_history ORDER BY lastReadDate DESC LIMIT 1'
    ) as { bibleId: string; bookId: number; chapterNumber: number } | null;
    
    return result;
  }

  async getDefaultReading(): Promise<{ bibleId: string; bookId: number; chapterNumber: number } | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    // First try to get the first available Bible
    const bibles = await this.getBibles();
    const downloadedBibles = bibles.filter(b => b.isDownloaded);
    
    if (downloadedBibles.length === 0) {
      return null;
    }
    
    // For now, return the first Bible with first book, first chapter
    // TODO: We could import BibleReaderService here to get the actual first book ID
    return {
      bibleId: downloadedBibles[0].id,
      bookId: 1, // This should be dynamically determined
      chapterNumber: 1
    };
  }

  async ensureSampleBible(): Promise<void> {
    const bibles = await this.getBibles();
    
    if (bibles.length === 0) {
      // Add a sample Bible entry for testing
      const sampleBible: Bible = {
        id: 'sample-bible',
        name: 'Bíblia de Exemplo',
        abbreviation: 'EXEMPLO',
        language: 'pt',
        fileName: 'sample.bbl.db',
        isDownloaded: false,
        downloadDate: undefined,
        size: 0,
      };
      
      await this.saveBible(sampleBible);
      console.log('Sample Bible added for testing purposes');
    }
  }
}

export default new DatabaseService();