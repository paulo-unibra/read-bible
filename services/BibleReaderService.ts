import * as SQLite from 'expo-sqlite';
import { Book, Chapter, SearchResult, Verse } from '../types';
import googleDriveService from './GoogleDriveService';

export class BibleReaderService {
  private bibleConnections: Map<string, SQLite.SQLiteDatabase> = new Map();

  // Parse HTML verse content to extract text, notes, and verse references
  private parseVerseContent(htmlContent: string): { 
    text: string; 
    titles: {level: number, text: string}[];
    notes: string[]; 
    verseReferences: {text: string, reference: string, position: number}[];
    crossReferences: string[];
    strongNumbers: {type: 'greek' | 'hebrew', number: string, position: number}[];
    interlinear: {hebrew?: string, greek?: string, transliteration?: string, translation?: string}[];
    formatting: {type: 'italic' | 'bold' | 'underline' | 'jesus' | 'ot_quote' | 'strikethrough', start: number, end: number, text: string}[];
  } {
    if (!htmlContent) {
      return { text: '', titles: [], notes: [], verseReferences: [], crossReferences: [], strongNumbers: [], interlinear: [], formatting: [] };
    }

    const titles: { level: number; text: string }[] = [];
    const notes: string[] = [];
    const verseReferences: { text: string; reference: string; position: number }[] = [];
    const crossReferences: string[] = [];
    const strongNumbers: { type: 'greek' | 'hebrew'; number: string; position: number }[] = [];
    const interlinear: { hebrew?: string; greek?: string; transliteration?: string; translation?: string }[] = [];
    const formatting: { type: 'italic' | 'bold' | 'underline' | 'jesus' | 'ot_quote' | 'strikethrough'; start: number; end: number; text: string }[] = [];

    let work = htmlContent.replace(/\r\n?/g, '\n').replace(/\t+/g, ' ');

    // Extract titles (TS/TS1/TS2...) including optional introduction RF.
    const titleRegex = /<TS(\d*)?>(.*?)<Ts>/gis;
    work = work.replace(titleRegex, (full, lvl, inner) => {
      const level = lvl ? parseInt(lvl, 10) : 1;
      const introRF = inner.match(/<RF\s+q=([^>]+?)><Rf>/i);
      let introLabel: string | undefined;
      if (introRF) {
        const raw = introRF[1];
        const parts = raw.split('|');
        if (parts.length > 1 && /Introdução/i.test(parts[0])) introLabel = parts[0].trim();
        else if (/Introdução/i.test(raw)) introLabel = 'Introdução';
      }
      let main = inner.replace(/<RF[^>]*>.*?<Rf>/gis, ' ');
      const pipeIdx = main.indexOf('|');
      if (pipeIdx !== -1) main = main.slice(pipeIdx + 1);
      main = main.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (main) {
        titles.push({ level, text: introLabel ? `${introLabel} | ${main}` : main });
      }
      return ' ';
    });

    // Cross-reference groups (✚)
    interface CrossRefGroup { references: { text: string; reference: string }[] }
    const crossRefGroups: CrossRefGroup[] = [];
    work = work.replace(/<sup><RF\s+q=✜>(.*?)<Rf><\/sup>/gis, (_f, inside) => {
      const group: CrossRefGroup = { references: [] };
      const linkRegex = /<a[^>]*href='b([^']+)'[^>]*>(.*?)<\/a>/gi;
      let lm: RegExpExecArray | null;
      while ((lm = linkRegex.exec(inside)) !== null) {
        const ref = lm[1].trim();
        const text = lm[2].replace(/<[^>]+>/g, '').trim();
        if (ref && text) group.references.push({ text, reference: ref });
      }
      if (group.references.length) crossRefGroups.push(group);
      return '✚';
    });

    // Commentary / translator notes ℕ (sup form)
    work = work.replace(/<sup><RF\s+q=ℕ>(.*?)<Rf><\/sup>/gis, (_f, inner) => {
      const cleaned = inner.replace(/<p>/gi, '\n').replace(/<\/p>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleaned) notes.push(cleaned);
      return 'ℕ';
    });

    // Generic RF (non-cross/non-commentary/intro)
    work = work.replace(/<RF(\s+q=([^>]*?))?>(.*?)<Rf>/gis, (_f, _afull, qVal, inner) => {
      const q = (qVal || '').trim();
      if (/✜|ℕ|Introdução/i.test(q)) return ' ';
      const cleaned = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleaned) notes.push(q ? `[${q}] ${cleaned}` : cleaned);
      return 'ℕ';
    });

    // Interlinear blocks
    work = work.replace(/<Q>(.*?)<q>/gis, (_full, block) => {
      const item: { hebrew?: string; greek?: string; transliteration?: string; translation?: string } = {};
      const extract = (re: RegExp) => { const m = block.match(re); return m ? m[1].trim() : undefined; };
      item.hebrew = extract(/<H>(.*?)<h>/is);
      item.greek = extract(/<G>(.*?)<g>/is);
      item.transliteration = extract(/<X>(.*?)<x>/is);
      item.translation = extract(/<(?:E|T)>(.*?)<\/?[A-Za-z]/is);
      Object.keys(item).forEach(k => { const key = k as keyof typeof item; if (item[key]) item[key] = item[key]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); });
      interlinear.push(item);
      return ' ';
    });

    // Simple RX cross refs
    work = work.replace(/<RX([^>]+)>/gi, (_f, rx) => { const ref = rx.trim(); if (ref) crossReferences.push(ref); return ' '; });

    // Build final text scanning tags to capture formatting & Strong's positions.
    const tagRegex = /<[^>]+>/g;
    let lastIndex = 0;
    let finalText = '';
    interface OpenFmt { type: 'italic' | 'bold' | 'underline' | 'jesus' | 'ot_quote' | 'strikethrough'; start: number; tag: string }
    const fmtStack: OpenFmt[] = [];

    const pushPlain = (seg: string) => {
      if (!seg) return;
      for (let i = 0; i < seg.length; i++) {
        const ch = seg[i];
        if (/\s/.test(ch)) {
          if (finalText.length === 0 || finalText[finalText.length - 1] === ' ') continue;
          finalText += ' ';
        } else {
          finalText += ch;
        }
      }
    };

    const mapOpenType = (tag: string): OpenFmt['type'] | undefined => {
      const name = tag.replace(/[<>]/g, '').split(/\s+/)[0];
      switch (name.toUpperCase()) {
        case 'FI':
        case 'I': return 'italic';
        case 'B': return 'bold';
        case 'FU':
        case 'U': return 'underline';
        case 'FR': return 'jesus';
        case 'FO': return 'ot_quote';
        case 'S': return 'strikethrough';
        default: return undefined;
      }
    };
    const isClosing = (tag: string, type: OpenFmt['type']): boolean => {
      const t = tag.replace(/[<>]/g, '');
      switch (type) {
        case 'italic': return /^(Fi|\/i)$/i.test(t);
        case 'bold': return /^(\/b)$/i.test(t);
        case 'underline': return /^(Fu|\/u)$/i.test(t);
        case 'jesus': return /^Fr$/i.test(t);
        case 'ot_quote': return /^Fo$/i.test(t);
        case 'strikethrough': return /^(\/s)$/i.test(t);
      }
    };

    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(work)) !== null) {
      const tag = match[0];
      pushPlain(work.slice(lastIndex, match.index));
      lastIndex = match.index + tag.length;

      if (/^<WG\d+>$/i.test(tag)) { const num = tag.match(/<WG(\d+)>/i)![1]; strongNumbers.push({ type: 'greek', number: num, position: finalText.length }); continue; }
      if (/^<WH\d+>$/i.test(tag)) { const num = tag.match(/<WH(\d+)>/i)![1]; strongNumbers.push({ type: 'hebrew', number: num, position: finalText.length }); continue; }
      if (/^<CM>$/i.test(tag) || /^<CI>$/i.test(tag)) { pushPlain(' '); continue; }
      if (/^<PI\d+>$/i.test(tag) || /^<PF\d+>$/i.test(tag) || /^<WT/i.test(tag)) { continue; }
      const openType = mapOpenType(tag);
      if (openType) { fmtStack.push({ type: openType, start: finalText.length, tag }); continue; }
      for (let i = fmtStack.length - 1; i >= 0; i--) {
        if (isClosing(tag, fmtStack[i].type)) {
          const open = fmtStack.splice(i, 1)[0];
          formatting.push({ type: open.type, start: open.start, end: finalText.length, text: '' });
          break;
        }
      }
    }
    pushPlain(work.slice(lastIndex));

    if (fmtStack.length) {
      fmtStack.forEach(f => formatting.push({ type: f.type, start: f.start, end: finalText.length, text: '' }));
    }
    formatting.forEach(f => { f.text = finalText.slice(f.start, f.end); });

    finalText = finalText.replace(/\s+/g, ' ').trim();

    // After final text built, map cross-ref groups to each ✚ (position search)
    if (titles.length) {
      // Already extracted; no extra processing
    }
    // Re-scan for ✚ positions
    if (Array.isArray((crossRefGroups as any)) && (crossRefGroups as any).length) {
      let cursor = 0;
      for (let i = 0; i < finalText.length && cursor < (crossRefGroups as any).length; i++) {
        if (finalText[i] === '✚') {
          const grp = (crossRefGroups as any)[cursor++];
          grp.references.forEach((r: any) => verseReferences.push({ text: r.text, reference: r.reference, position: i }));
        }
      }
    }

    return { text: finalText, titles, notes, verseReferences, crossReferences, strongNumbers, interlinear, formatting };
  }

  async openBible(bibleId: string, fileName: string): Promise<void> {
    try {
      if (this.bibleConnections.has(bibleId)) {
        return; // Already open
      }
      if (bibleId === 'sample-bible') {
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
    console.log("CARREGOU O BANCO")
    
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

      return result.map((row: any) => {
        const parsedContent = this.parseVerseContent(row.Scripture);

        return {
          id: parseInt(`${bookId}${chapterNumber.toString().padStart(3, '0')}${row.Verse.toString().padStart(3, '0')}`),
          bookId,
          chapterNumber,
          verseNumber: row.Verse,
          text: parsedContent.text,
          titles: parsedContent.titles.length > 0 ? parsedContent.titles : undefined,
          notes: parsedContent.notes.length > 0 ? parsedContent.notes : undefined,
          verseReferences: parsedContent.verseReferences.length > 0 ? parsedContent.verseReferences : undefined,
          crossReferences: parsedContent.crossReferences.length > 0 ? parsedContent.crossReferences : undefined,
          strongNumbers: parsedContent.strongNumbers.length > 0 ? parsedContent.strongNumbers : undefined,
          interlinear: parsedContent.interlinear.length > 0 ? parsedContent.interlinear : undefined,
          formatting: parsedContent.formatting.length > 0 ? parsedContent.formatting : undefined,
        };
      });
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
        const parsedContent = this.parseVerseContent(row.Scripture);
        const cleanText = parsedContent.text;
        const highlightedText = cleanText.replace(
          new RegExp(searchTerm, 'gi'),
          (match: string) => `<mark>${match}</mark>`
        );

        return {
          bookId: row.Book,
          bookName: bookMap.get(row.Book) || `Book ${row.Book}`,
          chapterNumber: row.Chapter,
          verseNumber: row.Verse,
          text: cleanText,
          highlightedText,
        };
      });
    } catch (error) {
      console.error('Error searching verses:', error);
      throw error;
    }
  }

  async getVerseByReference(bibleId: string, reference: string): Promise<Verse | null> {
    // Parse reference like "Pv 8:23" or "Sl 33:6"
    const refMatch = reference.match(/^([A-Za-z0-9\s]+)\s(\d+):(\d+)$/);
    if (!refMatch) return null;

    const bookAbbr = refMatch[1].trim();
    const chapterNumber = parseInt(refMatch[2]);
    const verseNumber = parseInt(refMatch[3]);

    // Simple book abbreviation mapping
    const bookMap: {[key: string]: number} = {
      'Gn': 1, 'Ex': 2, 'Lv': 3, 'Nm': 4, 'Dt': 5,
      'Pv': 20, 'Sl': 19, 'Is': 23, 'Jr': 24, 'Hb': 58,
      'At': 44, 'Rm': 45, 'Cl': 51, 'Zc': 38
    };

    const bookId = bookMap[bookAbbr];
    if (!bookId) return null;

    const db = this.getBibleConnection(bibleId);
    if (!db) return null;

    try {
      const result = await db.getAllAsync(
        'SELECT * FROM Bible WHERE Book = ? AND Chapter = ? AND Verse = ? LIMIT 1',
        [bookId, chapterNumber, verseNumber]
      );

      if (result.length === 0) return null;

      const row = result[0] as any;
      const parsedContent = this.parseVerseContent(row.Scripture);

      return {
        id: parseInt(`${bookId}${chapterNumber.toString().padStart(3, '0')}${row.Verse.toString().padStart(3, '0')}`),
        bookId,
        chapterNumber,
        verseNumber: row.Verse,
        text: parsedContent.text,
        titles: parsedContent.titles.length > 0 ? parsedContent.titles : undefined,
        notes: parsedContent.notes.length > 0 ? parsedContent.notes : undefined,
        verseReferences: parsedContent.verseReferences.length > 0 ? parsedContent.verseReferences : undefined,
        crossReferences: parsedContent.crossReferences.length > 0 ? parsedContent.crossReferences : undefined,
        strongNumbers: parsedContent.strongNumbers.length > 0 ? parsedContent.strongNumbers : undefined,
        interlinear: parsedContent.interlinear.length > 0 ? parsedContent.interlinear : undefined,
        formatting: parsedContent.formatting.length > 0 ? parsedContent.formatting : undefined,
      };
    } catch (error) {
      console.error('Error getting verse by reference:', error);
      return null;
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