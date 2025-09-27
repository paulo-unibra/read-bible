export interface Bible {
  id: string;
  name: string;
  abbreviation: string;
  language: string;
  fileName: string;
  downloadUrl?: string;
  isDownloaded: boolean;
  downloadDate?: string;
  size?: number;
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

export interface DriveFile {
  id: string;
  name: string;
  webContentLink?: string;
  size?: string;
  modifiedTime?: string;
}