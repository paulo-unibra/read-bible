import * as SQLite from 'expo-sqlite';
import { Book, BookIntroduction, Chapter, SearchResult, Verse } from '../types';
import googleDriveService from './GoogleDriveService';

export class BibleReaderService {
  private bibleConnections: Map<string, SQLite.SQLiteDatabase> = new Map();

  // Parse HTML verse content to extract text, notes, and verse references
  private parseVerseContent(htmlContent: string): { 
    text: string; 
    verseOnlyText: string; // texto sem notas (exclui conteúdo e marcadores de notas)
    verseSearchText: string; // texto para busca (sem notas, símbolos de refs, strong numbers, duplicação de espaços)
    titles: {level: number, text: string}[];
    notes: string[]; 
    verseReferences: {text: string, reference: string, position: number}[];
    crossReferences: string[];
    strongNumbers: {type: 'greek' | 'hebrew', number: string, position: number}[];
    interlinear: {hebrew?: string, greek?: string, transliteration?: string, translation?: string}[];
    formatting: {type: 'italic' | 'bold' | 'underline' | 'jesus' | 'ot_quote' | 'strikethrough', start: number, end: number, text: string}[];
  } {
    if (!htmlContent) {
      return { text: '', verseOnlyText: '', verseSearchText: '', titles: [], notes: [], verseReferences: [], crossReferences: [], strongNumbers: [], interlinear: [], formatting: [] };
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

    // Cross-reference groups (✚) - allow with or without <sup> wrapper
    interface CrossRefGroup { references: { text: string; reference: string }[] }
    const crossRefGroups: CrossRefGroup[] = [];
    work = work.replace(/(?:<sup>)?<RF\s+q=✜>(.*?)<Rf>(?:<\/sup>)?/gis, (_f, inside) => {
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

    const verseOnlyText = finalText.replace(/[ℕ]/g, ' ').replace(/\s+/g, ' ').trim();
    // Versão para busca: remove símbolos de notas, cruzetas, números fortes G/H, e colchetes residuais
    const verseSearchText = verseOnlyText
      .replace(/[✚]/g, ' ') // remove símbolo de referência cruzada
      .replace(/\bG\d+\b/gi, ' ') // strong patterns greek
      .replace(/\bH\d+\b/gi, ' ') // strong patterns hebrew
      .replace(/\[[^\]]+\]/g, ' ') // possíveis marcações de notas remanescentes
      .replace(/\s+/g, ' ').trim();
    return { text: finalText, verseOnlyText, verseSearchText, titles, notes, verseReferences, crossReferences, strongNumbers, interlinear, formatting };
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
        text: 'Este é um versículo de exemplo para demonstração do aplicativo Bíblia em Foco.'
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
      
      const chapters = result.map((row: any, index: number) => ({
        id: index + 1,
        bookId,
        chapterNumber: row.Chapter,
        versesCount: 0, // Will be calculated later if needed
      }));

      // Verificar se existe introdução para este livro
      const introduction = await this.getBookIntroduction(bibleId, bookId);
      
      if (introduction) {
        chapters.unshift({
          id: 0,
          bookId,
          chapterNumber: 0,
          versesCount: 1, // A introdução conta como 1 "versículo"
        });
      }
      
      return chapters;
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
      // Se o capítulo for 0, retornar a introdução
      if (chapterNumber === 0) {
        const introduction = await this.getBookIntroduction(bibleId, bookId);
        if (introduction) {
          // Para introdução, retornar o HTML original do campo 'data' sem limpeza
          // O IntroductionRenderer irá processar o HTML adequadamente
          
          return [{
            id: parseInt(`${bookId}000000`), // ID especial para introdução
            bookId,
            chapterNumber: 0,
            verseNumber: 0,
            text: introduction.data,
            titles: [{ level: 1, text: 'Introdução' }],
            notes: undefined,
            verseReferences: undefined,
            crossReferences: undefined,
            strongNumbers: undefined,
            interlinear: undefined,
            formatting: undefined,
          }];
        }
        return [];
      }

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

  async searchVerses(bibleId: string, searchTerm: string, limit: number = 1000): Promise<SearchResult[]> {
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
            text: 'Este é um versículo de exemplo para demonstração do aplicativo Bíblia em Foco.',
            highlightedText: 'Este é um versículo de <mark>exemplo</mark> para demonstração do aplicativo Bíblia em Foco.',
          }
        ];
      }
      return [];
    }
    
