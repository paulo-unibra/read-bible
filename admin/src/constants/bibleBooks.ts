// Lista de livros da Bíblia em ordem e com número de capítulos

export interface BibleBook {
  name: string;
  chapters: number;
  testament: 'old' | 'new';
}

export const BIBLE_BOOKS: BibleBook[] = [
  // Antigo Testamento
  { name: 'Gênesis', chapters: 50, testament: 'old' },
  { name: 'Êxodo', chapters: 40, testament: 'old' },
  { name: 'Levítico', chapters: 27, testament: 'old' },
  { name: 'Números', chapters: 36, testament: 'old' },
  { name: 'Deuteronômio', chapters: 34, testament: 'old' },
  { name: 'Josué', chapters: 24, testament: 'old' },
  { name: 'Juízes', chapters: 21, testament: 'old' },
  { name: 'Rute', chapters: 4, testament: 'old' },
  { name: '1 Samuel', chapters: 31, testament: 'old' },
  { name: '2 Samuel', chapters: 24, testament: 'old' },
  { name: '1 Reis', chapters: 22, testament: 'old' },
  { name: '2 Reis', chapters: 25, testament: 'old' },
  { name: '1 Crônicas', chapters: 29, testament: 'old' },
  { name: '2 Crônicas', chapters: 36, testament: 'old' },
  { name: 'Esdras', chapters: 10, testament: 'old' },
  { name: 'Neemias', chapters: 13, testament: 'old' },
  { name: 'Ester', chapters: 10, testament: 'old' },
  { name: 'Jó', chapters: 42, testament: 'old' },
  { name: 'Salmos', chapters: 150, testament: 'old' },
  { name: 'Provérbios', chapters: 31, testament: 'old' },
  { name: 'Eclesiastes', chapters: 12, testament: 'old' },
  { name: 'Cânticos', chapters: 8, testament: 'old' },
  { name: 'Isaías', chapters: 66, testament: 'old' },
  { name: 'Jeremias', chapters: 52, testament: 'old' },
  { name: 'Lamentações', chapters: 5, testament: 'old' },
  { name: 'Ezequiel', chapters: 48, testament: 'old' },
  { name: 'Daniel', chapters: 12, testament: 'old' },
  { name: 'Oséias', chapters: 14, testament: 'old' },
  { name: 'Joel', chapters: 3, testament: 'old' },
  { name: 'Amós', chapters: 9, testament: 'old' },
  { name: 'Obadias', chapters: 1, testament: 'old' },
  { name: 'Jonas', chapters: 4, testament: 'old' },
  { name: 'Miquéias', chapters: 7, testament: 'old' },
  { name: 'Naum', chapters: 3, testament: 'old' },
  { name: 'Habacuque', chapters: 3, testament: 'old' },
  { name: 'Sofonias', chapters: 3, testament: 'old' },
  { name: 'Ageu', chapters: 2, testament: 'old' },
  { name: 'Zacarias', chapters: 14, testament: 'old' },
  { name: 'Malaquias', chapters: 4, testament: 'old' },
  
  // Novo Testamento
  { name: 'Mateus', chapters: 28, testament: 'new' },
  { name: 'Marcos', chapters: 16, testament: 'new' },
  { name: 'Lucas', chapters: 24, testament: 'new' },
  { name: 'João', chapters: 21, testament: 'new' },
  { name: 'Atos', chapters: 28, testament: 'new' },
  { name: 'Romanos', chapters: 16, testament: 'new' },
  { name: '1 Coríntios', chapters: 16, testament: 'new' },
  { name: '2 Coríntios', chapters: 13, testament: 'new' },
  { name: 'Gálatas', chapters: 6, testament: 'new' },
  { name: 'Efésios', chapters: 6, testament: 'new' },
  { name: 'Filipenses', chapters: 4, testament: 'new' },
  { name: 'Colossenses', chapters: 4, testament: 'new' },
  { name: '1 Tessalonicenses', chapters: 5, testament: 'new' },
  { name: '2 Tessalonicenses', chapters: 3, testament: 'new' },
  { name: '1 Timóteo', chapters: 6, testament: 'new' },
  { name: '2 Timóteo', chapters: 4, testament: 'new' },
  { name: 'Tito', chapters: 3, testament: 'new' },
  { name: 'Filemom', chapters: 1, testament: 'new' },
  { name: 'Hebreus', chapters: 13, testament: 'new' },
  { name: 'Tiago', chapters: 5, testament: 'new' },
  { name: '1 Pedro', chapters: 5, testament: 'new' },
  { name: '2 Pedro', chapters: 3, testament: 'new' },
  { name: '1 João', chapters: 5, testament: 'new' },
  { name: '2 João', chapters: 1, testament: 'new' },
  { name: '3 João', chapters: 1, testament: 'new' },
  { name: 'Judas', chapters: 1, testament: 'new' },
  { name: 'Apocalipse', chapters: 22, testament: 'new' },
];

export const getBibleBookByName = (name: string): BibleBook | undefined => {
  return BIBLE_BOOKS.find(book => book.name.toLowerCase() === name.toLowerCase());
};

export const getChapterOptions = (bookName: string): number[] => {
  const book = getBibleBookByName(bookName);
  if (!book) return [];
  return Array.from({ length: book.chapters }, (_, i) => i + 1);
};

export const getBibleBookNames = (): string[] => {
  return BIBLE_BOOKS.map(book => book.name);
};

export const getOldTestamentBooks = (): string[] => {
  return BIBLE_BOOKS.filter(book => book.testament === 'old').map(book => book.name);
};

export const getNewTestamentBooks = (): string[] => {
  return BIBLE_BOOKS.filter(book => book.testament === 'new').map(book => book.name);
};
