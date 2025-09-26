import * as SQLite from 'expo-sqlite';
import { Book, Chapter, SearchResult, Verse } from '../types';
import googleDriveService from './GoogleDriveService';

export class BibleReaderService {
  private bibleConnections: Map<string, SQLite.SQLiteDatabase> = new Map();

  async openBible(bibleId: string, fileName: string): Promise<void> {
    try {
      if (this.bibleConnections.has(bibleId)) {
        return; // Already open
      }

      // If it's the sample bible, we don't need to open a real file
      if (bibleId === 'sample-bible') {
        // Create a mock connection for sample data
        this.bibleConnections.set(bibleId, null as any);
        return;
      }

      const localPath = await googleDriveService.getLocalBiblePath(fileName);
      if (!localPath) {
        throw new Error('Bible file not found locally');
      }

      const db = await SQLite.openDatabaseAsync(localPath);
      this.bibleConnections.set(bibleId, db);
    } catch (error) {
      console.error('Error opening Bible:', error);
      throw error;
    }
  }

  async closeBible(bibleId: string): Promise<void> {
    const db = this.bibleConnections.get(bibleId);
    if (db) {
      await db.closeAsync();
      this.bibleConnections.delete(bibleId);
    }
  }

  private getBibleConnection(bibleId: string): SQLite.SQLiteDatabase | null {
    const db = this.bibleConnections.get(bibleId);
    if (db === undefined) {
      throw new Error(`Bible ${bibleId} is not open. Call openBible first.`);
    }
    return db;
  }

  async getBooks(bibleId: string): Promise<Book[]> {
    const db = this.getBibleConnection(bibleId);
    
    // If it's the sample bible, return sample data
    if (bibleId === 'sample-bible') {
      return this.getSampleBooks();
    }
    
    if (!db) {
      throw new Error('Database connection is null');
    }
    
    try {
      // Based on the database structure shown, we need to get unique books from the main table
      const result = await db.getAllAsync('SELECT DISTINCT Book FROM Bible ORDER BY Book');
      
      if (result.length > 0) {
        return result.map((row: any) => ({
          id: row.Book,
          name: this.getBookName(row.Book),
          abbreviation: this.getBookName(row.Book).substring(0, 3),
          testament: this.determineTestament(row.Book),
          chaptersCount: 0, // Will be calculated later if needed
        }));
      }
      
      throw new Error('No books found in Bible table');
    } catch (error) {
      console.error('Error getting books:', error);
      throw error;
    }
  }

  private getSampleBooks(): Book[] {
    return [
      { id: 1, name: 'Gênesis', abbreviation: 'Gên', testament: 'old', chaptersCount: 50 },
      { id: 19, name: 'Salmos', abbreviation: 'Sal', testament: 'old', chaptersCount: 150 },
      { id: 40, name: 'Mateus', abbreviation: 'Mat', testament: 'new', chaptersCount: 28 },
      { id: 43, name: 'João', abbreviation: 'João', testament: 'new', chaptersCount: 21 },
    ];
  }

  private getSampleChapters(bookId: number): Chapter[] {
    const chaptersCount = bookId === 19 ? 5 : bookId === 1 ? 3 : 2; // Sample counts
    return Array.from({ length: chaptersCount }, (_, i) => ({
      id: i + 1,
      bookId,
      chapterNumber: i + 1,
      versesCount: 10, // Sample verse count
    }));
  }

  private getSampleVerses(bookId: number, chapterNumber: number): Verse[] {
    return [
      {
        id: parseInt(`${bookId}${chapterNumber.toString().padStart(3, '0')}001`),
        bookId,
        chapterNumber,
        verseNumber: 1,
        text: 'Este é um versículo de exemplo para demonstração do aplicativo ReadBible.'
      },
      {
        id: parseInt(`${bookId}${chapterNumber.toString().padStart(3, '0')}002`),
        bookId,
        chapterNumber,
        verseNumber: 2,
        text: 'Aqui temos outro versículo de exemplo que mostra como o texto bíblico seria exibido.'
      }
    ];
  }

  async getChapters(bibleId: string, bookId: number): Promise<Chapter[]> {
    const db = this.getBibleConnection(bibleId);
    
    // If it's the sample bible, return sample data
    if (bibleId === 'sample-bible') {
      return this.getSampleChapters(bookId);
    }
    
    if (!db) {
      throw new Error('Database connection is null');
    }
    
    try {
      const result = await db.getAllAsync(
        'SELECT DISTINCT Chapter FROM Bible WHERE Book = ? ORDER BY Chapter',
        [bookId]
      );
      
      return result.map((row: any, index: number) => ({
        id: index + 1,
        bookId,
        chapterNumber: row.Chapter,
        versesCount: 0, // Will be calculated later if needed
      }));
    } catch (error) {
      console.error('Error getting chapters:', error);
      throw error;
    }
  }

