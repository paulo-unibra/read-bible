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
  private DRIVE_FOLDER_ID = process.env.EXPO_PUBLIC_QUIZ_DRIVE_FOLDER_ID || process.env.EXPO_PUBLIC_DRIVE_FOLDER_ID; // fallback para pasta geral se não houver específica
  private API_KEY = process.env.EXPO_PUBLIC_GOOGLE_API_KEY;
  private availabilityCache = new Map<string, boolean>();

  constructor() {
    // Validação inicial (não quebrar a aplicação, mas avisar)
    if (!this.DRIVE_FOLDER_ID) {
      console.warn(
        '[QuizService] EXPO_PUBLIC_QUIZ_DRIVE_FOLDER_ID não definida. Usando EXPO_PUBLIC_DRIVE_FOLDER_ID como fallback. Caso queira separar a pasta dos quizzes, defina a variável específica.'
      );
    }
    if (!this.API_KEY) {
      console.warn(
        '[QuizService] EXPO_PUBLIC_GOOGLE_API_KEY ausente. As requisições ao Google Drive irão falhar até que seja configurada.'
      );
    }
  }

  private ensureConfigured() {
    if (!this.DRIVE_FOLDER_ID) {
      throw new Error(
        'Pasta de quizzes não configurada. Defina EXPO_PUBLIC_QUIZ_DRIVE_FOLDER_ID ou EXPO_PUBLIC_DRIVE_FOLDER_ID.'
      );
    }
    if (!this.API_KEY) {
      throw new Error(
        'EXPO_PUBLIC_GOOGLE_API_KEY não configurada. Configure para acessar os quizzes do Google Drive.'
      );
    }
  }

  // Mapeamento de nomes de livros bíblicos para o padrão dos arquivos JSON
  private bookNameMapping: { [key: number]: string } = {
    // Antigo Testamento
    1: 'genesis',
    2: 'exodo',
    3: 'levitico',
    4: 'numeros',
    5: 'deuteronomio',
    6: 'josue',
    7: 'juizes',
    8: 'rute',
    9: '1samuel',
    10: '2samuel',
    11: '1reis',
    12: '2reis',
    13: '1cronicas',
    14: '2cronicas',
    15: 'esdras',
    16: 'neemias',
    17: 'ester',
    18: 'jo',
    19: 'salmos',
    20: 'proverbios',
    21: 'eclesiastes',
    22: 'cantares',
    23: 'isaias',
    24: 'jeremias',
    25: 'lamentacoes',
    26: 'ezequiel',
    27: 'daniel',
    28: 'oseias',
    29: 'joel',
    30: 'amos',
    31: 'obadias',
    32: 'jonas',
    33: 'miqueias',
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
    43: 'joao',
    44: 'atos',
    45: 'romanos',
    46: '1corintios',
    47: '2corintios',
    48: 'galatas',
    49: 'efesios',
    50: 'filipenses',
    51: 'colossenses',
    52: '1tessalonicenses',
    53: '2tessalonicenses',
    54: '1timoteo',
    55: '2timoteo',
    56: 'tito',
    57: 'filemom',
    58: 'hebreus',
    59: 'tiago',
    60: '1pedro',
    61: '2pedro',
    62: '1joao',
    63: '2joao',
    64: '3joao',
    65: 'judas',
    66: 'apocalipse',
  };

  private getQuizFileName(bookId: number, chapter: number): string {
    const bookName = this.bookNameMapping[bookId];
    if (!bookName) {
      throw new Error(`Book not found for ID: ${bookId}`);
    }
    return `${bookName}-${chapter}.json`;
  }

  async checkQuizAvailable(bookId: number, chapter: number): Promise<boolean> {
    try {
      this.ensureConfigured();
      const fileName = this.getQuizFileName(bookId, chapter);
      const cacheKey = `${fileName}`;
      if (this.availabilityCache.has(cacheKey)) {
        return this.availabilityCache.get(cacheKey)!;
      }
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${this.DRIVE_FOLDER_ID}'+in+parents+and+name='${fileName}'&key=${this.API_KEY}&fields=files(id,name)`;
      
      const response = await fetch(listUrl);
      if (!response.ok) {
        this.availabilityCache.set(cacheKey, false);
        return false;
      }
      
      const data = await response.json();
      const exists = data.files && data.files.length > 0;
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
      const listUrl = `https://www.googleapis.com/drive/v3/files?q='${this.DRIVE_FOLDER_ID}'+in+parents+and+name='${fileName}'&key=${this.API_KEY}&fields=files(id,name)`;
      
      const response = await fetch(listUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.files || data.files.length === 0) {
        throw new Error(`Quiz file not found: ${fileName}`);
      }
      
      const file = data.files[0];
      if (!file.id) {
        throw new Error('File ID not found');
      }
      
      // Baixar o conteúdo do arquivo JSON
      const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;
      const downloadResponse = await fetch(downloadUrl);
      
      if (!downloadResponse.ok) {
        throw new Error(`Failed to download quiz: ${downloadResponse.status}`);
      }
      
      const quizData = await downloadResponse.json();
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
