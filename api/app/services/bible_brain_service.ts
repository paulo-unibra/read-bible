import env from '#start/env'

const BASE_URL = 'https://4.dbt.io/api'
const API_VERSION = 4

export interface BibleBrainListItem {
  abbr: string
  name: string | null
  vname: string | null
  language: string | null
  autonym: string | null
  language_id: number | null
  iso: string | null
  date: string | null
  country_id?: string | null
  filesets?: {
    'dbp-prod'?: Array<{
      id: string
      type: string
      size?: string
      codec?: string
      bitrate?: string
      container?: string
    }>
  }
}

export interface BibleBrainListPagination {
  total: number
  per_page: number
  current_page: number
  last_page?: number
  total_pages?: number
  next_page_url?: string | null
}

export interface BibleBrainListResponse {
  data: BibleBrainListItem[]
  meta?: { pagination?: BibleBrainListPagination }
}

export interface BibleBrainBook {
  book_id: string
  name: string
  name_short?: string
  testament?: string
  book_seq?: string
  chapters: number[]
}

export interface BibleBrainBookListResponse {
  data: BibleBrainBook[]
}

export interface BibleBrainTextVerse {
  book_id: string
  book_name?: string
  chapter: number
  verse_start: number
  verse_end?: number
  verse_text: string
}

export interface BibleBrainTextChapterResponse {
  data: BibleBrainTextVerse[]
}

export interface BibleBrainBibleInfo {
  data: {
    filesets?: Record<string, Array<{ id: string; type: string; size?: string }>>
  }
}

/**
 * Cliente HTTP para a API pública da BibleBrain (Digital Bible Platform).
 * A chave nunca é exposta ao app: todas as chamadas passam por aqui, no backend.
 */
class BibleBrainService {
  getKey(): string {
    const key = env.get('BIBLE_BRAIN_KEY')
    if (!key) {
      throw new Error('BIBLE_BRAIN_KEY não configurada no .env do servidor')
    }
    return key
  }

  private async request<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`)
    url.searchParams.set('v', String(API_VERSION))
    url.searchParams.set('key', this.getKey())

    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(name, String(value))
      }
    }

    const response = await fetch(url.toString())

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      throw new Error(`BibleBrain API respondeu ${response.status}: ${body.slice(0, 300)}`)
    }

    return (await response.json()) as T
  }

  /**
   * Lista bíblias disponíveis na BibleBrain (usado pela sincronização em massa e busca).
   */
  async listBibles(options: {
    page?: number
    limit?: number
    languageCode?: string
    media?: string
  } = {}): Promise<BibleBrainListResponse> {
    return this.request<BibleBrainListResponse>('/bibles', {
      page: options.page,
      limit: options.limit,
      language_code: options.languageCode,
      media: options.media,
      show_country: 'true',
    })
  }

  /**
   * Lista os livros (e capítulos) de uma bíblia específica.
   */
  async getBooks(bibleId: string): Promise<BibleBrainBookListResponse> {
    return this.request<BibleBrainBookListResponse>(`/bibles/${bibleId}/book`)
  }

  /**
   * Conteúdo (texto ou áudio) de um capítulo de um fileset específico.
   */
  async getChapterContent(
    filesetId: string,
    bookId: string,
    chapter: number
  ): Promise<{ data: any[] }> {
    return this.request<{ data: any[] }>(`/bibles/filesets/${filesetId}/${bookId}/${chapter}`)
  }

  /**
   * Detalhes de uma bíblia específica (inclui todos os filesets).
   */
  async getBibleInfo(bibleId: string): Promise<BibleBrainBibleInfo> {
    return this.request<BibleBrainBibleInfo>(`/bibles/${bibleId}`)
  }

  /**
   * Lista bíblias que tenham vídeo.
   */
  async listVideoBibles(options: {
    languageCode?: string
    limit?: number
    page?: number
  } = {}): Promise<BibleBrainListResponse> {
    return this.request<BibleBrainListResponse>('/bibles', {
      page: options.page,
      limit: options.limit,
      language_code: options.languageCode,
      media: 'video_stream',
      show_country: 'true',
    })
  }

  /**
   * Timestamps de áudio por versículo para um capítulo.
   */
  async getAudioTimestamps(
    filesetId: string,
    bookId: string,
    chapter: number
  ): Promise<{
    data: Array<{
      verse_start: number | string
      timestamp: number | string
    }>
  }> {
    return this.request(`/timestamps/${filesetId}/${bookId}/${chapter}`)
  }

  /**
   * Informações de áudio de um capítulo (URL assinada, duração, tamanho).
   */
  async getAudioChapterInfo(
    filesetId: string,
    bookId: string,
    chapter: number
  ): Promise<{
    data: Array<{
      book_id: string
      chapter_start: number
      path: string
      duration: number
      filesize_in_bytes: number
    }>
  }> {
    return this.request(`/bibles/filesets/${filesetId}/${bookId}/${chapter}`)
  }
}

export default new BibleBrainService()