  async getVerses(bibleId: string, bookId: number, chapterNumber: number): Promise<Verse[]> {
    const db = this.getBibleConnection(bibleId);
    
    // If it's the sample bible, return sample data
    if (bibleId === 'sample-bible') {
      return this.getSampleVerses(bookId, chapterNumber);
    }
    
    if (!db) {
      throw new Error('Database connection is null');
    }
    
    try {
      const result = await db.getAllAsync(
        'SELECT * FROM Bible WHERE Book = ? AND Chapter = ? ORDER BY Verse',
        [bookId, chapterNumber]
      );
      
      return result.map((row: any) => ({
        id: parseInt(`${bookId}${chapterNumber.toString().padStart(3, '0')}${row.Verse.toString().padStart(3, '0')}`),
        bookId,
        chapterNumber,
        verseNumber: row.Verse,
        text: row.Scripture,
      }));
    } catch (error) {
      console.error('Error getting verses:', error);
      throw error;
    }
  }

  async searchVerses(bibleId: string, searchTerm: string, limit: number = 100): Promise<SearchResult[]> {
    const db = this.getBibleConnection(bibleId);
    
    // If it's the sample bible, return sample search results
    if (bibleId === 'sample-bible') {
      if (searchTerm.toLowerCase().includes('exemplo')) {
        return [
          {
            bookId: 1,
            bookName: 'Gênesis',
            chapterNumber: 1,
            verseNumber: 1,
            text: 'Este é um versículo de exemplo para demonstração do aplicativo ReadBible.',
            highlightedText: 'Este é um versículo de <mark>exemplo</mark> para demonstração do aplicativo ReadBible.',
          }
        ];
      }
      return [];
    }
    
    if (!db) {
      throw new Error('Database connection is null');
    }
    
    try {
      const books = await this.getBooks(bibleId);
      const bookMap = new Map(books.map(book => [book.id, book.name]));

      const searchPattern = `%${searchTerm}%`;
      const result = await db.getAllAsync(
        'SELECT Book, Chapter, Verse, Scripture FROM Bible WHERE Scripture LIKE ? LIMIT ?',
        [searchPattern, limit]
      );

      return result.map((row: any) => {
        const text = row.Scripture;
        const highlightedText = text.replace(
          new RegExp(searchTerm, 'gi'),
          (match: string) => `<mark>${match}</mark>`
        );

        return {
          bookId: row.Book,
          bookName: bookMap.get(row.Book) || `Book ${row.Book}`,
          chapterNumber: row.Chapter,
          verseNumber: row.Verse,
          text,
          highlightedText,
        };
      });
    } catch (error) {
      console.error('Error searching verses:', error);
      throw error;
    }
  }

  private getBookName(bookId: number): string {
    // Standard Bible book names in order
    const bookNames = [
      '', // 0 - placeholder
      'Gênesis', 'Êxodo', 'Levítico', 'Números', 'Deuteronômio', 'Josué', 'Juízes', 'Rute',
      '1 Samuel', '2 Samuel', '1 Reis', '2 Reis', '1 Crônicas', '2 Crônicas', 'Esdras', 'Neemias', 'Ester',
      'Jó', 'Salmos', 'Provérbios', 'Eclesiastes', 'Cantares', 'Isaías', 'Jeremias', 'Lamentações',
      'Ezequiel', 'Daniel', 'Oséias', 'Joel', 'Amós', 'Obadias', 'Jonas', 'Miquéias', 'Naum', 'Habacuque',
      'Sofonias', 'Ageu', 'Zacarias', 'Malaquias',
      'Mateus', 'Marcos', 'Lucas', 'João', 'Atos', 'Romanos', '1 Coríntios', '2 Coríntios', 'Gálatas',
      'Efésios', 'Filipenses', 'Colossenses', '1 Tessalonicenses', '2 Tessalonicenses', '1 Timóteo', '2 Timóteo',
      'Tito', 'Filemom', 'Hebreus', 'Tiago', '1 Pedro', '2 Pedro', '1 João', '2 João', '3 João', 'Judas', 'Apocalipse'
    ];
    
    return bookNames[bookId] || `Livro ${bookId}`;
  }

  private determineTestament(bookId: number): 'old' | 'new' {
    // Standard Bible book order: Old Testament books 1-39, New Testament books 40-66
    return bookId <= 39 ? 'old' : 'new';
  }

  async closeAllConnections(): Promise<void> {
    for (const [bibleId] of this.bibleConnections) {
      await this.closeBible(bibleId);
    }
  }
}

export default new BibleReaderService();