    if (!db) {
      throw new Error('Database connection is null');
    }
    
    try {
  const termOriginal = searchTerm.trim();
  if (!termOriginal) return [];
  const lowerOriginal = termOriginal.toLowerCase(); // preserva acentos para LIKE primário
  // Versão normalizada (sem acentos / símbolos) para matching interno
  const termNorm = this.cleanForSearch(termOriginal);
  if (!termNorm) return [];
  const termWords = termNorm.split(' ').filter(Boolean);
      const books = await this.getBooks(bibleId);
      const bookMap = new Map(books.map(book => [book.id, book.name]));

      // Tamanho dinâmico de pool de candidatos: termos curtos exigem mais versos para filtrar depois
  const isSingleWord = termWords.length === 1;
  const baseMultiplier = termNorm.length <= 5 ? 20 : 5;
  // Para palavra única muito curta, pegar praticamente tudo de cara para não perder ocorrências raras
  let rawLimit = (isSingleWord && termNorm.length <= 5) ? 40000 : limit * baseMultiplier;
      const searchPatternOriginal = `%${lowerOriginal}%`;
      let candidates = await db.getAllAsync(
        'SELECT Book, Chapter, Verse, Scripture FROM Bible WHERE LOWER(Scripture) LIKE ? LIMIT ?',
        [searchPatternOriginal, rawLimit]
      );

      // Fallback: se nada veio (talvez por PRAGMA case_sensitive_like ou diacríticos não removidos no banco), buscar mais amplo
      if (candidates.length === 0) {
        // Fallback total: carrega todos os versos (31k aprox) e filtra em memória com normalização
        rawLimit = 40000; // acima do total de versos típico
        candidates = await db.getAllAsync(
          'SELECT Book, Chapter, Verse, Scripture FROM Bible LIMIT ?',
          [rawLimit]
        );
      }

      let scored = candidates.map((row: any) => {
        const parsed = this.parseVerseContent(row.Scripture);
        const verseDisplay = parsed.text; // manter texto completo (pode mostrar notas/ símbolos se necessários visualmente)
        const searchBase = (parsed.verseSearchText || parsed.verseOnlyText || parsed.text);
        const norm = this.cleanForSearch(searchBase);

        // Critério principal: substring direta (LIKE) no texto normalizado
        if (!norm.includes(termNorm)) {
          // Tentar padrão flexível (aceita símbolos entre palavras) apenas se múltiplas palavras
          if (termWords.length > 1) {
            const flex = this.buildFlexibleMultiWordPattern(termWords);
            if (!flex.test(verseDisplay)) return null;
          } else {
            return null;
          }
        }

        // Contagem de ocorrências para ranque
        let occurrences = 0;
        if (norm.includes(termNorm)) {
          const reOcc = new RegExp(this.escapeRegExp(termNorm), 'g');
            const tmp = norm.match(reOcc);
          occurrences = tmp ? tmp.length : 1;
        }

        // Posição da primeira ocorrência (quanto mais cedo, melhor)
        const firstIdx = norm.indexOf(termNorm);
        const positionScore = firstIdx >= 0 ? Math.max(0, 500 - firstIdx) : 0;

        // Highlight: tentar padrão flexível multi-palavra primeiro
        let highlightedText = verseDisplay;
        if (termWords.length > 1) {
          const flexPattern = this.buildFlexibleMultiWordPattern(termWords);
          highlightedText = highlightedText.replace(flexPattern, (m: string) => `<mark>${m}</mark>`);
        }
        // Se nada marcado ainda, marcar substring(s) direta(s) aproximadas
        if (!/<mark>/.test(highlightedText)) {
          highlightedText = highlightedText.replace(new RegExp(this.escapeRegExp(termOriginal), 'gi'), m => `<mark>${m}</mark>`);
        }
        // Se ainda não marcou (por símbolos no meio), marcar cada palavra separada
        if (!/<mark>/.test(highlightedText)) {
          highlightedText = termWords.reduce((acc, w) => acc.replace(new RegExp(this.escapeRegExp(w), 'gi'), mm => `<mark>${mm}</mark>`), highlightedText);
        }

  const score = occurrences * 400 + positionScore;

        return {
          bookId: row.Book,
          bookName: bookMap.get(row.Book) || `Book ${row.Book}`,
          chapterNumber: row.Chapter,
          verseNumber: row.Verse,
          text: verseDisplay,
          highlightedText,
          _score: score,
          _stats: { occurrences, firstIdx }
        } as SearchResult & { _score: number; _stats: any };
      })
      .filter((r): r is SearchResult & { _score: number; _stats: any } => !!r)
      .sort((a, b) => b._score - a._score)
      .slice(0, limit)
      .map(({ _score, _stats, ...rest }) => rest);

      // Fallback adicional: se nada encontrado para palavra única curta, fazer varredura completa filtrando norma
      if (scored.length === 0 && isSingleWord && termNorm.length <= 6) {
        try {
          const allRows = await db.getAllAsync('SELECT Book, Chapter, Verse, Scripture FROM Bible');
          scored = allRows.map((row: any) => {
            const parsed = this.parseVerseContent(row.Scripture);
            const verseDisplay = parsed.text;
            const searchBase = parsed.verseSearchText || parsed.verseOnlyText || parsed.text;
            const norm = this.cleanForSearch(searchBase);
            if (!norm.includes(termNorm)) return null;
            const firstIdx = norm.indexOf(termNorm);
            const occurrences = (norm.match(new RegExp(this.escapeRegExp(termNorm), 'g')) || []).length;
            let highlightedText = verseDisplay.replace(new RegExp(this.escapeRegExp(termOriginal), 'gi'), m => `<mark>${m}</mark>`);
            if (!/<mark>/.test(highlightedText)) {
              highlightedText = highlightedText.replace(new RegExp(this.escapeRegExp(termNorm), 'gi'), m => `<mark>${m}</mark>`);
            }
            const score = occurrences * 400 + Math.max(0, 500 - firstIdx);
            return {
              bookId: row.Book,
              bookName: bookMap.get(row.Book) || `Book ${row.Book}`,
              chapterNumber: row.Chapter,
              verseNumber: row.Verse,
              text: verseDisplay,
              highlightedText,
              _score: score,
              _stats: { occurrences, firstIdx }
            } as SearchResult & { _score: number; _stats: any };
          })
          .filter((r): r is SearchResult & { _score: number; _stats: any } => !!r)
          .sort((a, b) => b._score - a._score)
          .slice(0, limit)
          .map(({ _score, _stats, ...rest }) => rest);
        } catch (e) {
          console.warn('Fallback full scan search failed:', e);
        }
      }

      return scored;
    } catch (error) {
      console.error('Error searching verses:', error);
      throw error;
    }
  }

  // Utilidades de similaridade / normalização
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\s+/g, ' ') // espaços simples
      .trim();
  }

  // Remove símbolos/pontuação usados no texto bíblico que não devem afetar a busca
  private cleanForSearch(text: string): string {
    return this.normalizeText(
      text
        .replace(/[+✚ℕ*·.,;:!?'"“”‘’()\[\]{}<>\-—–_/|\\^§@#$%&=~`]+/g, ' ')
    ).replace(/\s+/g, ' ');
  }

  private buildFlexibleMultiWordPattern(words: string[]): RegExp {
    if (words.length === 0) return /$a/; // nunca casa
    const sym = "[+✚ℕ*·.,;:!?\\'\"“”‘’()\[\]{}<>\-—–_/|\\^§@#$%&=~`]*"; // símbolos a ignorar entre letras
    const parts = words.map(w => this.escapeRegExp(w));
    // Permite qualquer combinação de espaços ou símbolos entre palavras
    const pattern = parts.join(`${sym}(?:\s+${sym})?`);
    return new RegExp(pattern, 'gi');
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    const al = a.length, bl = b.length;
    if (al === 0) return bl; if (bl === 0) return al;
    const dp = new Array(bl + 1);
    for (let j = 0; j <= bl; j++) dp[j] = j;
    for (let i = 1; i <= al; i++) {
      let prev = i - 1;
      dp[0] = i;
      for (let j = 1; j <= bl; j++) {
        const tmp = dp[j];
        dp[j] = a[i - 1] === b[j - 1]
          ? prev
          : Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
        prev = tmp;
      }
    }
    return dp[bl];
  }

  async getVerseByReference(bibleId: string, reference: string): Promise<Verse | null> {
    console.log('getVerseByReference called with:', reference);
    
    // Parse reference - supports multiple formats:
    // "Pv 8:23" (single verse)
    // "Ap 12:10-11" (range with hyphen)
    // "Ap 12:10,11" (range with comma)
    const singleVerseMatch = reference.match(/^([A-Za-zÀ-ÿ0-9\s]+)\s(\d+):(\d+)$/);
    const verseRangeHyphenMatch = reference.match(/^([A-Za-zÀ-ÿ0-9\s]+)\s(\d+):(\d+)-(\d+)$/);
    const verseRangeCommaMatch = reference.match(/^([A-Za-zÀ-ÿ0-9\s]+)\s(\d+):(\d+),(\d+)$/);
    
    let bookAbbr: string;
    let chapterNumber: number;
    let startVerse: number;
    let endVerse: number;
    
    if (verseRangeHyphenMatch) {
      // Range with hyphen: "Ap 12:10-11"
      bookAbbr = verseRangeHyphenMatch[1].trim();
      chapterNumber = parseInt(verseRangeHyphenMatch[2]);
      startVerse = parseInt(verseRangeHyphenMatch[3]);
      endVerse = parseInt(verseRangeHyphenMatch[4]);
      console.log('Parsed verse range (hyphen):', { bookAbbr, chapterNumber, startVerse, endVerse });
    } else if (verseRangeCommaMatch) {
      // Range with comma: "Ap 12:10,11"
      bookAbbr = verseRangeCommaMatch[1].trim();
      chapterNumber = parseInt(verseRangeCommaMatch[2]);
      startVerse = parseInt(verseRangeCommaMatch[3]);
      endVerse = parseInt(verseRangeCommaMatch[4]);
      console.log('Parsed verse range (comma):', { bookAbbr, chapterNumber, startVerse, endVerse });
    } else if (singleVerseMatch) {
      // Single verse: "Pv 8:23"
      bookAbbr = singleVerseMatch[1].trim();
      chapterNumber = parseInt(singleVerseMatch[2]);
      startVerse = parseInt(singleVerseMatch[3]);
      endVerse = startVerse;
      console.log('Parsed single verse:', { bookAbbr, chapterNumber, verseNumber: startVerse });
    } else {
      console.warn('Reference format not matched:', reference);
      return null;
    }

    // Complete book abbreviation mapping
    const bookMap: {[key: string]: number} = {
      // Antigo Testamento
      'Gn': 1, 'Êx': 2, 'Ex': 2, 'Lv': 3, 'Nm': 4, 'Dt': 5,
      'Js': 6, 'Jz': 7, 'Rt': 8,
      '1Sm': 9, '2Sm': 10, '1Rs': 11, '2Rs': 12,
      '1Cr': 13, '2Cr': 14, 'Ed': 15, 'Ne': 16, 'Et': 17,
      'Jó': 18, 'Sl': 19, 'Pv': 20, 'Ec': 21, 'Ct': 22,
      'Is': 23, 'Jr': 24, 'Lm': 25, 'Ez': 26, 'Dn': 27,
      'Os': 28, 'Jl': 29, 'Am': 30, 'Ob': 31, 'Jn': 32,
      'Mq': 33, 'Na': 34, 'Hc': 35, 'Sf': 36, 'Ag': 37,
      'Zc': 38, 'Ml': 39,
      // Novo Testamento
      'Mt': 40, 'Mc': 41, 'Lc': 42, 'Jo': 43, 'João': 43, 'At': 44,
      'Rm': 45, '1Co': 46, '2Co': 47, 'Gl': 48, 'Ef': 49,
      'Fp': 50, 'Cl': 51, '1Ts': 52, '2Ts': 53,
      '1Tm': 54, '2Tm': 55, 'Tt': 56, 'Fm': 57,
      'Hb': 58, 'Tg': 59, '1Pe': 60, '2Pe': 61,
      '1Jo': 62, '2Jo': 63, '3Jo': 64, 'Jd': 65, 'Ap': 66, 'Apc': 66, 'Apocalipse': 66
    };

    const bookId = bookMap[bookAbbr];
    if (!bookId) {
      console.warn(`Book abbreviation not found: ${bookAbbr}`);
      return null;
    }

    const db = this.getBibleConnection(bibleId);
    if (!db) return null;

    try {
      // Fetch verses in the range
      const result = await db.getAllAsync(
        'SELECT * FROM Bible WHERE Book = ? AND Chapter = ? AND Verse >= ? AND Verse <= ? ORDER BY Verse',
        [bookId, chapterNumber, startVerse, endVerse]
      );

      if (result.length === 0) return null;

      // Combine all verses in the range
      let combinedText = '';
      let allTitles: string[] = [];
      let allNotes: string[] = [];
      let allReferences: Array<{ text: string; reference: string; position: number }> = [];
      let allCrossReferences: string[] = [];
      
      result.forEach((row: any, index) => {
        const parsedContent = this.parseVerseContent(row.Scripture);
        
        // Add verse number prefix for multi-verse ranges
        if (result.length > 1) {
          combinedText += `${row.Verse}. ${parsedContent.text} `;
        } else {
          combinedText += parsedContent.text;
        }
        
        // Collect all metadata
        if (parsedContent.titles.length > 0) allTitles.push(...parsedContent.titles);
        if (parsedContent.notes.length > 0) allNotes.push(...parsedContent.notes);
        if (parsedContent.verseReferences.length > 0) allReferences.push(...parsedContent.verseReferences);
        if (parsedContent.crossReferences.length > 0) allCrossReferences.push(...parsedContent.crossReferences);
      });

      const firstRow = result[0] as any;
      return {
        id: parseInt(`${bookId}${chapterNumber.toString().padStart(3, '0')}${firstRow.Verse.toString().padStart(3, '0')}`),
        bookId,
        chapterNumber,
        verseNumber: startVerse, // Use the start verse as the main verse number
        text: combinedText.trim(),
        titles: allTitles.length > 0 ? allTitles : undefined,
        notes: allNotes.length > 0 ? allNotes : undefined,
        verseReferences: allReferences.length > 0 ? allReferences : undefined,
        crossReferences: allCrossReferences.length > 0 ? allCrossReferences : undefined,
        strongNumbers: undefined,
        interlinear: undefined,
        formatting: undefined,
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

  async getBookIntroduction(bibleId: string, bookId: number): Promise<BookIntroduction | null> {
    const db = this.getBibleConnection(bibleId);
    
    // Se for a bíblia de exemplo, não tem introdução
    if (bibleId === 'sample-bible' || !db) {
      return null;
    }

    try {
      // Primeiro verifica se a tabela 'dictionary' existe
      const tableExists = await db.getFirstAsync(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='dictionary'"
      );
      
      if (!tableExists) {
        return null;
      }

      // Buscar o nome do livro pelo bookId
      const bookName = this.getBookName(bookId);
      
      // Tentar várias variações do nome do livro para encontrar na tabela dictionary
      const bookVariations = this.getBookVariations(bookName);
      
      for (const variation of bookVariations) {
        const result = await db.getFirstAsync(
          'SELECT word, data FROM dictionary WHERE UPPER(word) = UPPER(?)',
          [variation]
        );
        
        if (result) {
          // Retornar HTML original sem limpeza para renderização pelo componente
          return {
            bookId,
            word: (result as any).word,
            data: (result as any).data
          };
        }
      }
      
      // Se não encontrou com as variações exatas, tentar busca com LIKE
      const likeResult = await db.getFirstAsync(
        'SELECT word, data FROM dictionary WHERE UPPER(word) LIKE ?',
        [`%${bookName.toUpperCase()}%`]
      );
      
      if (likeResult) {
        // Retornar HTML original sem limpeza para renderização pelo componente
        return {
          bookId,
          word: (likeResult as any).word,
          data: (likeResult as any).data
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting book introduction:', error);
      return null;
    }
  }

  private getBookVariations(bookName: string): string[] {
    // Gerar várias variações do nome do livro para tentar encontrar na tabela dictionary
    const variations = [bookName.toUpperCase()];
    
    // Remover números e espaços para livros como "1 Samuel" -> "SAMUEL"
    const withoutNumbers = bookName.replace(/^\d+\s+/, '').toUpperCase();
    if (withoutNumbers !== bookName.toUpperCase()) {
      variations.push(withoutNumbers);
    }
    
    // Versão sem acentos
    const withoutAccents = bookName
      .toUpperCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');
    variations.push(withoutAccents);
    
    // Mapeamento específico para nomes comuns (incluindo variações)
    const nameMap: {[key: string]: string[]} = {
      'GÊNESIS': ['GENESIS', 'GN', 'GEN'],
      'ÊXODO': ['EXODO', 'EX'],
      'LEVÍTICO': ['LEVITICO', 'LV', 'LEV'],
      'NÚMEROS': ['NUMEROS', 'NM', 'NUM'],
      'DEUTERONÔMIO': ['DEUTERONOMIO', 'DT', 'DEU'],
      'JOSUÉ': ['JOSUE', 'JS', 'JOS'],
      'JUÍZES': ['JUIZES', 'JZ', 'JUZ'],
      'RUTE': ['RT', 'RUT'],
      '1 SAMUEL': ['SAMUEL', '1SAMUEL', '1SM', '1 SM', 'I SAMUEL'],
      '2 SAMUEL': ['SAMUEL', '2SAMUEL', '2SM', '2 SM', 'II SAMUEL'],
      '1 REIS': ['REIS', '1REIS', '1RS', '1 RS', 'I REIS'],
      '2 REIS': ['REIS', '2REIS', '2RS', '2 RS', 'II REIS'],
      '1 CRÔNICAS': ['CRONICAS', '1CRONICAS', '1CR', '1 CR', 'I CRONICAS'],
      '2 CRÔNICAS': ['CRONICAS', '2CRONICAS', '2CR', '2 CR', 'II CRONICAS'],
      'ESDRAS': ['ED', 'ESR'],
      'NEEMIAS': ['NE', 'NEE'],
      'ESTER': ['ET', 'EST'],
      'JÓ': ['JO', 'JOB'],
      'SALMOS': ['SALMO', 'SL', 'SAL', 'PS'],
      'PROVÉRBIOS': ['PROVERBIOS', 'PV', 'PRO'],
      'ECLESIASTES': ['ECLESIASTES', 'EC', 'ECL'],
      'CANTARES': ['CANTICOS', 'CANTICO DOS CANTICOS', 'CT', 'CAN'],
      'ISAÍAS': ['ISAIAS', 'IS', 'ISA'],
      'JEREMIAS': ['JR', 'JER'],
      'LAMENTAÇÕES': ['LAMENTACOES', 'LM', 'LAM'],
      'EZEQUIEL': ['EZ', 'EZE'],
      'DANIEL': ['DN', 'DAN'],
      'OSÉIAS': ['OSEIAS', 'OS', 'OSE'],
      'JOEL': ['JL', 'JOE'],
      'AMÓS': ['AMOS', 'AM', 'AMO'],
      'OBADIAS': ['OB', 'OBD'],
      'JONAS': ['JN', 'JON'],
      'MIQUÉIAS': ['MIQUEIAS', 'MQ', 'MIQ'],
      'NAUM': ['NA', 'NAU'],
      'HABACUQUE': ['HC', 'HAB'],
      'SOFONIAS': ['SF', 'SOF'],
      'AGEU': ['AG', 'AGE'],
      'ZACARIAS': ['ZC', 'ZAC'],
      'MALAQUIAS': ['ML', 'MAL'],
      'MATEUS': ['MT', 'MAT'],
      'MARCOS': ['MC', 'MAR'],
      'LUCAS': ['LC', 'LUC'],
      'JOÃO': ['JOAO', 'JO', 'JOA'],
      'ATOS': ['AT', 'ACT'],
      'ROMANOS': ['RM', 'ROM'],
      '1 CORÍNTIOS': ['CORINTIOS', '1CORINTIOS', '1CO', '1 CO', 'I CORINTIOS'],
      '2 CORÍNTIOS': ['CORINTIOS', '2CORINTIOS', '2CO', '2 CO', 'II CORINTIOS'],
      'GÁLATAS': ['GALATAS', 'GL', 'GAL'],
      'EFÉSIOS': ['EFESIOS', 'EF', 'EFE'],
      'FILIPENSES': ['FL', 'FIL'],
      'COLOSSENSES': ['CL', 'COL'],
      '1 TESSALONICENSES': ['TESSALONICENSES', '1TESSALONICENSES', '1TS', '1 TS', 'I TESSALONICENSES'],
      '2 TESSALONICENSES': ['TESSALONICENSES', '2TESSALONICENSES', '2TS', '2 TS', 'II TESSALONICENSES'],
      '1 TIMÓTEO': ['TIMOTEO', '1TIMOTEO', '1TM', '1 TM', 'I TIMOTEO'],
      '2 TIMÓTEO': ['TIMOTEO', '2TIMOTEO', '2TM', '2 TM', 'II TIMOTEO'],
      'TITO': ['TT', 'TIT'],
      'FILEMOM': ['FM', 'FIL'],
      'HEBREUS': ['HB', 'HEB'],
      'TIAGO': ['TG', 'TIA'],
      '1 PEDRO': ['PEDRO', '1PEDRO', '1PE', '1 PE', 'I PEDRO'],
      '2 PEDRO': ['PEDRO', '2PEDRO', '2PE', '2 PE', 'II PEDRO'],
      '1 JOÃO': ['JOAO', '1JOAO', '1JO', '1 JO', 'I JOAO'],
      '2 JOÃO': ['JOAO', '2JOAO', '2JO', '2 JO', 'II JOAO'], 
      '3 JOÃO': ['JOAO', '3JOAO', '3JO', '3 JO', 'III JOAO'],
      'JUDAS': ['JD', 'JUD'],
      'APOCALIPSE': ['AP', 'APO', 'REV']
    };
    
    const upperBookName = bookName.toUpperCase();
    if (nameMap[upperBookName]) {
      variations.push(...nameMap[upperBookName]);
    }
    
    // Adicionar versões sem acentos das variações mapeadas
    if (nameMap[upperBookName]) {
      const accentFreeVariations = nameMap[upperBookName].map(v => 
        v.normalize('NFD').replace(/\p{Diacritic}/gu, '')
      );
      variations.push(...accentFreeVariations);
    }
    
    return [...new Set(variations)]; // Remove duplicatas
  }

  /**
   * Busca a referência cruzada para um versículo específico
   */
  async getCrossReference(bibleId: string, bookName: string, chapterNumber: number, verseNumber: number): Promise<string | null> {
    try {
      const db = this.bibleConnections.get(bibleId);
      if (!db) {
        throw new Error(`Bíblia ${bibleId} não está aberta`);
      }

      // Buscar o livro pelo nome
      const books = await this.getBooks(bibleId);
      const book = books.find(b => b.name.toLowerCase() === bookName.toLowerCase());
      
      if (!book) {
        console.warn(`Livro não encontrado: ${bookName}`);
        return null;
      }

      // Buscar o versículo completo
      const result = await db.getAllAsync<{content: string}>(
        'SELECT content FROM verses WHERE book_id = ? AND chapter = ? AND verse = ?',
        [book.id, chapterNumber, verseNumber]
      );

      if (result.length === 0) {
        return null;
      }

      // Parse do conteúdo para extrair referências cruzadas
      const parsed = this.parseVerseContent(result[0].content);
      
      if (parsed.crossReferences && parsed.crossReferences.length > 0) {
        return parsed.crossReferences.join('\n\n');
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar referência cruzada:', error);
      return null;
    }
  }

  /**
   * Busca a nota de rodapé para um versículo específico
   */
  async getFootnote(bibleId: string, bookName: string, chapterNumber: number, verseNumber: number): Promise<string | null> {
    try {
      const db = this.bibleConnections.get(bibleId);
      if (!db) {
        throw new Error(`Bíblia ${bibleId} não está aberta`);
      }

      // Buscar o livro pelo nome
      const books = await this.getBooks(bibleId);
      const book = books.find(b => b.name.toLowerCase() === bookName.toLowerCase());
      
      if (!book) {
        console.warn(`Livro não encontrado: ${bookName}`);
        return null;
      }

      // Buscar o versículo completo
      const result = await db.getAllAsync<{content: string}>(
        'SELECT content FROM verses WHERE book_id = ? AND chapter = ? AND verse = ?',
        [book.id, chapterNumber, verseNumber]
      );

      if (result.length === 0) {
        return null;
      }

      // Parse do conteúdo para extrair notas
      const parsed = this.parseVerseContent(result[0].content);
      
      if (parsed.notes && parsed.notes.length > 0) {
        return parsed.notes.join('\n\n');
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar nota de rodapé:', error);
      return null;
    }
  }
}

export default new BibleReaderService();