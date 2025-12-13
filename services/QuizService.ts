interface Question {
  id: string;
  pergunta: string;
  alternativas: string[];
  respostaCorreta: string;
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
  respostaCorreta: string;
  correct: boolean;
  timeSpent: number;
}

interface QuizSession {
  quiz: Quiz;
  currentQuestionIndex: number;
  results: QuizResult[];
  startTime: number;
  isCompleted: boolean;
}

class QuizService {
  private BUCKET_NAME = 'bibliaquiz-files';
  private BUCKET_PATH = 'quizzes'; // Subpasta dentro do bucket
  private availabilityCache = new Map<string, boolean>();

  constructor() {
    console.log('[QuizService] Initialized with bucket:', this.BUCKET_NAME, 'path:', this.BUCKET_PATH);
  }

  private ensureConfigured() {
    if (!this.BUCKET_NAME) {
      throw new Error(
        'Bucket GCS não configurado.'
      );
    }
  }

  // Mapeamento de nomes de livros bíblicos para o padrão dos arquivos JSON
  private bookNameMapping: { [key: number]: string } = {
    // Antigo Testamento
    1: 'gênesis',
    2: 'êxodo',
    3: 'levítico',
    4: 'números',
    5: 'deuteronômio',
    6: 'josué',
    7: 'juízes',
    8: 'rute',
    9: '1samuel',
    10: '2samuel',
    11: '1reis',
    12: '2reis',
    13: '1crônicas',
    14: '2crônicas',
    15: 'esdras',
    16: 'neemias',
    17: 'ester',
    18: 'jó',
    19: 'salmos',
    20: 'provérbios',
    21: 'eclesiastes',
    22: 'cantares',
    23: 'isaías',
    24: 'jeremias',
    25: 'lamentações',
    26: 'ezequiel',
    27: 'daniel',
    28: 'oséias',
    29: 'joel',
    30: 'amós',
    31: 'obadias',
    32: 'jonas',
    33: 'miquéias',
    34: 'naum',
    35: 'habacuque',
    36: 'sofonias',
    37: 'ageu',
    38: 'zacarias',
    39: 'malaquias',
    // Novo Testamento
    40: 'mateus',
    41: 'marcos',
    42: 'lucas',
    43: 'joão',
    44: 'atos',
    45: 'romanos',
    46: '1coríntios',
    47: '2coríntios',
    48: 'gálatas',
    49: 'efésios',
    50: 'filipenses',
    51: 'colossenses',
    52: '1tessalonicenses',
    53: '2tessalonicenses',
    54: '1timóteo',
    55: '2timóteo',
    56: 'tito',
    57: 'filemom',
    58: 'hebreus',
    59: 'tiago',
    60: '1pedro',
    61: '2pedro',
    62: '1joão',
    63: '2joão',
    64: '3joão',
    65: 'judas',
    66: 'apocalipse',
  };

  private getQuizFileName(bookId: number, chapter: number): string {
    const bookName = this.bookNameMapping[bookId];
    if (!bookName) {
      throw new Error(`Book not found for ID: ${bookId}`);
    }
    // Formato: arc-nome-do-livro-[numero].json
    // URL encode para caracteres especiais como ê, í, etc.
    const encodedBookName = encodeURIComponent(bookName);
    const fileName = `arc-${encodedBookName}-${chapter}.json`;
    console.log('[QuizService] Generated filename:', fileName, 'from book:', bookName);
    return fileName;
  }

  private getQuizUrl(fileName: string): string {
    // URL completa: https://storage.googleapis.com/bibliaquiz-files/quizzes/arc-genesis-1.json
    const url = `https://storage.googleapis.com/${this.BUCKET_NAME}/${this.BUCKET_PATH}/${fileName}`;
    console.log('[QuizService] Full GCS URL:', url);
    return url;
  }

  async checkQuizAvailable(bookId: number, chapter: number): Promise<boolean> {
    try {
      this.ensureConfigured();
      const fileName = this.getQuizFileName(bookId, chapter);
      const cacheKey = `${fileName}`;
      
      if (this.availabilityCache.has(cacheKey)) {
        return this.availabilityCache.get(cacheKey)!;
      }

      // URL pública do Google Cloud Storage
      const gcsUrl = this.getQuizUrl(fileName);
      console.log('[QuizService] Checking quiz availability:', gcsUrl);
      
      // Fazer HEAD request para verificar se existe
      const response = await fetch(gcsUrl, { method: 'HEAD' });
      const exists = response.ok;
      console.log('[QuizService] Quiz exists:', exists, 'Status:', response.status);
      
      this.availabilityCache.set(cacheKey, exists);
      return exists;
    } catch (error) {
      console.error('Error checking quiz availability:', error);
      return false;
    }
  }

  async ensureQuiz(bookId: number, chapter: number): Promise<Quiz> {
    // Apenas carrega quizzes existentes do Drive
    const exists = await this.checkQuizAvailable(bookId, chapter);
    if (exists) {
      return await this.loadQuiz(bookId, chapter);
    }
    throw new Error(`Quiz não encontrado para ${this.bookNameMapping[bookId]} capítulo ${chapter}`);
  }

  async loadQuiz(bookId: number, chapter: number): Promise<Quiz> {
    try {
      this.ensureConfigured();
      const fileName = this.getQuizFileName(bookId, chapter);
      console.log('[QuizService] Loading quiz for book:', bookId, 'chapter:', chapter, 'filename:', fileName);
      
      // URL pública do Google Cloud Storage
      const gcsUrl = this.getQuizUrl(fileName);
      console.log('[QuizService] Fetching from GCS:', gcsUrl);
      
      const response = await fetch(gcsUrl);
      console.log('[QuizService] Response status:', response.status);
      
      if (!response.ok) {
        throw new Error(`Quiz file not found: ${fileName} (HTTP ${response.status})`);
      }
      
      const quizData = await response.json();
      console.log('[QuizService] Quiz loaded successfully:', quizData.name);
      return quizData as Quiz;
    } catch (error) {
      console.error('Error loading quiz:', error);
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
    const isCorrect = answer === currentQuestion.respostaCorreta;

    const result: QuizResult = {
      questionId: currentQuestion.id,
      pergunta: currentQuestion.pergunta,
      respostaEscolhida: answer,
      respostaCorreta: currentQuestion.respostaCorreta,
      correct: isCorrect,
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

  calculateScore(session: QuizSession): {
    correct: number;
    total: number;
    percentage: number;
    totalTime: number;
    averageTime: number;
  } {
    const correct = session.results.filter(r => r.correct).length;
    const total = session.results.length;
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    const totalTime = session.results.reduce((sum, r) => sum + r.timeSpent, 0);
    const averageTime = total > 0 ? Math.round(totalTime / total) : 0;

    return {
      correct,
      total,
      percentage,
      totalTime,
      averageTime,
    };
  }

  getPerformanceMessage(percentage: number): string {
    if (percentage >= 90) return "Excelente! Você domina este capítulo! 🏆";
    if (percentage >= 80) return "Muito bom! Continue assim! 🌟";
    if (percentage >= 70) return "Bom trabalho! 👍";
    if (percentage >= 60) return "Razoável. Que tal revisar o capítulo? 📖";
    return "Precisa estudar mais este capítulo. 📚";
  }
}

export default new QuizService();
export type { Question, Quiz, QuizResult, QuizSession };
