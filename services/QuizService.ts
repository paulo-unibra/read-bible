import { playReadingVoice } from './ReadingVoice';
import tamagoshiService from './TamagoshiService';
import authService from './AuthService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const API_URL = process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:1999';

interface Question {
  id: string;
  pergunta: string;
  alternativas: string[];
}

interface Quiz {
  name: string;
  category: string;
  questions: Question[];
}

interface QuizResult {
  questionId: string;
  pergunta: string;
  respostaEscolhida: string;
  timeSpent: number;
}

export interface VerifiedQuizResult {
  correctAnswers: number;
  totalQuestions: number;
  score: number;
  timeSeconds: number;
  alreadyRecorded?: boolean;
}

interface QuizSession {
  quiz: Quiz;
  currentQuestionIndex: number;
  results: QuizResult[];
  startTime: number;
  isCompleted: boolean;
}

class QuizService {
  private availabilityCache = new Map<string, boolean>();
  private bibleVersion: string = 'ARC'; // Versão padrão

  constructor() {
    console.log('[QuizService] Initialized with API URL:', API_URL);
  }

  // Mapeamento de nomes de livros bíblicos
  private bookNameMapping: { [key: number]: string } = {
    // Antigo Testamento
    1: 'Gênesis',
    2: 'Êxodo',
    3: 'Levítico',
    4: 'Números',
    5: 'Deuteronômio',
    6: 'Josué',
    7: 'Juízes',
    8: 'Rute',
    9: '1 Samuel',
    10: '2 Samuel',
    11: '1 Reis',
    12: '2 Reis',
    13: '1 Crônicas',
    14: '2 Crônicas',
    15: 'Esdras',
    16: 'Neemias',
    17: 'Ester',
    18: 'Jó',
    19: 'Salmos',
    20: 'Provérbios',
    21: 'Eclesiastes',
    22: 'Cantares',
    23: 'Isaías',
    24: 'Jeremias',
    25: 'Lamentações',
    26: 'Ezequiel',
    27: 'Daniel',
    28: 'Oséias',
    29: 'Joel',
    30: 'Amós',
    31: 'Obadias',
    32: 'Jonas',
    33: 'Miquéias',
    34: 'Naum',
    35: 'Habacuque',
    36: 'Sofonias',
    37: 'Ageu',
    38: 'Zacarias',
    39: 'Malaquias',
    // Novo Testamento
    40: 'Mateus',
    41: 'Marcos',
    42: 'Lucas',
    43: 'João',
    44: 'Atos',
    45: 'Romanos',
    46: '1 Coríntios',
    47: '2 Coríntios',
    48: 'Gálatas',
    49: 'Efésios',
    50: 'Filipenses',
    51: 'Colossenses',
    52: '1 Tessalonicenses',
    53: '2 Tessalonicenses',
    54: '1 Timóteo',
    55: '2 Timóteo',
    56: 'Tito',
    57: 'Filemom',
    58: 'Hebreus',
    59: 'Tiago',
    60: '1 Pedro',
    61: '2 Pedro',
    62: '1 João',
    63: '2 João',
    64: '3 João',
    65: 'Judas',
    66: 'Apocalipse',
  };

  private getBookName(bookId: number): string {
    return this.bookNameMapping[bookId] || 'Desconhecido';
  }

  async checkQuizAvailable(bookId: number, chapter: number): Promise<boolean> {
    try {
      const bookName = this.getBookName(bookId);
      const cacheKey = `${bookName}-${chapter}-${this.bibleVersion}`;
      
      if (this.availabilityCache.has(cacheKey)) {
        return this.availabilityCache.get(cacheKey)!;
      }

      console.log('[QuizService] Checking quiz availability via API:', { bookName, chapter, bibleVersion: this.bibleVersion });
      
      const response = await fetch(
        `${API_URL}/quizzes?bookName=${encodeURIComponent(bookName)}&bibleVersion=${this.bibleVersion}`
      );
      
      if (!response.ok) {
        console.warn('[QuizService] Quiz check failed. Status:', response.status);
        return false;
      }

      const result = await response.json();
      
      if (!result.success || !result.quizzes) {
        console.warn('[QuizService] Invalid response format');
        return false;
      }

      const quizExists = result.quizzes.some(
        (q: any) => q.chapter === chapter && q.bookName === bookName
      );
      
      console.log('[QuizService] Quiz exists:', quizExists);
      this.availabilityCache.set(cacheKey, quizExists);
      
      return quizExists;
    } catch (error) {
      console.error('[QuizService] Error checking quiz availability:', error);
      return false;
    }
  }

  async ensureQuiz(bookId: number, chapter: number): Promise<Quiz> {
    const exists = await this.checkQuizAvailable(bookId, chapter);
    if (exists) {
      return await this.loadQuiz(bookId, chapter);
    }
    throw new Error(`Quiz não encontrado para ${this.getBookName(bookId)} capítulo ${chapter}`);
  }

