import AsyncStorage from '@react-native-async-storage/async-storage';

export interface VerseNote {
  id: string;
  bookId: number;
  bookName: string;
  chapterNumber: number;
  verseNumbers: number[]; // Array para suportar múltiplos versículos
  verseText: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

const NOTES_STORAGE_KEY = '@bible_notes';

class NotesService {
  // Salvar ou atualizar uma anotação
  async saveNote(
    bookId: number,
    bookName: string,
    chapterNumber: number,
    verseNumbers: number[],
    verseText: string,
    note: string
  ): Promise<VerseNote> {
    try {
      const notes = await this.getAllNotes();
      
      // Criar ID único baseado na referência bíblica
      const verseRange = verseNumbers.length === 1 
        ? verseNumbers[0].toString()
        : `${Math.min(...verseNumbers)}-${Math.max(...verseNumbers)}`;
      const noteId = `${bookId}-${chapterNumber}-${verseRange}`;
      
      // Verificar se já existe uma nota para esses versículos
      const existingNoteIndex = notes.findIndex(n => n.id === noteId);
      
      const timestamp = new Date().toISOString();
      const newNote: VerseNote = {
        id: noteId,
        bookId,
        bookName,
        chapterNumber,
        verseNumbers,
        verseText,
        note,
        createdAt: existingNoteIndex >= 0 ? notes[existingNoteIndex].createdAt : timestamp,
        updatedAt: timestamp,
      };
      
      if (existingNoteIndex >= 0) {
        // Atualizar nota existente
        notes[existingNoteIndex] = newNote;
      } else {
        // Adicionar nova nota
        notes.push(newNote);
      }
      
      await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
      return newNote;
    } catch (error) {
      console.error('Erro ao salvar anotação:', error);
      throw error;
    }
  }

  // Buscar todas as anotações
  async getAllNotes(): Promise<VerseNote[]> {
    try {
      const notesJson = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      if (!notesJson) return [];
      
      const notes = JSON.parse(notesJson) as VerseNote[];
      // Ordenar por data de atualização (mais recentes primeiro)
      return notes.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    } catch (error) {
      console.error('Erro ao buscar anotações:', error);
      return [];
    }
  }

  // Buscar anotação específica por referência
  async getNoteByReference(
    bookId: number,
    chapterNumber: number,
    verseNumbers: number[]
  ): Promise<VerseNote | null> {
    try {
      const notes = await this.getAllNotes();
      const verseRange = verseNumbers.length === 1 
        ? verseNumbers[0].toString()
        : `${Math.min(...verseNumbers)}-${Math.max(...verseNumbers)}`;
      const noteId = `${bookId}-${chapterNumber}-${verseRange}`;
      
      return notes.find(n => n.id === noteId) || null;
    } catch (error) {
      console.error('Erro ao buscar anotação:', error);
      return null;
    }
  }

  // Buscar anotações de um capítulo específico
  async getNotesByChapter(bookId: number, chapterNumber: number): Promise<VerseNote[]> {
    try {
      const notes = await this.getAllNotes();
      return notes.filter(
        n => n.bookId === bookId && n.chapterNumber === chapterNumber
      );
    } catch (error) {
      console.error('Erro ao buscar anotações do capítulo:', error);
      return [];
    }
  }

  // Buscar anotações de um livro
  async getNotesByBook(bookId: number): Promise<VerseNote[]> {
    try {
      const notes = await this.getAllNotes();
      return notes.filter(n => n.bookId === bookId);
    } catch (error) {
      console.error('Erro ao buscar anotações do livro:', error);
      return [];
    }
  }

  // Deletar uma anotação
  async deleteNote(noteId: string): Promise<void> {
    try {
      const notes = await this.getAllNotes();
      const filteredNotes = notes.filter(n => n.id !== noteId);
      await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(filteredNotes));
    } catch (error) {
      console.error('Erro ao deletar anotação:', error);
      throw error;
    }
  }

  // Verificar se existe anotação para versículos específicos
  async hasNote(bookId: number, chapterNumber: number, verseNumbers: number[]): Promise<boolean> {
    const note = await this.getNoteByReference(bookId, chapterNumber, verseNumbers);
    return note !== null;
  }
}

export default new NotesService();
