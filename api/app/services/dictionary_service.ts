import env from '#start/env'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

const DICTIONARIES_DIR = new URL('../../public/dictionaries/', import.meta.url)

const DICT_KEYS = ['nomes', 'wycliffe', 'champlin', 'outros'] as const
type DictKey = (typeof DICT_KEYS)[number]

const DICT_META: Record<DictKey, { label: string; match: RegExp }> = {
  nomes: { label: 'Dicionário de Nomes', match: /nomes/i },
  wycliffe: { label: 'Dicionário Wycliffe', match: /wycliffe|wyclife/i },
  champlin: { label: 'Dicionário Champlin', match: /champlin/i },
  outros: { label: 'Dicionário de Temas Bíblicos', match: /./ },
}

interface DriveFile {
  id: string
  name: string
  size: string
}

interface DictionarySource {
  dictKey: DictKey
  label: string
  fileName: string
  filePath: string
  db: Database.Database | null
  tableName: string
  wordColumn: string
  definitionColumn: string
}

export interface DictionaryEntry {
  word: string
  definition: string
  dictKey: string
  dictionary: string
}

export interface DictionaryGroup {
  dictKey: string
  label: string
  total: number
  entries: { word: string; snippet: string }[]
}

export interface DictionarySearchResult {
  groups: DictionaryGroup[]
  total: number
  page: number
  perPage: number
}

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function makeSnippet(definition: string): string {
  const text = plainText(definition)
  return text.length > 100 ? `${text.slice(0, 100)}...` : text
}

class DictionaryService {
  private sources: DictionarySource[] = []
  private loaded = false

  private classifyFile(fileName: string): DictKey {
    const lower = fileName.toLowerCase()
    if (DICT_META.nomes.match.test(lower)) return 'nomes'
    if (DICT_META.wycliffe.match.test(lower)) return 'wycliffe'
    if (DICT_META.champlin.match.test(lower)) return 'champlin'
    return 'outros'
  }

  async listDriveFiles(): Promise<DriveFile[]> {
    const folderId =
      env.get('EXPO_PUBLIC_DICTIONARY_DRIVE_FOLDER_ID') || '1uOQqOPGnImUTApeyY94XJ7BCvIFBzG0H'
    const apiKey = env.get('GOOGLE_API_KEY') || env.get('EXPO_PUBLIC_GOOGLE_API_KEY')

    const url = `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents&key=${apiKey}&fields=files(id,name,size)`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Drive API error: ${response.status}`)
    const data = (await response.json()) as { files?: DriveFile[] }
    return data.files || []
  }

  private async downloadFile(file: DriveFile): Promise<void> {
    const dlUrl = `https://drive.usercontent.google.com/download?id=${file.id}&export=download`
    const response = await fetch(dlUrl)
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(`${DICTIONARIES_DIR.pathname}${file.name}`, buffer)
  }

  private openSource(dictKey: DictKey, fileName: string): DictionarySource | null {
    const filePath = `${DICTIONARIES_DIR.pathname}${fileName}`
    if (!existsSync(filePath)) return null

    const db = new Database(filePath, { readonly: true })

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string
    }[]
    const dictTable = tables.find((t) =>
      ['dictionary', 'dict', 'entries', 'definitions'].includes(t.name.toLowerCase())
    )
    if (!dictTable) {
      db.close()
      return null
    }

    const cols = db.prepare(`PRAGMA table_info("${dictTable.name}")`).all() as { name: string }[]
    const colNames = cols.map((c) => c.name.toLowerCase())
    const wordColumn = colNames.includes('word')
      ? 'word'
      : colNames.includes('topic')
        ? 'topic'
        : cols[0].name
    const definitionColumn = colNames.includes('definition')
      ? 'definition'
      : colNames.includes('meaning')
        ? 'meaning'
        : colNames.includes('data')
          ? 'data'
          : colNames.includes('content')
            ? 'content'
            : cols[1]?.name || cols[0].name

