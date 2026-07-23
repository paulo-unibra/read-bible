/**
 * Mapeamento dos 66 livros protestantes (ordem padrão) para os códigos
 * USFM/Paratext de 3 letras usados pela BibleBrain (book_id).
 *
 * O app já possui sua própria lista de nomes (em português) indexada por
 * esse mesmo número (1-66), então aqui só precisamos do número — o
 * pacote SQLite gerado não armazena o nome do livro, só o id numérico.
 */
export const USFM_BOOK_ORDER: string[] = [
  'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'JOS', 'JDG', 'RUT', '1SA', '2SA',
  '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST', 'JOB', 'PSA', 'PRO',
  'ECC', 'SNG', 'ISA', 'JER', 'LAM', 'EZK', 'DAN', 'HOS', 'JOL', 'AMO',
  'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL',
  'MAT', 'MRK', 'LUK', 'JHN', 'ACT', 'ROM', '1CO', '2CO', 'GAL', 'EPH',
  'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM', 'HEB', 'JAS',
  '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD', 'REV',
]

const USFM_TO_NUMBER: Record<string, number> = USFM_BOOK_ORDER.reduce(
  (acc, code, index) => {
    acc[code] = index + 1
    return acc
  },
  {} as Record<string, number>
)

/**
 * Converte um book_id USFM (ex: "GEN", "JHN") para o número 1-66 usado
 * pelo app. Retorna null para livros fora do cânon protestante padrão
 * (ex: deuterocanônicos), que são ignorados no pacote gerado.
 */
export function usfmBookIdToNumber(bookId: string): number | null {
  return USFM_TO_NUMBER[bookId?.toUpperCase()] ?? null
}

export function isStandardProtestantBook(bookId: string): boolean {
  return usfmBookIdToNumber(bookId) !== null
}
