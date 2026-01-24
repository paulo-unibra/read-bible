import AuthService, { API_URL } from "./AuthService";

export interface VerseNote {
  id: number;
  userId: number;
  bookId: number;
  bookName: string;
  chapterNumber: number;
  verseNumbers: number[];
  verseText: string;
  note: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

class NotesService {
  // Salvar ou atualizar uma anotação
  async saveNote(
    bookId: number,
    bookName: string,
    chapterNumber: number,
    verseNumbers: number[],
    verseText: string,
    note: string,
    isPrivate: boolean = true,
  ): Promise<VerseNote> {
    try {
      const token = await AuthService.getToken();
      if (!token) {
        throw new Error("Usuário não autenticado");
      }

      const response = await fetch(`${API_URL}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bookId,
          bookName,
          chapterNumber,
          verseNumbers,
          verseText,
          note,
          isPrivate,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Erro ao salvar anotação");
      }

      return result.data;
    } catch (error) {
      console.error("Erro ao salvar anotação:", error);
      throw error;
    }
  }

  // Buscar todas as anotações
  async getAllNotes(): Promise<VerseNote[]> {
    try {
      const token = await AuthService.getToken();
      if (!token) {
        return [];
      }

      const response = await fetch(`${API_URL}/notes`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Erro ao buscar anotações");
      }

      return result.data || [];
    } catch (error) {
      console.error("Erro ao buscar anotações:", error);
      return [];
    }
  }

  // Buscar anotação específica por referência
  async getNoteByReference(
    bookId: number,
    chapterNumber: number,
    verseNumbers: number[],
  ): Promise<VerseNote | null> {
    try {
      const notes = await this.getNotesByChapter(bookId, chapterNumber);

      // Procurar nota que contenha exatamente esses versículos
      const note = notes.find(
        (n) =>
          n.verseNumbers.length === verseNumbers.length &&
          n.verseNumbers.every((v) => verseNumbers.includes(v)),
      );

      return note || null;
    } catch (error) {
      console.error("Erro ao buscar anotação:", error);
      return null;
    }
  }

  // Buscar anotações de um capítulo específico
  async getNotesByChapter(
    bookId: number,
    chapterNumber: number,
  ): Promise<VerseNote[]> {
    try {
      const token = await AuthService.getToken();
      if (!token) {
        return [];
      }

      const response = await fetch(
        `${API_URL}/notes/chapter/${bookId}/${chapterNumber}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Erro ao buscar anotações do capítulo",
        );
      }

      return result.data || [];
    } catch (error) {
      console.error("Erro ao buscar anotações do capítulo:", error);
      return [];
    }
  }

  // Buscar anotações de um livro
  async getNotesByBook(bookId: number): Promise<VerseNote[]> {
    try {
      const allNotes = await this.getAllNotes();
      return allNotes.filter((n) => n.bookId === bookId);
    } catch (error) {
      console.error("Erro ao buscar anotações do livro:", error);
      return [];
    }
  }

  // Deletar uma anotação
  async deleteNote(noteId: number): Promise<void> {
    try {
      const token = await AuthService.getToken();
      if (!token) {
        throw new Error("Usuário não autenticado");
      }

      const response = await fetch(`${API_URL}/notes/${noteId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Erro ao deletar anotação");
      }
    } catch (error) {
      console.error("Erro ao deletar anotação:", error);
      throw error;
    }
  }

  // Verificar se existe anotação para versículos específicos
  async hasNote(
    bookId: number,
    chapterNumber: number,
    verseNumbers: number[],
  ): Promise<boolean> {
    const note = await this.getNoteByReference(
      bookId,
      chapterNumber,
      verseNumbers,
    );
    return note !== null;
  }
}

export default new NotesService();