    return {
      dictKey,
      label: DICT_META[dictKey].label,
      fileName,
      filePath,
      db,
      tableName: dictTable.name,
      wordColumn,
      definitionColumn,
    }
  }

  private closeSources() {
    for (const source of this.sources) {
      if (source.db) source.db.close()
    }
    this.sources = []
    this.loaded = false
  }

  async ensureLoaded(): Promise<boolean> {
    if (this.loaded) return true

    const dir = DICTIONARIES_DIR.pathname
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    const localFiles = readdirSync(dir).filter(
      (f) => f.endsWith('.mybible') || f.endsWith('.dct') || f.endsWith('.db')
    )
    const found = new Map<DictKey, string>()
    for (const f of localFiles) {
      const key = this.classifyFile(f)
      if (!found.has(key)) found.set(key, f)
    }

    const missing = DICT_KEYS.filter((k) => !found.has(k))
    if (missing.length > 0) {
      const driveFiles = await this.listDriveFiles()
      const dctFiles = driveFiles.filter(
        (f) => f.name.endsWith('.mybible') || f.name.endsWith('.dct')
      )
      for (const key of missing) {
        const driveFile = dctFiles.find((f) => this.classifyFile(f.name) === key)
        if (driveFile) {
          await this.downloadFile(driveFile)
          found.set(key, driveFile.name)
        }
      }
    }

    this.closeSources()
    this.sources = DICT_KEYS.map((key) => {
      const fileName = found.get(key)
      if (!fileName) return null
      return this.openSource(key, fileName)
    }).filter((s): s is DictionarySource => s !== null)

    this.loaded = this.sources.length > 0
    return this.loaded
  }

  async downloadAll(force = false): Promise<{ downloaded: string[] }> {
    const dir = DICTIONARIES_DIR.pathname
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    const driveFiles = await this.listDriveFiles()
    const dctFiles = driveFiles.filter(
      (f) => f.name.endsWith('.mybible') || f.name.endsWith('.dct')
    )
    const downloaded: string[] = []

    for (const file of dctFiles) {
      if (!force && existsSync(`${dir}${file.name}`)) continue
      await this.downloadFile(file)
      downloaded.push(file.name)
    }

    await this.ensureLoaded()
    return { downloaded }
  }

  private excludeFilter(source: DictionarySource): string {
    return `"${source.wordColumn}" NOT LIKE 'Prefácio%' AND "${source.wordColumn}" NOT LIKE 'Sobre o Livro%' AND "${source.wordColumn}" NOT GLOB '[0-9].*'`
  }

  private runSearch(like: string | null, page: number, perPage: number): DictionarySearchResult {
    const offset = (page - 1) * perPage
    const groups: DictionaryGroup[] = []
    let total = 0

    for (const source of this.sources) {
      if (!source.db) continue
      const filter = this.excludeFilter(source)
      const where = like === null ? filter : `"${source.wordColumn}" LIKE ? AND ${filter}`
      const args: unknown[] = like === null ? [] : [`%${like.toUpperCase()}%`]

      const countRow = source.db
        .prepare(`SELECT COUNT(*) as total FROM "${source.tableName}" WHERE ${where}`)
        .get(...args) as { total: number }
      const rows = source.db
        .prepare(
          `SELECT "${source.wordColumn}" as word, "${source.definitionColumn}" as definition FROM "${source.tableName}" WHERE ${where} ORDER BY "${source.wordColumn}" ASC LIMIT ? OFFSET ?`
        )
        .all(...args, perPage, offset) as { word: string; definition: string }[]

      if (rows.length > 0) {
        groups.push({
          dictKey: source.dictKey,
          label: source.label,
          total: countRow.total,
          entries: rows.map((r) => ({ word: r.word, snippet: makeSnippet(r.definition) })),
        })
      }
      total += countRow.total
    }

    return { groups, total, page, perPage }
  }

  async search(query: string, page = 1, perPage = 50): Promise<DictionarySearchResult> {
    if (!(await this.ensureLoaded())) {
      await this.downloadAll()
    }
    return this.runSearch(query || null, page, perPage)
  }

  async getWord(word: string, dictKey?: string): Promise<DictionaryEntry | null> {
    if (!(await this.ensureLoaded())) {
      await this.downloadAll()
    }

    const sources = dictKey ? this.sources.filter((s) => s.dictKey === dictKey) : this.sources
    for (const source of sources) {
      if (!source.db) continue
      const row = source.db
        .prepare(
          `SELECT "${source.wordColumn}" as word, "${source.definitionColumn}" as definition FROM "${source.tableName}" WHERE "${source.wordColumn}" = ?`
        )
        .get(word) as { word: string; definition: string } | undefined
      if (row) {
        return { ...row, dictKey: source.dictKey, dictionary: source.label }
      }
    }
    return null
  }

  async getTotalCount(): Promise<number> {
    if (!(await this.ensureLoaded())) return 0
    let total = 0
    for (const source of this.sources) {
      if (!source.db) continue
      const where = this.excludeFilter(source)
      const row = source.db
        .prepare(`SELECT COUNT(*) as total FROM "${source.tableName}" WHERE ${where}`)
        .get() as { total: number }
      total += row.total
    }
    return total
  }

  async getStats(): Promise<{
    loaded: boolean
    total: number
    dictionaries: { dictKey: string; label: string; total: number }[]
  }> {
    const loaded = await this.ensureLoaded()
    if (!loaded) return { loaded: false, total: 0, dictionaries: [] }

    const dictionaries: { dictKey: string; label: string; total: number }[] = []
    let total = 0
    for (const source of this.sources) {
      if (!source.db) continue
      const where = this.excludeFilter(source)
      const row = source.db
        .prepare(`SELECT COUNT(*) as total FROM "${source.tableName}" WHERE ${where}`)
        .get() as { total: number }
      dictionaries.push({ dictKey: source.dictKey, label: source.label, total: row.total })
      total += row.total
    }
    return { loaded: true, total, dictionaries }
  }
}

export default new DictionaryService()
