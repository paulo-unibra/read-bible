export interface Bible {
  id: string;
  name: string;
  abbreviation: string;
  fileName: string;
  downloadUrl?: string;
  isDownloaded: boolean;
  downloadDate?: string;
  size?: number;
  source?: string;
}

export interface Book {
  id: number;
  name: string;
  abbreviation: string;
  testament: 'old' | 'new';
  chaptersCount: number;
}

export interface Chapter {
  id: number;
  bookId: number;
  chapterNumber: number;
  versesCount: number;
}

export interface Verse {
  id: number;
  bookId: number;
  chapterNumber: number;
  verseNumber: number;
  text: string;
  titles?: {level: number, text: string}[];
  notes?: string[];
  verseReferences?: {text: string, reference: string, position: number}[];
  crossReferences?: string[];
  strongNumbers?: {type: 'greek' | 'hebrew', number: string, position: number}[];
  interlinear?: {hebrew?: string, greek?: string, transliteration?: string, translation?: string}[];
  formatting?: {type: 'italic' | 'bold' | 'underline' | 'jesus' | 'ot_quote' | 'strikethrough', start: number, end: number, text: string}[];
  isFavorite?: boolean;
}

export interface ReadingPlan {
  id: string;
  name: string;
  type: 'monthly' | 'yearly' | 'custom';
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdDate: string;
  totalDays: number;
  completedDays: number;
}

export interface ReadingPlanDay {
  id: string;
  planId: string;
  dayNumber: number;
  date: string;
  readings: Reading[];
  isCompleted: boolean;
  completedDate?: string;
}

export interface Reading {
  id: string;
  bookId: number;
  startChapter: number;
  endChapter: number;
  startVerse?: number;
  endVerse?: number;
  bookName: string;
}

export interface UserSettings {
  preferredBibleId: string;
  fontSize: 'small' | 'medium' | 'large';
  theme: 'light' | 'dark';
  dailyNotificationEnabled: boolean;
  notificationTime: string; // HH:MM format
  lastReadPosition?: {
    bookId: number;
    chapterNumber: number;
    verseNumber: number;
  };
}

export interface SearchResult {
  bookId: number;
  bookName: string;
  chapterNumber: number;
  verseNumber: number;
  text: string;
  highlightedText: string;
}

export interface BibleBrainBible {
  bibleId: string;
  name: string;
  languageName: string;
  languageIso: string;
  countryId: string | null;
  date: string | null;
  hasText: boolean;
  hasAudio: boolean;
  packageStatus: string | null;
  packageProgress: number;
  downloadUrl: string | null;
  packageSize: number | null;
  audioPackageStatus?: string | null;
  audioPackageProgress?: number;
}

export interface DriveFile {
  id: string;
  name: string;
  webContentLink?: string;
  size?: string;
  modifiedTime?: string;
}

export interface BookIntroduction {
  bookId: number;
  word: string; // nome do livro (ex: GÊNESIS, ÊXODO)
  data: string; // conteúdo HTML da introdução
}

// Autenticação básica
export interface User {
  id: string;          // UUID gerado local
  username: string;    // nome de login único
  passwordHash: string;// hash (sha256) da senha
  createdAt: string;   // ISO date
  lastLogin?: string;  // ISO date
}

// Ranking de quizzes
export interface RankingEntry {
  id: string;             // unique id (quizId + timestamp)
  userId: string;         // referência ao usuário
  username: string;       // denormalizado para exibição rápida
  bookId: number;
  chapter: number;
  quizName: string;
  correct: number;
  total: number;
  percentage: number;     // 0-100
  totalTimeMs: number;    // tempo total em ms
  averageTimeMs: number;  // media em ms
  createdAt: string;      // ISO date
}
