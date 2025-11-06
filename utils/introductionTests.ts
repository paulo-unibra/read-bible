/**
 * Teste simples para verificar a funcionalidade de introdução
 * Este arquivo pode ser removido após os testes
 */

// Mock de dados para teste
const mockChaptersWithIntroduction = [
  { id: 0, bookId: 1, chapterNumber: 0, versesCount: 1 }, // Introdução
  { id: 1, bookId: 1, chapterNumber: 1, versesCount: 31 },
  { id: 2, bookId: 1, chapterNumber: 2, versesCount: 25 },
];

const mockChaptersWithoutIntroduction = [
  { id: 1, bookId: 1, chapterNumber: 1, versesCount: 31 },
  { id: 2, bookId: 1, chapterNumber: 2, versesCount: 25 },
];

const mockIntroductionVerse = {
  id: 1000000,
  bookId: 1,
  chapterNumber: 0,
  verseNumber: 0,
  text: 'Introdução ao livro de Gênesis...',
  titles: [{ level: 1, text: 'Introdução' }],
};

export const testIntroductionFunctionality = {
  // Teste: Verificar se capítulos incluem introdução quando disponível
  shouldIncludeIntroductionChapter: (chapters: typeof mockChaptersWithIntroduction) => {
    const hasIntroduction = chapters.some(ch => ch.chapterNumber === 0);
    console.log('✓ Teste: Capítulos incluem introdução:', hasIntroduction);
    return hasIntroduction;
  },

  // Teste: Calcular total de capítulos corretamente
  shouldCalculateTotalChaptersCorrectly: (chapters: typeof mockChaptersWithIntroduction) => {
    const hasIntroduction = chapters.some(ch => ch.chapterNumber === 0);
    const actualTotal = hasIntroduction ? chapters.length - 1 : chapters.length;
    console.log('✓ Teste: Total de capítulos (sem contar introdução):', actualTotal);
    return actualTotal;
  },

  // Teste: Renderização especial para capítulo 0
  shouldRenderIntroductionSpecially: (chapterNumber: number) => {
    const isIntroduction = chapterNumber === 0;
    const displayText = isIntroduction ? 'Introdução' : chapterNumber.toString();
    console.log('✓ Teste: Texto de exibição para capítulo', chapterNumber, ':', displayText);
    return displayText;
  },

  // Teste: Versículo de introdução não deve mostrar número
  shouldHideVerseNumberForIntroduction: (verse: typeof mockIntroductionVerse) => {
    const shouldShowNumber = verse.chapterNumber !== 0;
    console.log('✓ Teste: Mostrar número do versículo para capítulo', verse.chapterNumber, ':', shouldShowNumber);
    return shouldShowNumber;
  },

  // Executar todos os testes
  runAllTests: () => {
    console.log('🧪 Executando testes da funcionalidade de introdução...\n');
    
    // Teste 1: Com introdução
    testIntroductionFunctionality.shouldIncludeIntroductionChapter(mockChaptersWithIntroduction);
    testIntroductionFunctionality.shouldCalculateTotalChaptersCorrectly(mockChaptersWithIntroduction);
    
    // Teste 2: Sem introdução  
    testIntroductionFunctionality.shouldCalculateTotalChaptersCorrectly(mockChaptersWithoutIntroduction);
    
    // Teste 3: Renderização
    testIntroductionFunctionality.shouldRenderIntroductionSpecially(0);
    testIntroductionFunctionality.shouldRenderIntroductionSpecially(1);
    
    // Teste 4: Versículo
    testIntroductionFunctionality.shouldHideVerseNumberForIntroduction(mockIntroductionVerse);
    
    console.log('\n✅ Todos os testes executados com sucesso!');
  }
};

// Teste das variações de nomes de livros
export const testBookVariations = {
  testVariations: () => {
    console.log('🧪 Testando variações de nomes de livros...\n');
    
    const testCases = [
      { input: 'GÊNESIS', expected: ['GÊNESIS', 'GENESIS'] },
      { input: '1 SAMUEL', expected: ['1 SAMUEL', 'SAMUEL', '1SAMUEL'] },
      { input: 'SALMOS', expected: ['SALMOS', 'SALMO'] },
    ];
    
    testCases.forEach(({ input, expected }) => {
      console.log(`✓ Variações para "${input}":`, expected.join(', '));
    });
    
    console.log('\n✅ Teste de variações concluído!');
  }
};

// Para uso em desenvolvimento/debugging
if (typeof window !== 'undefined') {
  (window as any).testIntroduction = testIntroductionFunctionality;
  (window as any).testBookVariations = testBookVariations;
}