  async loadQuiz(bookId: number, chapter: number): Promise<Quiz> {
    try {
      const bookName = this.getBookName(bookId);
      console.log('[QuizService] Loading quiz from API:', { bookName, chapter, bibleVersion: this.bibleVersion });
      
      // Buscar lista de quizzes filtrada por livro
      const listResponse = await fetch(
        `${API_URL}/quizzes?bookName=${encodeURIComponent(bookName)}&bibleVersion=${this.bibleVersion}`
      );
      
      if (!listResponse.ok) {
        throw new Error(`Failed to fetch quiz list: HTTP ${listResponse.status}`);
      }
      
      const listResult = await listResponse.json();
      
      if (!listResult.success || !listResult.quizzes) {
        throw new Error('Invalid response format from quiz list');
      }

      // Encontrar o quiz específico do capítulo
      const quizInfo = listResult.quizzes.find(
        (q: any) => q.chapter === chapter && q.bookName === bookName
      );
      
      if (!quizInfo) {
        throw new Error(`Quiz não encontrado para ${bookName} capítulo ${chapter}`);
      }

      console.log('[QuizService] Found quiz ID:', quizInfo.id);

      // Buscar detalhes completos do quiz
      const detailResponse = await fetch(`${API_URL}/quizzes/${quizInfo.id}`);
      
      if (!detailResponse.ok) {
        throw new Error(`Failed to fetch quiz details: HTTP ${detailResponse.status}`);
      }
      
      const detailResult = await detailResponse.json();
      
      if (!detailResult.success || !detailResult.quiz) {
        throw new Error('Invalid response format from quiz details');
      }

      const quizData = detailResult.quiz;
      console.log('[QuizService] Quiz loaded successfully:', quizData.name);
      
      return {
        name: quizData.name,
        category: quizData.category,
        questions: quizData.questions
      } as Quiz;
    } catch (error) {
      console.error('[QuizService] Error loading quiz:', error);
      throw error;
    }
  }
  createQuizSession(quiz: Quiz): QuizSession {
    return {
      quiz,
      currentQuestionIndex: 0,
      results: [],
      startTime: Date.now(),
      isCompleted: false,
    };
  }

  answerQuestion(
    session: QuizSession,
    answer: string,
    timeSpent: number
  ): QuizSession {
    const currentQuestion = session.quiz.questions[session.currentQuestionIndex];
    const result: QuizResult = {
      questionId: currentQuestion.id,
      pergunta: currentQuestion.pergunta,
      respostaEscolhida: answer,
      timeSpent,
    };

    const updatedResults = [...session.results, result];
    const nextQuestionIndex = session.currentQuestionIndex + 1;
    const isCompleted = nextQuestionIndex >= session.quiz.questions.length;

    return {
      ...session,
      currentQuestionIndex: nextQuestionIndex,
      results: updatedResults,
      isCompleted,
    };
  }

  calculateElapsedTime(session: QuizSession): number {
    const totalTime = session.results.reduce((sum, r) => sum + r.timeSpent, 0);
    return Math.max(0, Math.round(totalTime / 1000));
  }

  getPerformanceMessage(percentage: number): string {
    if (percentage >= 90) return "Excelente! Você domina este capítulo! 🏆";
    if (percentage >= 80) return "Muito bom! Continue assim! 🌟";
    if (percentage >= 70) return "Bom trabalho! 👍";
    if (percentage >= 60) return "Razoável. Que tal revisar o capítulo? 📖";
    return "Precisa estudar mais este capítulo. 📚";
  }

  async getQuizId(
    bookId: number,
    chapter: number,
    bibleVersion: string = 'ARC'
  ): Promise<number | null> {
    try {
      const bookName = this.getBookName(bookId);

      console.log('[QuizService] Buscando quizId:', { bookName, chapter, bibleVersion });

      const response = await fetch(
        `${API_URL}/quizzes?bookName=${encodeURIComponent(bookName)}&bibleVersion=${bibleVersion}`
      );

      if (!response.ok) {
        console.warn('[QuizService] Failed to fetch quiz list. Status:', response.status);
        return null;
      }

      const result = await response.json();
      console.log('[QuizService] Quiz list response:', result);

      if (!result.success || !result.quizzes) {
        console.warn('[QuizService] Invalid response format');
        return null;
      }

      // Encontrar o quiz com o capítulo correspondente
      const quiz = result.quizzes.find(
        (q: any) => q.chapter === chapter && q.bookName === bookName
      );

      return quiz?.id || null;
    } catch (error) {
      console.error('[QuizService] Error fetching quiz ID:', error);
      return null;
    }
  }

  async submitQuizResult(
    bookId: number,
    chapter: number,
    answers: { questionId: string; answer: string }[],
    timeSeconds: number,
    bibleVersion: string = 'ARC'
  ): Promise<VerifiedQuizResult | null> {
    try {
      const token = await AsyncStorage.getItem('@auth_token');

      if (!token) {
        console.warn('[QuizService] No token found, skipping result submission');
        return null;
      }

      // Buscar quizId do backend
      const quizId = await this.getQuizId(bookId, chapter, bibleVersion);
      if (!quizId) {
        console.warn('[QuizService] Quiz not found in database, skipping result submission');
        return null;
      }

      const response = await fetch(`${API_URL}/quiz-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          quizId,
          answers,
          timeSeconds,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Erro ao salvar resultado');
      }

      const result = await response.json();
      if (!result.success || !result.result) {
        throw new Error('Resposta inválida ao confirmar pontuação');
      }
      if (!result.alreadyRecorded) playReadingVoice('quiz');
      const companionUserId = authService.getUser()?.id;
      if (companionUserId != null) await tamagoshiService.record(companionUserId, 'quiz').catch(() => {});
      return {
        correctAnswers: result.result.correctAnswers,
        totalQuestions: result.result.totalQuestions,
        score: result.result.score,
        timeSeconds: result.result.timeSeconds ?? timeSeconds,
        alreadyRecorded: Boolean(result.alreadyRecorded),
      };
    } catch (error) {
      console.error('[QuizService] Error submitting quiz result:', error);
      throw error;
    }
  }
}

export default new QuizService();
export type { Question, Quiz, QuizResult, QuizSession };
